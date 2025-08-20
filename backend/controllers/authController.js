const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  const { name, phone_number, password, role, unit, employee_id } = req.body;

  try {
    if (!name || !phone_number || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['resident', 'security', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (name, phone_number, password_hash, role, unit, employee_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone_number, password_hash, role, unit || null, employee_id || null]
    );

    const token = jwt.sign({ id: result.insertId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ id: result.insertId, name, phone_number, role, unit, employee_id, token });
  } catch (err) {
    console.error('Error during signup:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.login = async (req, res) => {
  const { phone_number, password, role } = req.body;

  try {
    if (!phone_number || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE phone_number = ? AND role = ?', [phone_number, role]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      role: user.role,
      unit: user.unit,
      employee_id: user.employee_id,
      token,
    });
  } catch (err) {
    console.error('Error during login:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};