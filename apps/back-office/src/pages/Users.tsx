import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated } from '../lib/types';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  roles: Array<{ id: string; code: string; scopeCountryId: string | null; scopeAgencyId: string | null }>;
}

interface Agency {
  id: string;
  code: string;
  name: string;
}

interface Country {
  id: string;
  iso2: string;
  name: string;
}

// FOURNISSEUR n'apparaît pas ici : ce rôle se crée uniquement via
// « Activer le portail » sur l'écran Fournisseurs (docs/11 §5).
const ASSIGNABLE_ROLES = [
  { code: 'AGENT_FRET', label: 'Agent fret' },
  { code: 'ADMIN_DAF', label: 'Admin DAF' },
  { code: 'SUPER_ADMIN', label: 'Super-admin' },
];

function roleLabel(code: string): string {
  return ASSIGNABLE_ROLES.find((r) => r.code === code)?.label ?? code;
}

function AssignRoleModal({ u, onClose }: { u: UserRow; onClose: () => void }) {
  const qc = useQueryClient();
  const agencies = useQuery({ queryKey: ['reference-agencies'], queryFn: () => api<Agency[]>('/reference/agencies') });
  const countries = useQuery({ queryKey: ['reference-countries'], queryFn: () => api<Country[]>('/reference/countries') });
  const [roleCode, setRoleCode] = useState('AGENT_FRET');
  const [scopeAgencyId, setScopeAgencyId] = useState('');
  const [scopeCountryId, setScopeCountryId] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const resetPassword = useMutation({
    mutationFn: () => api<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`, { method: 'POST' }),
    onSuccess: (r) => setTempPassword(r.temporaryPassword),
    onError: setError,
  });

  const assign = useMutation({
    mutationFn: () =>
      api(`/admin/users/${u.id}/roles`, {
        method: 'POST',
        body: {
          roleCode,
          scopeAgencyId: roleCode === 'AGENT_FRET' ? scopeAgencyId : undefined,
          scopeCountryId: roleCode === 'ADMIN_DAF' ? scopeCountryId || undefined : undefined,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: setError,
  });

  const revoke = useMutation({
    mutationFn: (userRoleId: string) => api(`/admin/users/${u.id}/roles/${userRoleId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <Modal title={`Rôles — ${u.fullName}`} onClose={onClose}>
      <div className="card" style={{ marginBottom: 16 }}>
        {tempPassword ? (
          <>
            <p>
              Nouveau mot de passe temporaire — communiquez-le par un canal sûr, il ne sera plus
              jamais affiché :
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: 18, padding: 8, background: 'var(--surface2, #f4f4f7)' }}>
              {tempPassword}
            </p>
          </>
        ) : (
          <button className="btn" disabled={resetPassword.isPending} onClick={() => resetPassword.mutate()}>
            Réinitialiser le mot de passe
          </button>
        )}
      </div>

      <table style={{ width: '100%', marginBottom: 16 }}>
        <thead>
          <tr>
            <th>Rôle</th>
            <th>Périmètre</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {u.roles.map((r) => (
            <tr key={r.id}>
              <td>
                <Pill kind="info">{roleLabel(r.code)}</Pill>
              </td>
              <td className="muted">
                {r.scopeAgencyId
                  ? (agencies.data?.find((a) => a.id === r.scopeAgencyId)?.name ?? 'Agence')
                  : r.scopeCountryId
                    ? (countries.data?.find((c) => c.id === r.scopeCountryId)?.name ?? 'Pays')
                    : 'National / global'}
              </td>
              <td>
                <button className="btn ghost" onClick={() => revoke.mutate(r.id)}>
                  Retirer
                </button>
              </td>
            </tr>
          ))}
          {u.roles.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                Aucun rôle attribué.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>

        {roleCode === 'AGENT_FRET' && (
          <select value={scopeAgencyId} onChange={(e) => setScopeAgencyId(e.target.value)} required>
            <option value="">Agence…</option>
            {agencies.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        )}

        {roleCode === 'ADMIN_DAF' && (
          <select value={scopeCountryId} onChange={(e) => setScopeCountryId(e.target.value)}>
            <option value="">Tous pays (national)</option>
            {countries.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.iso2} — {c.name}
              </option>
            ))}
          </select>
        )}

        <ErrorText error={error} />
        <button
          className="btn primary"
          type="submit"
          disabled={assign.isPending || (roleCode === 'AGENT_FRET' && !scopeAgencyId)}
        >
          Attribuer
        </button>
      </form>
    </Modal>
  );
}

export function Users() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [rolesForId, setRolesForId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['users', q],
    queryFn: () => api<Paginated<UserRow>>('/admin/users', { query: { q, limit: 50 } }),
  });
  const rolesFor = rolesForId ? (list.data?.data.find((u) => u.id === rolesForId) ?? null) : null;

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
                  <td>{u.roles.map((r) => roleLabel(r.code)).join(', ') || '—'}</td>
                  <td>{u.mfaEnabled ? <Pill kind="ok">✔</Pill> : <Pill>–</Pill>}</td>
                  <td>{u.isActive ? <Pill kind="ok">oui</Pill> : <Pill kind="err">non</Pill>}</td>
                  <td>
                    <button className="btn ghost" onClick={() => setRolesForId(u.id)}>
                      Rôles
                    </button>
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
          Une fois créé, cliquez « Rôles » sur sa ligne pour lui donner accès (Agent, DAF, Super-admin).
        </p>
      </div>

      {rolesFor && <AssignRoleModal u={rolesFor} onClose={() => setRolesForId(null)} />}
    </>
  );
}
