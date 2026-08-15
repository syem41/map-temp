import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Pool de conexiones MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Crear tabla al iniciar
async function initDB() {
  try {
    const conn = await pool.getConnection();
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS traces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        geojson LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    conn.release();
    console.log('✓ Base de datos inicializada');
  } catch (err) {
    console.error('Error inicializando DB:', err);
    process.exit(1);
  }
}

// Endpoint: Guardar trazos
app.post('/api/save-traces', async (req, res) => {
  try {
    const { features } = req.body;
    const geojson = JSON.stringify({ type: 'FeatureCollection', features });
    
    const conn = await pool.getConnection();
    
    // Borrar trazos antiguos e insertar nuevos (para simplificar)
    await conn.execute('DELETE FROM traces');
    await conn.execute('INSERT INTO traces (geojson) VALUES (?)', [geojson]);
    
    conn.release();
    res.json({ success: true, message: 'Trazos guardados' });
  } catch (err) {
    console.error('Error guardando trazos:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Obtener trazos guardados
app.get('/api/get-traces', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT geojson FROM traces ORDER BY updated_at DESC LIMIT 1');
    conn.release();
    
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].geojson));
    } else {
      res.json({ type: 'FeatureCollection', features: [] });
    }
  } catch (err) {
    console.error('Error obteniendo trazos:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Iniciar servidor
initDB().then(() => {
  app.listen(port, () => {
    console.log(`✓ Servidor escuchando en puerto ${port}`);
  });
});

