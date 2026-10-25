import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Setup() {
  const { setupRequired, loading, reload, gymName } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ setupToken: '', fullName: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!loading && !setupRequired) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/setup/owner', f); await reload(); nav('/login'); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Logo />
        <h1>Welcome to {gymName}.</h1>
        <p>Create the owner account to get started. This page locks itself after the first owner exists.</p>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <h2>Create owner account</h2>
          <Alert>{error}</Alert>
          <Field label="Setup token" hint="The SETUP_TOKEN value from your backend .env file"><input type="password" value={f.setupToken} onChange={set('setupToken')} required /></Field>
          <Field label="Full name"><input value={f.fullName} onChange={set('fullName')} required /></Field>
          <Field label="Username"><input value={f.username} onChange={set('username')} required autoComplete="username" /></Field>
          <Field label="Email (optional)"><input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Password" hint="At least 10 characters"><input type="password" value={f.password} onChange={set('password')} minLength={10} required autoComplete="new-password" /></Field>
          <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create owner account'}</button>
        </form>
      </div>
    </div>
  );
}
