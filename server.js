const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ifto-secret-key';

// Use DATABASE_URL or fall back to a local Postgres connection string for development
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING });

async function query(text, params = []) {
  const res = await pool.query(text, params);
  return res;
}

async function initDb() {
  // Create tables if not exists
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      phone TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      userId TEXT NOT NULL,
      date DATE NOT NULL,
      hour TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // seed default user if none exists
  const existing = await query('SELECT id FROM users LIMIT 1');
  if (existing.rowCount === 0) {
    const passwordHash = bcrypt.hashSync('ifto1234', 10);
    await query('INSERT INTO users (id, name, email, password, phone) VALUES ($1, $2, $3, $4, $5)', [
      'default-server', 'Servidor IFTO Exemplo', 'servidor@ifto.edu.br', passwordHash, ''
    ]);
  }
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  const token = authHeader.replace('Bearer ', '');
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
    req.userId = payload.id;
    next();
  });
}

async function loadUser(req, res, next) {
  try {
    const result = await query('SELECT id, name, email, phone FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/register', async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (!email.toLowerCase().endsWith('@ifto.edu.br')) {
      return res.status(400).json({ error: 'Use um e-mail válido do IFTO.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'E-mail já cadastrado.' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await query('INSERT INTO users (id, name, email, password, phone) VALUES ($1, $2, $3, $4, $5)', [
      id, name, email.toLowerCase(), passwordHash, phone || ''
    ]);

    const token = createToken({ id, email: email.toLowerCase() });
    res.json({ token, user: { id, name, email: email.toLowerCase(), phone: phone || '' } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

    const token = createToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone || '' } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/profile', authenticate, loadUser, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/profile', authenticate, loadUser, async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;
    if (!name) return res.status(400).json({ error: 'O nome é obrigatório.' });
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      await query('UPDATE users SET name = $1, phone = $2, password = $3 WHERE id = $4', [name, phone || '', hashed, req.userId]);
    } else {
      await query('UPDATE users SET name = $1, phone = $2 WHERE id = $3', [name, phone || '', req.userId]);
    }
    res.json({ user: { id: req.user.id, name, email: req.user.email, phone: phone || '' } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/devices', authenticate, async (req, res, next) => {
  try {
    const devicesRes = await query('SELECT * FROM devices ORDER BY createdAt DESC');
    const devices = devicesRes.rows;

    const reservationsRes = await query(`
      SELECT r.id, r.deviceid AS "deviceId", r.date, r.hour, r.createdat AS "createdAt", u.name AS "userName", u.email AS "userEmail"
      FROM reservations r
      JOIN users u ON u.id = r.userid
      ORDER BY r.date, r.hour
    `);

    const reservations = reservationsRes.rows;
    const grouped = reservations.reduce((acc, reservation) => {
      if (!acc[reservation.deviceId]) acc[reservation.deviceId] = [];
      acc[reservation.deviceId].push(reservation);
      return acc;
    }, {});

    const result = devices.map(device => ({ ...device, reservations: grouped[device.id] || [] }));
    res.json({ devices: result });
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices', authenticate, async (req, res, next) => {
  try {
    const { name, status } = req.body;
    if (!name || !status) return res.status(400).json({ error: 'Nome e status do aparelho são obrigatórios.' });
    const id = `device-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date();
    await query('INSERT INTO devices (id, name, status, createdAt) VALUES ($1, $2, $3, $4)', [id, name.trim(), status, createdAt]);
    res.json({ device: { id, name: name.trim(), status, createdAt, reservations: [] } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices/:id/reserve', authenticate, loadUser, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, hour } = req.body;
    if (!date || !hour) return res.status(400).json({ error: 'Data e horário são obrigatórios para reserva.' });

    const deviceRes = await query('SELECT * FROM devices WHERE id = $1', [id]);
    const device = deviceRes.rows[0];
    if (!device) return res.status(404).json({ error: 'Aparelho não encontrado.' });
    if (device.status === 'Em manutenção') return res.status(400).json({ error: 'Aparelho em manutenção não pode ser reservado.' });
    if (device.status === 'Em uso') return res.status(400).json({ error: 'Aparelho em uso não pode ser reservado.' });

    const existing = await query('SELECT id FROM reservations WHERE deviceId = $1 AND date = $2 AND hour = $3', [id, date, hour]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'Horário já reservado para este aparelho.' });

    const reservationId = `reservation-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date();
    await query('INSERT INTO reservations (id, deviceId, userId, date, hour, createdAt) VALUES ($1, $2, $3, $4, $5, $6)', [
      reservationId, id, req.userId, date, hour, createdAt
    ]);

    res.json({ reservation: { id: reservationId, deviceId: id, date, hour, userName: req.user.name, userEmail: req.user.email, createdAt } });
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor iniciado em http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error('Falha ao inicializar o banco de dados:', error);
    process.exit(1);
  });
