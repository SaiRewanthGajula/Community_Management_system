const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const listEndpoints = require('express-list-endpoints');
require('dotenv').config();

const announcementRoutes = require('./routes/announcementRoutes');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const billRoutes = require('./routes/billRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const amenityRoutes = require('./routes/amenities');
const notificationRoutes = require('./routes/notificationRoutes');
const { scheduleBillingReminders } = require('./jobs/billingReminders');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  // TODO: Verify JWT token and extract user_id
  socket.user_id = socket.handshake.auth.user_id || 'unknown';
  socket.join(`user:${socket.user_id}`);
  next();
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user_id}`);
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user_id}`);
  });
});


app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/announcements', announcementRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api', amenityRoutes);
app.use('/api/notifications', notificationRoutes);

// Start billing reminders
scheduleBillingReminders(io);

console.log('Registered routes:', listEndpoints(app));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));