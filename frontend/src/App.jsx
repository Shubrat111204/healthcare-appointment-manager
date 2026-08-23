import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Register from './pages/Register';

import PatientDashboard from './pages/patient/PatientDashboard';
import DoctorSearch from './pages/patient/DoctorSearch';
import BookAppointment from './pages/patient/BookAppointment';

import DoctorDashboard from './pages/doctor/DoctorDashboard';
import PostVisitNotes from './pages/doctor/PostVisitNotes';

import AdminDashboard from './pages/admin/AdminDashboard';
import ManageDoctors from './pages/admin/ManageDoctors';

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const home = user.role === 'doctor' ? '/doctor' : user.role === 'admin' ? '/admin' : '/patient';
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/calendar-connected" element={<div className="p-8 text-center">Google Calendar connected ✅</div>} />

        <Route path="/patient" element={<ProtectedRoute roles={['patient']}><PatientDashboard /></ProtectedRoute>} />
        <Route path="/patient/search" element={<ProtectedRoute roles={['patient']}><DoctorSearch /></ProtectedRoute>} />
        <Route path="/patient/book/:doctorId" element={<ProtectedRoute roles={['patient']}><BookAppointment /></ProtectedRoute>} />

        <Route path="/doctor" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/doctor/visit/:appointmentId" element={<ProtectedRoute roles={['doctor']}><PostVisitNotes /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/doctors" element={<ProtectedRoute roles={['admin']}><ManageDoctors /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
