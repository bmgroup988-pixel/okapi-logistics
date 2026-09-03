import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Paginated, ParcelSummary } from '../lib/types';
import { Pill, statusKind, paymentKind, Loading } from '../components/ui';

function useCount(query: Record<string, string>) {
  return useQuery({
    queryKey: ['parcels-count', query],
    queryFn: () => api<Paginated<ParcelSummary>>('/parcels', { query: { ...query, limit: 1 } }),
    select: (r) => r.page.total,
  });
}

export function Dashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = useCount({ from: today.toISOString() });
  const transit = useCount({ status: 'EN_TRANSIT' });
  const arrived = useCount({ status: 'ARRIVE' });
  const unpaid = useCount({ status: 'ARRIVE,EN_TRANSIT', paymentStatus: 'IMPAYE,PARTIEL' });

  const recent = useQuery({
    queryKey: ['parcels-recent'],
    queryFn: () => api<Paginated<ParcelSummary>>('/parcels', { query: { limit: 8, sort: '-createdAt' } }),
  });

  return (
    <>
      <h1>Tableau de bord</h1>
      <div className="kpis">
        <div className="kpi">
          <div className="lab">Colis du jour</div>
          <div className="num">{todayCount.data ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="lab">En transit</div>
          <div className="num">{transit.data ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="lab">Arrivés à retirer</div>
          <div className="num">{arrived.data ?? '—'}</div>
        </div>
        <div className="kpi">
          <div className="lab">Impayés (arrivés / en transit)</div>
          <div className="num" style={{ color: 'var(--err)' }}>{unpaid.data ?? '—'}</div>
        </div>
      </div>

      <div className="card">
        <h3>Derniers colis</h3>
        {recent.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>N° suivi</th>
                <th>Trajet</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th>Créé</th>
              </tr>
            </thead>
            <tbody>
              {(recent.data?.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="mono" to={`/parcels/${p.id}`}>
                      {p.trackingNumber}
                    </Link>
                  </td>
                  <td>
                    {p.originCityCode} → {p.destinationCityCode}
                  </td>
                  <td>
                    <Pill kind={statusKind(p.status)}>{p.status}</Pill>
                  </td>
                  <td>
                    <Pill kind={paymentKind(p.paymentStatus)}>{p.paymentStatus}</Pill>
                  </td>
                  <td className="muted">{new Date(p.createdAt).toLocaleString('fr')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
