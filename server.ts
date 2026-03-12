import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: '.env.local' });

const db = new Database('rescue.db');
db.pragma('foreign_keys = ON');

// Initialize DB (only creates if not exists — never drops)
db.exec(`
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
`);

// Add reporter_token column if missing (migration for existing DBs)
try {
  db.exec(`ALTER TABLE cases ADD COLUMN reporter_token TEXT`);
} catch {
  // Column already exists, ignore
}

// Seed data
const stmt = db.prepare('SELECT COUNT(*) as count FROM ngos');
const { count } = stmt.get() as { count: number };
if (count === 0) {
  const insertNgo = db.prepare('INSERT INTO ngos (name, phone, address, lat, lng, coverage_radius, is_accepting_cases) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertSpecies = db.prepare('INSERT INTO ngo_species (ngo_id, species) VALUES (?, ?)');
  
  const seedNgos = [
    { name: 'People For Animals', phone: '+91 11 2371 9293', address: '14 Ashoka Road, New Delhi', lat: 28.6280, lng: 77.2197, radius: 50, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
    { name: 'Friendicoes SECA', phone: '+91 11 2431 5480', address: 'Jangpura, New Delhi', lat: 28.5846, lng: 77.2445, radius: 25, accepting: 1, species: ['dog', 'cat'] },
    { name: 'Sanjay Gandhi Animal Care Centre', phone: '+91 11 2374 3900', address: 'Raja Garden, New Delhi', lat: 28.6519, lng: 77.1168, radius: 30, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
    { name: 'Blue Cross of India', phone: '+91 44 2254 0758', address: 'Velachery Road, Guindy, Chennai', lat: 13.0067, lng: 80.2206, radius: 30, accepting: 1, species: ['dog', 'cat'] },
    { name: 'IDA India', phone: '+91 44 2441 2442', address: 'Besant Nagar, Chennai', lat: 12.9986, lng: 80.2669, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird'] },
    { name: 'CUPA Bangalore', phone: '+91 80 2557 1024', address: 'Veterinary College Campus, Hebbal, Bangalore', lat: 13.0358, lng: 77.5970, radius: 35, accepting: 1, species: ['dog', 'cat', 'wildlife'] },
    { name: 'Charlie\'s Animal Rescue Centre', phone: '+91 98450 24935', address: 'Sarjapur Road, Bangalore', lat: 12.9081, lng: 77.6736, radius: 25, accepting: 1, species: ['dog', 'cat', 'bird'] },
    { name: 'The Welfare of Stray Dogs', phone: '+91 22 2655 3812', address: 'Parel, Mumbai', lat: 18.9988, lng: 72.8400, radius: 30, accepting: 1, species: ['dog'] },
    { name: 'Red Paws Rescue', phone: '+91 90290 60022', address: 'Andheri West, Mumbai', lat: 19.1197, lng: 72.8464, radius: 20, accepting: 1, species: ['dog', 'cat'] },
    { name: 'Bombay SPCA', phone: '+91 22 2413 6053', address: 'Parel, Mumbai', lat: 19.0033, lng: 72.8426, radius: 35, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
    { name: 'Animal Aid Unlimited', phone: '+91 294 2490489', address: 'Badi Village, Udaipur', lat: 24.6222, lng: 73.6783, radius: 45, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
    { name: 'Wildlife SOS', phone: '+91 120 4538015', address: 'Agra-Mathura Road, Agra', lat: 27.3076, lng: 77.8557, radius: 60, accepting: 1, species: ['wildlife', 'bird'] },
    { name: 'Visakha SPCA', phone: '+91 891 254 6254', address: 'Maddilapalem, Visakhapatnam', lat: 17.7340, lng: 83.3152, radius: 30, accepting: 1, species: ['dog', 'cat', 'bird', 'wildlife'] },
    { name: 'Animal Rahat', phone: '+91 233 2321 405', address: 'Sangli, Maharashtra', lat: 16.8547, lng: 74.5646, radius: 40, accepting: 1, species: ['dog', 'wildlife'] },
    { name: 'PAWS Kolkata', phone: '+91 33 2486 1462', address: 'Tollygunge, Kolkata', lat: 22.4972, lng: 88.3473, radius: 30, accepting: 1, species: ['dog', 'cat', 'bird'] },
    { name: 'Karuna Society for Animals', phone: '+91 8518 277246', address: 'Puttaparthi, Andhra Pradesh', lat: 14.1650, lng: 77.8115, radius: 35, accepting: 1, species: ['dog', 'cat', 'wildlife'] },
    { name: 'Help in Suffering', phone: '+91 141 276 0013', address: 'Maharani Farm, Durgapura, Jaipur', lat: 26.8454, lng: 75.8191, radius: 30, accepting: 1, species: ['dog', 'cat'] },
    { name: 'PFA Dehradun', phone: '+91 135 274 2461', address: 'Vasant Vihar, Dehradun', lat: 30.3165, lng: 78.0322, radius: 25, accepting: 1, species: ['dog', 'cat', 'wildlife'] },
    { name: 'Jeev Ashram', phone: '+91 522 277 0888', address: 'Chinhat, Lucknow', lat: 26.8905, lng: 81.0245, radius: 25, accepting: 1, species: ['dog', 'cat', 'bird'] },
    { name: 'Krupa Animal Hospital', phone: '+91 79 2646 1182', address: 'Satellite, Ahmedabad', lat: 23.0225, lng: 72.5714, radius: 25, accepting: 1, species: ['dog', 'cat', 'bird'] },
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

  // --- NGO CRUD ---
  app.post('/api/ngos', (req, res) => {
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

  app.delete('/api/ngos/:id', (req, res) => {
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

  app.get('/api/cases', (req, res) => {
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

  app.patch('/api/cases/:id/status', (req, res) => {
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
  });
}

startServer();
