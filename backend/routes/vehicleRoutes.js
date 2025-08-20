// cms-backend/routes/vehicleRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createVehicle,
  getVehicles,
  updateVehicle,
  deleteVehicle,
} = require('../controllers/vehicleController');

router.post('/', authenticateToken, createVehicle);
router.get('/', authenticateToken, getVehicles);
router.put('/:id', authenticateToken, updateVehicle);
router.delete('/:id', authenticateToken, deleteVehicle);

module.exports = router;