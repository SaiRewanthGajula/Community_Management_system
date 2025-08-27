const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  submitPollVote,
} = require('../controllers/announcementController');

router.post('/', authenticateToken, createAnnouncement);
router.get('/', authenticateToken, getAllAnnouncements);
router.put('/:id', authenticateToken, updateAnnouncement);
router.delete('/:id', authenticateToken, deleteAnnouncement);
router.post('/vote', authenticateToken, submitPollVote);

module.exports = router;