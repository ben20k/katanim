import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/format';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Register() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (user) return <Navigate to={next} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, phone: form.phone },
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    if (!data.session) setDone(true); // email confirmation required
  }

  if (done) {
    return (
      <div className="container narrow">
        <div className="card auth-card">
          <h1>Check your email</h1>
          <p>We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <div className="auth-brand"><Logo size={72} /></div>
        <h1>Join #Katanim</h1>
        <p className="muted small">Create an account to order hydroponic kits and farm inputs.</p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            Full name
            <input required value={form.full_name} onChange={set('full_name')} autoComplete="name" />
          </label>
          <label className="field">
            Mobile number
            <input required value={form.phone} onChange={set('phone')} placeholder="09XX XXX XXXX" autoComplete="tel" />
          </label>
          <label className="field">
            Email
            <input type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
          </label>
          <PasswordInput
            label="Password"
            required
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            autoComplete="new-password"
            hint="At least 8 characters."
          />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="muted small terms">
          By continuing you agree to our <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <p className="small">
          Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
