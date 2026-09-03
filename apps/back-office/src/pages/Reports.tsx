import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated, ParcelSummary } from '../lib/types';
import { Loading, Pill, paymentKind } from '../components/ui';

/**
 * Rapports (aperçu). L'endpoint de reporting consolidé + exports Excel/PDF/CSV
 * est la brique suivante ; ici on synthétise depuis la liste des colis.
 */
export function Reports() {
  const unpaid = useQuery({
    queryKey: ['report-unpaid'],
    queryFn: () =>
      api<Paginated<ParcelSummary>>('/parcels', {
        query: { status: 'ARRIVE,EN_TRANSIT', paymentStatus: 'IMPAYE,PARTIEL', limit: 50 },
      }),
  });

  return (
    <>
      <h1>Rapports</h1>
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
                  <td>{p.destinationCityCode}</td>
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
