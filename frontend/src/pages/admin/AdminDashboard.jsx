import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    api.get('/admin/doctors').then((res) => setDoctors(res.data.doctors));
    api.get('/admin/appointments').then((res) => setAppointments(res.data.appointments));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Admin Overview</h1>
        <Link to="/admin/doctors" className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm">
          Manage Doctors & Leave
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-2xl font-bold">{doctors.length}</p>
          <p className="text-sm text-slate-500">Doctors</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-2xl font-bold">{appointments.length}</p>
          <p className="text-sm text-slate-500">Recent appointments</p>
        </div>
      </div>

      <h2 className="font-semibold mb-2">Recent Appointments</h2>
      <div className="space-y-2">
        {appointments.slice(0, 20).map((a) => (
          <div key={a._id} className="bg-white border rounded-lg p-3 text-sm flex justify-between">
            <span>{a.patientId?.name} → Dr. {a.doctorId?.name}</span>
            <span className="text-slate-400">{new Date(a.slotStart).toLocaleString()}</span>
            <span className="uppercase text-xs text-slate-500">{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
