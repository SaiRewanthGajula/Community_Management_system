// src/pages/Announcements.tsx
import React, { useState, useEffect, ChangeEvent } from 'react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const apiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
console.log('Using API base:', apiBase);

interface Announcement {
  id: number;
  title: string;
  content: string;
  date: string | null;
  priority: 'low' | 'medium' | 'high';
}

const Announcements: React.FC = () => {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Announcement | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const token = localStorage.getItem('societyToken');
        if (!token) throw new Error('No token found');
        const res = await axios.get<Announcement[]>(`${apiBase}/announcements?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Announcements response:', res.data); // Debug
        setAnnouncements(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        console.error('Failed to load announcements:', err);
        if (axios.isAxiosError(err)) {
          console.log('Axios error details:', {
            status: err.response?.status,
            data: err.response?.data,
            url: err.config?.url,
          });
          if (err.response?.status === 401 || err.response?.status === 403) {
            localStorage.removeItem('societyToken');
            nav('/login');
          } else if (err.response?.status === 404) {
            setError('Announcements endpoint not found. Check backend configuration.');
          } else {
            setError(err.response?.data?.error || `Failed to load announcements: ${err.message}`);
          }
        } else {
          setError(`Unexpected error: ${err.message}`);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [nav]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const deleteAnnouncement = async (id: number) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      const token = localStorage.getItem('societyToken');
      await axios.delete(`${apiBase}/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      alert('Announcement deleted.');
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || err.message);
    }
  };

  const openEditModal = (announcement: Announcement) => {
    const formatted = announcement.date
      ? new Date(announcement.date).toISOString().split('T')[0]
      : '';
    setEditData({ ...announcement, date: formatted });
    setEditError(null);
    setIsEditing(true);
  };

  const handleEditChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (!editData) return;
    const { name, value } = e.target;
    setEditData({ ...editData, [name]: value } as Announcement);
  };

  const submitEdit = async () => {
    if (!editData) return;
    setEditLoading(true);
    try {
      const { id, title, content, priority } = editData;
      const token = localStorage.getItem('societyToken');
      const res = await axios.put<Announcement>(
        `${apiBase}/announcements/${id}`,
        { title, content, priority },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? res.data : a))
      );
      setIsEditing(false);
      alert('Updated successfully.');
    } catch (err: any) {
      console.error('Update failed:', err);
      setEditError(err.response?.data?.error || err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = filterPriority ? a.priority === filterPriority : true;
    const dateValue = a.date ?? '';
    const matchesDate = filterDate ? dateValue.startsWith(filterDate) : true;
    return matchesSearch && matchesPriority && matchesDate;
  });

  if (loading) return <p className="p-6">Loading announcements...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Announcements</h1>
        {isAdmin && (
          <Button onClick={() => nav('/announcements/new')}>
            <Megaphone className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="px-3 py-2 border rounded"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
      </Card>

      <div className="space-y-4">
        {filteredAnnouncements.length ? (
          filteredAnnouncements.map((a) => (
            <Card key={a.id} className="hover:shadow-md">
              <div className="p-4 flex justify-between">
                <div>
                  <div className="flex items-center mb-2">
                    <h3 className="font-semibold mr-2">{a.title}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getPriorityColor(
                        a.priority
                      )}`}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-1">{a.content}</p>
                  <p className="text-sm text-gray-500">
                    Posted on: {a.date ? new Date(a.date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(a)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Edit Announcement"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(a.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <p className="text-center text-gray-500">No announcements match your filters.</p>
        )}
      </div>

      {isEditing && editData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg w-96 p-6">
            <h2 className="text-xl mb-4">Edit Announcement</h2>
            {editError && <p className="text-red-600 text-sm mb-4">{editError}</p>}
            <Input
              name="title"
              type="text"
              placeholder="Title"
              value={editData.title}
              onChange={handleEditChange}
              required
            />
            <textarea
              name="content"
              rows={4}
              className="w-full border p-2 mt-2 rounded"
              value={editData.content}
              onChange={handleEditChange}
              required
            />
            <select
              name="priority"
              className="w-full p-2 border rounded mt-2"
              value={editData.priority}
              onChange={handleEditChange}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={() => setIsEditing(false)}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button onClick={submitEdit} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;