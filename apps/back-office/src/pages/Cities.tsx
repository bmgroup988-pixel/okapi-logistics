import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading, Pill } from '../components/ui';

interface Country {
  id: string;
  iso2: string;
  name: string;
}

interface City {
  id: string;
  code: string;
  nameKey: string;
  name: string;
  countryId: string;
  countryIso2: string;
  countryName: string;
  timezone: string;
  status: 'HUB' | 'PARTNER' | 'PLANNED';
  isOrigin: boolean;
  isDestination: boolean;
  isActive: boolean;
  deliveryPartnerCount: number;
  agencyCount: number;
}

function statusKind(s: string): string {
  return s === 'HUB' ? 'ok' : s === 'PARTNER' ? 'info' : '';
}

const emptyForm = {
  code: '',
  nameKey: '',
  countryId: '',
  timezone: '',
  status: 'PLANNED' as City['status'],
  isOrigin: true,
  isDestination: true,
};

/**
 * Administration du référentiel de villes — couverture réseau HUB / PARTNER /
 * PLANNED (addendum 08 §1, docs/09). Une ville PARTNER n'a pas d'agence Okapi ;
 * la livraison finale passe par un partenaire (écran « Partenaires »).
 */
export function Cities() {
  const qc = useQueryClient();
  const cities = useQuery({ queryKey: ['admin-cities'], queryFn: () => api<City[]>('/admin/cities') });
  const countries = useQuery({
    queryKey: ['ref-countries'],
    queryFn: () => api<Country[]>('/reference/countries'),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-cities'] });

  const create = useMutation({
    mutationFn: () => api('/admin/cities', { method: 'POST', body: form }),
    onSuccess: () => {
      setForm(emptyForm);
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; status: City['status']; isActive: boolean }) =>
      api(`/admin/cities/${vars.id}`, {
        method: 'PATCH',
        body: { status: vars.status, isActive: vars.isActive },
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  return (
    <>
      <h1>Villes — couverture réseau</h1>
      <div className="card">
        {cities.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Pays</th>
                <th>Fuseau</th>
                <th>Statut</th>
                <th>Origine</th>
                <th>Destination</th>
                <th>Partenaires</th>
                <th>Agences</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(cities.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="mono">
                    {c.code}
                    <span className="city-name"> ({c.name})</span>
                  </td>
                  <td className="mono">
                    {c.countryIso2}
                    <span className="city-name"> ({c.countryName})</span>
                  </td>
                  <td className="muted">{c.timezone}</td>
                  <td>
                    {editingId === c.id ? (
                      <select
                        defaultValue={c.status}
                        onChange={(e) =>
                          update.mutate({ id: c.id, status: e.target.value as City['status'], isActive: c.isActive })
                        }
                      >
                        <option value="HUB">HUB</option>
                        <option value="PARTNER">PARTNER</option>
                        <option value="PLANNED">PLANNED</option>
                      </select>
                    ) : (
                      <Pill kind={statusKind(c.status)}>{c.status}</Pill>
                    )}
                  </td>
                  <td>{c.isOrigin ? '✔' : '—'}</td>
                  <td>{c.isDestination ? '✔' : '—'}</td>
                  <td>{c.deliveryPartnerCount}</td>
                  <td>{c.agencyCount}</td>
                  <td>
                    <button className="btn ghost" onClick={() => setEditingId(editingId === c.id ? null : c.id)}>
                      {editingId === c.id ? 'Fermer' : 'Modifier'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Nouvelle ville</h3>
        <div className="row">
          <div className="field">
            <label>Code (3 lettres) *</label>
            <input
              value={form.code}
              maxLength={3}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
          </div>
          <div className="field">
            <label>Nom *</label>
            <input value={form.nameKey} onChange={(e) => set('nameKey', e.target.value)} />
          </div>
          <div className="field">
            <label>Pays *</label>
            <select value={form.countryId} onChange={(e) => set('countryId', e.target.value)}>
              <option value="">—</option>
              {(countries.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.iso2} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Fuseau horaire *</label>
            <input
              value={form.timezone}
              placeholder="Africa/Kinshasa"
              onChange={(e) => set('timezone', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Statut</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value as City['status'])}>
              <option value="PLANNED">PLANNED — identifiée, pas encore active</option>
              <option value="PARTNER">PARTNER — livrée via partenaire tiers</option>
              <option value="HUB">HUB — agence Okapi propre</option>
            </select>
          </div>
        </div>
        <div className="row">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.isOrigin} onChange={(e) => set('isOrigin', e.target.checked)} />
            Ville de départ possible
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.isDestination}
              onChange={(e) => set('isDestination', e.target.checked)}
            />
            Ville de destination possible
          </label>
        </div>
        <ErrorText error={create.error} />
        <button
          className="btn primary"
          disabled={!form.code || !form.nameKey || !form.countryId || !form.timezone || create.isPending}
          onClick={() => create.mutate()}
        >
          Créer la ville
        </button>
      </div>
    </>
  );
}
