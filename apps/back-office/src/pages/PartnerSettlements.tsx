import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated } from '../lib/types';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';

interface Partner {
  id: string;
  name: string;
  cityCode: string;
}

interface Settlement {
  id: string;
  deliveryPartnerId: string;
  deliveryPartnerName: string | null;
  periodStart: string;
  periodEnd: string;
  parcelCount: number;
  totalCollectedAmount: string;
  commissionAmount: string;
  currency: string;
  status: 'DRAFT' | 'VALIDATED' | 'PAID';
  paidAt: string | null;
  paymentReference: string | null;
}

interface SettlementDetail extends Settlement {
  parcels: Array<{
    id: string;
    trackingNumber: string;
    weightKg: string;
    amountPaid: string;
    billingCurrency: string;
    deliveredAt: string | null;
  }>;
}

function statusKind(s: string): string {
  return s === 'PAID' ? 'ok' : s === 'VALIDATED' ? 'info' : 'warn';
}

/**
 * Réconciliation des commissions dues aux partenaires de livraison —
 * addendum 08 §5, docs/09. Un règlement agrège les colis LIVRE d'un
 * partenaire sur une période ; workflow DRAFT → VALIDATED → PAID.
 */
export function PartnerSettlements() {
  const qc = useQueryClient();
  const [deliveryPartnerId, setDeliveryPartnerId] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const partners = useQuery({
    queryKey: ['admin-delivery-partners-all'],
    queryFn: () => api<Partner[]>('/admin/delivery-partners'),
  });

  const settlements = useQuery({
    queryKey: ['partner-settlements', deliveryPartnerId],
    queryFn: () =>
      api<Paginated<Settlement>>('/admin/partner-settlements', {
        query: { deliveryPartnerId: deliveryPartnerId || undefined },
      }),
  });

  const [genPartnerId, setGenPartnerId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['partner-settlements'] });

  const generate = useMutation({
    mutationFn: () =>
      api('/admin/partner-settlements/generate', {
        method: 'POST',
        body: { deliveryPartnerId: genPartnerId, periodStart, periodEnd },
      }),
    onSuccess: (r: unknown) => {
      invalidate();
      setDetailId((r as { id: string }).id);
    },
  });

  return (
    <>
      <h1>Réconciliation des partenaires</h1>

      <div className="card">
        <div className="field" style={{ maxWidth: 280 }}>
          <label>Filtrer par partenaire</label>
          <select value={deliveryPartnerId} onChange={(e) => setDeliveryPartnerId(e.target.value)}>
            <option value="">Tous</option>
            {(partners.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.cityCode})</option>
            ))}
          </select>
        </div>
        {settlements.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Partenaire</th>
                <th>Période</th>
                <th>Colis</th>
                <th>Encaissé</th>
                <th>Commission</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(settlements.data?.data ?? []).map((s) => (
                <tr key={s.id} className="clickable" onClick={() => setDetailId(s.id)}>
                  <td>{s.deliveryPartnerName ?? '—'}</td>
                  <td className="muted">{s.periodStart} → {s.periodEnd}</td>
                  <td>{s.parcelCount}</td>
                  <td className="mono">{s.totalCollectedAmount} {s.currency}</td>
                  <td className="mono">{s.commissionAmount} {s.currency}</td>
                  <td><Pill kind={statusKind(s.status)}>{s.status}</Pill></td>
                  <td><button className="btn ghost" onClick={(e) => { e.stopPropagation(); setDetailId(s.id); }}>Détail</button></td>
                </tr>
              ))}
              {(settlements.data?.data ?? []).length === 0 && (
                <tr><td colSpan={7} className="muted">Aucun règlement pour ce filtre.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Générer un règlement</h3>
        <div className="row">
          <div className="field">
            <label>Partenaire *</label>
            <select value={genPartnerId} onChange={(e) => setGenPartnerId(e.target.value)}>
              <option value="">—</option>
              {(partners.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.cityCode})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Début de période *</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="field">
            <label>Fin de période *</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Agrège tous les colis livrés par ce partenaire sur la période (calcul prix/kg ou %
          du montant encaissé, selon le mode configuré). Regénérer un brouillon existant le
          met à jour ; un règlement déjà validé n'est plus modifié par une régénération.
        </p>
        <ErrorText error={generate.error} />
        <button
          className="btn primary"
          disabled={!genPartnerId || !periodStart || !periodEnd || generate.isPending}
          onClick={() => generate.mutate()}
        >
          Générer le brouillon
        </button>
      </div>

      {detailId && (
        <SettlementDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={invalidate} />
      )}
    </>
  );
}

function SettlementDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['partner-settlement', id],
    queryFn: () => api<SettlementDetail>(`/admin/partner-settlements/${id}`),
  });
  const [paymentReference, setPaymentReference] = useState('');

  const update = useMutation({
    mutationFn: (status: 'VALIDATED' | 'PAID') =>
      api(`/admin/partner-settlements/${id}`, {
        method: 'PATCH',
        body: { status, paymentReference: status === 'PAID' ? paymentReference || undefined : undefined },
      }),
    onSuccess: () => {
      onChanged();
      void qc.invalidateQueries({ queryKey: ['partner-settlement', id] });
    },
  });

  if (detail.isLoading || !detail.data) {
    return (
      <Modal title="Règlement" onClose={onClose}>
        <Loading />
      </Modal>
    );
  }
  const s = detail.data;

  return (
    <Modal title={`Règlement — ${s.deliveryPartnerName ?? ''}`} onClose={onClose}>
      <p>
        Période <b>{s.periodStart} → {s.periodEnd}</b> · <Pill kind={statusKind(s.status)}>{s.status}</Pill>
      </p>
      <p>
        {s.parcelCount} colis · Encaissé <span className="mono">{s.totalCollectedAmount} {s.currency}</span> ·
        Commission <b className="mono">{s.commissionAmount} {s.currency}</b>
      </p>
      {s.paymentReference && <p className="muted">Référence de paiement : {s.paymentReference}</p>}
      {s.paidAt && <p className="muted">Payé le {new Date(s.paidAt).toLocaleDateString('fr')}</p>}

      <table className="data">
        <thead>
          <tr>
            <th>N° suivi</th>
            <th>Poids</th>
            <th>Montant payé</th>
            <th>Livré le</th>
          </tr>
        </thead>
        <tbody>
          {s.parcels.map((p) => (
            <tr key={p.id}>
              <td className="mono">{p.trackingNumber}</td>
              <td>{p.weightKg} kg</td>
              <td className="mono">{p.amountPaid} {p.billingCurrency}</td>
              <td className="muted">{p.deliveredAt ? new Date(p.deliveredAt).toLocaleDateString('fr') : '—'}</td>
            </tr>
          ))}
          {s.parcels.length === 0 && (
            <tr><td colSpan={4} className="muted">Aucun colis livré sur cette période.</td></tr>
          )}
        </tbody>
      </table>

      <ErrorText error={update.error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={onClose}>Fermer</button>
        {s.status === 'DRAFT' && (
          <button className="btn primary" disabled={update.isPending} onClick={() => update.mutate('VALIDATED')}>
            Valider
          </button>
        )}
        {s.status === 'VALIDATED' && (
          <>
            <input
              className="btn"
              style={{ minWidth: 180 }}
              placeholder="Référence de paiement"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
            <button className="btn primary" disabled={update.isPending} onClick={() => update.mutate('PAID')}>
              Marquer payé
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
