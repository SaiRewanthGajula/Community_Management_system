// controllers/amenityController.js
const db = require('../config/db'); // Assuming MySQL connection pool

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
      'SELECT ab.id, ab.amenity_id, ab.user_id, ab.status, ' +
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

const getPendingBookings = async (req, res) => {
  if (req.user.role !== 'security' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only security or admin can view pending bookings' });
  }
  try {
    const [bookings] = await db.execute(
      'SELECT ab.*, a.name AS amenity_name, u.name AS resident_name FROM amenity_bookings ab ' +
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
    const [result] = await db.execute(
      'INSERT INTO amenity_bookings (amenity_id, user_id, start_time, end_time, status) VALUES (?, ?, ?, ?, "pending")',
      [amenity_id, userId, start_time, end_time]
    );
    res.json({
      id: result.insertId,
      amenity_id,
      amenity_name: amenity[0].name,
      user_id: userId,
      start_time,
      end_time,
      status: 'pending'
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
};

const updateBookingStatus = async (req, res) => {
  const { booking_id, status } = req.body;
  console.log('updateBookingStatus called:', { booking_id, status, user: req.user });
  if (req.user.role !== 'security' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only security or admin can update booking status' });
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    console.log('Fetching booking with ID:', booking_id);
    const [booking] = await db.execute(
      'SELECT ab.*, a.name AS amenity_name, u.name AS resident_name FROM amenity_bookings ab ' +
      'JOIN amenities a ON ab.amenity_id = a.id ' +
      'JOIN users u ON ab.user_id = u.id ' +
      'WHERE ab.id = ?',
      [booking_id]
    );
    if (booking.length === 0) {
      console.log('Booking not found for ID:', booking_id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    console.log('Updating booking status for ID:', booking_id, 'to:', status);
    await db.execute(
      'UPDATE amenity_bookings SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, booking_id]
    );
    console.log('Inserting notification for user:', booking[0].user_id);
    await db.execute(
      'INSERT INTO notifications (user_id, message, booking_id) VALUES (?, ?, ?)',
      [booking[0].user_id, `Your booking for ${booking[0].amenity_name} has been ${status}.`, booking_id]
    );
    const io = req.app.get('io');
    if (!io) {
      console.warn('Socket.IO instance not found, skipping emit');
    } else {
      console.log('Emitting bookingUpdated event:', { booking_id, status, amenity_name: booking[0].amenity_name });
      io.emit('bookingUpdated', { booking_id, status, amenity_name: booking[0].amenity_name });
    }
    res.json({ id: booking_id, status });
  } catch (err) {
    console.error('Error updating booking status:', {
      message: err.message,
      stack: err.stack,
      booking_id,
      status,
      sqlMessage: err.sqlMessage, // MySQL-specific error message
      sqlState: err.sqlState, // MySQL-specific error code
    });
    res.status(500).json({ error: 'Failed to update booking status', details: err.message, sqlMessage: err.sqlMessage });
  }
};

module.exports = {
  getAmenities,
  getAvailability,
  getBookingHistory,
  getPendingBookings,
  createBooking,
  updateBookingStatus
};