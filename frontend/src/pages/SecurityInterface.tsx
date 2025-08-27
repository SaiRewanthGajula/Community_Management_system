import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Car, Calendar, Users } from 'lucide-react';

interface Visitor {
  id: number;
  name: string;
  phone: string;
  purpose: string;
  check_in: string | null;
  unit: string | null;
}

interface Booking {
  id: number;
  amenity_id: number;
  amenity_name: string;
  user_id: number;
  resident_name: string;
  resident_unit: string | null;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

interface VehicleLog {
  id: number;
  license_plate: string;
  model: string;
  color: string;
  unit: string | null;
  entry_time: string;
  exit_time: string | null;
}

interface Notification {
  id: number;
  title: string;
  description: string;
  timestamp: number;
  type: 'visitors' | 'bookings' | 'vehicles';
}

const SecurityInterface: React.FC = () => {
  const { user, isSecurity, isAdmin } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLog[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [rejectionReasons, setRejectionReasons] = useState<{ [key: number]: string }>({});
  const [pinVerificationId, setPinVerificationId] = useState<number | null>(null);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [activeSection, setActiveSection] = useState<'visitors' | 'bookings' | 'vehicles' | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const apiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
  const socketRef = useRef<Socket | null>(null);

  // Debug re-renders
  const renderCount = useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(`SecurityInterface rendered ${renderCount.current} times`);
  });

  // Socket.IO setup
  useEffect(() => {
    const token = localStorage.getItem('societyToken');
    socketRef.current = io(apiBase.replace('/api', ''), {
      auth: { token },
      reconnectionAttempts: 3,
    });

    socketRef.current.on('connect', () => console.log('Socket connected'));
    socketRef.current.on('visitorUpdated', (data: any) => {
      fetchVisitors();
      setNotifications((prev) => [
        {
          id: Date.now(),
          title: data.check_in ? `Visitor ${data.name} Checked In` : `Visitor ${data.name} Rejected`,
          description: `Visitor for unit ${data.unit || 'N/A'} ${data.check_in ? 'checked in' : 'rejected'} at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
          timestamp: Date.now(),
          type: 'visitors',
        },
        ...prev.slice(0, 9), // Keep last 10 notifications
      ]);
    });
    socketRef.current.on('bookingUpdated', (data: any) => {
      fetchPendingBookings();
      setNotifications((prev) => [
        {
          id: Date.now(),
          title: `Booking ${data.status === 'approved' ? 'Approved' : 'Rejected'}`,
          description: `Booking for ${data.amenity_name} by ${data.resident_name} ${data.status} at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
          timestamp: Date.now(),
          type: 'bookings',
        },
        ...prev.slice(0, 9),
      ]);
    });
    socketRef.current.on('vehicleUpdated', (data: any) => {
      fetchVehicleLogs();
      setNotifications((prev) => [
        {
          id: Date.now(),
          title: `Vehicle Log Updated`,
          description: `Vehicle ${data.license_plate} ${data.exit_time ? 'exited' : 'entered'} at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
          timestamp: Date.now(),
          type: 'vehicles',
        },
        ...prev.slice(0, 9),
      ]);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [apiBase]);

  // Fetch pending visitors
  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/visitors/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVisitors(Array.isArray(response.data) ? response.data.filter((v: Visitor) => !v.check_in) : []);
    } catch (err: any) {
      const errorMessage = err.response?.status === 404
        ? 'Visitors endpoint not found. Please check the server configuration.'
        : err.response?.data?.error || 'Failed to load visitors';
      setError(errorMessage);
      console.error('Error fetching visitors:', err);
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Fetch pending bookings
  const fetchPendingBookings = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/amenities/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingBookings(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      const errorMessage = err.response?.status === 403
        ? 'Access denied to pending bookings endpoint.'
        : err.response?.status === 404
        ? 'Pending bookings endpoint not found. Please check the server configuration.'
        : err.response?.data?.error || 'Failed to load pending bookings';
      setError(errorMessage);
      console.error('Error fetching pending bookings:', err);
      setPendingBookings([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Fetch vehicle logs
  const fetchVehicleLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVehicleLogs(Array.isArray(response.data.vehicles) ? response.data.vehicles : []);
    } catch (err: any) {
      const errorMessage = err.response?.status === 404
        ? 'Vehicle logs endpoint not found. Please check the server configuration.'
        : err.response?.data?.error || 'Failed to load vehicle logs';
      setError(errorMessage);
      console.error('Error fetching vehicle logs:', err);
      setVehicleLogs([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Handle visitor PIN verification
  const handlePinVerification = async (visitorId: number) => {
    if (!pin.match(/^[0-9]{4}$/)) {
      setPinError('PIN must be a 4-digit number');
      return;
    }
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      await axios.post(
        `${apiBase}/visitors/verify-pin/${visitorId}`,
        { pin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPinVerificationId(null);
      setPin('');
      setPinError('');
      fetchVisitors();
      socketRef.current?.emit('visitorUpdated', { id: visitorId, name: visitors.find(v => v.id === visitorId)?.name, unit: visitors.find(v => v.id === visitorId)?.unit, check_in: new Date().toISOString() });
    } catch (err: any) {
      setPinError(err.response?.data?.error || 'Failed to verify PIN');
      console.error('Error verifying PIN:', err);
    }
  };

  // Handle visitor checkout
  const handleCheckOut = async (visitorId: number) => {
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      await axios.post(
        `${apiBase}/visitors/checkout/${visitorId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchVisitors();
      socketRef.current?.emit('visitorUpdated', { id: visitorId, name: visitors.find(v => v.id === visitorId)?.name, unit: visitors.find(v => v.id === visitorId)?.unit });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check out visitor');
      console.error('Error checking out visitor:', err);
    }
  };

  // Handle booking action (approve/reject)
  const handleBookingAction = async (bookingId: number, status: 'approved' | 'rejected') => {
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const payload: { booking_id: number; status: string; rejection_reason?: string } = {
        booking_id: bookingId,
        status,
      };
      if (status === 'rejected') {
        const reason = rejectionReasons[bookingId];
        if (!reason?.trim()) {
          setError('Rejection reason is required');
          return;
        }
        payload.rejection_reason = reason;
      }
      await axios.post(`${apiBase}/amenities/status`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingBookings((prev) => prev.filter((b) => b.id !== bookingId));
      setRejectionReasons((prev) => {
        const newReasons = { ...prev };
        delete newReasons[bookingId];
        return newReasons;
      });
      socketRef.current?.emit('bookingUpdated', {
        booking_id: bookingId,
        status,
        amenity_name: pendingBookings.find(b => b.id === bookingId)?.amenity_name,
        resident_name: pendingBookings.find(b => b.id === bookingId)?.resident_name,
        rejection_reason: payload.rejection_reason
      });
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${status} booking`);
      console.error('Error updating booking status:', err);
    }
  };

  // Handle rejection reason input
  const handleRejectionReasonChange = (bookingId: number, reason: string) => {
    setRejectionReasons((prev) => ({ ...prev, [bookingId]: reason }));
  };

  // Fetch data on mount and role change
  useEffect(() => {
    if (!user || (!isSecurity && !isAdmin)) {
      console.log('Access denied for role:', user?.role);
      return;
    }
    fetchVisitors();
    fetchPendingBookings();
    fetchVehicleLogs();
  }, [user, isSecurity, isAdmin, fetchVisitors, fetchPendingBookings, fetchVehicleLogs]);

  // Stats for summary cards
  const stats = useMemo(
    () => [
      {
        label: 'Pending Visitors',
        value: visitors.length.toString(),
        icon: Users,
        color: 'text-blue-500',
      },
      {
        label: 'Pending Bookings',
        value: pendingBookings.length.toString(),
        icon: Calendar,
        color: 'text-purple-500',
      },
      {
        label: 'Vehicle Logs',
        value: vehicleLogs.length.toString(),
        icon: Car,
        color: 'text-indigo-500',
      },
    ],
    [visitors, pendingBookings, vehicleLogs]
  );

  const formatDateTimeToIST = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  if (!user) {
    return <Card className="p-4 mx-auto max-w-md sm:max-w-lg">Loading user data...</Card>;
  }

  if (!isSecurity && !isAdmin) {
    return <Card className="p-4 mx-auto max-w-md sm:max-w-lg">Access denied. Security or admin role required.</Card>;
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl">
      <div className="block sm:hidden mb-6 bg-primary/10 rounded-lg p-4 border-l-4 border-primary">
        <p className="text-sm font-medium text-primary">
          Welcome back, <span className="font-semibold">{user?.name || 'User'}</span>
        </p>
        <p className="text-xs text-gray-600">Unit: {user?.unit || 'N/A'}</p>
      </div>
      {error && (
        <Card className="p-4 mb-6 text-red-600 flex items-center max-w-md sm:max-w-lg md:max-w-2xl mx-auto">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </Card>
      )}
      {loading ? (
        <Card className="p-4 mx-auto max-w-md sm:max-w-lg">Loading data...</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {stats.map((stat) => (
              <Card
                key={stat.label}
                className="flex items-center p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setActiveSection(stat.label.toLowerCase().includes('visitors') ? 'visitors' : stat.label.toLowerCase().includes('bookings') ? 'bookings' : 'vehicles')}
              >
                <div className={`p-3 rounded-full bg-gray-100 mr-4 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="flex justify-between items-center mt-6">
            <h2 className="text-lg font-medium text-gray-800">Recent Activity</h2>
            <Link to="#" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-4 mb-6">
            {notifications.length === 0 ? (
              <Card className="p-4 text-gray-600">No recent activity</Card>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className="flex p-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setActiveSection(notification.type)}
                >
                  <div className="flex-shrink-0 mr-4">
                    {notification.type === 'visitors' && <Users className="w-6 h-6 text-blue-500" />}
                    {notification.type === 'bookings' && <Calendar className="w-6 h-6 text-purple-500" />}
                    {notification.type === 'vehicles' && <Car className="w-6 h-6 text-indigo-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium text-gray-800">{notification.title}</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(notification.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{notification.description}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
          {activeSection && (
            <Card
              title={activeSection === 'visitors' ? 'Pending Visitors' : activeSection === 'bookings' ? 'Pending Amenity Bookings' : 'Vehicle Logs'}
              icon={
                activeSection === 'visitors' ? <Users className="w-5 h-5" /> :
                activeSection === 'bookings' ? <Calendar className="w-5 h-5" /> :
                <Car className="w-5 h-5" />
              }
            >
              {activeSection === 'visitors' && (
                visitors.length === 0 ? (
                  <p className="text-gray-600">No pending visitors.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Phone</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Purpose</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Unit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {visitors.map((visitor) => (
                          <tr key={visitor.id} className="block sm:table-row">
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Name:'] before:font-medium sm:before:content-none">
                              {visitor.name}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Phone:'] before:font-medium sm:before:content-none">
                              {visitor.phone}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Purpose:'] before:font-medium sm:before:content-none">
                              {visitor.purpose}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Unit:'] before:font-medium sm:before:content-none">
                              {visitor.unit || 'N/A'}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Action:'] before:font-medium sm:before:content-none">
                              <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                                {pinVerificationId === visitor.id ? (
                                  <>
                                    <Input
                                      placeholder="Enter 4-digit PIN"
                                      value={pin}
                                      onChange={(e) => setPin(e.target.value)}
                                      error={pinError}
                                      className="w-full sm:w-24"
                                      maxLength={4}
                                    />
                                    <Button
                                      onClick={() => handlePinVerification(visitor.id)}
                                      className="bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto"
                                    >
                                      Verify
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setPinVerificationId(null);
                                        setPin('');
                                        setPinError('');
                                      }}
                                      className="w-full sm:w-auto"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      onClick={() => setPinVerificationId(visitor.id)}
                                      className="bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
                                    >
                                      Check In
                                    </Button>
                                    <Button
                                      onClick={() => handleCheckOut(visitor.id)}
                                      className="bg-red-600 text-white hover:bg-red-700 w-full sm:w-auto"
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              {activeSection === 'bookings' && (
                pendingBookings.length === 0 ? (
                  <p className="text-gray-600">No pending bookings.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Amenity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Resident</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Unit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">Start Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">End Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingBookings.map((booking) => (
                          <tr key={booking.id} className="block sm:table-row">
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Amenity:'] before:font-medium sm:before:content-none">
                              {booking.amenity_name}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Resident:'] before:font-medium sm:before:content-none">
                              {booking.resident_name}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Unit:'] before:font-medium sm:before:content-none">
                              {booking.resident_unit || 'N/A'}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Start_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {formatDateTimeToIST(booking.start_time)}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['End_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {formatDateTimeToIST(booking.end_time)}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Action:'] before:font-medium sm:before:content-none">
                              <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                                <Button
                                  onClick={() => handleBookingAction(booking.id, 'approved')}
                                  className="bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto"
                                >
                                  Approve
                                </Button>
                                <div className="flex flex-col space-y-2 sm:w-48">
                                  <Input
                                    placeholder="Rejection reason"
                                    value={rejectionReasons[booking.id] || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                      handleRejectionReasonChange(booking.id, e.target.value)
                                    }
                                    className="w-full"
                                  />
                                  <Button
                                    onClick={() => handleBookingAction(booking.id, 'rejected')}
                                    className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                                    disabled={!rejectionReasons[booking.id]?.trim()}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              {activeSection === 'vehicles' && (
                vehicleLogs.length === 0 ? (
                  <p className="text-gray-600">No vehicle logs available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">License Plate</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Model</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Color</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Unit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">Entry Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">Exit Time</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {vehicleLogs.map((log) => (
                          <tr key={log.id} className="block sm:table-row">
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['License_Plate:'] before:font-medium sm:before:content-none">
                              {log.license_plate}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Model:'] before:font-medium sm:before:content-none">
                              {log.model}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Color:'] before:font-medium sm:before:content-none">
                              {log.color}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Unit:'] before:font-medium sm:before:content-none">
                              {log.unit || 'N/A'}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Entry_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {formatDateTimeToIST(log.entry_time)}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Exit_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {formatDateTimeToIST(log.exit_time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default SecurityInterface;