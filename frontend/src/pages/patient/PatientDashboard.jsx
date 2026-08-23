import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const statusColors = {
  confirmed: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  cancelled_by_leave: 'bg-amber-100 text-amber-700',
};

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await api.get('/appointments/my');
    setAppointments(res.data.appointments);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    await api.post(`/appointments/${id}/cancel`, { reason: 'Cancelled by patient' });
    load();
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">My Appointments</h1>
        <Link to="/patient/search" className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm">
          + Book new appointment
        </Link>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}

      <div className="space-y-3">
        {appointments.map((a) => (
          <div key={a._id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">Dr. {a.doctorId?.name}</p>
                <p className="text-sm text-slate-500">{new Date(a.slotStart).toLocaleString()}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${statusColors[a.status] || 'bg-slate-100'}`}>
                {a.status.replace('_', ' ')}
              </span>
            </div>

            {a.preVisitSummary?.chiefComplaint && (
              <p className="text-xs text-slate-400 mt-2">Chief complaint noted: {a.preVisitSummary.chiefComplaint}</p>
            )}

            {a.status === 'completed' && a.postVisitSummary?.summary && (
              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm">
                <p className="font-medium text-emerald-700 mb-1">Visit Summary</p>
                <p>{a.postVisitSummary.summary}</p>
                {a.postVisitSummary.medicationSchedule && (
                  <p className="mt-1"><b>Medication:</b> {a.postVisitSummary.medicationSchedule}</p>
                )}
                {a.postVisitSummary.followUpSteps && (
                  <p className="mt-1"><b>Follow-up:</b> {a.postVisitSummary.followUpSteps}</p>
                )}
              </div>
            )}

            {a.status === 'confirmed' && (
              <button onClick={() => cancel(a._id)} className="mt-3 text-sm text-red-600 hover:underline">
                Cancel appointment
              </button>
            )}
          </div>
        ))}
        {!loading && appointments.length === 0 && <p className="text-slate-400">No appointments yet.</p>}
      </div>
    </div>
  );
}
