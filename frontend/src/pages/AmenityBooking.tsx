import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
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
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const apiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';

  // Debug re-renders
  const renderCount = React.useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(`AmenityBooking rendered ${renderCount.current} times`);
  });

  // Fetch amenities
  useEffect(() => {
    const fetchAmenities = async () => {
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
        const errorMessage = err.response?.status === 404
          ? 'Amenities endpoint not found. Please check the server configuration.'
          : err.response?.data?.error || 'Failed to load amenities';
        setError(errorMessage);
        console.error('Error fetching amenities:', err);
      } finally {
        setLoadingAmenities(false);
      }
    };
    fetchAmenities();
  }, [apiBase]);

  // Fetch availability
  useEffect(() => {
    if (bookingData.amenity_id && bookingData.date) {
      const fetchAvailability = async () => {
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
          const errorMessage = err.response?.status === 404
            ? 'Availability endpoint not found. Please check the server configuration.'
            : err.response?.data?.error || 'Failed to load availability';
          setError(errorMessage);
          console.error('Error fetching availability:', err);
        } finally {
          setLoadingAvailability(false);
        }
      };
      fetchAvailability();
    }
  }, [bookingData.amenity_id, bookingData.date, amenities, apiBase]);

  // Fetch history or pending bookings
  useEffect(() => {
    if (activeTab === 'history' && isResident) {
      const fetchHistory = async () => {
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
      };
      fetchHistory();
    } else if (activeTab === 'pending' && (isSecurity || isAdmin)) {
      const fetchPending = async () => {
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
      };
      fetchPending();
    }
  }, [activeTab, isResident, isSecurity, isAdmin, apiBase]);

  const generateTimeSlots = (duration: number, bookedSlots: { start: string; end: string }[]) => {
    const slots: string[] = [];
    const startHour = 8;
    const endHour = 22;
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += duration) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const isBooked = bookedSlots.some(
          (slot) => slot.start <= time && time < slot.end
        );
        if (!isBooked) {
          slots.push(time);
        }
      }
    }
    return slots;
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    setBookingData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token');
      const startDateTime = new Date(`${bookingData.date}T${bookingData.start_time}`);
      const selectedAmenity = amenities.find((a) => a.id === parseInt(bookingData.amenity_id));
      const endDateTime = new Date(startDateTime.getTime() + (selectedAmenity?.booking_duration || 60) * 60 * 1000);
      const response = await axios.post(
        `${apiBase}/amenities/book`,
        {
          amenity_id: bookingData.amenity_id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConfirmation({ ...response.data, amenity_name: selectedAmenity?.name || '' });
      setActiveTab('confirmation');
      setBookingData({
        amenity_id: amenities[0]?.id.toString() || '',
        date: new Date().toISOString().slice(0, 10),
        start_time: '',
      });
      window.dispatchEvent(new Event('bookingUpdated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create booking');
      console.error('Error creating booking:', err);
    }
  };

  const handleBookingAction = async (bookingId: number, status: 'approved' | 'rejected') => {
  try {
    const token = localStorage.getItem('societyToken');
    console.log('Sending status update:', { bookingId, status, token });
    if (!token) throw new Error('No authentication token');
    await axios.post(
      `${apiBase}/amenities/status`,
      { booking_id: bookingId, status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setPendingBookings(pendingBookings.filter((b) => b.id !== bookingId));
    window.dispatchEvent(new Event('bookingUpdated'));
  } catch (err: any) {
    console.error('Error updating booking status:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    setError(err.response?.data?.error || `Failed to ${status} booking`);
  }
};

  const tabs: Tab[] = isResident
    ? [
        { id: 'book', label: 'Book Amenity', icon: Calendar },
        { id: 'confirmation', label: 'Confirmation', icon: CheckCircle },
        { id: 'history', label: 'Booking History', icon: Clock },
      ]
    : (isSecurity || isAdmin)
    ? [
        { id: 'pending', label: 'Pending Bookings', icon: CheckCircle },
      ]
    : [];

  if (!user) {
    console.log('User is null, showing loading state');
    return <Card className="p-4">Loading user data...</Card>;
  }

  if (!isResident && !isSecurity && !isAdmin) {
    console.log('Access denied for role:', user.role);
    return <Card className="p-4">Access denied. Resident, security, or admin role required.</Card>;
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold mb-6">Amenity Booking</h1>
      {error && (
        <Card className="p-4 mb-6 text-red-600 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 p-4">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => {
                console.log('Tab changed to:', tab.id);
                setActiveTab(tab.id);
              }}
              className={`flex items-center space-x-2 ${
                activeTab === tab.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {isResident && (
          <>
            <TabsContent value="book" className="mt-4">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Book an Amenity</h2>
                {loadingAmenities ? (
                  <p>Loading amenities...</p>
                ) : amenities.length === 0 ? (
                  <p>No amenities available.</p>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col">
                      <label htmlFor="amenity_id" className="text-sm font-medium text-gray-700">
                        Amenity<span className="text-red-500">*</span>
                      </label>
                      <select
                        id="amenity_id"
                        name="amenity_id"
                        value={bookingData.amenity_id}
                        onChange={handleInputChange}
                        required
                        className="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
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
                      key="date-input"
                      label="Date"
                      name="date"
                      type="date"
                      value={bookingData.date}
                      onChange={handleInputChange}
                      required
                    />
                    <div className="flex flex-col">
                      <label htmlFor="start_time" className="text-sm font-medium text-gray-700">
                        Start Time<span className="text-red-500">*</span>
                      </label>
                      {loadingAvailability ? (
                        <p>Loading available time slots...</p>
                      ) : (
                        <select
                          id="start_time"
                          name="start_time"
                          value={bookingData.start_time}
                          onChange={handleInputChange}
                          required
                          disabled={!availableSlots.length}
                          className="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
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
                    <Button type="submit" disabled={!bookingData.amenity_id || !bookingData.start_time || loadingAvailability}>
                      Book Amenity
                    </Button>
                  </form>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="confirmation" className="mt-4">
              {confirmation && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Booking Confirmed</h2>
                  <p>Amenity: {confirmation.amenity_name}</p>
                  <p>Start Time: {new Date(confirmation.start_time).toLocaleString()}</p>
                  <p>End Time: {new Date(confirmation.end_time).toLocaleString()}</p>
                  <p>Status: {confirmation.status}</p>
                  <div className="mt-4">
                    <QRCodeCanvas
                      value={`Booking ID: ${confirmation.id}, Amenity: ${confirmation.amenity_name}, Start: ${confirmation.start_time}`}
                      size={128}
                      className="mx-auto"
                    />
                    <p className="text-center text-sm mt-2">Booking ID: {confirmation.id}</p>
                  </div>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
            <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Booking History</h2>
                {loadingAmenities ? (
                <p>Loading...</p>
                ) : bookingHistory.length === 0 ? (
                <p>No booking history.</p>
                ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amenity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {bookingHistory.map((booking) => (
                        <tr key={booking.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{booking.amenity_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(booking.start_time).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'short',
                            timeStyle: 'medium',
                            })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(booking.end_time).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            dateStyle: 'short',
                            timeStyle: 'medium',
                            })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{booking.status}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                )}
            </Card>
            </TabsContent>
          </>
        )}
        {(isSecurity || isAdmin) && (
          <TabsContent value="pending" className="mt-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Pending Bookings</h2>
              {loadingAmenities ? (
                <p>Loading...</p>
              ) : pendingBookings.length === 0 ? (
                <p>No pending bookings.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amenity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resident</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{booking.amenity_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{booking.resident_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{new Date(booking.start_time).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{new Date(booking.end_time).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
                          <Button onClick={() => handleBookingAction(booking.id, 'approved')}>
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleBookingAction(booking.id, 'rejected')}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AmenityBooking;