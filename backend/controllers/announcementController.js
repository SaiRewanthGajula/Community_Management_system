// D:\cms\backend\controllers\announcementController.js
const db = require('../config/db');

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority, date } = req.body;
    const userId = req.user?.id;

    if (!title || !content || !priority || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    const announcementDate = date || new Date().toISOString().split('T')[0];
    const [result] = await db.execute(
      'INSERT INTO announcements (title, content, date, priority, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, content, announcementDate, priority, userId]
    );
    const announcementId = result.insertId;

    await db.execute(
      `INSERT INTO notifications (user_id, announcement_id)
       SELECT id, ? FROM users WHERE role = 'resident'`,
      [announcementId]
    );

    res.status(201).json({
      announcementId,
      title,
      content,
      date: announcementDate,
      priority,
      created_by: userId,
    });
  } catch (err) {
    console.error('Error creating announcement:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.getAllAnnouncements = async (req, res) => {
  console.log('Received request for /api/announcements');
  try {
    const limit = parseInt(req.query.limit) || 10;
    console.log('Fetching announcements with limit:', limit);
    const [rows] = await db.execute(
      'SELECT announcement_id AS id, title, content, date, priority, created_by, created_at, updated_at FROM announcements ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    console.log('Announcements fetched:', rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching announcements:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, priority, date } = req.body;

    if (!title || !content || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    const announcementDate = date || new Date().toISOString().split('T')[0];
    const [result] = await db.execute(
      'UPDATE announcements SET title = ?, content = ?, date = ?, priority = ?, updated_at = NOW() WHERE announcement_id = ?',
      [title, content, announcementDate, priority, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await db.execute('DELETE FROM notifications WHERE announcement_id = ?', [id]);
    await db.execute(
      `INSERT INTO notifications (user_id, announcement_id)
       SELECT id, ? FROM users WHERE role = 'resident'`,
      [id]
    );

    res.json({
      id: Number(id),
      title,
      content,
      date: announcementDate,
      priority,
    });
  } catch (err) {
    console.error('Error updating announcement:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM notifications WHERE announcement_id = ?', [id]);
    const [result] = await db.execute('DELETE FROM announcements WHERE announcement_id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error('Error deleting announcement:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};