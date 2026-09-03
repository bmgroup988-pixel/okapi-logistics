import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated } from '../lib/types';
import { ErrorText, Loading, Pill } from '../components/ui';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  roles: Array<{ id: string; code: string; scopeCountryId: string | null; scopeAgencyId: string | null }>;
}

export function Users() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: ['users', q],
    queryFn: () => api<Paginated<UserRow>>('/admin/users', { query: { q, limit: 50 } }),
  });

  const [f, setF] = useState({ email: '', fullName: '', password: '', locale: 'fr' });
  const create = useMutation({
    mutationFn: () => api('/admin/users', { method: 'POST', body: f }),
    onSuccess: () => {
      setF({ email: '', fullName: '', password: '', locale: 'fr' });
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (u: UserRow) =>
      api(`/admin/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <>
      <h1>Utilisateurs & rôles</h1>
      <div className="card">
        <div className="field" style={{ maxWidth: 320 }}>
          <label>Recherche</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="nom, e-mail…" />
        </div>
        {list.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Rôles</th>
                <th>MFA</th>
                <th>Actif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data?.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td className="mono">{u.email}</td>
                  <td>{u.roles.map((r) => r.code).join(', ') || '—'}</td>
                  <td>{u.mfaEnabled ? <Pill kind="ok">✔</Pill> : <Pill>–</Pill>}</td>
                  <td>{u.isActive ? <Pill kind="ok">oui</Pill> : <Pill kind="err">non</Pill>}</td>
                  <td>
                    <button className="btn ghost" onClick={() => toggle.mutate(u)}>
                      {u.isActive ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Inviter un utilisateur</h3>
        <div className="row">
          <div className="field">
            <label>Nom complet</label>
            <input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input value={f.email} type="email" onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Mot de passe provisoire (≥ 10)</label>
            <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          </div>
        </div>
        <ErrorText error={create.error} />
        <button
          className="btn primary"
          disabled={!f.email || !f.fullName || f.password.length < 10 || create.isPending}
          onClick={() => create.mutate()}
        >
          Créer
        </button>
        <p className="muted" style={{ fontSize: 12 }}>
          L’attribution des rôles et périmètres se fait via l’API (`POST /admin/users/:id/roles`).
        </p>
      </div>
    </>
  );
}
