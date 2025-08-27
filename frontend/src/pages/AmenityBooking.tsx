// D:\cms\frontend\src\components\AmenityBooking.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Tabs, TabsContent } from '../components/common/Tabs';
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';

interface Amenity {
  id: number;
  name: string;
  description: string;
  max_capacity: number;
  booking_duration: number;
}

interface Booking {
  id: number;
  amenity_id: number;
  amenity_name: string;
  user_id: number;
  resident_name: string;
  resident_unit?: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  rejection_reason?: string | null;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
}

const AmenityBooking: React.FC = () => {
  const { user, isResident, isSecurity, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('book');
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookingData, setBookingData] = useState({
    amenity_id: '',
    date: new Date().toISOString().slice(0, 10),
    start_time: '',
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookingHistory, setBookingHistory] = useState<Booking[]>([]);
  const [allBookingHistory, setAllBookingHistory] = useState<Booking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<{ [key: number]: string }>({});
  const apiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
  const socketRef = useRef<Socket | null>(null);

  // Debug re-renders
  const renderCount = useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(`AmenityBooking rendered ${renderCount.current} times`);
  });

  // Socket.IO setup
  useEffect(() => {
    const token = localStorage.getItem('societyToken');
    socketRef.current = io(apiBase.replace('/api', ''), {
      auth: { token },
      reconnectionAttempts: 3,
    });

    socketRef.current.on('connect', () => console.log('Socket connected'));
    socketRef.current.on('newBooking', () => {
      if (isSecurity || isAdmin) {
        if (activeTab === 'pending') {
          fetchPendingBookings();
        }
      }
    });
    socketRef.current.on('bookingUpdated', (data) => {
      if (isResident && data.user_id === user?.id) {
        if (activeTab === 'history') {
          fetchBookingHistory();
        }
        if (confirmation && confirmation.id === data.booking_id) {
          setConfirmation((prev) => (prev ? { ...prev, status: data.status, rejection_reason: data.rejection_reason } : null));
        }
      }
      if (isSecurity || isAdmin) {
        setPendingBookings((prev) => prev.filter((b) => b.id !== data.booking_id));
        if (activeTab === 'all-history') {
          fetchAllBookingHistory();
        }
      }
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isResident, isSecurity, isAdmin, user?.id, activeTab, confirmation]);

  // Fetch amenities
  const fetchAmenities = useCallback(async () => {
    setLoadingAmenities(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/amenities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAmenities(response.data);
      if (response.data.length > 0) {
        setBookingData((prev) => ({ ...prev, amenity_id: response.data[0].id.toString() }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load amenities');
      console.error('Error fetching amenities:', err);
    } finally {
      setLoadingAmenities(false);
    }
  }, [apiBase]);

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    if (bookingData.amenity_id && bookingData.date) {
      setLoadingAvailability(true);
      try {
        const token = localStorage.getItem('societyToken');
        if (!token) throw new Error('No authentication token');
        const response = await axios.get(`${apiBase}/amenities/availability`, {
          params: { amenity_id: bookingData.amenity_id, date: bookingData.date },
          headers: { Authorization: `Bearer ${token}` },
        });
        const bookedSlots = response.data.map((b: Booking) => ({
          start: new Date(b.start_time).toISOString().slice(11, 16),
          end: new Date(b.end_time).toISOString().slice(11, 16),
        }));
        const selectedAmenity = amenities.find((a) => a.id === parseInt(bookingData.amenity_id));
        if (selectedAmenity) {
          const slots = generateTimeSlots(selectedAmenity.booking_duration, bookedSlots);
          setAvailableSlots(slots);
          setBookingData((prev) => ({ ...prev, start_time: slots[0] || '' }));
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load availability');
        console.error('Error fetching availability:', err);
      } finally {
        setLoadingAvailability(false);
      }
    }
  }, [bookingData.amenity_id, bookingData.date, amenities]);

  // Fetch resident's booking history
  const fetchBookingHistory = useCallback(async () => {
    if (!isResident) return;
    setLoadingAmenities(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/amenities/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookingHistory(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load booking history');
      console.error('Error fetching booking history:', err);
    } finally {
      setLoadingAmenities(false);
    }
  }, [apiBase, isResident]);

  // Fetch all booking history for security/admin
  const fetchAllBookingHistory = useCallback(async () => {
    if (!isSecurity && !isAdmin) return;
    setLoadingAmenities(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/amenities/all-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllBookingHistory(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load all booking history');
      console.error('Error fetching all booking history:', err);
    } finally {
      setLoadingAmenities(false);
    }
  }, [apiBase, isSecurity, isAdmin]);

  // Fetch pending bookings
  const fetchPendingBookings = useCallback(async () => {
    if (!isSecurity && !isAdmin) return;
    setLoadingAmenities(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const response = await axios.get(`${apiBase}/amenities/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingBookings(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load pending bookings');
      console.error('Error fetching pending bookings:', err);
    } finally {
      setLoadingAmenities(false);
    }
  }, [apiBase, isSecurity, isAdmin]);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    setBookingData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle booking submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      try {
        const token = localStorage.getItem('societyToken');
        if (!token) throw new Error('No authentication token');
        const startDateTime = new Date(`${bookingData.date}T${bookingData.start_time}`);
        const selectedAmenity = amenities.find((a) => a.id === parseInt(bookingData.amenity_id));
        if (!selectedAmenity) throw new Error('Selected amenity not found');
        const endDateTime = new Date(startDateTime.getTime() + selectedAmenity.booking_duration * 60 * 1000);
        const response = await axios.post(
          `${apiBase}/amenities/book`,
          {
            amenity_id: parseInt(bookingData.amenity_id),
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setConfirmation({ ...response.data, amenity_name: selectedAmenity.name });
        setActiveTab('confirmation');
        setBookingData({
          amenity_id: amenities[0]?.id.toString() || '',
          date: new Date().toISOString().slice(0, 10),
          start_time: '',
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to create booking');
        console.error('Error creating booking:', err);
      }
    },
    [bookingData, amenities, apiBase]
  );

  // Handle booking actions
  const handleBookingAction = useCallback(
    async (bookingId: number, status: 'approved' | 'rejected') => {
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
      } catch (err: any) {
        setError(err.response?.data?.error || `Failed to ${status} booking`);
        console.error('Error updating booking status:', err);
      }
    },
    [rejectionReasons, apiBase]
  );

  // Handle rejection reason input
  const handleRejectionReasonChange = useCallback((bookingId: number, reason: string) => {
    setRejectionReasons((prev) => ({ ...prev, [bookingId]: reason }));
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    let mounted = true;
    if (activeTab === 'history' && isResident) {
      fetchBookingHistory().then(() => {
        if (mounted) setLoadingAmenities(false);
      });
    } else if (activeTab === 'pending' && (isSecurity || isAdmin)) {
      fetchPendingBookings().then(() => {
        if (mounted) setLoadingAmenities(false);
      });
    } else if (activeTab === 'all-history' && (isSecurity || isAdmin)) {
      fetchAllBookingHistory().then(() => {
        if (mounted) setLoadingAmenities(false);
      });
    }
    return () => {
      mounted = false;
    };
  }, [activeTab, isResident, isSecurity, isAdmin, fetchBookingHistory, fetchPendingBookings, fetchAllBookingHistory]);

  // Fetch amenities and availability
  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Generate time slots
  const generateTimeSlots = useCallback((duration: number, bookedSlots: { start: string; end: string }[]) => {
    const slots: string[] = [];
    const startHour = 8;
    const endHour = 22;
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += duration) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const isBooked = bookedSlots.some((slot) => slot.start <= time && time < slot.end);
        if (!isBooked) {
          slots.push(time);
        }
      }
    }
    return slots;
  }, []);

  const tabs: Tab[] = isResident
    ? [
        { id: 'book', label: 'Book Amenity', icon: Calendar },
        { id: 'confirmation', label: 'Confirmation', icon: CheckCircle },
        { id: 'history', label: 'Booking History', icon: Clock },
      ]
    : isSecurity || isAdmin
    ? [
        { id: 'pending', label: 'Pending Bookings', icon: CheckCircle },
        { id: 'all-history', label: 'Booking History', icon: Clock },
      ]
    : [];

  if (!user) {
    return <Card className="p-4 mx-auto max-w-md sm:max-w-lg">Loading user data...</Card>;
  }

  if (!isResident && !isSecurity && !isAdmin) {
    return <Card className="p-4 mx-auto max-w-md sm:max-w-lg">Access denied. Resident, security, or admin role required.</Card>;
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800">Amenity Booking</h1>
      {error && (
        <Card className="p-4 mb-6 text-red-600 flex items-center max-w-md sm:max-w-lg md:max-w-2xl mx-auto">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </Card>
      )}

      <Card className="mb-4 max-w-md sm:max-w-lg md:max-w-2xl mx-auto">
        <div className="flex flex-wrap gap-2 p-4 justify-center sm:justify-start">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 flex-1 justify-center sm:flex-none ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } px-3 py-2 sm:px-4 sm:py-2 rounded-md text-sm sm:text-base`}
            >
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isResident && (
          <>
            <TabsContent value="book" className="mt-4">
              <Card className="p-6 max-w-md sm:max-w-lg md:max-w-2xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800">Book an Amenity</h2>
                {loadingAmenities ? (
                  <p>Loading amenities...</p>
                ) : amenities.length === 0 ? (
                  <p>No amenities available.</p>
                ) : (
                  <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                    <div className="sm:col-span-2">
                      <label htmlFor="amenity_id" className="text-sm font-medium text-gray-700">
                        Amenity<span className="text-red-500">*</span>
                      </label>
                      <select
                        id="amenity_id"
                        name="amenity_id"
                        value={bookingData.amenity_id}
                        onChange={handleInputChange}
                        required
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select an amenity</option>
                        {amenities.map((amenity) => (
                          <option key={amenity.id} value={amenity.id}>
                            {amenity.name} ({amenity.booking_duration} min)
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Date"
                      name="date"
                      type="date"
                      value={bookingData.date}
                      onChange={handleInputChange}
                      required
                      className="w-full"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="start_time" className="text-sm font-medium text-gray-700">
                        Start Time<span className="text-red-500">*</span>
                      </label>
                      {loadingAvailability ? (
                        <p>Loading time slots...</p>
                      ) : (
                        <select
                          id="start_time"
                          name="start_time"
                          value={bookingData.start_time}
                          onChange={handleInputChange}
                          required
                          disabled={!availableSlots.length}
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a time slot</option>
                          {availableSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={!bookingData.amenity_id || !bookingData.start_time || loadingAvailability}
                      className="bg-blue-600 hover:bg-blue-700 text-white sm:col-span-2 w-full sm:w-auto"
                    >
                      Book Amenity
                    </Button>
                  </form>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="confirmation" className="mt-4">
              {confirmation && (
                <Card className="p-6 max-w-md sm:max-w-lg md:max-w-2xl mx-auto">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800">Booking Confirmation</h2>
                  <div className="grid gap-2 text-sm sm:text-base">
                    <p><span className="font-medium">Amenity:</span> {confirmation.amenity_name}</p>
                    <p>
                      <span className="font-medium">Start Time:</span>{' '}
                      {new Date(confirmation.start_time).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </p>
                    <p>
                      <span className="font-medium">End Time:</span>{' '}
                      {new Date(confirmation.end_time).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </p>
                    <p><span className="font-medium">Status:</span> {confirmation.status}</p>
                    {confirmation.status === 'pending' && (
                      <p className="text-yellow-600 mt-2">Your booking is pending approval by security.</p>
                    )}
                    {confirmation.status === 'approved' && (
                      <p className="text-green-600 mt-2">Your booking has been approved.</p>
                    )}
                    {confirmation.status === 'rejected' && (
                      <p className="text-red-600 mt-2">
                        Your booking has been rejected. Reason: {confirmation.rejection_reason || 'N/A'}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex justify-center">
                    <QRCodeCanvas
                      value={`Booking ID: ${confirmation.id}, Amenity: ${confirmation.amenity_name}, Start: ${confirmation.start_time}`}
                      size={Math.min(window.innerWidth * 0.4, 200)}
                      className="mx-auto"
                    />
                  </div>
                  <p className="text-center text-sm mt-2">Booking ID: {confirmation.id}</p>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <Card className="p-6 max-w-full mx-auto overflow-x-auto">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800">Booking History</h2>
                {loadingAmenities ? (
                  <p>Loading...</p>
                ) : bookingHistory.length === 0 ? (
                  <p>No booking history.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Amenity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">Start Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">End Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">Rejection Reason</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bookingHistory.map((booking) => (
                          <tr key={booking.id} className="block sm:table-row">
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Amenity:'] before:font-medium sm:before:content-none">
                              {booking.amenity_name}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Start_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {new Date(booking.start_time).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['End_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {new Date(booking.end_time).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Status:'] before:font-medium sm:before:content-none capitalize">
                              {booking.status}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Rejection_Reason:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {booking.status === 'rejected' ? booking.rejection_reason || 'N/A' : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>
          </>
        )}
        {(isSecurity || isAdmin) && (
          <>
            <TabsContent value="pending" className="mt-4">
              <Card className="p-6 max-w-full mx-auto overflow-x-auto">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800">Pending Bookings</h2>
                {loadingAmenities ? (
                  <p>Loading...</p>
                ) : pendingBookings.length === 0 ? (
                  <p>No pending bookings.</p>
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
                              {new Date(booking.start_time).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['End_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {new Date(booking.end_time).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
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
                )}
              </Card>
            </TabsContent>
            <TabsContent value="all-history" className="mt-4">
              <Card className="p-6 max-w-full mx-auto overflow-x-auto">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-800">Booking History</h2>
                {loadingAmenities ? (
                  <p>Loading...</p>
                ) : allBookingHistory.length === 0 ? (
                  <p>No booking history.</p>
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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sm:px-6 hidden sm:table-cell">Rejection Reason</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allBookingHistory.map((booking) => (
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
                              {new Date(booking.start_time).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['End_Time:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {new Date(booking.end_time).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Status:'] before:font-medium sm:before:content-none capitalize">
                              {booking.status}
                            </td>
                            <td className="block px-4 py-2 sm:table-cell sm:px-6 sm:py-4 before:content-['Rejection_Reason:'] before:font-medium sm:before:content-none hidden sm:table-cell">
                              {booking.status === 'rejected' ? booking.rejection_reason || 'N/A' : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default AmenityBooking;