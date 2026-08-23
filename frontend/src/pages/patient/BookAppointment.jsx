import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

// Three-step flow mirroring the backend: pick date -> pick slot (creates a
// short hold) -> fill symptoms & confirm (creates the real appointment).
export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hold, setHold] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);

  const loadSlots = async (d) => {
    setDate(d);
    setSelected(null);
    setHold(null);
    setError('');
    if (!d) return;
    const res = await api.get(`/doctors/${doctorId}/slots`, { params: { date: d } });
    setSlots(res.data.slots);
  };

  const pickSlot = async (slot) => {
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/appointments/hold', {
        doctorId, slotStart: slot.slotStart, slotEnd: slot.slotEnd,
      });
      setSelected(slot);
      setHold(res.data.holdId);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not hold slot — it may already be taken.');
      loadSlots(date); // refresh availability
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/appointments/confirm', { holdId: hold, symptoms });
      setSuccess(res.data.appointment);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not confirm booking.');
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-emerald-700 mb-2">Appointment Confirmed 🎉</h2>
          <p className="text-sm text-slate-600">
            {new Date(success.slotStart).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-2">A confirmation email is on its way.</p>
          <button onClick={() => navigate('/patient')} className="mt-4 bg-sky-600 text-white px-4 py-2 rounded-lg text-sm">
            Go to my appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Book Appointment</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!hold && (
        <>
          <label className="block text-sm font-medium mb-1">Choose a date</label>
          <input type="date" className="border rounded-lg px-3 py-2 mb-4"
            min={new Date().toISOString().split('T')[0]}
            value={date} onChange={(e) => loadSlots(e.target.value)} />

          {date && (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button key={s.slotStart} disabled={busy} onClick={() => pickSlot(s)}
                  className="border rounded-lg py-2 text-sm hover:bg-sky-50 disabled:opacity-50">
                  {new Date(s.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
              {slots.length === 0 && <p className="text-slate-400 col-span-3">No slots available this day.</p>}
            </div>
          )}
        </>
      )}

      {hold && (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm bg-sky-50 border border-sky-200 rounded-lg p-3">
            Slot held: <b>{new Date(selected.slotStart).toLocaleString()}</b> — please confirm within 5 minutes.
          </p>
          <label className="block text-sm font-medium">Describe your symptoms</label>
          <textarea className="w-full border rounded-lg px-3 py-2" rows={4}
            value={symptoms} onChange={(e) => setSymptoms(e.target.value)}
            placeholder="E.g. fever for 2 days, headache, mild cough..." required />
          <button disabled={busy} className="w-full bg-emerald-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
            {busy ? 'Confirming...' : 'Confirm Booking'}
          </button>
        </form>
      )}
    </div>
  );
}
