import { useState } from 'react';

// Password field with a Show / Hide toggle.
export default function PasswordInput({ label, value, onChange, autoComplete = 'new-password', hint, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      {label}
      <div className="password-input">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          {...rest}
        />
        <button type="button" className="link small" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <span className="muted small hint">{hint}</span>}
    </label>
  );
}

// Shared rules for new passwords. Returns an error message or ''.
export function checkNewPassword(password, confirm) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least one letter and one number.';
  if (password !== confirm) return 'The two new passwords do not match.';
  return '';
}
