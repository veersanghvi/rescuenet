import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

dotenv.config({ path: '.env.local' });

const dbPath = process.env.DB_PATH || 'rescue.db';
const dbDir = path.dirname(dbPath);
if (dbDir && dbDir !== '.') {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    // If a path is not writable (common on Render without a mounted disk),
    // continue and let SQLite open the file path or fail with a clearer DB error.
    console.warn(`Could not create DB directory ${dbDir}:`, (err as Error).message);
  }
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize DB (only creates if not exists — never drops)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'volunteer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ngos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    coverage_radius REAL NOT NULL,
    is_accepting_cases INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS ngo_species (
    ngo_id INTEGER NOT NULL,
    species TEXT NOT NULL,
    PRIMARY KEY (ngo_id, species),
    FOREIGN KEY (ngo_id) REFERENCES ngos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    species TEXT NOT NULL,
    description TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    reporter_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS case_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lost_found_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT NOT NULL CHECK(report_type IN ('lost', 'found')),
    species TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    area TEXT NOT NULL,
    last_seen_at TEXT,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add reporter_token column if missing (migration for existing DBs)
try {
  db.exec(`ALTER TABLE cases ADD COLUMN reporter_token TEXT`);
} catch {
  // Column already exists, ignore
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

// Seed default admin (admin / admin123)
const adminExists = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('admin') as { c: number };
if (adminExists.c === 0) {
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hashPassword('admin123'), 'admin');
}

// Seed data
const stmt = db.prepare('SELECT COUNT(*) as count FROM ngos');
const { count } = stmt.get() as { count: number };
if (count === 0) {
  const insertNgo = db.prepare('INSERT INTO ngos (name, phone, address, lat, lng, coverage_radius, is_accepting_cases) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertSpecies = db.prepare('INSERT INTO ngo_species (ngo_id, species) VALUES (?, ?)');
  
  const seedNgos = [
    // Dog & Cat general rescues
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

    // Cat-specific
    { name: 'Cat Boarding - MeoowLove', phone: '086928 09106', address: 'Sarova Building B-2, Thakur Village, Kandivali East, Mumbai 400101', lat: 19.2070, lng: 72.8600, radius: 15, accepting: 1, species: ['cat'] },
    { name: 'LiFelines Kittens', phone: '098347 91733', address: 'Behnur CHSL, Lokhandwala Circle, Andheri West, Mumbai 400053', lat: 19.1370, lng: 72.8290, radius: 15, accepting: 1, species: ['cat'] },

    // Bird-specific
    { name: 'Save Birds Free Treatment Centre (Malad)', phone: '084518 99899', address: 'Opposite RTO Office Subway, Malad West, Mumbai 400064', lat: 19.1890, lng: 72.8340, radius: 20, accepting: 1, species: ['bird'] },
    { name: 'MAA (Medical Aid For Birds)', phone: '098205 23802', address: 'Shop 9, Emerald Shopping Center, Andheri East, Mumbai 400069', lat: 19.1150, lng: 72.8700, radius: 15, accepting: 1, species: ['bird'] },
    { name: 'Save Birds Kandivali East', phone: '084518 99899', address: 'Damodar Wadi Main Gate, Kandivali East, Mumbai 400101', lat: 19.2070, lng: 72.8620, radius: 15, accepting: 1, species: ['bird'] },
    { name: 'HELP Animals & Birds Hospital', phone: '092233 33338', address: '11, Asok House, Nandalal Jani Rd, Masjid Bandar, Mumbai 400009', lat: 18.9680, lng: 72.8440, radius: 15, accepting: 1, species: ['bird', 'dog', 'cat'] },

    // Wildlife & snake rescue
    { name: 'RAWW (Resqink Association For Wildlife Welfare)', phone: '076666 80202', address: 'P&T Staff Colony, Mulund West, Mumbai 400080', lat: 19.1750, lng: 72.9500, radius: 30, accepting: 1, species: ['wildlife', 'bird'] },
    { name: 'Wildlife Welfare Association (WWA)', phone: '097573 22901', address: 'Koknipada, Manpada, Thane West, Thane 400610', lat: 19.2000, lng: 72.9700, radius: 25, accepting: 1, species: ['wildlife'] },
    { name: 'Snake Catcher Ashish', phone: '093247 92692', address: 'Room 103, Sangharsh Nagar, Chandivali, Powai, Mumbai 400072', lat: 19.1176, lng: 72.9060, radius: 20, accepting: 1, species: ['wildlife', 'bird'] },
    { name: 'Wildlife Rescuer / Snake Friend', phone: '074003 60576', address: 'Tata Nagar, Bhandup East, Mumbai 400042', lat: 19.1530, lng: 72.9380, radius: 20, accepting: 1, species: ['wildlife'] },
    { name: 'Animals Rescue & Rehab Wildlife Organization', phone: '095522 39243', address: 'Shop 69696, Shivaji Nagar Rd, Ambernath East, Maharashtra 421501', lat: 19.1860, lng: 73.1890, radius: 30, accepting: 1, species: ['wildlife'] },
  ];

  const insertMany = db.transaction((ngos) => {
    for (const ngo of ngos) {
      const info = insertNgo.run(ngo.name, ngo.phone, ngo.address, ngo.lat, ngo.lng, ngo.radius, ngo.accepting);
      for (const sp of ngo.species) {
        insertSpecies.run(info.lastInsertRowid, sp);
      }
    }
  });
  
  insertMany(seedNgos);
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
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Auth middleware — extracts user from session token
  function getUser(req: express.Request): { id: number; username: string; role: string } | null {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const session = db.prepare(`
      SELECT u.id, u.username, u.role FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `).get(token) as any;
    return session || null;
  }

  function requireRole(...roles: string[]) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = getUser(req);
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      if (!roles.includes(user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
      (req as any).user = user;
      next();
    };
  }

  // --- Auth Routes ---
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(user);
  });

  // Admin only: create volunteer accounts
  app.post('/api/auth/users', requireRole('admin'), (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (!['admin', 'volunteer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    try {
      const hash = hashPassword(password);
      const info = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
      res.status(201).json({ id: info.lastInsertRowid, username, role });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.get('/api/auth/users', requireRole('admin'), (_req, res) => {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  });

  app.delete('/api/auth/users/:id', requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const user = (req as any).user;
    if (Number(id) === user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    res.json({ success: true });
  });

  // API Routes
  app.get('/api/ngos', (req, res) => {
    const { lat, lng, species, radius, q, all } = req.query;
    
    const conditions: string[] = [];
    const params: any[] = [];

    if (!all) {
      conditions.push('n.is_accepting_cases = 1');
    }

    if (species) {
      conditions.push('n.id IN (SELECT ngo_id FROM ngo_species WHERE species = ?)');
      params.push(species);
    }

    if (q) {
      conditions.push('(n.name LIKE ? OR n.address LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term);
    }

    let sql = `
      SELECT n.*, GROUP_CONCAT(s.species) as species_list
      FROM ngos n
      LEFT JOIN ngo_species s ON n.id = s.ngo_id
    `;
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' GROUP BY n.id';

    const ngos = db.prepare(sql).all(...params).map((ngo: any) => ({
      ...ngo,
      species: ngo.species_list ? ngo.species_list.split(',') : []
    }));

    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const userRadius = radius ? parseFloat(radius as string) : Infinity;

      if (!isNaN(userLat) && !isNaN(userLng)) {
        const ngosWithDistance = ngos.map(ngo => {
          const distance = getDistance(userLat, userLng, ngo.lat, ngo.lng);
          return { ...ngo, distance };
        });

        const filteredAndSorted = ngosWithDistance
          .filter(ngo => ngo.distance <= ngo.coverage_radius && ngo.distance <= userRadius)
          .sort((a, b) => a.distance - b.distance);

        return res.json(filteredAndSorted);
      }
    }

    res.json(ngos);
  });

  // --- NGO CRUD (volunteer or admin) ---
  app.post('/api/ngos', requireRole('admin', 'volunteer'), (req, res) => {
    const { name, phone, address, lat, lng, coverage_radius, species } = req.body;

    if (!name || !phone || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const insertNgo = db.prepare('INSERT INTO ngos (name, phone, address, lat, lng, coverage_radius, is_accepting_cases) VALUES (?, ?, ?, ?, ?, ?, 1)');
    const insertSpecies = db.prepare('INSERT INTO ngo_species (ngo_id, species) VALUES (?, ?)');

    const transaction = db.transaction(() => {
      const info = insertNgo.run(name, phone, address, lat, lng, coverage_radius || 20);
      if (Array.isArray(species)) {
        for (const sp of species) {
          insertSpecies.run(info.lastInsertRowid, sp);
        }
      }
      return info.lastInsertRowid;
    });

    try {
      const id = transaction();
      res.status(201).json({ id });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create NGO' });
    }
  });

  app.delete('/api/ngos/:id', requireRole('admin', 'volunteer'), (req, res) => {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM ngos WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'NGO not found' });
    }
    res.json({ success: true });
  });

  // --- Cases ---
  app.post('/api/cases', (req, res) => {
    const { species, description, lat, lng } = req.body;
    
    if (!species || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate a simple tracking token
    const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    const insertCase = db.prepare('INSERT INTO cases (species, description, lat, lng, reporter_token) VALUES (?, ?, ?, ?, ?)');
    const insertUpdate = db.prepare('INSERT INTO case_updates (case_id, status, note) VALUES (?, ?, ?)');
    
    const transaction = db.transaction(() => {
      const info = insertCase.run(species, description || null, lat, lng, token);
      insertUpdate.run(info.lastInsertRowid, 'pending', 'Case created');
      return info.lastInsertRowid;
    });

    try {
      const caseId = transaction();
      res.status(201).json({ id: caseId, token });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create case' });
    }
  });

  app.get('/api/cases', requireRole('admin', 'volunteer'), (req, res) => {
    const cases = db.prepare('SELECT id, species, description, lat, lng, status, created_at FROM cases ORDER BY created_at DESC').all();
    res.json(cases);
  });

  // Public case tracking by token
  app.get('/api/cases/track/:token', (req, res) => {
    const { token } = req.params;
    const caseRow = db.prepare('SELECT id, species, description, lat, lng, status, created_at FROM cases WHERE reporter_token = ?').get(token) as any;
    if (!caseRow) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const updates = db.prepare('SELECT status, note, created_at FROM case_updates WHERE case_id = ? ORDER BY created_at ASC').all(caseRow.id);
    res.json({ ...caseRow, updates });
  });

  app.patch('/api/cases/:id/status', requireRole('admin', 'volunteer'), (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateCase = db.prepare('UPDATE cases SET status = ? WHERE id = ?');
    const insertUpdate = db.prepare('INSERT INTO case_updates (case_id, status, note) VALUES (?, ?, ?)');

    const transaction = db.transaction(() => {
      const result = updateCase.run(status, id);
      if (result.changes === 0) {
        throw new Error('Case not found');
      }
      insertUpdate.run(id, status, note || null);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      if (err.message === 'Case not found') {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Failed to update case status' });
      }
    }
  });

  // --- First-aid guidance ---
  app.get('/api/first-aid', (req, res) => {
    const species = String(req.query.species || 'other').toLowerCase();
    const safeSpecies = ['dog', 'cat', 'bird', 'wildlife'].includes(species) ? species : 'other';
    res.json({ species: safeSpecies, guide: FIRST_AID_GUIDES[safeSpecies] });
  });

  // --- Lost & Found ---
  app.get('/api/lost-found', (req, res) => {
    const { status, type, q } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status && ['open', 'resolved'].includes(String(status))) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (type && ['lost', 'found'].includes(String(type))) {
      conditions.push('report_type = ?');
      params.push(type);
    }

    if (q) {
      const term = `%${String(q).trim()}%`;
      conditions.push('(title LIKE ? OR area LIKE ? OR species LIKE ?)');
      params.push(term, term, term);
    }

    let sql = 'SELECT * FROM lost_found_posts';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY created_at DESC';

    const posts = db.prepare(sql).all(...params);
    res.json(posts);
  });

  app.post('/api/lost-found', (req, res) => {
    const {
      report_type,
      species,
      title,
      description,
      area,
      last_seen_at,
      contact_name,
      contact_phone
    } = req.body;

    if (!['lost', 'found'].includes(report_type)) {
      return res.status(400).json({ error: 'report_type must be lost or found' });
    }
    if (!species || !title || !area || !contact_name || !contact_phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const info = db.prepare(`
      INSERT INTO lost_found_posts (
        report_type, species, title, description, area, last_seen_at, contact_name, contact_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report_type,
      String(species).toLowerCase(),
      String(title).trim(),
      description ? String(description).trim() : null,
      String(area).trim(),
      last_seen_at ? String(last_seen_at) : null,
      String(contact_name).trim(),
      String(contact_phone).trim()
    );

    res.status(201).json({ id: info.lastInsertRowid });
  });

  app.patch('/api/lost-found/:id/status', requireRole('admin', 'volunteer'), (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = db.prepare('UPDATE lost_found_posts SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ success: true });
  });

  // --- Gemini Search Proxy (keeps API key server-side) ---
  app.post('/api/search', async (req, res) => {
    const { query, lat, lng } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Search service not configured' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const config: any = {
        tools: [{ googleSearch: {} }],
      };
      
      if (lat !== undefined && lng !== undefined) {
        config.tools.unshift({ googleMaps: {} });
        config.toolConfig = {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Find animal rescue NGOs, shelters, or veterinary clinics matching this search: "${query}". Provide their names, addresses, and contact numbers. Return a helpful and concise summary.`,
        config
      });

      const text = response.text || '';
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      res.json({ text, chunks });
    } catch (err) {
      console.error('Gemini search error:', err);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    // SPA fallback — serve index.html for client-side routes
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`DB path: ${dbPath}`);
  });
}

startServer();
