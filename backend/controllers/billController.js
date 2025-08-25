const db = require('../config/db');

exports.createBill = async (req, res) => {
  try {
    console.log('Request body:', req.body); // Debug payload
    const { user_ids, description, amount, due_date, status } = req.body;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create bills' });
    }

    // Validate user_ids is an array of integers
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'user_ids must be a non-empty array of integers' });
    }
    const parsedUserIds = user_ids.map(id => parseInt(id, 10));
    if (parsedUserIds.some(id => isNaN(id))) {
      return res.status(400).json({ error: 'All user_ids must be valid integers' });
    }

    if (!description || !amount || !due_date) {
      return res.status(400).json({ error: 'Missing required fields: description, amount, or due_date' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid number greater than 0' });
    }

    if (!['paid', 'pending', 'upcoming'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be paid, pending, or upcoming' });
    }

    // Validate due_date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ error: 'Invalid due_date format. Use YYYY-MM-DD' });
    }

    // Validate user_ids exist in users table
    console.log('Validating user_ids:', parsedUserIds); // Debug
    const placeholders = parsedUserIds.map(() => '?').join(',');
    const [users] = await db.execute(
      `SELECT id FROM users WHERE id IN (${placeholders}) AND role = "resident"`,
      parsedUserIds
    );
    const validUserIds = users.map((user) => user.id);
    if (validUserIds.length !== parsedUserIds.length) {
      const invalidIds = parsedUserIds.filter((id) => !validUserIds.includes(id));
      return res.status(400).json({ error: `Invalid user IDs: ${invalidIds.join(', ')}` });
    }

    // Start transaction
    await db.execute('START TRANSACTION');
    const createdBills = [];
    try {
      for (const user_id of parsedUserIds) {
        console.log('Inserting bill for user_id:', user_id); // Debug
        const [result] = await db.execute(
          'INSERT INTO bills (user_id, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
          [user_id, description, parsedAmount, due_date, status || 'pending']
        );
        createdBills.push({
          id: result.insertId,
          user_id,
          description,
          amount: parsedAmount,
          due_date,
          status,
        });
      }
      await db.execute('COMMIT');
      res.status(201).json(createdBills);
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error:', err.message, err.stack);
      return res.status(500).json({ error: 'Failed to create bills', details: err.message });
    }
  } catch (err) {
    console.error('Error creating bill:', err.message, err.stack);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user.id;
    const role = req.user.role;

    let query = `
      SELECT b.id, b.user_id, b.description, b.amount, b.due_date, b.status, b.paid_date, b.created_at, b.updated_at
    `;
    let params = [];

    if (role === 'admin') {
      query += ', u.name AS user_name, u.unit AS user_unit FROM bills b JOIN users u ON b.user_id = u.id';
    } else {
      query += ' FROM bills b';
    }

    if (role !== 'admin') {
      query += ' WHERE b.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY b.due_date DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.execute(query, params);
    // Ensure amount is a number
    const formattedRows = rows.map((bill) => ({
      ...bill,
      amount: Number(bill.amount),
    }));
    res.json(formattedRows);
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

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid number greater than 0' });
    }

    if (!['paid', 'pending', 'upcoming'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const [result] = await db.execute(
      'UPDATE bills SET description = ?, amount = ?, due_date = ?, status = ?, paid_date = ?, updated_at = NOW() WHERE id = ?',
      [description, parsedAmount, due_date, status, paid_date || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json({ id: Number(id), description, amount: parsedAmount, due_date, status, paid_date });
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
      res.json({ ...updatedBill[0], amount: Number(updatedBill[0].amount) });
    } else {
      res.status(400).json({ error: 'Payment failed' });
    }
  } catch (err) {
    console.error('Error processing payment:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const role = req.user.role;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view users' });
    }

    const [rows] = await db.execute(
      'SELECT id, name, unit FROM users WHERE role = "resident" ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};