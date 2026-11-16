import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/format';
import PasswordInput, { checkNewPassword } from '../components/PasswordInput.jsx';

export default function Account() {
  const { user, profile, refreshProfile } = useAuth();
  const providers = (user?.identities || []).map((i) => i.provider);
  const hasPassword = providers.includes('email');
  const hasFacebook = providers.includes('facebook');

  return (
    <div className="container narrow-wide">
      <h1>My account</h1>
      <div className="stack">
        <ProfileCard profile={profile} email={user?.email} onSaved={refreshProfile} />
        <PasswordCard email={user?.email} hasPassword={hasPassword} />
        <section className="card">
          <h3>Sign-in methods</h3>
          <ul className="signin-methods">
            <li>
              <span>Email &amp; password</span>
              {hasPassword ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Not set</span>}
            </li>
            <li>
              <span>Facebook</span>
              {hasFacebook ? <span className="badge badge-success">Connected</span> : <span className="badge badge-muted">Not connected</span>}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function ProfileCard({ profile, email, onSaved }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
  }, [profile]);

  async function save(e) {
    e.preventDefault();
    if (!fullName.trim()) return setMsg({ type: 'error', text: 'Please enter your name.' });
    setBusy(true);
    setMsg({ type: '', text: '' });
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id);
    setBusy(false);
    if (error) return setMsg({ type: 'error', text: errorMessage(error) });
    setMsg({ type: 'success', text: 'Profile saved.' });
    onSaved?.();
  }

  return (
    <section className="card">
      <h3>Profile</h3>
      <form className="form" onSubmit={save}>
        <label className="field">
          Email
          <input value={email || ''} disabled />
        </label>
        <label className="field">
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
        </label>
        <label className="field">
          Mobile number
          <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="09XX XXX XXXX" />
        </label>
        {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <div className="row end">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>
    </section>
  );
}

function PasswordCard({ email, hasPassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    const invalid = checkNewPassword(next, confirm);
    if (invalid) return setMsg({ type: 'error', text: invalid });
    if (hasPassword && !current) return setMsg({ type: 'error', text: 'Enter your current password.' });
    if (hasPassword && current === next) return setMsg({ type: 'error', text: 'Choose a password different from your current one.' });

    setBusy(true);
    try {
      // Confirm it's really the account owner before changing the password.
      if (hasPassword) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: current });
        if (error) throw new Error('Your current password is incorrect.');
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      // Log out any other devices that were signed in with the old password.
      await supabase.auth.signOut({ scope: 'others' });
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({
        type: 'success',
        text: hasPassword
          ? 'Password changed. Other devices have been signed out.'
          : 'Password set. You can now also sign in with your email and this password.',
      });
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h3>{hasPassword ? 'Change password' : 'Set a password'}</h3>
      {!hasPassword && (
        <p className="muted small">
          You signed up with Facebook. Set a password if you also want to sign in with {email || 'your email'}.
        </p>
      )}
      <form className="form" onSubmit={submit}>
        {/* hidden username helps password managers save the right account */}
        <input type="email" value={email || ''} autoComplete="username" readOnly hidden />
        {hasPassword && (
          <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        )}
        <PasswordInput
          label="New password"
          value={next}
          onChange={setNext}
          hint="At least 8 characters, with a letter and a number."
        />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} />
        {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        <div className="row end">
          <button className="btn btn-primary" disabled={busy || (!hasPassword && !email)}>
            {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
          </button>
        </div>
        {!hasPassword && !email && (
          <div className="alert alert-warn small">Your Facebook account has no email address, so a password can't be set.</div>
        )}
      </form>
    </section>
  );
}
