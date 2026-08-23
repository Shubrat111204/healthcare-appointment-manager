import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function emptyForm() {
  return {
    name: '', email: '', phone: '', specialisation: '', bio: '',
    slotDurationMinutes: 30,
    workingHours: [1, 2, 3, 4, 5].map((d) => ({ day: d, start: '09:00', end: '17:00' })),
  };
}

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [leaveDate, setLeaveDate] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/admin/doctors').then((res) => setDoctors(res.data.doctors));
  useEffect(() => { load(); }, []);

  const createDoctor = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.post('/admin/doctors', form);
      setMessage(`Doctor created. Login credentials were emailed to ${form.email}.`);
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create doctor');
    }
  };

  const markLeave = async (doctorId) => {
    const date = leaveDate[doctorId];
    if (!date) return;
    const res = await api.post(`/admin/doctors/${doctorId}/leave`, { date });
    setMessage(`Leave recorded. ${res.data.affectedCount} appointment(s) cancelled & patients notified.`);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold mb-4">Add Doctor</h1>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {message && <p className="text-sm text-emerald-600 mb-2">{message}</p>}
        <form onSubmit={createDoctor} className="bg-white border rounded-lg p-4 grid grid-cols-2 gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2" placeholder="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2" placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Specialisation" value={form.specialisation}
            onChange={(e) => setForm({ ...form, specialisation: e.target.value })} required />
          <input className="border rounded-lg px-3 py-2 col-span-2" placeholder="Bio" value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <label className="text-sm col-span-2">Slot duration (minutes)
            <input className="border rounded-lg px-3 py-2 w-24 ml-2" type="number" value={form.slotDurationMinutes}
              onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })} />
          </label>
          <div className="col-span-2 text-sm text-slate-500">
            Default working hours: Mon–Fri, 09:00–17:00 (edit later from the API if needed)
          </div>
          <button className="col-span-2 bg-sky-600 text-white rounded-lg py-2">Create Doctor</button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Doctors</h2>
        <div className="space-y-3">
          {doctors.map((d) => (
            <div key={d._id} className="bg-white border rounded-lg p-4">
              <p className="font-semibold">Dr. {d.name} — {d.doctorProfile?.specialisation}</p>
              <p className="text-xs text-slate-400">{d.email}</p>
              <div className="mt-2 flex gap-2 items-center">
                <input type="date" className="border rounded-lg px-2 py-1 text-sm"
                  onChange={(e) => setLeaveDate({ ...leaveDate, [d._id]: e.target.value })} />
                <button onClick={() => markLeave(d._id)} className="text-sm bg-amber-500 text-white px-3 py-1 rounded-lg">
                  Mark leave day
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
