const db = require('../config/db');

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority, date, poll_question, poll_options } = req.body;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create announcements' });
    }

    if (!title || !content || !priority || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    await db.execute('START TRANSACTION');
    try {
      const announcementDate = date || new Date().toISOString().split('T')[0];
      const [result] = await db.execute(
        'INSERT INTO announcements (title, content, date, priority, created_by) VALUES (?, ?, ?, ?, ?)',
        [title, content, announcementDate, priority, userId]
      );
      const announcementId = result.insertId;

      // Create poll if provided
      let pollId = null;
      if (poll_question && Array.isArray(poll_options) && poll_options.length >= 2 && poll_options.length <= 10) {
        const [pollResult] = await db.execute(
          'INSERT INTO polls (announcement_id, question) VALUES (?, ?)',
          [announcementId, poll_question]
        );
        pollId = pollResult.insertId;

        for (const option of poll_options) {
          if (!option?.trim()) {
            throw new Error('Poll options must be non-empty strings');
          }
          await db.execute(
            'INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)',
            [pollId, option]
          );
        }
      }

      // Notify residents
      await db.execute(
        `INSERT INTO notifications (user_id, announcement_id, message, type, created_at)
         SELECT id, ?, ?, 'announcement', NOW() FROM users WHERE role = 'resident'`,
        [announcementId, `New announcement: ${title}`]
      );

      const io = req.app.get('io');
      if (io) {
        io.emit('announcementAdded', { id: announcementId, title, content, priority, date: announcementDate });
      }

      await db.execute('COMMIT');
      res.status(201).json({
        announcementId,
        title,
        content,
        date: announcementDate,
        priority,
        created_by: userId,
        poll: pollId ? { id: pollId, question: poll_question, options: poll_options } : null,
      });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error creating announcement:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

const getAllAnnouncements = async (req, res) => {
  console.log('Received request for /api/announcements');
  try {
    const limit = parseInt(req.query.limit) || 10;
    console.log('Fetching announcements with limit:', limit);
    const [announcements] = await db.execute(
      'SELECT announcement_id AS id, title, content, date, priority, created_by, created_at, updated_at FROM announcements ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    // Fetch polls and their options
    for (const announcement of announcements) {
      const [polls] = await db.execute(
        'SELECT id, question FROM polls WHERE announcement_id = ?',
        [announcement.id]
      );
      if (polls.length > 0) {
        const poll = polls[0];
        const [options] = await db.execute(
          'SELECT id, option_text FROM poll_options WHERE poll_id = ?',
          [poll.id]
        );
        const [voteCounts] = await db.execute(
          'SELECT option_id, COUNT(*) as vote_count FROM poll_votes WHERE poll_id = ? GROUP BY option_id',
          [poll.id]
        );
        const totalVotes = voteCounts.reduce((sum, { vote_count }) => sum + parseInt(vote_count), 0);
        poll.options = options.map((opt) => {
          const vote = voteCounts.find((v) => v.option_id === opt.id);
          return {
            id: opt.id,
            text: opt.option_text,
            vote_count: vote ? parseInt(vote.vote_count) : 0,
            percentage: totalVotes > 0 ? ((vote ? parseInt(vote.vote_count) : 0) / totalVotes * 100).toFixed(1) : '0.0',
          };
        });
        announcement.poll = poll;
        if (req.user?.role === 'resident') {
          const [userVote] = await db.execute(
            'SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?',
            [poll.id, req.user.id]
          );
          announcement.poll.user_vote = userVote.length > 0 ? userVote[0].option_id : null;
        }
      }
    }

    console.log('Announcements fetched:', announcements);
    res.json(announcements);
  } catch (err) {
    console.error('Error fetching announcements:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, priority, date, poll_question, poll_options } = req.body;
    const role = req.user?.role;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update announcements' });
    }

    if (!title || !content || !priority) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    await db.execute('START TRANSACTION');
    try {
      const announcementDate = date || new Date().toISOString().split('T')[0];
      const [result] = await db.execute(
        'UPDATE announcements SET title = ?, content = ?, date = ?, priority = ?, updated_at = NOW() WHERE announcement_id = ?',
        [title, content, announcementDate, priority, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      // Update poll if provided
      let pollId = null;
      if (poll_question && Array.isArray(poll_options) && poll_options.length >= 2 && poll_options.length <= 10) {
        const [existingPoll] = await db.execute('SELECT id FROM polls WHERE announcement_id = ?', [id]);
        if (existingPoll.length > 0) {
          pollId = existingPoll[0].id;
          await db.execute('UPDATE polls SET question = ? WHERE id = ?', [poll_question, pollId]);
          await db.execute('DELETE FROM poll_options WHERE poll_id = ?', [pollId]);
        } else {
          const [pollResult] = await db.execute(
            'INSERT INTO polls (announcement_id, question) VALUES (?, ?)',
            [id, poll_question]
          );
          pollId = pollResult.insertId;
        }
        for (const option of poll_options) {
          if (!option?.trim()) {
            throw new Error('Poll options must be non-empty strings');
          }
          await db.execute(
            'INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)',
            [pollId, option]
          );
        }
      }

      // Update notifications
      await db.execute('DELETE FROM notifications WHERE announcement_id = ?', [id]);
      await db.execute(
        `INSERT INTO notifications (user_id, announcement_id, message, type, created_at)
         SELECT id, ?, ?, 'announcement', NOW() FROM users WHERE role = 'resident'`,
        [id, `Updated announcement: ${title}`]
      );

      const io = req.app.get('io');
      if (io) {
        io.emit('announcementUpdated', { id: Number(id), title, content, priority, date: announcementDate });
      }

      await db.execute('COMMIT');
      res.json({
        id: Number(id),
        title,
        content,
        date: announcementDate,
        priority,
        poll: pollId ? { id: pollId, question: poll_question, options: poll_options } : null,
      });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error updating announcement:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete announcements' });
    }

    await db.execute('START TRANSACTION');
    try {
      await db.execute('DELETE FROM notifications WHERE announcement_id = ?', [id]);
      const [result] = await db.execute('DELETE FROM announcements WHERE announcement_id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('announcementDeleted', { id: Number(id) });
      }

      await db.execute('COMMIT');
      res.json({ message: 'Announcement deleted' });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error deleting announcement:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

const submitPollVote = async (req, res) => {
  try {
    const { poll_id, option_id } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== 'resident') {
      return res.status(403).json({ error: 'Only residents can vote on polls' });
    }

    if (!poll_id || !option_id) {
      return res.status(400).json({ error: 'Missing poll_id or option_id' });
    }

    const [poll] = await db.execute('SELECT announcement_id FROM polls WHERE id = ?', [poll_id]);
    if (poll.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const [option] = await db.execute('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?', [option_id, poll_id]);
    if (option.length === 0) {
      return res.status(404).json({ error: 'Poll option not found' });
    }

    await db.execute('START TRANSACTION');
    try {
      const [existingVote] = await db.execute(
        'SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?',
        [poll_id, userId]
      );
      if (existingVote.length > 0) {
        return res.status(400).json({ error: 'You have already voted on this poll' });
      }

      await db.execute(
        'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)',
        [poll_id, option_id, userId]
      );

      // Fetch updated poll results
      const [voteCounts] = await db.execute(
        'SELECT option_id, COUNT(*) as vote_count FROM poll_votes WHERE poll_id = ? GROUP BY option_id',
        [poll_id]
      );
      const totalVotes = voteCounts.reduce((sum, { vote_count }) => sum + parseInt(vote_count), 0);
      const [options] = await db.execute('SELECT id, option_text FROM poll_options WHERE poll_id = ?', [poll_id]);
      const pollResults = options.map((opt) => {
        const vote = voteCounts.find((v) => v.option_id === opt.id);
        return {
          id: opt.id,
          text: opt.option_text,
          vote_count: vote ? parseInt(vote.vote_count) : 0,
          percentage: totalVotes > 0 ? ((vote ? parseInt(vote.vote_count) : 0) / totalVotes * 100).toFixed(1) : '0.0',
        };
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('pollUpdated', { poll_id, announcement_id: poll[0].announcement_id, results: pollResults });
      }

      await db.execute('COMMIT');
      res.json({ poll_id, option_id, results: pollResults });
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('Transaction error:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error submitting poll vote:', err.message, err.stack);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
};

module.exports = {
  createAnnouncement,
  getAllAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  submitPollVote,
};