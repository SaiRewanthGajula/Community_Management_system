// cms-backend/controllers/vehicleController.js
const db = require('../config/db');

exports.createVehicle = async (req, res) => {
  try {
    const { license_plate, model, color, parking_spot } = req.body;
    const userId = req.user.id;

    if (!license_plate || !model || !color) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await db.execute(
      'INSERT INTO vehicles (user_id, license_plate, model, color, parking_spot) VALUES (?, ?, ?, ?, ?)',
      [userId, license_plate, model, color, parking_spot || null]
    );

    res.status(201).json({
      id: result.insertId,
      user_id: userId,
      license_plate,
      model,
      color,
      parking_spot,
    });
  } catch (err) {
    console.error('Error creating vehicle:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.getVehicles = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let query = 'SELECT id, user_id, license_plate, model, color, parking_spot, created_at, updated_at FROM vehicles';
    let params = [];

    if (role !== 'admin') {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching vehicles:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { license_plate, model, color, parking_spot } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!license_plate || !model || !color) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let query = 'UPDATE vehicles SET license_plate = ?, model = ?, color = ?, parking_spot = ?, updated_at = NOW() WHERE id = ?';
    let params = [license_plate, model, color, parking_spot || null, id];

    if (role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }

    res.json({ id: Number(id), license_plate, model, color, parking_spot });
  } catch (err) {
    console.error('Error updating vehicle:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    let query = 'DELETE FROM vehicles WHERE id = ?';
    let params = [id];

    if (role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }

    res.json({ message: 'Vehicle deleted' });
  } catch (err) {
    console.error('Error deleting vehicle:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};