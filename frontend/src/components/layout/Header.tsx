// src/components/layout/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface NotificationItem {
  id: string;
  type: 'announcement' | 'complaint';
  title: string;
  description: string;
  date: string;
  link: string;
  number?: number;
}

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('societyToken');
        if (!token) throw new Error('No token found');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch announcements
        const announcementsRes = await axios.get(`${apiUrl}/announcements?limit=10`, { headers });
        console.log('Announcements response:', announcementsRes.data); // Debug
        const announcements = announcementsRes.data.map((item: any) => ({
          id: item.id.toString(),
          title: item.title,
          description: item.content,
          date: item.date || new Date().toISOString().split('T')[0],
          type: 'announcement' as const,
          link: '/announcements',
        }));

        // Fetch complaints
        const complaintsRes = await axios.get(`${apiUrl}/complaints?limit=10`, { headers });
        console.log('Complaints response:', complaintsRes.data); // Debug
        const complaints = complaintsRes.data.map((item: any) => ({
          id: item.id.toString(),
          title: item.title,
          description: item.description,
          date: item.date || new Date().toISOString().split('T')[0],
          type: 'complaint' as const,
          link: '/complaints',
          number: item.id,
        }));

        // Merge and sort by date descending
        const allNotifications = [...announcements, ...complaints].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setNotifications(allNotifications);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        if (axios.isAxiosError(error)) {
          console.log('Axios error details:', {
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url,
          });
          if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('societyToken');
            navigate('/login');
          } else if (error.response?.status === 404) {
            setNotifications([]); // Handle 404 gracefully
          } else {
            console.error('Unexpected error:', error.response?.data?.error || error.message);
          }
        }
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node) &&
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !readNotificationIds.has(n.id)).length;

  const handleNotificationClick = (link: string, id: string) => {
    setShowNotifications(false);
    setReadNotificationIds((prev) => new Set([...prev, id]));
    navigate(link);
  };

  const handleToggleNotifications = () => {
    if (!showNotifications) {
      const allIds = notifications.map((n) => n.id);
      setReadNotificationIds(new Set(allIds));
    }
    setShowNotifications(!showNotifications);
  };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-white shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center">
        <button
          type="button"
          className="p-2 text-gray-500 rounded-md md:hidden focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={onMenuClick}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="w-6 h-6" />
        </button>
        <div className="ml-2 md:ml-0">
          <h1 className="text-lg font-semibold text-primary">Smart Society</h1>
          <p className="hidden text-xs text-gray-500 md:block">Making community living smarter</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative" ref={notificationRef}>
          <button
            className="p-1 text-gray-600 transition-colors rounded-full hover:bg-gray-100 focus:outline-none"
            onClick={handleToggleNotifications}
            aria-haspopup="true"
            aria-expanded={showNotifications}
            aria-label="Notifications"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs text-white bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 w-80 mt-2 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 max-h-96 overflow-y-auto z-50">
              <div className="p-4 border-b border-gray-200 font-semibold text-gray-700">Recent Notifications</div>
              {notifications.length === 0 ? (
                <div className="p-4 text-gray-500">No new notifications</div>
              ) : (
                <ul>
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className="cursor-pointer hover:bg-primary/10 px-4 py-3 border-b border-gray-100 last:border-0"
                      onClick={() => handleNotificationClick(notification.link, notification.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          {notification.number && (
                            <span className="inline-block w-5 h-5 text-center text-white bg-primary rounded-full text-xs font-semibold">
                              {notification.number}
                            </span>
                          )}
                          <p className="font-medium text-gray-900">{notification.title}</p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(notification.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{notification.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            className="flex items-center p-1 space-x-2 text-gray-600 transition-colors rounded-full hover:bg-gray-100 focus:outline-none"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-haspopup="true"
            aria-expanded={showProfileMenu}
            aria-label="User menu"
          >
            <div className="flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full">
              <User className="w-5 h-5" />
            </div>
            <span className="hidden md:block text-sm font-medium">{user?.name}</span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 w-48 mt-2 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
              <div className="py-1">
                <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Profile
                </Link>
                <button
                  onClick={logout}
                  className="block w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;