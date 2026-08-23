import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

export default function DoctorSearch() {
  const [specialisation, setSpecialisation] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const search = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await api.get('/doctors', { params: specialisation ? { specialisation } : {} });
      setDoctors(res.data.doctors);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { search(); }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Find a Doctor</h1>
      <form onSubmit={search} className="flex gap-2 mb-6">
        <input className="flex-1 border rounded-lg px-3 py-2" placeholder="Search by specialisation (e.g. Cardiology)"
          value={specialisation} onChange={(e) => setSpecialisation(e.target.value)} />
        <button className="bg-sky-600 text-white px-4 py-2 rounded-lg">Search</button>
      </form>

      {loading && <p className="text-slate-400">Loading...</p>}

      <div className="space-y-3">
        {doctors.map((d) => (
          <div key={d._id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">Dr. {d.name}</p>
              <p className="text-sm text-slate-500">{d.doctorProfile?.specialisation}</p>
              <p className="text-xs text-slate-400">{d.doctorProfile?.bio}</p>
            </div>
            <button
              onClick={() => navigate(`/patient/book/${d._id}`)}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              Book slot
            </button>
          </div>
        ))}
        {!loading && doctors.length === 0 && <p className="text-slate-400">No doctors found.</p>}
      </div>
    </div>
  );
}
