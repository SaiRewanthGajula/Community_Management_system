import React from 'react';

const AdminDashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">User Management</h2>
          <p className="text-gray-600 mb-4">Manage resident accounts, permissions, and access controls.</p>
          <button className="bg-primary hover:bg-primary/90 text-white focus:ring-primary rounded px-4 py-2">
            Manage Users
          </button>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">System Settings</h2>
          <p className="text-gray-600 mb-4">Configure application settings, notifications, and preferences.</p>
          <button className="bg-primary hover:bg-primary/90 text-white focus:ring-primary rounded px-4 py-2">
            Edit Settings
          </button>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Reports & Analytics</h2>
          <p className="text-gray-600 mb-4">View and export system data, usage statistics, and reports.</p>
          <button className="bg-primary hover:bg-primary/90 text-white focus:ring-primary rounded px-4 py-2">
            View Reports
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;