import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import ActionTile from '../components/common/ActionTile';
import { useAuth } from '../context/AuthContext';
import { Users, AlertCircle, Bell, CreditCard, Car, Calendar, Sparkles } from 'lucide-react';
import axios from 'axios';

interface Announcement {
  id: number;
  title: string;
  content: string;
  date: string | null;
  priority: 'low' | 'medium' | 'high';
}

interface Notification {
  id: number;
  title: string;
  description: string;
  timestamp: number;
  type: 'event' | 'maintenance' | 'payment' | 'announcement' | 'booking';
}

const Dashboard: React.FC = () => {
  const { user, isResident, isSecurity, isAdmin } = useAuth();
  const [openComplaintsCount, setOpenComplaintsCount] = useState(0);
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Debug re-renders
  const renderCount = React.useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(`Dashboard rendered ${renderCount.current} times`);
  });

  const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No authentication token found');

      // Fetch open complaints count
      const complaintsResponse = await axios.get(`${apiUrl}/complaints?status=open`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOpenComplaintsCount(Array.isArray(complaintsResponse.data) ? complaintsResponse.data.length : 0);

      // Fetch pending bookings count (for security/admin)
      if (isSecurity || isAdmin) {
        const bookingsResponse = await axios.get(`${apiUrl}/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pendingCount = Array.isArray(bookingsResponse.data)
          ? bookingsResponse.data.filter((b: any) => b.status === 'pending').length
          : 0;
        setPendingBookingsCount(pendingCount);
      }

      // Fetch announcements
      const announcementsResponse = await axios.get(`${apiUrl}/announcements?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnnouncements(Array.isArray(announcementsResponse.data) ? announcementsResponse.data : []);

      // Fetch booking notifications
      const notificationsResponse = await axios.get(`${apiUrl}/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bookingNotifications = Array.isArray(notificationsResponse.data)
        ? notificationsResponse.data.map((n: any) => ({
            id: n.id,
            title: n.type === 'booking_request' ? `New Booking Request` : `Booking ${n.status || 'Updated'}`,
            description: n.message,
            timestamp: new Date(n.created_at).getTime(),
            type: 'booking' as const,
          }))
        : [];
      setNotifications(bookingNotifications);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error.response?.data || error.message);
      setError('Failed to load dashboard data');
      setOpenComplaintsCount(0);
      setPendingBookingsCount(0);
      setAnnouncements([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, isSecurity, isAdmin]);

  useEffect(() => {
    if (!user) {
      console.log('User is null, skipping data fetch');
      setLoading(false);
      return;
    }
    fetchData();

    const handleComplaintUpdate = () => {
      console.log('Complaint updated, refetching data');
      fetchData();
    };

    const handleAnnouncementAdded = () => {
      console.log('Announcement added, refetching data');
      fetchData();
    };

    const handleBookingUpdate = () => {
      console.log('Booking updated, refetching data');
      fetchData();
    };

    window.addEventListener('complaintUpdated', handleComplaintUpdate);
    window.addEventListener('announcementAdded', handleAnnouncementAdded);
    window.addEventListener('bookingUpdated', handleBookingUpdate);

    return () => {
      window.removeEventListener('complaintUpdated', handleComplaintUpdate);
      window.removeEventListener('announcementAdded', handleAnnouncementAdded);
      window.removeEventListener('bookingUpdated', handleBookingUpdate);
    };
  }, [user, fetchData]);

  const staticNotifications: Notification[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Community Meeting',
        description: 'Monthly community meeting this Sunday at 10:00 AM.',
        timestamp: Date.now() - 3600 * 1000,
        type: 'event',
      },
      {
        id: 2,
        title: 'Maintenance Notice',
        description: 'Water supply will be interrupted tomorrow from 10:00 AM to 2:00 PM.',
        timestamp: Date.now() - 24 * 3600 * 1000,
        type: 'maintenance',
      },
      {
        id: 3,
        title: 'New Payment',
        description: 'Your maintenance payment for August has been received.',
        timestamp: Date.now() - 3 * 24 * 3600 * 1000,
        type: 'payment',
      },
    ],
    []
  );

  const announcementNotifications: Notification[] = useMemo(
    () =>
      announcements.map((a) => ({
        id: 1000 + a.id,
        title: a.title,
        description: a.content,
        timestamp: a.date ? new Date(a.date).getTime() : Date.now(),
        type: 'announcement',
      })),
    [announcements]
  );

  const allNotifications: Notification[] = useMemo(
    () => [...announcementNotifications, ...staticNotifications, ...notifications].sort(
      (a, b) => b.timestamp - a.timestamp
    ),
    [announcementNotifications, staticNotifications, notifications]
  );

  const stats = useMemo(
    () => [
      {
        label: 'Pending Bills',
        value: '2', // Replace with API call if dynamic
        icon: CreditCard,
        color: 'text-red-500',
      },
      {
        label: 'Upcoming Visitors',
        value: '3', // Replace with API call if dynamic
        icon: Users,
        color: 'text-blue-500',
      },
      {
        label: 'Open Complaints',
        value: openComplaintsCount.toString(),
        icon: AlertCircle,
        color: 'text-amber-500',
      },
      ...(isSecurity || isAdmin
        ? [
            {
              label: 'Pending Bookings',
              value: pendingBookingsCount.toString(),
              icon: Calendar,
              color: 'text-purple-500',
            },
          ]
        : []),
    ],
    [openComplaintsCount, pendingBookingsCount, isSecurity, isAdmin]
  );

  if (!user) {
    return <Card className="p-4">Loading user data...</Card>;
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {error && <Card className="p-4 mb-6 text-red-600">{error}</Card>}
      {loading ? (
        <Card className="p-4">Loading dashboard data...</Card>
      ) : (
        <>
          <div className="block sm:hidden mb-6 bg-primary/10 rounded-lg p-4 border-l-4 border-primary">
            <p className="text-sm font-medium text-primary">
              Welcome back, <span className="font-semibold">{user?.name || 'User'}</span>
            </p>
            <p className="text-xs text-gray-600">Unit: {user?.unit || 'N/A'}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="flex items-center p-4">
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
          <h2 className="text-lg font-medium text-gray-800 mt-6">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <ActionTile
              icon={Users}
              title="Register Visitor"
              description="Pre-register guests for easy access"
              to="/visitors"
              color="bg-blue-500 text-white"
            />
            <ActionTile
              icon={AlertCircle}
              title="Lodge Complaint"
              description="Report issues that need attention"
              to="/complaints"
              color="bg-amber-500 text-white"
            />
            <ActionTile
              icon={CreditCard}
              title="View Bills"
              description="Check and pay pending bills"
              to="/billing"
              color="bg-emerald-500 text-white"
            />
            <ActionTile
              icon={Car}
              title="Manage Vehicles"
              description="Register or view your vehicles"
              to="/vehicles"
              color="bg-indigo-500 text-white"
            />
            <ActionTile
              icon={Calendar}
              title="Amenity Booking"
              description="Reserve community facilities"
              to="/amenity-booking"
              color="bg-purple-500 text-white"
            />
          </div>
          <div className="flex justify-between items-center mt-6">
            <h2 className="text-lg font-medium text-gray-800">Recent Notifications</h2>
            <Link to="/announcements" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {allNotifications.length === 0 ? (
              <Card className="p-4 text-gray-600">No notifications available</Card>
            ) : (
              allNotifications.map((notification) => (
                <Card key={notification.id} className="flex p-4">
                  <div className="flex-shrink-0 mr-4">
                    {notification.type === 'event' && <Calendar className="w-6 h-6 text-blue-500" />}
                    {notification.type === 'maintenance' && <Sparkles className="w-6 h-6 text-amber-500" />}
                    {notification.type === 'payment' && <CreditCard className="w-6 h-6 text-green-500" />}
                    {notification.type === 'announcement' && <Bell className="w-6 h-6 text-purple-500" />}
                    {notification.type === 'booking' && <Calendar className="w-6 h-6 text-purple-500" />}
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
        </>
      )}
    </div>
  );
};

export default Dashboard;