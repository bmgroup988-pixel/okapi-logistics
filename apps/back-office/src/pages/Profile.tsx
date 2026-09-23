import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ErrorText } from '../components/ui';

/** Changement de mot de passe en libre-service — accessible à tout compte connecté. */
export function Profile() {
  const { me, mfaSetupRequired } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const change = useMutation({
    mutationFn: () => api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setDone(true);
      setError(null);
    },
    onError: (e) => {
      setError(e);
      setDone(false);
    },
  });

  const mismatch = confirm.length > 0 && newPassword !== confirm;

  return (
    <>
      <h1>Mon profil</h1>
      <div className="card" style={{ maxWidth: 420 }}>
        <p>
          <b>{me?.fullName}</b>
          <br />
          <span className="muted">{me?.email}</span>
        </p>
      </div>

      {mfaSetupRequired && (
        <div className="card" style={{ maxWidth: 420, borderColor: 'var(--danger, #c0392b)' }}>
          <p style={{ color: 'var(--danger, #c0392b)', fontWeight: 600, margin: 0 }}>
            Double authentification obligatoire pour votre rôle — le reste de l'application reste
            inaccessible tant qu'elle n'est pas activée ci-dessous.
          </p>
        </div>
      )}

      <MfaCard mfaEnabled={!!me?.mfaEnabled} />

      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Changer mon mot de passe</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!mismatch) change.mutate();
          }}
          style={{ display: 'grid', gap: 8 }}
        >
          <div className="field">
            <label>Mot de passe actuel</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Nouveau mot de passe (≥ 10 caractères)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {mismatch && <p className="error">Les deux mots de passe ne correspondent pas.</p>}
          <ErrorText error={error} />
          {done && <p style={{ color: 'var(--ok)' }}>Mot de passe changé avec succès.</p>}
          <button
            className="btn primary"
            type="submit"
            disabled={
              change.isPending || !currentPassword || newPassword.length < 10 || mismatch || !confirm
            }
          >
            Enregistrer
          </button>
        </form>
      </div>
    </>
  );
}

/** Configuration de la double authentification (TOTP) — enrôlement puis confirmation par code. */
function MfaCard({ mfaEnabled }: { mfaEnabled: boolean }) {
  const { refreshMe } = useAuth();
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const enroll = useMutation({
    mutationFn: () => api<{ secret: string; otpauthUri: string }>('/auth/mfa/enroll', { method: 'POST' }),
    onSuccess: (data) => {
      setEnrollment(data);
      setError(null);
    },
    onError: setError,
  });

  const verify = useMutation({
    mutationFn: () => api('/auth/mfa/verify', { method: 'POST', body: { otp } }),
    onSuccess: async () => {
      setActivated(true);
      setError(null);
      await refreshMe();
    },
    onError: setError,
  });

  if (mfaEnabled || activated) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Double authentification</h3>
        <p style={{ color: 'var(--ok)' }}>✔ Activée sur ce compte.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h3>Double authentification (MFA)</h3>
      {!enrollment ? (
        <>
          <p className="muted">
            Utilisez une application d'authentification (Google Authenticator, Authy, etc.).
          </p>
          <button className="btn primary" onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            Configurer
          </button>
          <ErrorText error={error} />
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate();
          }}
          style={{ display: 'grid', gap: 8 }}
        >
          <p className="muted">
            Dans votre application, ajoutez un compte via « Saisir une clé manuellement » avec :
          </p>
          <p>
            Compte : <b>{'Okapi Logistics'}</b>
            <br />
            Clé secrète :{' '}
            <code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{enrollment.secret}</code>
          </p>
          <div className="field">
            <label>Code à 6 chiffres affiché par l'application</label>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>
          <ErrorText error={error} />
          <button className="btn primary" type="submit" disabled={verify.isPending || otp.length !== 6}>
            Activer
          </button>
        </form>
      )}
    </div>
  );
}
