// backend/controllers/visitorController.js
const pool = require('../config/db');
const Joi = require('joi');

const generatePin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const validateCheckIn = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    email: Joi.string().email().optional(),
    address: Joi.string().max(200).optional(),
    purpose: Joi.string().max(100).required(),
    unit: Joi.string().max(50).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  next();
};

const validatePin = (req, res, next) => {
  const schema = Joi.object({
    pin: Joi.string().pattern(/^[0-9]{4}$/).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  next();
};

exports.checkIn = [validateCheckIn, async (req, res) => {
  if (!['resident'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only residents can register visitors' });
  }
  const { name, phone, email, address, purpose, unit } = req.body;
  const userId = req.user.id;
  const pin = generatePin();
  try {
    const [result] = await pool.query(
      `INSERT INTO visitors (name, phone, email, address, purpose, user_id, unit, pin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, address || null, purpose, userId, unit || null, pin]
    );
    const [rows] = await pool.query(`SELECT * FROM visitors WHERE id = ?`, [result.insertId]);
    console.log('CheckIn Response:', rows[0]); // Debug log
    res.status(201).json(rows[0]); // Return full row, including pin
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to register visitor' });
  }
}];

exports.verifyPin = [validatePin, async (req, res) => {
  if (!['security'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only security can verify PINs' });
  }
  const { id } = req.params;
  const { pin } = req.body;
  try {
    const [rows] = await pool.query(`SELECT pin, check_in FROM visitors WHERE id = ? AND check_out IS NULL`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found or already checked out' });
    }
    if (rows[0].pin !== pin) {
      return res.status(400).json({ error: 'Invalid PIN' });
    }
    if (!rows[0].check_in) {
      await pool.query(`UPDATE visitors SET check_in = CONVERT_TZ(NOW(), @@session.time_zone, '+05:30') WHERE id = ?`, [id]);
    }
    const [updated] = await pool.query(`SELECT * FROM visitors WHERE id = ?`, [id]);
    console.log('VerifyPin Response:', updated[0]); // Debug log
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to verify PIN' });
  }
}];

exports.checkOut = async (req, res) => {
  if (!['security'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only security can check out visitors' });
  }
  const { id } = req.params;
  try {
    const [existing] = await pool.query(`SELECT * FROM visitors WHERE id = ? AND check_out IS NULL`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Visitor not found or already checked out' });
    }
    await pool.query(`UPDATE visitors SET check_out = CONVERT_TZ(NOW(), @@session.time_zone, '+05:30') WHERE id = ?`, [id]);
    const [rows] = await pool.query(`SELECT * FROM visitors WHERE id = ?`, [id]);
    console.log('CheckOut Response:', rows[0]); // Debug log
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to check out visitor' });
  }
};

exports.getCurrent = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  try {
    let query = `SELECT * FROM visitors WHERE check_out IS NULL`;
    let params = [];
    if (role === 'resident') {
      query += ` AND user_id = ? AND check_in IS NOT NULL`;
      params.push(userId);
    } else if (role === 'security') {
      // Security sees all pending and checked-in visitors
      query += ` AND (check_in IS NULL OR (check_in IS NOT NULL AND check_out IS NULL))`;
    }
    query += ` ORDER BY id DESC`;
    const [rows] = await pool.query(query, params);
    console.log('GetCurrent Response:', rows); // Debug log
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch current visitors' });
  }
};

exports.getHistory = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  try {
    let query = `SELECT * FROM visitors`;
    let params = [];
    if (role === 'resident') {
      query += ` WHERE user_id = ?`;
      params.push(userId);
    }
    query += ` ORDER BY check_in DESC`;
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch visitor history' });
  }
};