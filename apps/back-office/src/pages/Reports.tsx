import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated, ParcelSummary } from '../lib/types';
import { CityLabel, Loading, Pill, paymentKind } from '../components/ui';

interface FinancialStatus {
  currency: string;
  global: {
    agencyCount: number;
    parcelCount: number;
    byStatus: Record<string, number>;
    billed: string;
    collected: string;
    unpaid: string;
  };
  byAgency: Array<{
    agencyId: string;
    agencyCode: string;
    agencyName: string;
    countryIso2: string;
    countryName: string;
    billingCurrency: string;
    parcelCount: number;
    byStatus: Record<string, number>;
    billed: string;
    collected: string;
    unpaid: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  ENREGISTRE: 'Enregistré',
  EN_TRANSIT: 'En transit',
  ARRIVE: 'Arrivé',
  HANDED_TO_PARTNER: 'Remis au partenaire',
  LIVRE: 'Livré',
  ANNULE: 'Annulé',
  RETOURNE: 'Retourné',
};
const STATUS_ORDER = ['ENREGISTRE', 'EN_TRANSIT', 'ARRIVE', 'HANDED_TO_PARTNER', 'LIVRE', 'RETOURNE', 'ANNULE'];

function money(amount: string, currency: string): string {
  const n = Number(amount);
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency}`;
}

export function Reports() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const financial = useQuery({
    queryKey: ['reports-financial-status', periodStart, periodEnd],
    queryFn: () =>
      api<FinancialStatus>('/admin/reports/financial-status', {
        query: { periodStart: periodStart || undefined, periodEnd: periodEnd || undefined },
      }),
  });

  const unpaid = useQuery({
    queryKey: ['report-unpaid'],
    queryFn: () =>
      api<Paginated<ParcelSummary>>('/parcels', {
        query: { status: 'ARRIVE,EN_TRANSIT', paymentStatus: 'IMPAYE,PARTIEL', limit: 50 },
      }),
  });

  const g = financial.data?.global;
  const currency = financial.data?.currency ?? 'USD';

  return (
    <>
      <h1>Rapports</h1>

      <div className="card">
        <h3>État financier et des colis — global et par agence</h3>
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Depuis le</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="field">
            <label>Jusqu'au</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>

        {financial.isLoading ? (
          <Loading />
        ) : g && financial.data ? (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="lab">Agences ({g.agencyCount})</div>
                <div className="num">{g.parcelCount} colis</div>
              </div>
              <div className="kpi">
                <div className="lab">Facturé (réf. {currency})</div>
                <div className="num">{money(g.billed, currency)}</div>
              </div>
              <div className="kpi">
                <div className="lab">Encaissé (réf. {currency})</div>
                <div className="num" style={{ color: 'var(--ok)' }}>
                  {money(g.collected, currency)}
                </div>
              </div>
              <div className="kpi">
                <div className="lab">Impayé (réf. {currency})</div>
                <div className="num" style={{ color: 'var(--err)' }}>
                  {money(g.unpaid, currency)}
                </div>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 4 }}>
              Colis par statut (global) :{' '}
              {STATUS_ORDER.filter((s) => g.byStatus[s]).map((s) => (
                <span key={s} style={{ marginRight: 10 }}>
                  {STATUS_LABELS[s]} <strong>{g.byStatus[s]}</strong>
                </span>
              ))}
            </p>

            <table className="data" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Agence</th>
                  <th>Pays</th>
                  <th>Colis</th>
                  <th>Facturé ({currency})</th>
                  <th>Encaissé ({currency})</th>
                  <th>Impayé ({currency})</th>
                </tr>
              </thead>
              <tbody>
                {financial.data.byAgency.map((a) => (
                  <tr key={a.agencyId}>
                    <td>
                      {a.agencyName} <span className="muted mono">({a.agencyCode})</span>
                    </td>
                    <td className="mono">
                      {a.countryIso2}
                      <span className="city-name"> ({a.countryName})</span>
                    </td>
                    <td>{a.parcelCount}</td>
                    <td className="mono">{money(a.billed, currency)}</td>
                    <td className="mono">{money(a.collected, currency)}</td>
                    <td className="mono" style={{ color: Number(a.unpaid) > 0 ? 'var(--err)' : undefined }}>
                      {money(a.unpaid, currency)}
                    </td>
                  </tr>
                ))}
                {financial.data.byAgency.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Aucune donnée pour cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        ) : null}
      </div>

      <div className="card">
        <h3>Colis impayés / en retard</h3>
        {unpaid.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>N° suivi</th>
                <th>Destination</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {(unpaid.data?.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.trackingNumber}</td>
                  <td><CityLabel code={p.destinationCityCode} /></td>
                  <td>{p.status}</td>
                  <td>
                    <Pill kind={paymentKind(p.paymentStatus)}>{p.paymentStatus}</Pill>
                  </td>
                  <td className="mono">
                    {p.balance.amount} {p.balance.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
