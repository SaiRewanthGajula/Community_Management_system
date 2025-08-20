// cms-backend/routes/billRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createBill,
  getBills,
  updateBill,
  deleteBill,
} = require('../controllers/billController');

router.post('/', authenticateToken, createBill);
router.get('/', authenticateToken, getBills);
router.put('/:id', authenticateToken, updateBill);
router.delete('/:id', authenticateToken, deleteBill);

module.exports = router;