import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ErrorText } from '../components/ui';

/** Changement de mot de passe en libre-service — accessible à tout compte connecté. */
export function Profile() {
  const { me } = useAuth();
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
