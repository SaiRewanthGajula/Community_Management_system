// backend/routes/visitorRoutes.js
const router = require('express').Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const visitorController = require('../controllers/visitorController');

router.post('/checkin', authenticateToken, visitorController.checkIn);
router.post('/checkout/:id', authenticateToken, visitorController.checkOut);
router.get('/current', authenticateToken, visitorController.getCurrent);
router.get('/history', authenticateToken, visitorController.getHistory);
router.post('/verify-pin/:id', authenticateToken, visitorController.verifyPin);

module.exports = router;