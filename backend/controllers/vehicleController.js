const db = require('../config/db');

exports.createVehicle = async (req, res) => {
  try {
    const { license_plate, model, color, parking_spot } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== 'resident' && role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to create vehicle' });
    }

    if (!license_plate || !model || !color) {
      return res.status(400).json({ error: 'Missing required fields: license_plate, model, color' });
    }

    if (typeof license_plate !== 'string' || license_plate.length > 20) {
      return res.status(400).json({ error: 'Invalid license plate (max 20 characters)' });
    }

    let finalParkingSpot = parking_spot || null;
    if (role === 'resident') {
      const [user] = await db.execute('SELECT unit FROM users WHERE id = ?', [userId]);
      if (!user[0]?.unit) {
        return res.status(400).json({ error: 'User unit not found' });
      }
      finalParkingSpot = user[0].unit;
      console.log(`Auto-filling parking_spot with unit: ${finalParkingSpot} for user ${userId}`); // Debug log
    }

    const [result] = await db.execute(
      'INSERT INTO vehicles (user_id, license_plate, model, color, parking_spot) VALUES (?, ?, ?, ?, ?)',
      [userId, license_plate.trim().toUpperCase(), model.trim(), color.trim(), finalParkingSpot]
    );

    const vehicleId = result.insertId;
    const [newVehicle] = await db.execute(
      'SELECT v.id, v.user_id, v.license_plate, v.model, v.color, v.parking_spot, v.created_at, v.updated_at, u.unit, u.phone_number ' +
      'FROM vehicles v LEFT JOIN users u ON v.user_id = u.id WHERE v.id = ?',
      [vehicleId]
    );

    console.log('Created vehicle:', newVehicle[0]); // Debug log
    res.status(201).json(newVehicle[0]);
  } catch (err) {
    console.error('Error creating vehicle:', err.message, err.stack);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'License plate already registered' });
    }
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.getVehicles = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    let query = `
      SELECT v.id, v.user_id, v.license_plate, v.model, v.color, 
             COALESCE(v.parking_spot, u.unit) as parking_spot, 
             v.created_at, v.updated_at, u.unit, u.phone_number
      FROM vehicles v
      LEFT JOIN users u ON v.user_id = u.id
    `;
    let params = [];

    if (role === 'resident') {
      query += ' WHERE v.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    console.log('Fetching vehicles with query:', query, 'params:', params); // Debug log
    const [rows] = await db.execute(query, params);
    console.log('Vehicles fetched:', rows); // Debug log

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM vehicles${role === 'resident' ? ' WHERE user_id = ?' : ''}`,
      role === 'resident' ? [userId] : []
    );

    res.json({
      vehicles: rows,
      total: countResult[0].total,
      limit,
      offset,
    });
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
      return res.status(400).json({ error: 'Missing required fields: license_plate, model, color' });
    }

    if (typeof license_plate !== 'string' || license_plate.length > 20) {
      return res.status(400).json({ error: 'Invalid license plate (max 20 characters)' });
    }

    let finalParkingSpot = parking_spot || null;
    if (role === 'resident') {
      const [user] = await db.execute('SELECT unit FROM users WHERE id = ?', [userId]);
      if (!user[0]?.unit) {
        return res.status(400).json({ error: 'User unit not found' });
      }
      finalParkingSpot = user[0].unit;
      console.log(`Auto-filling parking_spot with unit: ${finalParkingSpot} for user ${userId}`); // Debug log
    }

    let query = 'UPDATE vehicles SET license_plate = ?, model = ?, color = ?, parking_spot = ?, updated_at = NOW() WHERE id = ?';
    let params = [license_plate.trim().toUpperCase(), model.trim(), color.trim(), finalParkingSpot, id];

    if (role === 'resident') {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (role === 'security') {
      return res.status(403).json({ error: 'Unauthorized to update vehicle' });
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }

    const [updatedVehicle] = await db.execute(
      'SELECT v.id, v.user_id, v.license_plate, v.model, v.color, v.parking_spot, v.created_at, v.updated_at, u.unit, u.phone_number ' +
      'FROM vehicles v LEFT JOIN users u ON v.user_id = u.id WHERE v.id = ?',
      [id]
    );

    console.log('Updated vehicle:', updatedVehicle[0]); // Debug log
    res.json(updatedVehicle[0]);
  } catch (err) {
    console.error('Error updating vehicle:', err.message, err.stack);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'License plate already registered' });
    }
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

    if (role === 'resident') {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (role === 'security') {
      return res.status(403).json({ error: 'Unauthorized to delete vehicle' });
    }

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }

    res.json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    console.error('Error deleting vehicle:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};