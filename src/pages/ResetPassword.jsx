import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/format';
import Logo from '../components/Logo.jsx';
import Spinner from '../components/Spinner.jsx';
import PasswordInput, { checkNewPassword } from '../components/PasswordInput.jsx';

// Landing page for the "Forgot password?" email link.
// Supabase signs the user in from the link, then they choose a new password here.
export default function ResetPassword() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const linkError = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description')
    || new URLSearchParams(window.location.search).get('error_description');

  async function submit(e) {
    e.preventDefault();
    const invalid = checkNewPassword(password, confirm);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      return setError(errorMessage(err));
    }
    await supabase.auth.signOut({ scope: 'others' });
    setBusy(false);
    setDone(true);
    setTimeout(() => navigate('/', { replace: true }), 2000);
  }

  if (loading) return <Spinner />;

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <div className="auth-brand"><Logo size={72} /></div>
        <h1>Set a new password</h1>

        {done ? (
          <div className="alert alert-success">Password updated. Taking you to the shop…</div>
        ) : !user ? (
          <>
            <div className="alert alert-error">
              {linkError ? linkError.replace(/\+/g, ' ') : 'This reset link is invalid or has expired.'}
            </div>
            <p className="small">
              Go back to <Link to="/login">Sign in</Link> and click <strong>Forgot password?</strong> to get a new link.
            </p>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="muted small">Resetting the password for <strong>{user.email}</strong>.</p>
            <input type="email" value={user.email || ''} autoComplete="username" readOnly hidden />
            <PasswordInput
              label="New password"
              value={password}
              onChange={setPassword}
              hint="At least 8 characters, with a letter and a number."
              autoFocus
            />
            <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} />
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
