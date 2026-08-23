import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      const home = user.role === 'doctor' ? '/doctor' : user.role === 'admin' ? '/admin' : '/patient';
      navigate(home);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-sky-700">Sign in</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" type="email"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Password" type="password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button disabled={busy} className="w-full bg-sky-600 text-white rounded-lg py-2 font-medium hover:bg-sky-700 disabled:opacity-50">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="text-sm text-center text-slate-500">
          New patient? <Link to="/register" className="text-sky-600 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
