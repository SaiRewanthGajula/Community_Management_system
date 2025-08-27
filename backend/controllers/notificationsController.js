console.log('Loading notificationsController.js');

const db = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    console.log('Request user:', req.user); // Debug req.user
    const userId = req.user.id;
    const role = req.user.role;
    let query = 'SELECT id, user_id, message, booking_id, type, rejection_reason, created_at FROM notifications';
    let params = [];
    if (role !== 'admin') {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY created_at DESC LIMIT 50';
    const [rows] = await db.execute(query, params);
    console.log('Notifications fetched:', rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
};

module.exports = { getNotifications };