import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const home = user?.role === 'doctor' ? '/doctor' : user?.role === 'admin' ? '/admin' : '/patient';

  return (
    <nav className="bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between">
      <Link to={user ? home : '/login'} className="font-bold text-lg text-sky-700">
        🩺 Clinic Manager
      </Link>
      {user && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">
            {user.name} <span className="uppercase text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded">{user.role}</span>
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
