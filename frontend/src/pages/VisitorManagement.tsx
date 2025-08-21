import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/Tabs';
import Button  from '../components/common/Button';
import Input  from '../components/common/Input';
import  Card  from '../components/common/Card';
import axios, { AxiosResponse } from 'axios';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface Visitor {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  purpose: string;
  check_in: string | null;
  check_out: string | null;
  user_id: number | null;
  unit: string | null;
  pin: string | null;
}

interface FormInputs {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  purpose: string;
  unit?: string | null;
}

interface PinFormInputs {
  pin: string;
}

interface User {
  id: number;
  name: string;
  phone_number: string;
  employee_id: string;
  role: string;
}

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be a 10-digit number'),
  email: z.string().email('Invalid email').nullable().optional(),
  address: z.string().max(200, 'Address must be 200 characters or less').nullable().optional(),
  purpose: z.string().min(5, 'Purpose must be at least 5 characters').max(100),
  unit: z.string().max(50, 'Unit must be 50 characters or less').nullable().optional(),
});

const pinSchema = z.object({
  pin: z.string().regex(/^[0-9]{4}$/, 'PIN must be a 4-digit number'),
});

const VisitorManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('register');
  const [currentVisitors, setCurrentVisitors] = useState<Visitor[]>([]);
  const [visitorHistory, setVisitorHistory] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinVerificationId, setPinVerificationId] = useState<number | null>(null);
  const [checkedInVisitors, setCheckedInVisitors] = useState<Set<number>>(new Set());
  const [responseData, setResponseData] = useState<Visitor | null>(null); // State to store registration response
  const navigate = useNavigate();

  // Retrieve and parse user from localStorage
  const userData = localStorage.getItem('societyUser') ? JSON.parse(localStorage.getItem('societyUser')!) : null;
  const role = userData?.role;

  // Debug user data
  useEffect(() => {
    console.log('User Data:', userData);
  }, [userData]);

  // Debug role value
  useEffect(() => {
    console.log('User Role:', role);
  }, [role]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: null,
      address: null,
      purpose: '',
      unit: null,
    },
  });

  const {
    register: registerPin,
    handleSubmit: handlePinSubmit,
    reset: resetPin,
    formState: { errors: pinErrors },
  } = useForm<PinFormInputs>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  const apiBase = import.meta.env.VITE_BACKEND_API_URL.replace(/\/+$/, '');
  const token = localStorage.getItem('societyToken');

  const fetchCurrentVisitors = async () => {
    if (!token) {
      setError('Please log in to view visitors');
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const response: AxiosResponse<Visitor[]> = await axios.get(`${apiBase}/visitors/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('FetchCurrentVisitors Response:', response.data); // Debug log
      setCurrentVisitors(response.data);
      const checkedIn = new Set<number>(
        response.data
          .filter((visitor) => visitor.check_in && !visitor.check_out)
          .map((visitor) => visitor.id)
      );
      setCheckedInVisitors(checkedIn);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitorHistory = async () => {
    if (!token) {
      setError('Please log in to view visitor history');
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const response: AxiosResponse<Visitor[]> = await axios.get(`${apiBase}/visitors/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVisitorHistory(response.data);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApiError = (err: any) => {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('societyToken');
        setError('Session expired. Please log in again.');
        navigate('/login');
      } else {
        setError(err.response?.data?.message || 'An error occurred');
      }
    } else {
      setError('An unexpected error occurred');
    }
  };

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    if (!token) {
      setError('Please log in to register visitors');
      navigate('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response: AxiosResponse<Visitor> = await axios.post(`${apiBase}/visitors/checkin`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('CheckIn Response:', response.data); // Debug log
      setResponseData(response.data); // Store the response with pin
      reset();
      fetchCurrentVisitors();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePinVerification = async (data: PinFormInputs, visitorId: number) => {
    if (!token) {
      setError('Please log in to verify PIN');
      navigate('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response: AxiosResponse<Visitor> = await axios.post(
        `${apiBase}/visitors/verify-pin/${visitorId}`,
        { pin: data.pin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('VerifyPin Response:', response.data); // Debug log
      setPinVerificationId(null);
      resetPin();
      setCheckedInVisitors((prev) => new Set([...prev, visitorId]));
      fetchCurrentVisitors();
      fetchVisitorHistory();
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (visitorId: number) => {
    if (!token) {
      setError('Please log in to check out visitors');
      navigate('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.post(
        `${apiBase}/visitors/checkout/${visitorId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCheckedInVisitors((prev) => {
        const newSet = new Set(prev);
        newSet.delete(visitorId);
        return newSet;
      });
      fetchCurrentVisitors();
      fetchVisitorHistory();
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
        timeStyle: 'short',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    if (role === 'security') {
      setActiveTab('current');
    }
    fetchCurrentVisitors();
    fetchVisitorHistory();
  }, [role]);

  // Clear responseData after 10 seconds
  useEffect(() => {
    const timer = responseData ? setTimeout(() => setResponseData(null), 10000) : null;
    return () => timer ? clearTimeout(timer) : undefined;
  }, [responseData]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Visitor Management</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {role === 'resident' && <TabsTrigger value="register">Register Visitor</TabsTrigger>}
          {role === 'security' && <TabsTrigger value="current">Current Visitors</TabsTrigger>}
          <TabsTrigger value="history">Visitor History</TabsTrigger>
        </TabsList>

        {role === 'resident' && (
          <TabsContent value="register">
            <Card className="p-6 max-w-md mx-auto">
              <h2 className="text-xl font-semibold mb-4">Register New Visitor</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Input
                    label="Name"
                    {...register('name')}
                    error={errors.name?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Phone"
                    {...register('phone')}
                    error={errors.phone?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Email"
                    {...register('email')}
                    error={errors.email?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Address"
                    {...register('address')}
                    error={errors.address?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Purpose of Visit"
                    {...register('purpose')}
                    error={errors.purpose?.message}
                    fullWidth
                  />
                </div>
                <div>
                  <Input
                    label="Unit"
                    {...register('unit')}
                    error={errors.unit?.message}
                    fullWidth
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Register Visitor'}
                </Button>
              </form>
              {error && <p className="text-red-600 mt-4">{error}</p>}
              {responseData?.pin && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">Visitor PIN</h3>
                  <p className="text-sm text-gray-700">PIN: {responseData.pin}</p>
                </div>
              )}
            </Card>
          </TabsContent>
        )}

        {role === 'security' && (
          <TabsContent value="current">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Current Visitors</h2>
              {loading && <p>Loading...</p>}
              {error && <p className="text-red-600">{error}</p>}
              {currentVisitors.length === 0 && !loading && !error && <p>No current visitors.</p>}
              {currentVisitors.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Name</th>
                        <th className="border p-2 text-left">Phone</th>
                        <th className="border p-2 text-left">Purpose</th>
                        <th className="border p-2 text-left">Check-In</th>
                        <th className="border p-2 text-left">Unit</th>
                        <th className="border p-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentVisitors.map((visitor) => (
                        <tr key={visitor.id}>
                          <td className="border p-2">{visitor.name}</td>
                          <td className="border p-2">{visitor.phone}</td>
                          <td className="border p-2">{visitor.purpose}</td>
                          <td className="border p-2">{visitor.check_in ? formatDateTimeToIST(visitor.check_in) : 'Pending'}</td>
                          <td className="border p-2">{visitor.unit || 'N/A'}</td>
                          <td className="border p-2">
                            {visitor.check_in ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleCheckOut(visitor.id)}
                                disabled={loading}
                              >
                                Check Out
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPinVerificationId(visitor.id)}
                                disabled={loading}
                              >
                                Check In
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pinVerificationId && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">Verify PIN</h3>
                  <form
                    onSubmit={handlePinSubmit((data) => handlePinVerification(data, pinVerificationId))}
                    className="space-y-4 max-w-md"
                  >
                    <Input
                      label="Enter 4-Digit PIN"
                      {...registerPin('pin')}
                      error={pinErrors.pin?.message}
                      fullWidth
                    />
                    <div className="flex space-x-2">
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Verifying...' : 'Verify PIN'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPinVerificationId(null);
                          resetPin();
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </Card>
          </TabsContent>
        )}

        <TabsContent value="history">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Visitor History</h2>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {visitorHistory.length === 0 && !loading && !error && <p>No visitor history.</p>}
            {visitorHistory.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Phone</th>
                      <th className="border p-2 text-left">Purpose</th>
                      <th className="border p-2 text-left">Check-In</th>
                      <th className="border p-2 text-left">Check-Out</th>
                      <th className="border p-2 text-left">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitorHistory.map((visitor) => (
                      <tr key={visitor.id}>
                        <td className="border p-2">{visitor.name}</td>
                        <td className="border p-2">{visitor.phone}</td>
                        <td className="border p-2">{visitor.purpose}</td>
                        <td className="border p-2">{visitor.check_in ? formatDateTimeToIST(visitor.check_in) : 'N/A'}</td>
                        <td className="border p-2">{visitor.check_out ? formatDateTimeToIST(visitor.check_out) : 'N/A'}</td>
                        <td className="border p-2">{visitor.unit || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VisitorManagement;
