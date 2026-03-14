import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: '.env.local' });

// --- Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- PostgreSQL pool (Neon) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

// --- Multer memory storage (no disk — uploaded straight to Cloudinary) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { cb(null, true); return; }
    cb(new Error('Only image uploads are allowed'));
  },
});

async function uploadToCloudinary(file: Express.Multer.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'rescuenear', resource_type: 'image' },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Cloudinary upload failed'));
        else resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

// --- DB schema init ---
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'volunteer')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ngos (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      coverage_radius DOUBLE PRECISION NOT NULL,
      is_accepting_cases INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ngo_species (
      ngo_id INTEGER NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
      species TEXT NOT NULL,
      PRIMARY KEY (ngo_id, species)
    );

    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      species TEXT NOT NULL,
      description TEXT,
      photo_url TEXT,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      status TEXT DEFAULT 'pending',
      reporter_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS case_updates (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lost_found_posts (
      id SERIAL PRIMARY KEY,
      report_type TEXT NOT NULL CHECK(report_type IN ('lost', 'found')),
      species TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      photo_url TEXT,
      area TEXT NOT NULL,
      last_seen_at TEXT,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe column migrations for existing tables
  await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS reporter_token TEXT`);
  await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS photo_url TEXT`);
  await pool.query(`ALTER TABLE lost_found_posts ADD COLUMN IF NOT EXISTS photo_url TEXT`);
}

// Password hashing
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const FIRST_AID_GUIDES: Record<string, { title: string; urgent: string[]; avoid: string[]; supplies: string[] }> = {
  dog: {
    title: 'Injured Dog',
    urgent: [
      'Keep distance if the dog is frightened; use a cloth as a visual barrier.',
      'Move traffic away and create a quiet perimeter around the animal.',
      'If bleeding, apply gentle pressure with clean cloth for 5 to 10 minutes.',
      'Offer water only if the dog is alert and can swallow normally.'
    ],
    avoid: [
      'Do not force food or medicines.',
      'Do not lift by the legs or neck.',
      'Do not crowd the animal with multiple people.'
    ],
    supplies: ['Clean cloth or gauze', 'Bottle of water', 'Cardboard box or blanket', 'Phone torch at night']
  },
  cat: {
    title: 'Injured Cat',
    urgent: [
      'Approach slowly and speak softly to reduce panic.',
      'Use a towel to wrap and stabilize before moving.',
      'Keep the cat warm in a ventilated box.',
      'Share exact lane/building landmark with rescuers.'
    ],
    avoid: [
      'Do not chase a hiding cat into unsafe areas.',
      'Do not handle with bare hands if aggressive.',
      'Do not keep in direct heat or sun.'
    ],
    supplies: ['Large towel', 'Ventilated carton', 'Drinking water', 'Flashlight']
  },
  bird: {
    title: 'Injured Bird',
    urgent: [
      'Place the bird in a dark, quiet box with air holes.',
      'Keep handling time minimal to reduce stress.',
      'If wing appears fractured, restrict movement and wait for trained support.',
      'Note nearby wires, fans, or glass risks for responders.'
    ],
    avoid: [
      'Do not feed milk or bread.',
      'Do not pour water directly into the beak.',
      'Do not release a stunned bird immediately.'
    ],
    supplies: ['Small box with holes', 'Soft cloth', 'Safe corner indoors', 'Responder contact ready']
  },
  wildlife: {
    title: 'Wildlife Emergency',
    urgent: [
      'Maintain maximum distance and keep onlookers away.',
      'Secure pets and children immediately.',
      'Track location from a safe point until experts arrive.',
      'Share photos only if it is safe to take them from afar.'
    ],
    avoid: [
      'Do not attempt rescue without trained handlers.',
      'Do not provoke, corner, or trap the animal.',
      'Do not use sticks or loud sounds.'
    ],
    supplies: ['Safe distance marker', 'Phone camera zoom', 'Area isolation support', 'Local wildlife helpline']
  },
  other: {
    title: 'General Rescue First Steps',
    urgent: [
      'Prioritize scene safety for both people and animal.',
      'Limit noise and movement around the animal.',
      'Document species, condition, and exact location.',
      'Contact nearest rescue service with clear landmarks.'
    ],
    avoid: [
      'Do not crowd the scene.',
      'Do not attempt risky medical treatment.',
      'Do not delay contacting professionals.'
    ],
    supplies: ['Clean cloth', 'Water', 'Location pin', 'Torch at night']
  }
};

// --- Seed ---
async function seedData() {
  const adminCheck = await pool.query('SELECT COUNT(*) as c FROM users WHERE role = $1', ['admin']);
  if (parseInt(adminCheck.rows[0].c, 10) === 0) {
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      ['admin', hashPassword('admin123'), 'admin']
    );
  }

  const ngoCount = await pool.query('SELECT COUNT(*) as c FROM ngos');
  if (parseInt(ngoCount.rows[0].c, 10) === 0) {
    const seedNgos = [
      { name: 'Helping Hands Animal Welfare Foundation', phone: '088502 85889', address: 'RB2 Central Railway Quarters, Sion West, Mumbai 400022', lat: 19.0440, lng: 72.8620, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Pawpulation Control (Mission Compassion Foundation)', phone: '099874 38980', address: '105, Rebello House, C.T.S Road, Santacruz East, Mumbai 400029', lat: 19.0796, lng: 72.8565, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'HOPE FOUNDATION (House Of Paws Endearment)', phone: '081695 80661', address: 'Shop no 241, Ramabaiwadi, Mulund West, Mumbai 400080', lat: 19.1726, lng: 72.9560, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Gully Stray Care', phone: '093232 63322', address: 'Shop No. 386, Hill No. 4, Azad Nagar, Ghatkopar West, Mumbai 400086', lat: 19.0870, lng: 72.9080, radius: 12, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Animal Rescue & Shelter Foundation', phone: '098202 77824', address: '8-A, PARTH CHS, MMRDA Colony, Andheri East, Mumbai 400615', lat: 19.1197, lng: 72.8710, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
      { name: 'Rroaming Paws Foundation', phone: '091751 13013', address: '10-11, RSC Rd Number 10, Charkop, Kandivali West, Mumbai 400067', lat: 19.2050, lng: 72.8400, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Sharanam Animal Care and Rescue Center', phone: '091361 58595', address: 'Koliwada, Thane West, Thane 400615', lat: 19.2183, lng: 72.9781, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
      { name: 'Youth Organisation In Defence Of Animals (YODA)', phone: '080 6268 9333', address: 'Chikuwadi Rd, off Marve Road, Malad West, Mumbai 400095', lat: 19.1870, lng: 72.8220, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
      { name: 'Animal Matter To Me (AMTM)', phone: '099207 37737', address: 'CTS 166-167 Ashram, Madh-Marve Rd, Malad West, Mumbai 400061', lat: 19.2010, lng: 72.8120, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
      { name: 'All About Them', phone: '091367 82348', address: '15, Dr Elijah Moses Rd, Worli Naka, Mumbai 400018', lat: 19.0170, lng: 72.8150, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'PawTalk | Animal Communication & Rescue', phone: '081699 47599', address: 'Samarth Nagar, Chunabhatti, Sion, Mumbai 400022', lat: 19.0430, lng: 72.8670, radius: 12, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Apna Home Animal Shelter', phone: '093221 91638', address: 'Taloja, Siddhi Karavale, Maharashtra 410208', lat: 19.0650, lng: 73.1200, radius: 25, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Raksha Animal Welfare Center', phone: '090821 98551', address: 'Unit 29, Laxmi Woollen Mill, Shakti Mills Ln, Worli, Mumbai 400011', lat: 19.0100, lng: 72.8250, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Freedom Farm (Citizens for Animal Protection)', phone: '093246 10601', address: 'Unnathi Woods Rd, Kasarvadavali, Thane West, Thane 400615', lat: 19.2400, lng: 72.9650, radius: 25, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
      { name: 'The Welfare Of Stray Dogs', phone: '089760 22838', address: 'Tokershi Jivraj Rd, Sewri West, Mumbai 400015', lat: 19.0020, lng: 72.8580, radius: 20, accepting: 1, species: ['dog'] },
      { name: 'IDA India - Deonar', phone: '093200 56581', address: 'Near Deonar Colony, Baiganwadi, Deonar, Mumbai 400043', lat: 19.0560, lng: 72.9100, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird'] },
      { name: 'Dr. Deepa Katyal\'s AWRC', phone: '098197 42557', address: 'Bungalow 29, NB Patil Marg, Chembur, Mumbai 400071', lat: 19.0620, lng: 72.8980, radius: 15, accepting: 1, species: ['dog', 'cat'] },
      { name: 'Cat Boarding - MeoowLove', phone: '086928 09106', address: 'Sarova Building B-2, Thakur Village, Kandivali East, Mumbai 400101', lat: 19.2070, lng: 72.8600, radius: 15, accepting: 1, species: ['cat'] },
      { name: 'LiFelines Kittens', phone: '098347 91733', address: 'Behnur CHSL, Lokhandwala Circle, Andheri West, Mumbai 400053', lat: 19.1370, lng: 72.8290, radius: 15, accepting: 1, species: ['cat'] },
      { name: 'Save Birds Free Treatment Centre (Malad)', phone: '084518 99899', address: 'Opposite RTO Office Subway, Malad West, Mumbai 400064', lat: 19.1890, lng: 72.8340, radius: 20, accepting: 1, species: ['bird'] },
      { name: 'MAA (Medical Aid For Birds)', phone: '098205 23802', address: 'Shop 9, Emerald Shopping Center, Andheri East, Mumbai 400069', lat: 19.1150, lng: 72.8700, radius: 15, accepting: 1, species: ['bird'] },
      { name: 'Save Birds Kandivali East', phone: '084518 99899', address: 'Damodar Wadi Main Gate, Kandivali East, Mumbai 400101', lat: 19.2070, lng: 72.8620, radius: 15, accepting: 1, species: ['bird'] },
      { name: 'HELP Animals & Birds Hospital', phone: '092233 33338', address: '11, Asok House, Nandalal Jani Rd, Masjid Bandar, Mumbai 400009', lat: 18.9680, lng: 72.8440, radius: 15, accepting: 1, species: ['bird', 'dog', 'cat'] },
      { name: 'RAWW (Resqink Association For Wildlife Welfare)', phone: '076666 80202', address: 'P&T Staff Colony, Mulund West, Mumbai 400080', lat: 19.1750, lng: 72.9500, radius: 30, accepting: 1, species: ['wildlife', 'bird'] },
      { name: 'Wildlife Welfare Association (WWA)', phone: '097573 22901', address: 'Koknipada, Manpada, Thane West, Thane 400610', lat: 19.2000, lng: 72.9700, radius: 25, accepting: 1, species: ['wildlife'] },
      { name: 'Snake Catcher Ashish', phone: '093247 92692', address: 'Room 103, Sangharsh Nagar, Chandivali, Powai, Mumbai 400072', lat: 19.1176, lng: 72.9060, radius: 20, accepting: 1, species: ['wildlife', 'bird'] },
      { name: 'Wildlife Rescuer / Snake Friend', phone: '074003 60576', address: 'Tata Nagar, Bhandup East, Mumbai 400042', lat: 19.1530, lng: 72.9380, radius: 20, accepting: 1, species: ['wildlife'] },
      { name: 'Animals Rescue & Rehab Wildlife Organization', phone: '095522 39243', address: 'Shop 69696, Shivaji Nagar Rd, Ambernath East, Maharashtra 421501', lat: 19.1860, lng: 73.1890, radius: 30, accepting: 1, species: ['wildlife'] },
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const ngo of seedNgos) {
        const r = await client.query(
          'INSERT INTO ngos (name, phone, address, lat, lng, coverage_radius, is_accepting_cases) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [ngo.name, ngo.phone, ngo.address, ngo.lat, ngo.lng, ngo.radius, ngo.accepting]
        );
        const ngoId = r.rows[0].id;
        for (const sp of ngo.species) {
          await client.query('INSERT INTO ngo_species (ngo_id, species) VALUES ($1, $2)', [ngoId, sp]);
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

// Haversine formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; // Distance in km
  return d;
}

async function startServer() {
  await initDb();
  await seedData();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  const uploadImageIfPresent: express.RequestHandler = (req, res, next) => {
    if (!req.is('multipart/form-data')) { next(); return; }
    upload.single('photo')(req, res, (err) => {
      if (!err) { next(); return; }
      const code = (err as any)?.code;
      if (code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'Image must be 500KB or smaller' }); return; }
      res.status(400).json({ error: (err as any).message || 'Photo upload failed' });
    });
  };

  async function getUser(req: express.Request): Promise<{ id: number; username: string; role: string } | null> {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const r = await pool.query(
      `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1`,
      [token]
    );
    return r.rows[0] || null;
  }

  function requireRole(...roles: string[]) {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const user = await getUser(req);
        if (!user) { res.status(401).json({ error: 'Not authenticated' }); return; }
        if (!roles.includes(user.role)) { res.status(403).json({ error: 'Insufficient permissions' }); return; }
        (req as any).user = user;
        next();
      } catch {
        res.status(500).json({ error: 'Auth error' });
      }
    };
  }

  // --- Auth ---
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) { res.status(400).json({ error: 'Username and password required' }); return; }
      const r = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = r.rows[0];
      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials' }); return;
      }
      const token = generateToken();
      await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch { res.status(500).json({ error: 'Login failed' }); }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Logout failed' }); }
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) { res.status(401).json({ error: 'Not authenticated' }); return; }
      res.json(user);
    } catch { res.status(500).json({ error: 'Auth check failed' }); }
  });

  app.post('/api/auth/users', requireRole('admin'), async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) { res.status(400).json({ error: 'Username and password required' }); return; }
      if (!['admin', 'volunteer'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
      const r = await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        [username, hashPassword(password), role]
      );
      res.status(201).json({ id: r.rows[0].id, username, role });
    } catch (err: any) {
      if (err.code === '23505') { res.status(409).json({ error: 'Username already exists' }); return; }
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.get('/api/auth/users', requireRole('admin'), async (_req, res) => {
    try {
      const r = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
      res.json(r.rows);
    } catch { res.status(500).json({ error: 'Failed to get users' }); }
  });

  app.delete('/api/auth/users/:id', requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      if (Number(id) === user.id) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }
      const r = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      if (r.rowCount === 0) { res.status(404).json({ error: 'User not found' }); return; }
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete user' }); }
  });

  // --- NGOs ---
  app.get('/api/ngos', async (req, res) => {
    try {
      const { lat, lng, species, radius, q, all } = req.query;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (!all) conditions.push('n.is_accepting_cases = 1');

      if (species) {
        conditions.push(`n.id IN (SELECT ngo_id FROM ngo_species WHERE species = $${paramIdx++})`);
        params.push(species);
      }
      if (q) {
        conditions.push(`(n.name ILIKE $${paramIdx} OR n.address ILIKE $${paramIdx + 1})`);
        params.push(`%${q}%`, `%${q}%`);
        paramIdx += 2;
      }

      let sql = `
        SELECT n.id, n.name, n.phone, n.address, n.lat, n.lng, n.coverage_radius, n.is_accepting_cases,
               STRING_AGG(s.species, ',') as species_list
        FROM ngos n LEFT JOIN ngo_species s ON n.id = s.ngo_id
      `;
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' GROUP BY n.id, n.name, n.phone, n.address, n.lat, n.lng, n.coverage_radius, n.is_accepting_cases';

      const result = await pool.query(sql, params);
      const ngos = result.rows.map((ngo: any) => ({
        ...ngo,
        species: ngo.species_list ? ngo.species_list.split(',') : [],
      }));

      if (lat && lng) {
        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);
        const userRadius = radius ? parseFloat(radius as string) : Infinity;
        if (!isNaN(userLat) && !isNaN(userLng)) {
          const withDist = ngos.map(n => ({ ...n, distance: getDistance(userLat, userLng, n.lat, n.lng) }));
          res.json(withDist.filter(n => n.distance <= n.coverage_radius && n.distance <= userRadius).sort((a, b) => a.distance - b.distance));
          return;
        }
      }
      res.json(ngos);
    } catch { res.status(500).json({ error: 'Failed to load NGOs' }); }
  });

  app.post('/api/ngos', requireRole('admin'), async (req, res) => {
    try {
      const { name, phone, address, lat, lng, coverage_radius, species } = req.body;
      if (!name || !phone || !address || lat === undefined || lng === undefined) {
        res.status(400).json({ error: 'Missing required fields' }); return;
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await client.query(
          'INSERT INTO ngos (name, phone, address, lat, lng, coverage_radius, is_accepting_cases) VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING id',
          [name, phone, address, lat, lng, coverage_radius || 20]
        );
        const ngoId = r.rows[0].id;
        if (Array.isArray(species)) {
          for (const sp of species) await client.query('INSERT INTO ngo_species (ngo_id, species) VALUES ($1, $2)', [ngoId, sp]);
        }
        await client.query('COMMIT');
        res.status(201).json({ id: ngoId });
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch { res.status(500).json({ error: 'Failed to create NGO' }); }
  });

  app.delete('/api/ngos/:id', requireRole('admin'), async (req, res) => {
    try {
      const r = await pool.query('DELETE FROM ngos WHERE id = $1', [req.params.id]);
      if (r.rowCount === 0) { res.status(404).json({ error: 'NGO not found' }); return; }
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete NGO' }); }
  });

  // --- Cases ---
  app.post('/api/cases', uploadImageIfPresent, async (req, res) => {
    try {
      const { species, description } = req.body;
      const lat = Number(req.body.lat);
      const lng = Number(req.body.lng);
      if (!species || Number.isNaN(lat) || Number.isNaN(lng)) {
        res.status(400).json({ error: 'Missing required fields' }); return;
      }
      let photo_url: string | null = null;
      if ((req as any).file && process.env.CLOUDINARY_API_KEY) {
        photo_url = await uploadToCloudinary((req as any).file);
      }
      const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const client = await pool.connect();
      let caseId: number;
      try {
        await client.query('BEGIN');
        const r = await client.query(
          'INSERT INTO cases (species, description, photo_url, lat, lng, reporter_token) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [species, description || null, photo_url, lat, lng, token]
        );
        caseId = r.rows[0].id;
        await client.query('INSERT INTO case_updates (case_id, status, note) VALUES ($1, $2, $3)', [caseId, 'pending', 'Case created']);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
      res.status(201).json({ id: caseId!, token });
    } catch { res.status(500).json({ error: 'Failed to create case' }); }
  });

  app.get('/api/cases', requireRole('admin', 'volunteer'), async (_req, res) => {
    try {
      const r = await pool.query('SELECT id, species, description, photo_url, lat, lng, status, created_at FROM cases ORDER BY created_at DESC');
      res.json(r.rows);
    } catch { res.status(500).json({ error: 'Failed to load cases' }); }
  });

  app.get('/api/cases/track/:token', async (req, res) => {
    try {
      const caseRes = await pool.query(
        'SELECT id, species, description, photo_url, lat, lng, status, created_at FROM cases WHERE reporter_token = $1',
        [req.params.token]
      );
      const caseRow = caseRes.rows[0];
      if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return; }
      const updatesRes = await pool.query(
        'SELECT status, note, created_at FROM case_updates WHERE case_id = $1 ORDER BY created_at ASC',
        [caseRow.id]
      );
      res.json({ ...caseRow, updates: updatesRes.rows });
    } catch { res.status(500).json({ error: 'Failed to load case' }); }
  });

  app.patch('/api/cases/:id/status', requireRole('admin', 'volunteer'), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      if (!status) { res.status(400).json({ error: 'Status is required' }); return; }
      if (!['pending', 'in_progress', 'resolved'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await client.query('UPDATE cases SET status = $1 WHERE id = $2', [status, id]);
        if (r.rowCount === 0) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Case not found' }); return; }
        await client.query('INSERT INTO case_updates (case_id, status, note) VALUES ($1, $2, $3)', [id, status, note || null]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to update case status' }); }
  });

  // --- First-aid ---
  app.get('/api/first-aid', (req, res) => {
    const species = String(req.query.species || 'other').toLowerCase();
    const safeSpecies = ['dog', 'cat', 'bird', 'wildlife'].includes(species) ? species : 'other';
    res.json({ species: safeSpecies, guide: FIRST_AID_GUIDES[safeSpecies] });
  });

  // --- Lost & Found ---
  app.get('/api/lost-found', async (req, res) => {
    try {
      const { status, type, q } = req.query;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (status && ['open', 'resolved'].includes(String(status))) { conditions.push(`status = $${paramIdx++}`); params.push(status); }
      if (type && ['lost', 'found'].includes(String(type))) { conditions.push(`report_type = $${paramIdx++}`); params.push(type); }
      if (q) {
        const term = `%${String(q).trim()}%`;
        conditions.push(`(title ILIKE $${paramIdx} OR area ILIKE $${paramIdx + 1} OR species ILIKE $${paramIdx + 2})`);
        params.push(term, term, term);
        paramIdx += 3;
      }

      let sql = 'SELECT * FROM lost_found_posts';
      if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
      sql += ' ORDER BY created_at DESC';
      const r = await pool.query(sql, params);
      res.json(r.rows);
    } catch { res.status(500).json({ error: 'Failed to load posts' }); }
  });

  app.post('/api/lost-found', uploadImageIfPresent, async (req, res) => {
    try {
      const { report_type, species, title, description, area, last_seen_at, contact_name, contact_phone } = req.body;
      if (!['lost', 'found'].includes(report_type)) { res.status(400).json({ error: 'report_type must be lost or found' }); return; }
      if (!species || !title || !area || !contact_name || !contact_phone) { res.status(400).json({ error: 'Missing required fields' }); return; }

      let photo_url: string | null = null;
      if ((req as any).file && process.env.CLOUDINARY_API_KEY) {
        photo_url = await uploadToCloudinary((req as any).file);
      }

      const r = await pool.query(
        `INSERT INTO lost_found_posts (report_type, species, title, description, photo_url, area, last_seen_at, contact_name, contact_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [report_type, String(species).toLowerCase(), String(title).trim(),
          description ? String(description).trim() : null, photo_url,
          String(area).trim(), last_seen_at ? String(last_seen_at) : null,
          String(contact_name).trim(), String(contact_phone).trim()]
      );
      res.status(201).json({ id: r.rows[0].id });
    } catch { res.status(500).json({ error: 'Failed to create post' }); }
  });

  app.patch('/api/lost-found/:id/status', requireRole('admin', 'volunteer'), async (req, res) => {
    try {
      const { status } = req.body;
      if (!['open', 'resolved'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
      const r = await pool.query('UPDATE lost_found_posts SET status = $1 WHERE id = $2', [status, req.params.id]);
      if (r.rowCount === 0) { res.status(404).json({ error: 'Post not found' }); return; }
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to update post' }); }
  });

  // --- Gemini Search Proxy ---
  app.post('/api/search', async (req, res) => {
    const { query, lat, lng } = req.body;
    if (!query) { res.status(400).json({ error: 'Query is required' }); return; }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { res.status(500).json({ error: 'Search service not configured' }); return; }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const config: any = { tools: [{ googleSearch: {} }] };
      if (lat !== undefined && lng !== undefined) {
        config.tools.unshift({ googleMaps: {} });
        config.toolConfig = { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } };
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Find animal rescue NGOs, shelters, or veterinary clinics matching this search: "${query}". Provide their names, addresses, and contact numbers. Return a helpful and concise summary.`,
        config,
      });
      res.json({ text: response.text || '', chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] });
    } catch (err) {
      console.error('Gemini search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => { res.sendFile('index.html', { root: 'dist' }); });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${process.env.DATABASE_URL ? 'PostgreSQL (Neon)' : 'LOCAL — no DATABASE_URL set'}`);
  });
}

startServer();
