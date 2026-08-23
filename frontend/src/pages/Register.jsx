import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/patient');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-sky-700">Patient Registration</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Full name"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" type="email"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Phone"
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Password" type="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button disabled={busy} className="w-full bg-sky-600 text-white rounded-lg py-2 font-medium hover:bg-sky-700 disabled:opacity-50">
          {busy ? 'Creating account...' : 'Create account'}
        </button>
        <p className="text-sm text-center text-slate-500">
          Already have an account? <Link to="/login" className="text-sky-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
