import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/format';
import Logo from '../components/Logo.jsx';
import { safeNext } from '../lib/safeNext';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (user) return <Navigate to={next} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    navigate(next, { replace: true });
  }

  async function resetPassword() {
    if (!email) return setError('Enter your email first.');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(errorMessage(err));
    else setInfo('If an account exists for that email, a password reset link has been sent. Check your inbox.');
  }

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <div className="auth-brand"><Logo size={72} /></div>
        <h1>Welcome back</h1>
        <p className="muted small">Sign in to order and track your Katanim deliveries.</p>
        <form className="form" onSubmit={submit}>
          <label className="field">
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <PasswordInput
            label="Password"
            required
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-success">{info}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="row between small">
          <button className="link" type="button" onClick={resetPassword}>Forgot password?</button>
          <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </div>
      </div>
    </div>
  );
}
