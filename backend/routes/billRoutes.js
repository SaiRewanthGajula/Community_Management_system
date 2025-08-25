const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createBill,
  getBills,
  updateBill,
  deleteBill,
  payBill,
  getUsers
} = require('../controllers/billController');

router.post('/', authenticateToken, createBill);
router.get('/', authenticateToken, getBills);
router.put('/:id', authenticateToken, updateBill);
router.delete('/:id', authenticateToken, deleteBill);
router.post('/:id/pay', authenticateToken, payBill);
router.get('/users', authenticateToken, getUsers);

module.exports = router;