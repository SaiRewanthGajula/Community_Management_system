import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import VisitorManagement from './pages/VisitorManagement';
import AmenityBooking from './pages/AmenityBooking';
import ComplaintManagement from './pages/ComplaintManagement';
import Announcements from './pages/Announcements';
import NewAnnouncement from './pages/NewAnnouncement';
import BillingPayments from './pages/BillingPayments';
import VehicleManagement from './pages/VehicleManagement';
import SecurityInterface from './pages/SecurityInterface';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import ProtectedRoute from './components/common/ProtectedRoute';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public route for login */}
          <Route path="/login" element={<Login />} />

          {/* Protected route for authenticated users */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/visitors" element={<VisitorManagement />} />
            <Route path="/amenity-booking" element={<AmenityBooking />} />
            <Route path="/complaints" element={<ComplaintManagement />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/announcements/new" element={<NewAnnouncement />} />
            <Route path="/billing" element={<BillingPayments />} />
            <Route path="/vehicles" element={<VehicleManagement />} />
            <Route path="/security" element={<SecurityInterface />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
