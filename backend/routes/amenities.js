// D:\cms\backend\routes\amenities.js
const express = require('express');
const router = express.Router();
const { getAmenities, getAvailability, getBookingHistory, getAllBookingHistory, getPendingBookings, createBooking, updateBookingStatus } = require('../controllers/amenityController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/amenities', authenticateToken, getAmenities);
router.get('/amenities/availability', authenticateToken, getAvailability);
router.get('/amenities/history', authenticateToken, getBookingHistory);
router.get('/amenities/all-history', authenticateToken, getAllBookingHistory);
router.get('/amenities/pending', authenticateToken, getPendingBookings);
router.post('/amenities/book', authenticateToken, createBooking);
router.post('/amenities/status', authenticateToken, updateBookingStatus);

module.exports = router;