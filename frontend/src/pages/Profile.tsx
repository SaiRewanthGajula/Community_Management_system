import React from 'react';
import { useAuth } from '../context/AuthContext';

const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <p className="p-6">Loading user information...</p>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-primary hover:text-primary/90 mb-8 border-b-2 border-primary pb-2 focus:ring-primary">Profile</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-primary uppercase tracking-wide">Name</label>
            <p className="mt-1 text-lg text-gray-900 font-semibold">{user.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary uppercase tracking-wide">Phone Number</label>
            <p className="mt-1 text-lg text-gray-900 font-semibold">{user.phone_number}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary uppercase tracking-wide">Unit</label>
            <p className="mt-1 text-lg text-gray-900 font-semibold">{user.unit || 'N/A'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary uppercase tracking-wide">Role</label>
            <p className="mt-1 text-lg text-gray-900 font-semibold">{user.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;