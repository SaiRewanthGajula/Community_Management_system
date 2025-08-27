const cron = require('node-cron');
const moment = require('moment');
const db = require('../config/db');

const scheduleBillingReminders = (io) => {
  cron.schedule('0 9 * * *', async () => {
    console.log('Running billing reminders job at', new Date().toISOString());
    try {
      const [bills] = await db.execute(
        `SELECT b.id, b.user_id, b.description, b.amount, b.due_date, u.email
         FROM bills b
         JOIN users u ON b.user_id = u.id
         WHERE b.status IN ('pending', 'upcoming')
         AND b.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
      );

      for (const bill of bills) {
        const dueDate = moment(bill.due_date).format('YYYY-MM-DD');
        const message = `Reminder: Your bill "${bill.description}" of ₹${bill.amount} is due on ${dueDate}.`;
        await db.execute(
          'INSERT INTO notifications (user_id, bill_id, message, type, created_at) VALUES (?, ?, ?, ?, NOW())',
          [bill.user_id, bill.id, message, 'bill']
        );

        if (io) {
          io.to(`user:${bill.user_id}`).emit('newNotification', {
            bill_id: bill.id,
            message,
            type: 'bill',
            created_at: new Date().toISOString(),
          });
        }
      }
      console.log(`Sent ${bills.length} billing reminders`);
    } catch (err) {
      console.error('Error in billing reminders job:', err.message, err.stack);
    }
  });
};

module.exports = { scheduleBillingReminders };