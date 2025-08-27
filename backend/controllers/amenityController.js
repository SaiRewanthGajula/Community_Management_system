// D:\cms\backend\controllers\amenityController.js
const db = require('../config/db');

const getAvailability = async (req, res) => {
  const { amenity_id, date } = req.query;
  if (!amenity_id || !date) {
    return res.status(400).json({ error: 'Amenity ID and date are required' });
  }
  try {
    const [bookings] = await db.execute(
      'SELECT start_time, end_time FROM amenity_bookings WHERE amenity_id = ? AND DATE(start_time) = ? AND status IN ("pending", "approved")',
      [amenity_id, date]
    );
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
};

const getAmenities = async (req, res) => {
  try {
    const [amenities] = await db.execute('SELECT * FROM amenities');
    res.json(amenities);
  } catch (err) {
    console.error('Error fetching amenities:', err);
    res.status(500).json({ error: 'Failed to fetch amenities' });
  }
};

const getBookingHistory = async (req, res) => {
  if (req.user.role !== 'resident') {
    return res.status(403).json({ error: 'Only residents can view booking history' });
  }
  try {
    const [bookings] = await db.execute(
      'SELECT ab.id, ab.amenity_id, ab.user_id, ab.status, ab.rejection_reason, ' +
      'CONVERT_TZ(ab.start_time, "+00:00", "+05:30") AS start_time, ' +
      'CONVERT_TZ(ab.end_time, "+00:00", "+05:30") AS end_time, ' +
      'a.name AS amenity_name, u.name AS resident_name ' +
      'FROM amenity_bookings ab ' +
      'JOIN amenities a ON ab.amenity_id = a.id ' +
      'JOIN users u ON ab.user_id = u.id ' +
      'WHERE ab.user_id = ? ORDER BY ab.start_time DESC',
      [req.user.id]
    );
    console.log('Booking history (IST):', bookings);
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching booking history:', err);
    res.status(500).json({ error: 'Failed to fetch booking history' });
  }
};

const getAllBookingHistory = async (req, res) => {
  if (req.user.role !== 'security' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only security or admin can view all booking history' });
  }
  try {
    const [bookings] = await db.execute(
      'SELECT ab.id, ab.amenity_id, ab.user_id, ab.status, ab.rejection_reason, ' +
      'CONVERT_TZ(ab.start_time, "+00:00", "+05:30") AS start_time, ' +
      'CONVERT_TZ(ab.end_time, "+00:00", "+05:30") AS end_time, ' +
      'a.name AS amenity_name, u.name AS resident_name, u.unit AS resident_unit ' +
      'FROM amenity_bookings ab ' +
      'JOIN amenities a ON ab.amenity_id = a.id ' +
      'JOIN users u ON ab.user_id = u.id ' +
      'ORDER BY ab.start_time DESC'
    );
    console.log('All booking history (IST):', bookings);
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching all booking history:', err);
    res.status(500).json({ error: 'Failed to fetch all booking history' });
  }
};

const getPendingBookings = async (req, res) => {
  if (req.user.role !== 'security' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only security or admin can view pending bookings' });
  }
  try {
    const [bookings] = await db.execute(
      'SELECT ab.*, a.name AS amenity_name, u.name AS resident_name, u.unit AS resident_unit ' +
      'FROM amenity_bookings ab ' +
      'JOIN amenities a ON ab.amenity_id = a.id ' +
      'JOIN users u ON ab.user_id = u.id ' +
      'WHERE ab.status = "pending" ORDER BY ab.start_time ASC'
    );
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching pending bookings:', err);
    res.status(500).json({ error: 'Failed to fetch pending bookings' });
  }
};

const createBooking = async (req, res) => {
  const { amenity_id, start_time, end_time } = req.body;
  const userId = req.user.id;
  if (req.user.role !== 'resident') {
    return res.status(403).json({ error: 'Only residents can book amenities' });
  }
  try {
    const [existing] = await db.execute(
      'SELECT id FROM amenity_bookings WHERE amenity_id = ? AND status = "approved" AND (start_time < ? AND end_time > ?)',
      [amenity_id, end_time, start_time]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }
    const [amenity] = await db.execute('SELECT name FROM amenities WHERE id = ?', [amenity_id]);
    if (amenity.length === 0) {
      return res.status(404).json({ error: 'Amenity not found' });
    }
    await db.execute('START TRANSACTION');
    try {
      const [result] = await db.execute(
        'INSERT INTO amenity_bookings (amenity_id, user_id, start_time, end_time, status, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, "pending", NOW(), NOW())',
        [amenity_id, userId, start_time, end_time]
      );
      const bookingId = result.insertId;
      const [newBooking] = await db.execute(
        'SELECT ab.*, a.name AS amenity_name, u.name AS resident_name ' +
        'FROM amenity_bookings ab ' +
        'JOIN amenities a ON ab.amenity_id = a.id ' +
        'JOIN users u ON ab.user_id = u.id ' +
        'WHERE ab.id = ?',
        [bookingId]
      );
      const [securityUsers] = await db.execute('SELECT id FROM users WHERE role = "security"');
      for (const securityUser of securityUsers) {
        await db.execute(
          'INSERT INTO notifications (user_id, message, booking_id, type, created_at) ' +
          'VALUES (?, ?, ?, "booking_request", NOW())',
          [securityUser.id, `New booking request for ${amenity[0].name} by ${newBooking[0].resident_name}.`, bookingId]
        );
      }
      const io = req.app.get('io');
      if (io) {
        io.emit('newBooking', {
          booking_id: bookingId,
          amenity_name: amenity[0].name,
          resident_name: newBooking[0].resident_name,
          start_time,
          end_time,
        });
      } else {
        console.warn('Socket.IO instance not found, skipping emit');
      }
      await db.execute('COMMIT');
      res.json(newBooking[0]);
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error in createBooking:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking', details: err.message });
  }
};

const updateBookingStatus = async (req, res) => {
  const { booking_id, status, rejection_reason } = req.body;
  console.log('updateBookingStatus called:', { booking_id, status, rejection_reason, user: req.user });
  if (req.user.role !== 'security' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only security or admin can update booking status' });
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (status === 'rejected' && !rejection_reason?.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }
  try {
    const [booking] = await db.execute(
      'SELECT ab.*, a.name AS amenity_name, u.name AS resident_name, u.unit AS resident_unit ' +
      'FROM amenity_bookings ab ' +
      'JOIN amenities a ON ab.amenity_id = a.id ' +
      'JOIN users u ON ab.user_id = u.id ' +
      'WHERE ab.id = ?',
      [booking_id]
    );
    if (booking.length === 0) {
      console.log('Booking not found for ID:', booking_id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    await db.execute('START TRANSACTION');
    try {
      await db.execute(
        'UPDATE amenity_bookings SET status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
        [status, status === 'rejected' ? rejection_reason : null, booking_id]
      );
      const message = status === 'rejected'
        ? `Your booking for ${booking[0].amenity_name} has been rejected. Reason: ${rejection_reason}`
        : `Your booking for ${booking[0].amenity_name} has been ${status}.`;
      await db.execute(
        'INSERT INTO notifications (user_id, message, booking_id, type, rejection_reason, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, NOW())',
        [booking[0].user_id, message, booking_id, 'booking_status', status === 'rejected' ? rejection_reason : null]
      );
      const io = req.app.get('io');
      if (io) {
        console.log('Emitting bookingUpdated event:', { booking_id, status, amenity_name: booking[0].amenity_name, rejection_reason });
        io.emit('bookingUpdated', {
          booking_id,
          status,
          user_id: booking[0].user_id,
          amenity_name: booking[0].amenity_name,
          resident_name: booking[0].resident_name,
          rejection_reason: status === 'rejected' ? rejection_reason : null,
        });
      } else {
        console.warn('Socket.IO instance not found, skipping emit');
      }
      await db.execute('COMMIT');
      res.json({ id: booking_id, status, rejection_reason: status === 'rejected' ? rejection_reason : null });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error in updateBookingStatus:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error updating booking status:', {
      message: err.message,
      stack: err.stack,
      booking_id,
      status,
      sqlMessage: err.sqlMessage,
      sqlState: err.sqlState,
    });
    res.status(500).json({ error: 'Failed to update booking status', details: err.message, sqlMessage: err.sqlMessage });
  }
};

module.exports = {
  getAmenities,
  getAvailability,
  getBookingHistory,
  getAllBookingHistory,
  getPendingBookings,
  createBooking,
  updateBookingStatus,
};