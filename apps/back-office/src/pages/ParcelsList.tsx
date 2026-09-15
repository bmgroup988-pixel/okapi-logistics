import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Paginated, ParcelSummary } from '../lib/types';
import { CityPair, Money, Pill, statusKind, paymentKind, Loading } from '../components/ui';

export function ParcelsList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['parcels', { q, status, paymentStatus, page }],
    queryFn: () =>
      api<Paginated<ParcelSummary>>('/parcels', {
        query: { q, status, paymentStatus, page, limit: 25, sort: '-createdAt' },
      }),
  });

  return (
    <>
      <h1>Colis</h1>
      <div className="card">
        <div className="row">
          <div className="field">
            <label>Recherche</label>
            <input
              value={q}
              placeholder="n°, nom, téléphone…"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="field">
            <label>Statut</label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Tous</option>
              {['ENREGISTRE', 'EN_TRANSIT', 'ARRIVE', 'LIVRE', 'ANNULE', 'RETOURNE'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Paiement</label>
            <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}>
              <option value="">Tous</option>
              {['IMPAYE', 'PARTIEL', 'PAYE'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <table className="data">
              <thead>
                <tr>
                  <th>N° suivi</th>
                  <th>Trajet</th>
                  <th>Poids</th>
                  <th>Statut</th>
                  <th>Paiement</th>
                  <th>Solde</th>
                  <th>Créé</th>
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="mono" to={`/parcels/${p.id}`}>{p.trackingNumber}</Link>
                    </td>
                    <td><CityPair origin={p.originCityCode} destination={p.destinationCityCode} /></td>
                    <td>{p.weightKg} kg</td>
                    <td><Pill kind={statusKind(p.status)}>{p.status}</Pill></td>
                    <td><Pill kind={paymentKind(p.paymentStatus)}>{p.paymentStatus}</Pill></td>
                    <td><Money m={p.balance} /></td>
                    <td className="muted">{new Date(p.createdAt).toLocaleDateString('fr')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              <span className="muted">
                {data ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, data.page.total)} / ${data.page.total}` : ''}
              </span>
              <button
                className="btn"
                disabled={!data || page >= data.page.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
