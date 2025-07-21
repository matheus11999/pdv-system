import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Users, Server, FolderTree, CreditCard, LogOut } from 'lucide-react';

function Sidebar() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';
  const isAdminOrReseller = profile?.role === 'admin' || profile?.role === 'reseller';

  return (
    <div className="w-64 bg-white h-full shadow-lg">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-gray-600">Role: {profile?.role}</p>
      </div>
      <nav className="p-4">
        {isAdmin && (
          <>
            <Link to="/dashboard/categories" className="flex items-center p-2 hover:bg-gray-100 rounded">
              <FolderTree className="w-5 h-5 mr-2" />
              Categories
            </Link>
            <Link to="/dashboard/servers" className="flex items-center p-2 hover:bg-gray-100 rounded">
              <Server className="w-5 h-5 mr-2" />
              Servers
            </Link>
          </>
        )}
        {isAdminOrReseller && (
          <>
            <Link to="/dashboard/ssh-accounts" className="flex items-center p-2 hover:bg-gray-100 rounded">
              <Users className="w-5 h-5 mr-2" />
              SSH Accounts
            </Link>
            <Link to="/dashboard/credits" className="flex items-center p-2 hover:bg-gray-100 rounded">
              <CreditCard className="w-5 h-5 mr-2" />
              Credits
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}

function DashboardHome() {
  const { profile } = useAuthStore();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to your Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Account Information</h2>
        <p>Role: {profile?.role}</p>
        <p>Credits: {profile?.credits}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow h-16 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold">SSH Manager</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <LogOut className="w-5 h-5 mr-1" />
            Sign Out
          </button>
        </header>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            {/* Additional routes will be added here */}
          </Routes>
        </main>
      </div>
    </div>
  );
}