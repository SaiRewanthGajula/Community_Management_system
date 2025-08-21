import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, 
  Users, 
  AlertCircle, 
  Bell, 
  CreditCard, 
  Car, 
  Shield, 
  BarChart,
  Calendar
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { isAdmin, isResident, isSecurity } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) => 
    `flex items-center px-4 py-3 text-sm font-medium rounded-md ${
      isActive 
        ? 'bg-primary text-white' 
        : 'text-gray-700 hover:bg-primary/10 hover:text-primary'
    }`;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="flex flex-col flex-1 pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center justify-center flex-shrink-0 px-4">
          <h1 className="text-xl font-bold text-primary">Smart Society</h1>
        </div>
        <nav className="flex-1 px-2 mt-5 space-y-1">
          {isResident && (
            <>
              <NavLink to="/" className={navLinkClass}>
                <Home className="w-5 h-5 mr-3" />
                Dashboard
              </NavLink>
              <NavLink to="/visitors" className={navLinkClass}>
                <Users className="w-5 h-5 mr-3" />
                Visitors
              </NavLink>
              <NavLink to="/complaints" className={navLinkClass}>
                <AlertCircle className="w-5 h-5 mr-3" />
                Complaints
              </NavLink>
              <NavLink to="/announcements" className={navLinkClass}>
                <Bell className="w-5 h-5 mr-3" />
                Announcements
              </NavLink>
              <NavLink to="/billing" className={navLinkClass}>
                <CreditCard className="w-5 h-5 mr-3" />
                Billing & Payments
              </NavLink>
              <NavLink to="/vehicles" className={navLinkClass}>
                <Car className="w-5 h-5 mr-3" />
                Vehicles
              </NavLink>
            </>
          )}
          {isSecurity && (
            <>
              <NavLink to="/security" className={navLinkClass}>
                <Shield className="w-5 h-5 mr-3" />
                Security
              </NavLink>
              <NavLink to="/visitors" className={navLinkClass}>
                <Users className="w-5 h-5 mr-3" />
                Visitors
              </NavLink>
              <NavLink to="/vehicles" className={navLinkClass}>
                <Car className="w-5 h-5 mr-3" />
                Vehicle Logs
              </NavLink>
            </>
          )}
          {isAdmin && (
            <>
              <NavLink to="/admin" className={navLinkClass}>
                <BarChart className="w-5 h-5 mr-3" />
                Admin Dashboard
              </NavLink>
              <NavLink to="/announcements" className={navLinkClass}>
                <Bell className="w-5 h-5 mr-3" />
                Announcements
              </NavLink>
              <NavLink to="/complaints" className={navLinkClass}>
                <AlertCircle className="w-5 h-5 mr-3" />
                Complaints
              </NavLink>
              <NavLink to="/visitors" className={navLinkClass}>
                <Users className="w-5 h-5 mr-3" />
                Visitors
              </NavLink>
              <NavLink to="/billing" className={navLinkClass}>
                <CreditCard className="w-5 h-5 mr-3" />
                Billing
              </NavLink>
              <NavLink to="/vehicles" className={navLinkClass}>
                <Car className="w-5 h-5 mr-3" />
                Vehicles
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;