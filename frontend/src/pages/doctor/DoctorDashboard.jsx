import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const urgencyColors = { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-emerald-100 text-emerald-700', Unknown: 'bg-slate-100 text-slate-600' };

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments/doctor/queue').then((res) => {
      setAppointments(res.data.appointments);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Today & Upcoming Queue</h1>
      {loading && <p className="text-slate-400">Loading...</p>}
      <div className="space-y-3">
        {appointments.map((a) => (
          <div key={a._id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{a.patientId?.name}</p>
                <p className="text-sm text-slate-500">{new Date(a.slotStart).toLocaleString()}</p>
              </div>
              {a.preVisitSummary?.urgency && (
                <span className={`text-xs px-2 py-1 rounded ${urgencyColors[a.preVisitSummary.urgency] || urgencyColors.Unknown}`}>
                  {a.preVisitSummary.urgency} urgency
                </span>
              )}
            </div>

            {a.preVisitSummary?.chiefComplaint && (
              <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm">
                <p><b>Chief complaint:</b> {a.preVisitSummary.chiefComplaint}</p>
                {a.preVisitSummary.suggestedQuestions?.length > 0 && (
                  <>
                    <p className="mt-2 font-medium">Suggested questions:</p>
                    <ul className="list-disc list-inside text-slate-600">
                      {a.preVisitSummary.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </>
                )}
                {a.preVisitSummary.llmFailed && (
                  <p className="text-xs text-amber-600 mt-2">⚠ AI summary unavailable — showing raw symptoms only.</p>
                )}
              </div>
            )}

            <Link to={`/doctor/visit/${a._id}`} className="inline-block mt-3 text-sm text-sky-600 hover:underline">
              Submit post-visit notes →
            </Link>
          </div>
        ))}
        {!loading && appointments.length === 0 && <p className="text-slate-400">No upcoming appointments.</p>}
      </div>
    </div>
  );
}
