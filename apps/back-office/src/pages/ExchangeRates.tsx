import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ErrorText, Loading, Pill } from '../components/ui';

interface Currency {
  code: string;
  symbol: string;
  isActive: boolean;
  isReference: boolean;
}

interface RateRow {
  currency: string;
  rateToReference: string | null;
  source: string | null;
  effectiveFrom: string | null;
  ageHours: number | null;
  stale: boolean;
}

export function ExchangeRates() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const rates = useQuery({
    queryKey: ['fx-rates'],
    queryFn: () => api<{ referenceCurrency: string; rates: RateRow[] }>('/admin/exchange-rates'),
  });
  const currencies = useQuery({
    queryKey: ['ref-currencies'],
    queryFn: () => api<Currency[]>('/reference/currencies'),
  });

  const [base, setBase] = useState('');
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fx-rates'] });
  const sync = useMutation({
    mutationFn: () => api('/admin/exchange-rates/sync', { method: 'POST' }),
    onSuccess: invalidate,
  });
  const manual = useMutation({
    mutationFn: () =>
      api('/admin/exchange-rates', { method: 'POST', body: { baseCurrency: base, rate, note } }),
    onSuccess: () => {
      setRate('');
      invalidate();
    },
  });

  return (
    <>
      <h1>Taux de change</h1>
      <div className="card">
        <p className="muted">
          Devise de référence : <b>{rates.data?.referenceCurrency ?? 'USD'}</b> · source auto :
          exchangerate.host. Chaque devise ci-dessous a son propre taux indépendant — en enregistrer un
          nouveau pour l'une ne modifie jamais les autres.
        </p>
        {can('fx:write') && (
          <button className="btn" disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? 'Synchronisation…' : 'Synchroniser maintenant'}
          </button>
        )}
        {rates.isLoading ? (
          <Loading />
        ) : (
          <table className="data" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Devise</th>
                <th>Taux → réf.</th>
                <th>Source</th>
                <th>Depuis</th>
                <th>Âge</th>
              </tr>
            </thead>
            <tbody>
              {(rates.data?.rates ?? []).map((r) => (
                <tr key={r.currency}>
                  <td className="mono">{r.currency}</td>
                  <td className="mono">{r.rateToReference ?? '—'}</td>
                  <td>{r.source ?? '—'}</td>
                  <td className="muted">
                    {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleString('fr') : '—'}
                  </td>
                  <td>
                    {r.ageHours == null ? (
                      '—'
                    ) : (
                      <Pill kind={r.stale ? 'warn' : 'ok'}>
                        {r.ageHours} h{r.stale ? ' ⚠' : ''}
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {can('fx:write') && (
        <div className="card">
          <h3>Saisir un taux manuellement</h3>
          <div className="row">
            <div className="field">
              <label>Devise → référence</label>
              <select value={base} onChange={(e) => setBase(e.target.value)}>
                <option value="">—</option>
                {(currencies.data ?? [])
                  .filter((c) => c.isActive && !c.isReference)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>Taux (1 unité = ? réf.)</label>
              <input value={rate} inputMode="decimal" onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="field">
              <label>Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <ErrorText error={manual.error} />
          <button
            className="btn primary"
            disabled={!base || !rate || manual.isPending}
            onClick={() => manual.mutate()}
          >
            Enregistrer le taux manuel
          </button>
          <p className="muted" style={{ fontSize: 12 }}>
            Un taux manuel récent prévaut sur la synchro. Historique conservé.
          </p>
        </div>
      )}
    </>
  );
}
