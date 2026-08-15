require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'map_user',
  password: process.env.DB_PASS || 'strongpassword',
  database: process.env.DB_NAME || 'map_temp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper to parse JSON fields safely
function safeParseJson(x){ try { return x ? JSON.parse(x) : null; } catch(e){ return x; } }

// MARKERS
app.get('/api/markers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM markers ORDER BY created_at DESC');
    res.json(rows.map(r=>({ ...r, meta: safeParseJson(r.meta) })));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/markers', async (req, res) => {
  const { title, lat, lon, meta } = req.body;
  if (typeof lat !== 'number' || typeof lon !== 'number') return res.status(400).json({ error: 'lat/lon required and must be numbers' });
  try {
    const [r] = await pool.query('INSERT INTO markers (title, lat, lon, meta) VALUES (?, ?, ?, ?)', [title || null, lat, lon, meta ? JSON.stringify(meta) : null]);
    const [rows] = await pool.query('SELECT * FROM markers WHERE id = ?', [r.insertId]);
    const row = rows[0];
    row.meta = safeParseJson(row.meta);
    res.status(201).json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/markers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM markers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// DRAWINGS
app.get('/api/drawings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM drawings ORDER BY created_at DESC');
    res.json(rows.map(r=>({ ...r, geojson: safeParseJson(r.geojson) })));
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/drawings', async (req, res) => {
  const { title, geojson } = req.body;
  if (!geojson) return res.status(400).json({ error: 'geojson required' });
  try {
    const [r] = await pool.query('INSERT INTO drawings (title, geojson) VALUES (?, ?)', [title || null, JSON.stringify(geojson)]);
    const [rows] = await pool.query('SELECT * FROM drawings WHERE id = ?', [r.insertId]);
    const row = rows[0];
    row.geojson = safeParseJson(row.geojson);
    res.status(201).json(row);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log('API listening on ' + port));
