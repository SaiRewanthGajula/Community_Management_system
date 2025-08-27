import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/Tabs';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import axios from 'axios';
import Select, { MultiValue } from 'react-select';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

interface Bill {
  id: number;
  user_id: number;
  user_name?: string;
  user_unit?: string;
  description: string;
  amount: number | string;
  due_date: string;
  status: 'paid' | 'pending' | 'upcoming';
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

interface User {
  id: number;
  name: string;
  unit: string;
}

interface FormInputs {
  user_ids: { value: number | string; label: string }[];
  description: string;
  amount: string;
  due_date: string;
  status: 'paid' | 'pending' | 'upcoming';
}

const schema = z.object({
  user_ids: z
    .array(z.object({ value: z.union([z.number(), z.string()]), label: z.string() }))
    .min(1, 'At least one resident must be selected'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(255),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid number with up to 2 decimal places'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date is required'),
  status: z.enum(['paid', 'pending', 'upcoming']),
});

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <p className="text-red-600">Something went wrong. Please refresh the page or contact support.</p>;
    }
    return this.props.children;
  }
}

const BillingPayments: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('current');
  const [bills, setBills] = useState<Bill[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const navigate = useNavigate();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      user_ids: [],
      description: '',
      amount: '',
      due_date: '',
      status: 'pending',
    },
  });

  const apiBase = import.meta.env.VITE_BACKEND_API_URL.replace(/\/+$/, '');
  const token = localStorage.getItem('societyToken');

  const fetchBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${apiBase}/bills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Bills:', response.data);
      setBills(response.data);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${apiBase}/bills/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Failed to load residents. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleApiError = (err: any) => {
    if (axios.isAxiosError(err)) {
      const message = err.response?.data?.error || 'An error occurred';
      const details = err.response?.data?.details || '';
      setError(`${message}${details ? `: ${details}` : ''}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('societyToken');
        localStorage.removeItem('societyUser');
        navigate('/login');
      }
    } else {
      setError('An unexpected error occurred');
    }
  };

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    if (!token) {
      setError('Please log in to create bills');
      navigate('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        user_ids: data.user_ids
          .filter((user) => user.value !== 'all')
          .map((user) => Number(user.value)),
        description: data.description,
        amount: parseFloat(data.amount),
        due_date: data.due_date,
        status: data.status,
      };
      console.log('Submitting payload:', payload);
      await axios.post(`${apiBase}/bills`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowAddForm(false);
      reset();
      fetchBills();
    } catch (err: any) {
      console.error('Frontend POST error:', err.response?.data || err.message);
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (billId: number) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${apiBase}/bills/${billId}/pay`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBills();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeToIST = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const calculateSummary = () => {
    const totalDue = bills
      .filter((bill) => bill.status === 'pending' || bill.status === 'upcoming')
      .reduce((sum, bill) => {
        const amount = Number(bill.amount);
        return isNaN(amount) ? sum : sum + amount;
      }, 0);
    const totalPaid = bills
      .filter((bill) => bill.status === 'paid')
      .reduce((sum, bill) => {
        const amount = Number(bill.amount);
        return isNaN(amount) ? sum : sum + amount;
      }, 0);
    return { totalDue, totalPaid };
  };

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }
    const socket = io(apiBase.replace('/api', ''), {
      auth: { token, user_id: user.id },
    });

    socket.on('newNotification', (notification) => {
      if (notification.type === 'bill_reminder' || notification.type === 'bill_overdue') {
        fetchBills();
      }
    });

    fetchBills();
    if (isAdmin) {
      fetchUsers();
    }

    return () => {
      socket.disconnect();
    };
  }, [token, user, isAdmin, navigate]);

  const { totalDue, totalPaid } = calculateSummary();

  const userOptions = [
    { value: 'all', label: 'Select All' },
    ...users.map((user) => ({
      value: user.id,
      label: `${user.name} (${user.unit})`,
    })),
  ];

  const handleSelectChange = (
    selected: MultiValue<{ value: number | string; label: string }>,
    field: { onChange: (value: { value: number | string; label: string }[]) => void }
  ) => {
    if (!selected) {
      field.onChange([]);
      return;
    }
    if (selected.some((option) => option.value === 'all')) {
      field.onChange([...userOptions.filter((option) => option.value !== 'all')]);
    } else {
      field.onChange([...selected]);
    }
  };

  const customStyles = {
    control: (provided: any) => ({
      ...provided,
      border: '1px solid #e5e7eb',
      padding: '0.5rem',
      borderRadius: '0.375rem',
      boxShadow: 'none',
      '&:hover': { borderColor: '#2563eb' },
    }),
    menu: (provided: any) => ({
      ...provided,
      zIndex: 9999,
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.data.value === 'all' && state.isSelected ? '#dbeafe' : provided.backgroundColor,
    }),
  };

  return (
    <ErrorBoundary>
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Billing & Payments</h1>
        {isAdmin && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="mb-4 bg-primary hover:bg-primary/90 text-white focus:ring-primary"
          >
            Add New Bill
          </Button>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="current">Current Bills</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Billing Summary</h2>
              {loading && <p>Loading...</p>}
              {error && <p className="text-red-600">{error}</p>}
              {!loading && !error && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-100 rounded">
                    <h3 className="text-lg font-semibold">Total Due</h3>
                    <p className="text-2xl">₹{totalDue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-gray-100 rounded">
                    <h3 className="text-lg font-semibold">Total Paid</h3>
                    <p className="text-2xl">₹{totalPaid.toFixed(2)}</p>
                  </div>
                </div>
              )}
              <h3 className="text-lg font-semibold mt-6">Current Bills</h3>
              {bills.filter((bill) => bill.status === 'pending' || bill.status === 'upcoming').length === 0 && (
                <p>No current bills.</p>
              )}
              {bills.filter((bill) => bill.status === 'pending' || bill.status === 'upcoming').length > 0 && (
                <div className="overflow-x-auto shadow-md rounded-lg">
                  <table className="w-full text-sm text-left text-gray-700 bg-white border border-gray-200">
                    <thead className="bg-primary text-white">
                      <tr>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Description</th>
                        {isAdmin && <th className="px-6 py-3 border-b-2 border-blue-300">User</th>}
                        <th className="px-6 py-3 border-b-2 border-blue-300">Amount</th>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Due Date</th>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Status</th>
                        {!isAdmin && <th className="px-6 py-3 border-b-2 border-blue-300">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {bills
                        .filter((bill) => bill.status === 'pending' || bill.status === 'upcoming')
                        .map((bill, index) => (
                          <tr
                            key={bill.id}
                            className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white hover:bg-gray-100 transition-colors'}
                          >
                            <td className="px-6 py-4 border-b border-gray-200">{bill.description}</td>
                            {isAdmin && (
                              <td className="px-6 py-4 border-b border-gray-200">
                                {bill.user_name ? `${bill.user_name} (${bill.user_unit || 'N/A'})` : bill.user_id}
                              </td>
                            )}
                            <td className="px-6 py-4 border-b border-gray-200">₹{Number(bill.amount).toFixed(2)}</td>
                            <td className="px-6 py-4 border-b border-gray-200">{formatDateTimeToIST(bill.due_date)}</td>
                            <td className="px-6 py-4 border-b border-gray-200 capitalize">{bill.status}</td>
                            {!isAdmin && (
                              <td className="px-6 py-4 border-b border-gray-200">
                                <Button
                                  onClick={() => handlePayNow(bill.id)}
                                  disabled={loading}
                                  className="bg-green-600 text-white hover:bg-green-700"
                                >
                                  Pay Now
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Payment History</h2>
              {loading && <p>Loading...</p>}
              {error && <p className="text-red-600">{error}</p>}
              {bills.filter((bill) => bill.status === 'paid').length === 0 && !loading && !error && (
                <p>No payment history.</p>
              )}
              {bills.filter((bill) => bill.status === 'paid').length > 0 && (
                <div className="overflow-x-auto shadow-md rounded-lg">
                  <table className="w-full text-sm text-left text-gray-700 bg-white border border-gray-200">
                    <thead className="bg-primary text-white">
                      <tr>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Description</th>
                        {isAdmin && <th className="px-6 py-3 border-b-2 border-blue-300">User</th>}
                        <th className="px-6 py-3 border-b-2 border-blue-300">Amount</th>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Due Date</th>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Status</th>
                        <th className="px-6 py-3 border-b-2 border-blue-300">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills
                        .filter((bill) => bill.status === 'paid')
                        .map((bill, index) => (
                          <tr
                            key={bill.id}
                            className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white hover:bg-gray-100 transition-colors'}
                          >
                            <td className="px-6 py-4 border-b border-gray-200">{bill.description}</td>
                            {isAdmin && (
                              <td className="px-6 py-4 border-b border-gray-200">
                                {bill.user_name ? `${bill.user_name} (${bill.user_unit || 'N/A'})` : bill.user_id}
                              </td>
                            )}
                            <td className="px-6 py-4 border-b border-gray-200">₹{Number(bill.amount).toFixed(2)}</td>
                            <td className="px-6 py-4 border-b border-gray-200">{formatDateTimeToIST(bill.due_date)}</td>
                            <td className="px-6 py-4 border-b border-gray-200 capitalize">{bill.status}</td>
                            <td className="px-6 py-4 border-b border-gray-200">
                              {bill.paid_date ? formatDateTimeToIST(bill.paid_date) : 'N/A'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {isAdmin && showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Card className="p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add New Bill</h2>
              {error && <p className="text-red-600 mb-4">{error}</p>}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Residents</label>
                  <Controller
                    name="user_ids"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={userOptions}
                        isMulti
                        placeholder="Search residents by name or unit..."
                        isDisabled={users.length === 0}
                        className="basic-multi-select"
                        classNamePrefix="select"
                        onChange={(selected) => handleSelectChange(selected, field)}
                        value={field.value}
                        styles={customStyles}
                      />
                    )}
                  />
                  {errors.user_ids && <p className="text-red-600 text-sm mt-1">{errors.user_ids.message}</p>}
                </div>
                <div>
                  <Input
                    label="Description (e.g., Maintenance Fee)"
                    {...register('description')}
                    error={errors.description?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Amount"
                    type="number"
                    step="0.01"
                    {...register('amount')}
                    error={errors.amount?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Due Date"
                    type="date"
                    {...register('due_date')}
                    error={errors.due_date?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    {...register('status')}
                    className="w-full p-2 border rounded focus:ring-primary focus:border-primary"
                  >
                    <option value="pending">Pending</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="paid">Paid</option>
                  </select>
                  {errors.status && <p className="text-red-600 text-sm mt-1">{errors.status.message}</p>}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setError(null);
                      reset();
                    }}
                    className="bg-gray-500 text-white hover:bg-gray-600"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || users.length === 0}
                    className="bg-primary hover:bg-primary/90 text-white focus:ring-primary"
                  >
                    {loading ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default BillingPayments;