import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { City } from '../lib/types';
import { CityLabel, ErrorText, Loading } from '../components/ui';

interface Tariff {
  id: string;
  destinationCityCode: string | null;
  mode: string;
  currency: string;
  pricePerKg: string;
  fixedFee: string;
  minCharge: string;
  validFrom: string;
  validTo: string | null;
}

export function Tariffs() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['tariffs'], queryFn: () => api<Tariff[]>('/admin/tariffs') });
  const cities = useQuery({
    queryKey: ['ref-cities'],
    queryFn: () => api<(City & { code: string; name: string })[]>('/reference/cities'),
  });

  const [f, setF] = useState({
    destinationCityId: '',
    mode: 'AIR',
    currency: 'USD',
    pricePerKg: '',
    fixedFee: '0',
    minCharge: '0',
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () => api('/admin/tariffs', { method: 'POST', body: f }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tariffs'] });
      setF((s) => ({ ...s, pricePerKg: '' }));
    },
  });

  return (
    <>
      <h1>Tarifs — prix par kg par destination</h1>
      <div className="card">
        {list.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Destination</th>
                <th>Mode</th>
                <th>Prix/kg</th>
                <th>Frais fixes</th>
                <th>Min</th>
                <th>Valide depuis</th>
                <th>Jusqu’à</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.destinationCityCode ? <CityLabel code={t.destinationCityCode} /> : '(corridor)'}</td>
                  <td>{t.mode}</td>
                  <td className="mono">{t.pricePerKg} {t.currency}</td>
                  <td>{t.fixedFee}</td>
                  <td>{t.minCharge}</td>
                  <td className="muted">{t.validFrom}</td>
                  <td className="muted">{t.validTo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {can('tariff:write') && (
        <div className="card">
          <h3>Nouveau tarif (nouvelle version datée)</h3>
          <div className="row">
            <div className="field">
              <label>Destination *</label>
              <select value={f.destinationCityId} onChange={(e) => set('destinationCityId', e.target.value)}>
                <option value="">—</option>
                {(cities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={f.mode} onChange={(e) => set('mode', e.target.value)}>
                <option value="AIR">Aérien</option>
                <option value="SEA">Maritime</option>
              </select>
            </div>
            <div className="field">
              <label>Devise</label>
              <input value={f.currency} maxLength={3} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Prix par kg *</label>
              <input value={f.pricePerKg} inputMode="decimal" onChange={(e) => set('pricePerKg', e.target.value)} />
            </div>
            <div className="field">
              <label>Frais fixes</label>
              <input value={f.fixedFee} inputMode="decimal" onChange={(e) => set('fixedFee', e.target.value)} />
            </div>
            <div className="field">
              <label>Minimum</label>
              <input value={f.minCharge} inputMode="decimal" onChange={(e) => set('minCharge', e.target.value)} />
            </div>
          </div>
          <ErrorText error={save.error} />
          <button
            className="btn primary"
            disabled={!f.destinationCityId || !f.pricePerKg || save.isPending}
            onClick={() => save.mutate()}
          >
            Enregistrer le tarif
          </button>
        </div>
      )}
    </>
  );
}
