// D:\cms\backend\app.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const listEndpoints = require('express-list-endpoints');
require('dotenv').config();

const announcementRoutes = require('./routes/announcementRoutes');
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const billRoutes = require('./routes/billRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const amenityRoutes = require('./routes/amenities');
const app = express();

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io); // Make io available to controllers

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
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
console.log('Registered routes:', listEndpoints(app));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));