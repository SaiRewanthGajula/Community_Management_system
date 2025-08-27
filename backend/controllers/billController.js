const db = require('../config/db');

exports.createBill = async (req, res) => {
  try {
    const { user_ids, description, amount, due_date, status } = req.body;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create bills' });
    }

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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ error: 'Invalid due_date format. Use YYYY-MM-DD' });
    }

    const [users] = await db.execute(
      `SELECT id FROM users WHERE id IN (${parsedUserIds.map(() => '?').join(',')}) AND role = "resident"`,
      parsedUserIds
    );
    const validUserIds = users.map((user) => user.id);
    if (validUserIds.length !== parsedUserIds.length) {
      const invalidIds = parsedUserIds.filter((id) => !validUserIds.includes(id));
      return res.status(400).json({ error: `Invalid user IDs: ${invalidIds.join(', ')}` });
    }

    await db.execute('START TRANSACTION');
    const createdBills = [];
    try {
      for (const user_id of parsedUserIds) {
        const [result] = await db.execute(
          'INSERT INTO bills (user_id, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?)',
          [user_id, description, parsedAmount, due_date, status || 'pending']
        );
        const billId = result.insertId;
        createdBills.push({
          id: billId,
          user_id,
          description,
          amount: parsedAmount,
          due_date,
          status,
        });

        if (status === 'upcoming' || status === 'pending') {
          const message = status === 'upcoming'
            ? `Reminder: Bill "${description}" of ₹${parsedAmount.toFixed(2)} is due on ${due_date}.`
            : `Overdue: Bill "${description}" of ₹${parsedAmount.toFixed(2)} was due on ${due_date}.`;
          await db.execute(
            'INSERT INTO notifications (user_id, message, bill_id, notification_type, created_at) VALUES (?, ?, ?, "bill_reminder", NOW())',
            [user_id, message, billId]
          );
        }
      }

      const io = req.app.get('io');
      if (io) {
        createdBills.forEach((bill) => {
          if (bill.status === 'upcoming' || bill.status === 'pending') {
            io.emit('billReminder', {
              bill_id: bill.id,
              user_id: bill.user_id,
              description: bill.description,
              amount: bill.amount,
              due_date: bill.due_date,
              status: bill.status,
            });
          }
        });
      }

      await db.execute('COMMIT');
      res.status(201).json(createdBills);
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error:', err.message, err.stack);
      throw err;
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

    await db.execute('START TRANSACTION');
    try {
      const [result] = await db.execute(
        'UPDATE bills SET description = ?, amount = ?, due_date = ?, status = ?, paid_date = ?, updated_at = NOW() WHERE id = ?',
        [description, parsedAmount, due_date, status, paid_date || null, id]
      );

      if (result.affectedRows === 0) {
        throw new Error('Bill not found');
      }

      if (status === 'upcoming' || status === 'pending') {
        const [bill] = await db.execute('SELECT user_id FROM bills WHERE id = ?', [id]);
        const message = status === 'upcoming'
          ? `Reminder: Bill "${description}" of ₹${parsedAmount.toFixed(2)} is due on ${due_date}.`
          : `Overdue: Bill "${description}" of ₹${parsedAmount.toFixed(2)} was due on ${due_date}.`;
        await db.execute(
          'INSERT INTO notifications (user_id, message, bill_id, notification_type, created_at) VALUES (?, ?, ?, "bill_reminder", NOW())',
          [bill[0].user_id, message, id]
        );

        const io = req.app.get('io');
        if (io) {
          io.emit('billReminder', {
            bill_id: id,
            user_id: bill[0].user_id,
            description,
            amount: parsedAmount,
            due_date,
            status,
          });
        }
      }

      await db.execute('COMMIT');
      res.json({ id: Number(id), description, amount: parsedAmount, due_date, status, paid_date });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error in updateBill:', err);
      throw err;
    }
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

    await db.execute('START TRANSACTION');
    try {
      await db.execute('DELETE FROM notifications WHERE bill_id = ?', [id]);
      const [result] = await db.execute('DELETE FROM bills WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        throw new Error('Bill not found');
      }
      await db.execute('COMMIT');
      res.json({ message: 'Bill deleted' });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error in deleteBill:', err);
      throw err;
    }
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

    const paymentSuccess = true; // Placeholder for payment gateway
    if (paymentSuccess) {
      await db.execute(
        'UPDATE bills SET status = ?, paid_date = NOW(), updated_at = NOW() WHERE id = ?',
        ['paid', id]
      );
      await db.execute('DELETE FROM notifications WHERE bill_id = ? AND notification_type = "bill_reminder"', [id]);
      const [updatedBill] = await db.execute('SELECT * FROM bills WHERE id = ?', [id]);
      const io = req.app.get('io');
      if (io) {
        io.emit('billPaid', { bill_id: id, user_id: bill.user_id, status: 'paid' });
      }
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

exports.sendBillReminders = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split('T')[0];

    const [bills] = await db.execute(
      `SELECT id, user_id, description, amount, due_date, status
       FROM bills
       WHERE status IN ('upcoming', 'pending')
       AND due_date <= ?`,
      [sevenDaysFromNowStr]
    );

    for (const bill of bills) {
      const dueDate = bill.due_date.split('T')[0];
      const message = bill.status === 'upcoming'
        ? `Reminder: Bill "${bill.description}" of ₹${Number(bill.amount).toFixed(2)} is due on ${dueDate}.`
        : `Overdue: Bill "${bill.description}" of ₹${Number(bill.amount).toFixed(2)} was due on ${dueDate}.`;

      const [existing] = await db.execute(
        'SELECT id FROM notifications WHERE bill_id = ? AND notification_type = "bill_reminder"',
        [bill.id]
      );
      if (existing.length === 0) {
        await db.execute(
          'INSERT INTO notifications (user_id, message, bill_id, notification_type, created_at) VALUES (?, ?, ?, "bill_reminder", NOW())',
          [bill.user_id, message, bill.id]
        );

        const io = global.io;
        if (io) {
          io.emit('billReminder', {
            bill_id: bill.id,
            user_id: bill.user_id,
            description: bill.description,
            amount: Number(bill.amount),
            due_date: bill.due_date,
            status: bill.status,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error sending bill reminders:', err.message, err.stack);
  }
};