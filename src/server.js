import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './config/db.js';
import eventoRoutes from './routes/eventoRoutes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:3001', 'http://localhost:3000'] }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/metadata', express.static('metadata'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/eventos', eventoRoutes);

try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('MariaDB conectado');
} catch (e) {
    console.error('Error conectando a MariaDB:', e.message);
    process.exit(1);
}

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
