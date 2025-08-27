const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { getNotifications } = require('../controllers/notificationsController');

router.get('/', authenticateToken, getNotifications);

module.exports = router;