import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

export default function PostVisitNotes() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [medications, setMedications] = useState([{ name: '', instructions: '', timesPerDay: 2, totalDays: 5 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateMed = (i, field, value) => {
    const copy = [...medications];
    copy[i][field] = value;
    setMedications(copy);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/appointments/${appointmentId}/post-visit`, {
        notes, prescription,
        medications: medications.filter((m) => m.name.trim()),
      });
      navigate('/doctor');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit notes');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Post-Visit Notes</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Clinical notes</label>
          <textarea className="w-full border rounded-lg px-3 py-2" rows={4} value={notes}
            onChange={(e) => setNotes(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Prescription (free text)</label>
          <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={prescription}
            onChange={(e) => setPrescription(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Medications (for reminder scheduling)</label>
          {medications.map((m, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 mb-2">
              <input className="border rounded-lg px-2 py-1 col-span-2" placeholder="Name"
                value={m.name} onChange={(e) => updateMed(i, 'name', e.target.value)} />
              <input className="border rounded-lg px-2 py-1" type="number" min="1" placeholder="x/day"
                value={m.timesPerDay} onChange={(e) => updateMed(i, 'timesPerDay', Number(e.target.value))} />
              <input className="border rounded-lg px-2 py-1" type="number" min="1" placeholder="days"
                value={m.totalDays} onChange={(e) => updateMed(i, 'totalDays', Number(e.target.value))} />
            </div>
          ))}
          <button type="button" onClick={() => setMedications([...medications, { name: '', instructions: '', timesPerDay: 1, totalDays: 5 }])}
            className="text-sm text-sky-600 hover:underline">
            + Add another medication
          </button>
        </div>

        <button disabled={busy} className="w-full bg-sky-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
          {busy ? 'Generating summary...' : 'Submit & Generate Patient Summary'}
        </button>
      </form>
    </div>
  );
}
