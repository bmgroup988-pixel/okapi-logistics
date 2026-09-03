import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import { ApiError } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfa, setMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, mfa ? otp : undefined);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MFA_REQUIRED') {
        setMfa(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Échec de connexion');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo" />
        <h2 style={{ marginTop: 0 }}>{t('app.title')}</h2>
        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pw">{t('auth.password')}</label>
          <input
            id="pw"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {mfa && (
          <div className="field">
            <label htmlFor="otp">{t('auth.otp')}</label>
            <input
              id="otp"
              inputMode="numeric"
              pattern="\d{6}"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
        )}
        <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? '…' : t('auth.login')}
        </button>
        {error && <p className="error">{error}</p>}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Démo : admin@okapi.example / a.boni@okapi.example
        </p>
      </form>
    </div>
  );
}
