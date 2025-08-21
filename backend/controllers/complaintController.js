const db = require('../config/db');

exports.createComplaint = async (req, res) => {
  const { title, description, priority } = req.body;
  const userId = req.user.id; // From JWT

  try {
    // Validate input
    if (!title || !description || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    // Fetch user to get unit and role
    const [users] = await db.query('SELECT unit, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    // Restrict to residents
    if (user.role !== 'resident') {
      return res.status(403).json({ error: 'Only residents can submit complaints' });
    }

    // Get current date with time in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format for MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
    const formattedDate = istTime.toISOString().slice(0, 19).replace('T', ' ');

    // Insert complaint into database
    const [result] = await db.query(
      'INSERT INTO complaints (user_id, title, description, status, date, unit, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, title, description, 'open', formattedDate, user.unit || null, priority]
    );

    const complaintId = result.insertId;

    // Return created complaint
    res.status(201).json({
      id: complaintId,
      user_id: userId,
      title,
      description,
      status: 'open',
      date: formattedDate,
      unit: user.unit || null,
      priority,
      resolution_description: null,
      resolved_by: null,
      resolved_at: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating complaint' });
  }
};

exports.getComplaints = async (req, res) => {
  const userId = req.user.id; // From JWT

  try {
    // Fetch user role
    const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    // Admins see all complaints, residents see only their own
    const query =
      user.role === 'admin'
        ? 'SELECT id, user_id, title, description, status, date, unit, priority, resolution_description, resolved_by, resolved_at FROM complaints'
        : 'SELECT id, user_id, title, description, status, date, unit, priority, resolution_description, resolved_by, resolved_at FROM complaints WHERE user_id = ?';
    const params = user.role === 'admin' ? [] : [userId];
    const [complaints] = await db.query(query, params);
    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching complaints' });
  }
};

exports.updateComplaint = async (req, res) => {
  const { id } = req.params;
  const { title, description, priority } = req.body;
  const userId = req.user.id; // From JWT

  try {
    // Validate input
    if (!title || !description || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    // Fetch user role
    const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    // Restrict to residents
    if (user.role !== 'resident') {
      return res.status(403).json({ error: 'Only residents can edit complaints' });
    }

    // Check if complaint exists and belongs to the user
    const [complaints] = await db.query('SELECT * FROM complaints WHERE id = ? AND user_id = ?', [id, userId]);
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found or unauthorized' });
    }

    // Update complaint
    await db.query(
      'UPDATE complaints SET title = ?, description = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, description, priority, id]
    );

    // Fetch updated complaint
    const [updatedComplaints] = await db.query('SELECT id, user_id, title, description, status, date, unit, priority, resolution_description, resolved_by FROM complaints WHERE id = ?', [id]);
    res.json(updatedComplaints[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating complaint' });
  }
};

exports.resolveComplaint = async (req, res) => {
  const { id } = req.params;
  const { resolution_description } = req.body;
  const userId = req.user.id; // From JWT

  try {
    // Validate input
    if (!resolution_description) {
      return res.status(400).json({ error: 'Resolution description is required' });
    }

    // Fetch user role
    const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];

    // Check if complaint exists
    const [complaints] = await db.query('SELECT * FROM complaints WHERE id = ?', [id]);
    if (complaints.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = complaints[0];

    // Restrict access: admins can resolve any complaint, residents can only resolve their own
    if (user.role !== 'admin' && user.role !== 'resident') {
      return res.status(403).json({ error: 'Unauthorized to resolve complaints' });
    }
    if (user.role === 'resident' && complaint.user_id !== userId) {
      return res.status(403).json({ error: 'Residents can only resolve their own complaints' });
    }

    // Prevent resolving already resolved complaints
    if (complaint.status === 'resolved') {
      return res.status(400).json({ error: 'Complaint is already resolved' });
    }

    // Get current date with time in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format for MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
    const resolvedAt = istTime.toISOString().slice(0, 19).replace('T', ' ');

    try {
      // Try to update with resolved_at column
      await db.query(
        'UPDATE complaints SET status = ?, resolution_description = ?, resolved_by = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['resolved', resolution_description, userId, resolvedAt, id]
      );
    } catch (err) {
      // If resolved_at column doesn't exist, update without it
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage.includes('resolved_at')) {
        await db.query(
          'UPDATE complaints SET status = ?, resolution_description = ?, resolved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['resolved', resolution_description, userId, id]
        );
      } else {
        throw err; // Re-throw other errors
      }
    }

    // Fetch updated complaint
    const [updatedComplaints] = await db.query('SELECT id, user_id, title, description, status, date, unit, priority, resolution_description, resolved_by FROM complaints WHERE id = ?', [id]);
    
    // Add resolved_at to the response if it exists in the database
    const response = updatedComplaints[0];
    if (response && !response.resolved_at) {
      response.resolved_at = resolvedAt;
    }
    
    res.json(response);
  } catch (err) {
    console.error('Error resolving complaint:', err);
    res.status(500).json({ error: 'Error resolving complaint' });
  }
};