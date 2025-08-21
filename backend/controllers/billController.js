// cms-backend/controllers/billController.js
const db = require('../config/db');

exports.createBill = async (req, res) => {
  try {
    const { user_id, description, amount, due_date, status } = req.body;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create bills' });
    }

    if (!user_id || !description || !amount || !due_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['paid', 'pending', 'upcoming'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const [result] = await db.execute(
      'INSERT INTO bills (user_id, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [user_id, description, amount, due_date, status || 'pending']
    );

    res.status(201).json({
      id: result.insertId,
      user_id,
      description,
      amount,
      due_date,
      status,
    });
  } catch (err) {
    console.error('Error creating bill:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.id;
    const role = req.user.role;

    let query = 'SELECT id, user_id, description, amount, due_date, status, paid_date, created_at, updated_at FROM bills';
    let params = [];

    if (role !== 'admin') {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY due_date DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching bills:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount, due_date, status, paid_date } = req.body;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update bills' });
    }

    if (!description || !amount || !due_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['paid', 'pending', 'upcoming'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const [result] = await db.execute(
      'UPDATE bills SET description = ?, amount = ?, due_date = ?, status = ?, paid_date = ?, updated_at = NOW() WHERE id = ?',
      [description, amount, due_date, status, paid_date || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json({ id: Number(id), description, amount, due_date, status, paid_date });
  } catch (err) {
    console.error('Error updating bill:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete bills' });
    }

    const [result] = await db.execute('DELETE FROM bills WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json({ message: 'Bill deleted' });
  } catch (err) {
    console.error('Error deleting bill:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.payBill = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const [bills] = await db.execute('SELECT * FROM bills WHERE id = ?', [id]);
    if (bills.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    const bill = bills[0];

    if (role !== 'admin' && bill.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to pay this bill' });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({ error: 'Bill already paid' });
    }

    // TODO: Integrate with payment gateway (e.g., Razorpay)
    const paymentSuccess = true; // Placeholder
    if (paymentSuccess) {
      await db.execute(
        'UPDATE bills SET status = ?, paid_date = NOW(), updated_at = NOW() WHERE id = ?',
        ['paid', id]
      );
      const [updatedBill] = await db.execute('SELECT * FROM bills WHERE id = ?', [id]);
      res.json(updatedBill[0]);
    } else {
      res.status(400).json({ error: 'Payment failed' });
    }
  } catch (err) {
    console.error('Error processing payment:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};