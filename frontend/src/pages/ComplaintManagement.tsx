import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { MessageSquare, Filter, Plus, Search, X } from 'lucide-react';

// Utility function for API URLs
const getApiUrl = (endpoint: string) => {
  const baseUrl = import.meta.env.VITE_BACKEND_API_URL.replace(/\/+$/, '');
  return `${baseUrl}${endpoint}`;
};

// Utility function to format date and time in IST with proper formatting
const formatDateTimeToIST = (dateString: string) => {
  if (!dateString) return 'N/A';
  
  try {
    // Create a date object from the input string
    const date = new Date(dateString);
    
    // Get the current timezone offset in minutes
    const timezoneOffset = date.getTimezoneOffset();
    
    // Convert to IST (UTC+5:30)
    // IST is UTC+5:30, which is 330 minutes ahead of UTC
    // getTimezoneOffset() returns the difference in minutes between UTC and local time
    // So we need to adjust for both the local timezone and IST
    const istOffset = 330; // IST is UTC+5:30 = 330 minutes
    const totalOffset = timezoneOffset + istOffset;
    const istTime = new Date(date.getTime() + totalOffset * 60 * 1000);
    
    // Get date components
    const day = String(istTime.getDate()).padStart(2, '0');
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const year = istTime.getFullYear();
    
    // Get time components
    let hours = istTime.getHours();
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');
    
    return `${day}/${month}/${year}, ${formattedHours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    
    // Fallback: try to format with toLocaleString
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString; // Return original if parsing fails
    }
  }
};

// Utility function to get current date in IST format for form inputs
const getCurrentISTDate = () => {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000; // IST offset is UTC+5:30
  const istTime = new Date(now.getTime() + offset);
  return istTime.toISOString().split('T')[0];
};

interface Complaint {
  id: number;
  user_id: number;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved';
  date: string;
  unit: string;
  priority: 'low' | 'medium' | 'high';
  resolution_description: string | null;
  resolved_by: number | null;
  resolved_at: string | null;
}

const ComplaintManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const userId = user?.id;
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [newComplaint, setNewComplaint] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });
  const [editComplaint, setEditComplaint] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });
  const [resolveDescription, setResolveDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setLoading(true);
        const apiUrl = getApiUrl('/complaints');
        console.log('Fetching complaints from:', apiUrl);
        const response = await axios.get(apiUrl, {
          headers: { Authorization: `Bearer ${localStorage.getItem('societyToken')}` },
        });
        setComplaints(response.data);
      } catch (err: any) {
        console.error('Error fetching complaints:', err);
        setFetchError(err.response?.data?.error || 'Failed to load complaints');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesSearch =
      complaint.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.unit.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = !priorityFilter || complaint.priority === priorityFilter;
    
    // Convert complaint date to IST for filtering (date only)
    const complaintDate = new Date(complaint.date);
    const complaintDateOnly = complaintDate.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });
    
    const matchesDate =
      (!startDateFilter || complaintDateOnly >= startDateFilter) &&
      (!endDateFilter || complaintDateOnly <= endDateFilter);
    
    return matchesSearch && matchesPriority && matchesDate;
  });

  const handleNewComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newComplaint.title || !newComplaint.description) {
      setError('Title and description are required');
      return;
    }

    try {
      const apiUrl = getApiUrl('/complaints');
      console.log('Creating complaint at:', apiUrl);
      const response = await axios.post(
        apiUrl,
        {
          title: newComplaint.title,
          description: newComplaint.description,
          priority: newComplaint.priority,
        },
        {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('societyToken'),
          },
        }
      );

      const newComplaintData: Complaint = {
        id: response.data.id,
        user_id: response.data.user_id,
        title: response.data.title,
        description: response.data.description,
        status: response.data.status,
        date: response.data.date,
        unit: response.data.unit || '',
        priority: response.data.priority,
        resolution_description: response.data.resolution_description,
        resolved_by: response.data.resolved_by,
        resolved_at: response.data.resolved_at,
      };

      setComplaints([newComplaintData, ...complaints]);
      setNewComplaint({ title: '', description: '', priority: 'medium' });
      setShowNewModal(false);

      // Dispatch event to notify dashboard to update open complaints count
      window.dispatchEvent(new Event('complaintUpdated'));
    } catch (err: any) {
      console.error('Error creating complaint:', err);
      setError(err.response?.data?.error || 'Failed to create complaint');
    }
  };

  const handleEditComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!editComplaint.title || !editComplaint.description) {
      setError('Title and description are required');
      return;
    }

    try {
      const apiUrl = getApiUrl(`/complaints/${selectedComplaint?.id}`);
      console.log('Updating complaint at:', apiUrl);
      const response = await axios.put(
        apiUrl,
        {
          title: editComplaint.title,
          description: editComplaint.description,
          priority: editComplaint.priority,
        },
        {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('societyToken'),
          },
        }
      );

      const updatedComplaint: Complaint = {
        id: response.data.id,
        user_id: response.data.user_id,
        title: response.data.title,
        description: response.data.description,
        status: response.data.status,
        date: response.data.date,
        unit: response.data.unit || '',
        priority: response.data.priority,
        resolution_description: response.data.resolution_description,
        resolved_by: response.data.resolved_by,
        resolved_at: response.data.resolved_at,
      };

      setComplaints(complaints.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c)));
      setEditComplaint({ title: '', description: '', priority: 'medium' });
      setShowEditModal(false);
      setSelectedComplaint(null);
    } catch (err: any) {
      console.error('Error updating complaint:', err);
      setError(err.response?.data?.error || 'Failed to update complaint');
    }
  };

  // In your resolveComplaintSubmit function
const handleResolveComplaintSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');

  if (!resolveDescription) {
    setError('Resolution description is required');
    return;
  }

  try {
    const apiUrl = getApiUrl(`/complaints/${selectedComplaint?.id}/resolve`);
    console.log('Resolving complaint at:', apiUrl);
    const response = await axios.put(
      apiUrl,
      {
        resolution_description: resolveDescription,
      },
      {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('societyToken'),
        },
      }
    );

    const updatedComplaint: Complaint = {
      id: response.data.id,
      user_id: response.data.user_id,
      title: response.data.title,
      description: response.data.description,
      status: response.data.status,
      date: response.data.date,
      unit: response.data.unit || '',
      priority: response.data.priority,
      resolution_description: response.data.resolution_description,
      resolved_by: response.data.resolved_by,
      resolved_at: response.data.resolved_at || new Date().toISOString(), // Fallback to current date
    };

    setComplaints(complaints.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c)));
    setResolveDescription('');
    setShowResolveModal(false);
    setSelectedComplaint(null);
  } catch (err: any) {
    console.error('Error resolving complaint:', err);
    setError(err.response?.data?.error || 'Failed to resolve complaint');
  }
};

  const handleViewClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setShowViewModal(true);
  };

  const handleEditClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setEditComplaint({
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
    });
    setShowEditModal(true);
  };

  const handleResolveClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setResolveDescription('');
    setShowResolveModal(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <MessageSquare className="mr-2 h-6 w-6" />
          Complaint Management
        </h1>
        {!isAdmin && (
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Complaint
          </Button>
        )}
      </div>

      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            type="text"
            placeholder="Search complaints..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 h-10 px-2"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <Input
            type="date"
            placeholder="Start Date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="h-10"
          />
          <Input
            type="date"
            placeholder="End Date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="h-10"
          />
          <Button
            variant="outline"
            onClick={() => {
              setPriorityFilter('');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
            className="flex items-center"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-6 text-center">
          <p>Loading complaints...</p>
        </Card>
      ) : fetchError ? (
        <Card className="p-6 text-center text-red-800 bg-red-100">
          <p>{fetchError}</p>
        </Card>
      ) : filteredComplaints.length === 0 ? (
        <Card className="p-6 text-center">
          <p>No complaints found. {isAdmin ? 'No complaints exist in the system.' : 'Submit a new complaint to get started.'}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Unit
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date & Time (IST)
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Priority
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{complaint.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="font-medium">{complaint.title}</div>
                      <div className="text-xs text-gray-400 truncate max-w-xs">{complaint.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{complaint.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTimeToIST(complaint.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          complaint.status
                        )}`}
                      >
                        {complaint.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(
                          complaint.priority
                        )}`}
                      >
                        {complaint.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="text"
                          onClick={() => handleViewClick(complaint)}
                        >
                          View
                        </Button>
                        {!isAdmin && (
                          <Button
                            size="sm"
                            variant="text"
                            onClick={() => handleEditClick(complaint)}
                            disabled={complaint.status === 'resolved'}
                          >
                            Edit
                          </Button>
                        )}
                        {(isAdmin || complaint.user_id?.toString() === userId?.toString()) &&
                          complaint.status !== 'resolved' && (
                            <Button
                              size="sm"
                              variant="text"
                              onClick={() => handleResolveClick(complaint)}
                            >
                              Mark as Resolved
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New Complaint Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowNewModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">New Complaint</h2>
            {error && (
              <div className="p-3 text-sm text-red-800 bg-red-100 rounded-md mb-4">{error}</div>
            )}
            <form onSubmit={handleNewComplaintSubmit} className="space-y-4">
              <Input
                label="Title"
                type="text"
                value={newComplaint.title}
                onChange={(e) => setNewComplaint({ ...newComplaint, title: e.target.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  rows={4}
                  required
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <select
                  value={newComplaint.priority}
                  onChange={(e) =>
                    setNewComplaint({ ...newComplaint, priority: e.target.value as 'low' | 'medium' | 'high' })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowNewModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Complaint</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* View Complaint Modal */}
      {showViewModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowViewModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Complaint Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ID</label>
                <p className="mt-1 text-sm text-gray-900">#{selectedComplaint.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <p className="mt-1 text-sm text-gray-900">{selectedComplaint.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="mt-1 text-sm text-gray-900">{selectedComplaint.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unit</label>
                <p className="mt-1 text-sm text-gray-900">{selectedComplaint.unit || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date & Time (IST)</label>
                <p className="mt-1 text-sm text-gray-900">{formatDateTimeToIST(selectedComplaint.date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span
                  className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                    selectedComplaint.status
                  )}`}
                >
                  {selectedComplaint.status.replace('-', ' ')}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <span
                  className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(
                    selectedComplaint.priority
                  )}`}
                >
                  {selectedComplaint.priority}
                </span>
              </div>
              {selectedComplaint.status === 'resolved' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resolution Description</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedComplaint.resolution_description || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resolved By (User ID)</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedComplaint.resolved_by?.toString() || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resolved Date & Time (IST)</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedComplaint.resolution_description ? formatDateTimeToIST(selectedComplaint.date) : 'N/A'}
                    </p>
                  </div>
                </>
              )}
              <div className="flex justify-end space-x-2">
                {(isAdmin || selectedComplaint.user_id?.toString() === userId?.toString()) &&
                  selectedComplaint.status !== 'resolved' && (
                    <Button onClick={() => handleResolveClick(selectedComplaint)}>
                      Mark as Resolved
                    </Button>
                  )}
                <Button onClick={() => setShowViewModal(false)}>Close</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Complaint Modal */}
      {showEditModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Edit Complaint</h2>
            {error && (
              <div className="p-3 text-sm text-red-800 bg-red-100 rounded-md mb-4">{error}</div>
            )}
            <form onSubmit={handleEditComplaintSubmit} className="space-y-4">
              <Input
                label="Title"
                type="text"
                value={editComplaint.title}
                onChange={(e) => setEditComplaint({ ...editComplaint, title: e.target.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editComplaint.description}
                  onChange={(e) => setEditComplaint({ ...editComplaint, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  rows={4}
                  required
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <select
                  value={editComplaint.priority}
                  onChange={(e) =>
                    setEditComplaint({ ...editComplaint, priority: e.target.value as 'low' | 'medium' | 'high' })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Resolve Complaint Modal */}
      {showResolveModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowResolveModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Mark Complaint as Resolved</h2>
            {error && (
              <div className="p-3 text-sm text-red-800 bg-red-100 rounded-md mb-4">{error}</div>
            )}
            <form onSubmit={handleResolveComplaintSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Resolution Description</label>
                <textarea
                  value={resolveDescription}
                  onChange={(e) => setResolveDescription(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  rows={4}
                  required
                ></textarea>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Resolve Complaint</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ComplaintManagement;