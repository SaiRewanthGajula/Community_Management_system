import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/common/Tabs';
import  Button  from '../components/common/Button';
import  Card  from '../components/common/Card';
import axios from 'axios';

interface Bill {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'upcoming';
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

const BillingPayments: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const apiBase = import.meta.env.VITE_BACKEND_API_URL.replace(/\/+$/, '');
  const token = localStorage.getItem('societyToken');

  // Fetch bills
  const fetchBills = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiBase}/bills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBills(response.data);
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle API errors
  const handleApiError = (err: any) => {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('societyToken');
        navigate('/login');
      } else {
        setError(err.response?.data?.message || 'An error occurred');
      }
    } else {
      setError('An unexpected error occurred');
    }
  };

  // Placeholder for payment processing
  const handlePayNow = async (billId: number) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Integrate with payment gateway (e.g., Razorpay)
      alert(`Initiating payment for bill ID: ${billId}`);
      // Example: await axios.post(`${apiBase}/bills/${billId}/pay`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchBills(); // Refresh bills after payment
    } catch (err: any) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // Format date to IST
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

  // Calculate summary
  const calculateSummary = () => {
    const totalDue = bills
      .filter((bill) => bill.status === 'pending' || bill.status === 'upcoming')
      .reduce((sum, bill) => sum + bill.amount, 0);
    const totalPaid = bills
      .filter((bill) => bill.status === 'paid')
      .reduce((sum, bill) => sum + bill.amount, 0);
    return { totalDue, totalPaid };
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const { totalDue, totalPaid } = calculateSummary();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Billing & Payments</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
            <h3 className="text-lg font-semibold mt-6">Pending Bills</h3>
            {bills.filter((bill) => bill.status === 'pending' || bill.status === 'upcoming').length === 0 && (
              <p>No pending bills.</p>
            )}
            {bills
              .filter((bill) => bill.status === 'pending' || bill.status === 'upcoming')
              .map((bill) => (
                <div key={bill.id} className="flex justify-between items-center p-4 border-b">
                  <div>
                    <p className="font-semibold">{bill.description}</p>
                    <p>Due: {formatDateTimeToIST(bill.due_date)}</p>
                    <p>Amount: ₹{bill.amount.toFixed(2)}</p>
                  </div>
                  <Button onClick={() => handlePayNow(bill.id)} disabled={loading}>
                    Pay Now
                  </Button>
                </div>
              ))}
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Payment History</h2>
            {loading && <p>Loading...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {bills.length === 0 && !loading && !error && <p>No payment history.</p>}
            {bills.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Description</th>
                      <th className="border p-2 text-left">Amount</th>
                      <th className="border p-2 text-left">Due Date</th>
                      <th className="border p-2 text-left">Status</th>
                      <th className="border p-2 text-left">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.id}>
                        <td className="border p-2">{bill.description}</td>
                        <td className="border p-2">₹{bill.amount.toFixed(2)}</td>
                        <td className="border p-2">{formatDateTimeToIST(bill.due_date)}</td>
                        <td className="border p-2 capitalize">{bill.status}</td>
                        <td className="border p-2">{bill.paid_date ? formatDateTimeToIST(bill.paid_date) : 'N/A'}</td>
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

export default BillingPayments;