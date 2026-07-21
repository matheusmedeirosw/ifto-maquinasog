const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ifto-secret-key';
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run('PRAGMA foreign_keys = ON');
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      phone TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      hour TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const existingUser = await get('SELECT id FROM users LIMIT 1');
  if (!existingUser) {
    const passwordHash = bcrypt.hashSync('ifto1234', 10);
    await run(
      'INSERT INTO users (id, name, email, password, phone) VALUES (?, ?, ?, ?, ?)',
      ['default-server', 'Servidor IFTO Exemplo', 'servidor@ifto.edu.br', passwordHash, '']
    );
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
    const user = await get('SELECT id, name, email, phone FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
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

    const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await run(
      'INSERT INTO users (id, name, email, password, phone) VALUES (?, ?, ?, ?, ?)',
      [id, name, email.toLowerCase(), passwordHash, phone || '']
    );

    const token = createToken({ id, email: email.toLowerCase() });
    res.json({ token, user: { id, name, email: email.toLowerCase(), phone: phone || '' } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

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
    if (!name) {
      return res.status(400).json({ error: 'O nome é obrigatório.' });
    }
    const updatedPassword = password ? bcrypt.hashSync(password, 10) : undefined;
    await run(
      `UPDATE users SET name = ?, phone = ?${updatedPassword ? ', password = ?' : ''} WHERE id = ?`,
      updatedPassword ? [name, phone || '', updatedPassword, req.userId] : [name, phone || '', req.userId]
    );
    res.json({ user: { id: req.user.id, name, email: req.user.email, phone: phone || '' } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/devices', authenticate, async (req, res, next) => {
  try {
    const devices = await all('SELECT * FROM devices ORDER BY createdAt DESC');
    const reservations = await all(`
      SELECT r.id, r.deviceId, r.date, r.hour, r.createdAt, u.name AS userName, u.email AS userEmail
      FROM reservations r
      JOIN users u ON u.id = r.userId
      ORDER BY r.date, r.hour
    `);

    const grouped = reservations.reduce((acc, reservation) => {
      if (!acc[reservation.deviceId]) acc[reservation.deviceId] = [];
      acc[reservation.deviceId].push(reservation);
      return acc;
    }, {});

    const result = devices.map(device => ({
      ...device,
      reservations: grouped[device.id] || []
    }));

    res.json({ devices: result });
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices', authenticate, async (req, res, next) => {
  try {
    const { name, status } = req.body;
    if (!name || !status) {
      return res.status(400).json({ error: 'Nome e status do aparelho são obrigatórios.' });
    }
    const id = `device-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    await run(
      'INSERT INTO devices (id, name, status, createdAt) VALUES (?, ?, ?, ?)',
      [id, name.trim(), status, createdAt]
    );
    res.json({ device: { id, name: name.trim(), status, createdAt, reservations: [] } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/devices/:id/reserve', authenticate, loadUser, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, hour } = req.body;
    if (!date || !hour) {
      return res.status(400).json({ error: 'Data e horário são obrigatórios para reserva.' });
    }

    const device = await get('SELECT * FROM devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ error: 'Aparelho não encontrado.' });
    }

    if (device.status === 'Em manutenção') {
      return res.status(400).json({ error: 'Aparelho em manutenção não pode ser reservado.' });
    }
    if (device.status === 'Em uso') {
      return res.status(400).json({ error: 'Aparelho em uso não pode ser reservado.' });
    }

    const existing = await get(
      'SELECT id FROM reservations WHERE deviceId = ? AND date = ? AND hour = ?',
      [id, date, hour]
    );
    if (existing) {
      return res.status(409).json({ error: 'Horário já reservado para este aparelho.' });
    }

    const reservationId = `reservation-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    await run(
      'INSERT INTO reservations (id, deviceId, userId, date, hour, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [reservationId, id, req.userId, date, hour, createdAt]
    );

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
