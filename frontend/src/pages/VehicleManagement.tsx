import React, { useState, useEffect, ChangeEvent } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Car, Plus, Edit, Trash2 } from 'lucide-react';

interface Vehicle {
  id: number;
  user_id: number;
  license_plate: string;
  model: string;
  color: string;
  parking_spot?: string;
  unit?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

const VehicleManagement: React.FC = () => {
  const { user, isAdmin, isResident, isSecurity } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    license_plate: '',
    model: '',
    color: '',
    parking_spot: '',
  });
  const [pagination, setPagination] = useState({ total: 0, limit: 10, offset: 0 });

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('societyToken');
        if (!token) throw new Error('No token found');

        console.log('Fetching vehicles with limit:', pagination.limit, 'offset:', pagination.offset); // Debug log
        const res = await axios.get(`${apiUrl}/vehicles?limit=${pagination.limit}&offset=${pagination.offset}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log('Vehicles response:', res.data); // Debug log
        setVehicles(res.data.vehicles || []);
        setPagination(prev => ({ ...prev, total: res.data.total || 0 }));
      } catch (err: any) {
        console.error('Failed to load vehicles:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401 || err.response?.status === 403) {
            localStorage.removeItem('societyToken');
            window.location.href = '/login';
          }
          setError(err.response?.data?.error || 'Failed to load vehicles');
        } else {
          setError('Unexpected error: ' + err.message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [pagination.offset, pagination.limit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('societyToken');
      const method = editingVehicle ? 'put' : 'post';
      const url = editingVehicle ? `${apiUrl}/vehicles/${editingVehicle.id}` : `${apiUrl}/vehicles`;

      const payload = { license_plate: formData.license_plate, model: formData.model, color: formData.color };
      if (isAdmin && formData.parking_spot) {
        payload.parking_spot = formData.parking_spot;
      }

      const res = await axios({
        method,
        url,
        data: payload,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (editingVehicle) {
        setVehicles(vehicles.map(v => v.id === editingVehicle.id ? res.data : v));
      } else {
        setVehicles([res.data, ...vehicles]);
        setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      }

      setShowForm(false);
      setEditingVehicle(null);
      setFormData({ license_plate: '', model: '', color: '', parking_spot: '' });
    } catch (err: any) {
      console.error('Failed to save vehicle:', err);
      setError(err.response?.data?.error || 'Failed to save vehicle');
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setFormData({
      license_plate: vehicle.license_plate,
      model: vehicle.model,
      color: vehicle.color,
      parking_spot: vehicle.parking_spot || '',
    });
    setEditingVehicle(vehicle);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('societyToken');

      await axios.delete(`${apiUrl}/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setVehicles(vehicles.filter(v => v.id !== id));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (err: any) {
      console.error('Failed to delete vehicle:', err);
      setError(err.response?.data?.error || 'Failed to delete vehicle');
    }
  };

  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
  };

  const canEditDelete = isResident || isAdmin;
  const canAdd = isResident || isAdmin;

  if (loading) return <p className="p-6 text-center">Loading vehicles...</p>;
  if (error) return <p className="p-6 text-center text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{isSecurity ? 'Vehicle Logs' : 'Vehicle Management'}</h1>
        {canAdd && (
          <Button onClick={() => { setShowForm(true); setEditingVehicle(null); setFormData({ license_plate: '', model: '', color: '', parking_spot: '' }); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        )}
      </div>

      {showForm && canAdd && (
        <Card className="mb-6">
          <h2 className="text-xl font-semibold mb-4">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="License Plate"
              value={formData.license_plate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, license_plate: e.target.value })}
              required
              maxLength={20}
            />
            <Input
              label="Model"
              value={formData.model}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, model: e.target.value })}
              required
            />
            <Input
              label="Color"
              value={formData.color}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, color: e.target.value })}
              required
            />
            {isAdmin && (
              <Input
                label="Parking Spot (optional)"
                value={formData.parking_spot}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, parking_spot: e.target.value })}
              />
            )}
            <div className="flex space-x-2">
              <Button type="submit">{editingVehicle ? 'Update' : 'Save'}</Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditingVehicle(null); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-6">
        {vehicles.length === 0 ? (
          <p className="text-center text-gray-500">No vehicles registered.</p>
        ) : (
          vehicles.map((vehicle) => (
            <Card key={vehicle.id}>
              <div className="flex justify-between items-center p-4">
                <div>
                  <h3 className="font-medium text-gray-900">{vehicle.license_plate}</h3>
                  <p className="text-gray-600">{vehicle.model} - {vehicle.color}</p>
                  <p className="text-sm text-gray-500">Parking Spot: {vehicle.parking_spot || vehicle.unit || 'N/A'}</p>
                  {(isSecurity || isAdmin) && (
                    <>
                      <p className="text-sm text-gray-500">Unit: {vehicle.unit || 'N/A'}</p>
                      <p className="text-sm text-gray-500">Phone: {vehicle.phone_number || 'N/A'}</p>
                    </>
                  )}
                  <p className="text-sm text-gray-500">Registered on: {new Date(vehicle.created_at).toLocaleDateString()}</p>
                </div>
                {canEditDelete && (
                  <div className="flex space-x-2">
                    <Button variant="text" onClick={() => handleEdit(vehicle)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="text" onClick={() => handleDelete(vehicle.id)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {pagination.total > pagination.limit && (
        <div className="flex justify-center mt-6 space-x-2">
          <Button
            disabled={pagination.offset === 0}
            onClick={() => handlePageChange(pagination.offset - pagination.limit)}
          >
            Previous
          </Button>
          <Button
            disabled={pagination.offset + pagination.limit >= pagination.total}
            onClick={() => handlePageChange(pagination.offset + pagination.limit)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default VehicleManagement;