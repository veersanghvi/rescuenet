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
    { name: 'City Animal Rescue', phone: '+1234567890', address: '123 Main St', lat: 37.7749, lng: -122.4194, radius: 20, accepting: 1, species: ['dog', 'cat', 'bird'] },
    { name: 'Wildlife Haven', phone: '+1987654321', address: '456 Forest Rd', lat: 37.7849, lng: -122.4094, radius: 50, accepting: 1, species: ['wildlife', 'bird'] },
    { name: 'Feline Friends', phone: '+1122334455', address: '789 Cat Alley', lat: 37.7649, lng: -122.4294, radius: 10, accepting: 1, species: ['cat'] },
    { name: 'Avian Rescue Center', phone: '+1555666777', address: '101 Skyway', lat: 37.7949, lng: -122.3994, radius: 30, accepting: 1, species: ['bird'] },
    { name: 'All Paws Sanctuary', phone: '+1888999000', address: '202 Country Rd', lat: 37.7549, lng: -122.4394, radius: 25, accepting: 0, species: ['dog', 'cat'] },
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
    const { lat, lng, species, radius } = req.query;
    
    let query = `
      SELECT n.*, GROUP_CONCAT(s.species) as species_list
      FROM ngos n
      LEFT JOIN ngo_species s ON n.id = s.ngo_id
      WHERE n.is_accepting_cases = 1
    `;
    const params: any[] = [];

    if (species) {
      query += ` AND n.id IN (SELECT ngo_id FROM ngo_species WHERE species = ?)`;
      params.push(species);
    }

    query += ` GROUP BY n.id`;

    const ngos = db.prepare(query).all(...params).map((ngo: any) => ({
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
