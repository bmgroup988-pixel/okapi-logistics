import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCities } from '../lib/geo';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';
import { useT } from '../lib/i18n';

interface Shipment {
  id: string;
  code: string;
  status: 'OUVERTE' | 'CLOTUREE' | 'ANNULEE';
  parcelCount: number;
  totalWeightKg: string;
  currency: string;
  totalAmountDue: string;
  openedAt: string;
  closedAt: string | null;
}

interface ShipmentParcel {
  id: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string | null;
  destinationCityCode: string;
  destinationCityName: string;
  weightKg: string;
  amountDue: string;
  currency: string;
}

interface ShipmentDetail extends Shipment {
  parcels: ShipmentParcel[];
}

interface SupplierInvoice {
  id: string;
  number: string;
  amountGross: string;
  currency: string;
  issuedAt: string;
}

function statusKind(s: Shipment['status']): string {
  return s === 'CLOTUREE' ? 'ok' : s === 'ANNULEE' ? 'err' : 'info';
}

function ShipmentDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canManageParcels = can('supplier-parcel:create');
  const cities = useCities();
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<unknown>(null);

  const detail = useQuery({
    queryKey: ['supplier-shipment', id],
    queryFn: () => api<ShipmentDetail>(`/supplier-portal/shipments/${id}`),
  });

  const addParcel = useMutation({
    mutationFn: () =>
      api(`/supplier-portal/shipments/${id}/parcels`, {
        method: 'POST',
        body: {
          recipientName,
          recipientPhone: recipientPhone || undefined,
          destinationCityId,
          weightKg,
          amount,
        },
      }),
    onSuccess: () => {
      setRecipientName('');
      setRecipientPhone('');
      setWeightKg('');
      setAmount('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['supplier-shipment', id] });
      void qc.invalidateQueries({ queryKey: ['supplier-shipments'] });
    },
    onError: setError,
  });

  const removeParcel = useMutation({
    mutationFn: (parcelId: string) =>
      api(`/supplier-portal/shipments/${id}/parcels/${parcelId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-shipment', id] });
      void qc.invalidateQueries({ queryKey: ['supplier-shipments'] });
    },
  });

  const s = detail.data;
  const isOpen = s?.status === 'OUVERTE';

  return (
    <Modal onClose={onClose} title={s ? `Expédition ${s.code}` : 'Expédition'}>
      {detail.isLoading && <Loading />}
      {s && (
        <>
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Colis</th>
                <th>Client</th>
                <th>Ville</th>
                <th>Poids</th>
                <th>Montant</th>
                {isOpen && canManageParcels && <th />}
              </tr>
            </thead>
            <tbody>
              {s.parcels.map((p) => (
                <tr key={p.id}>
                  <td>{p.trackingNumber}</td>
                  <td>
                    {p.recipientName}
                    {p.recipientPhone ? ` — ${p.recipientPhone}` : ''}
                  </td>
                  <td>
                    {p.destinationCityCode} — {p.destinationCityName}
                  </td>
                  <td>{p.weightKg} kg</td>
                  <td>
                    {p.amountDue} {p.currency}
                  </td>
                  {isOpen && canManageParcels && (
                    <td>
                      <button className="btn ghost" onClick={() => removeParcel.mutate(p.id)}>
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {s.parcels.length === 0 && (
                <tr>
                  <td colSpan={isOpen && canManageParcels ? 6 : 5} className="muted">
                    Aucun colis pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {isOpen && !canManageParcels && (
            <p className="muted" style={{ fontSize: 13 }}>
              L'ajout de colis depuis ce portail est temporairement désactivé. Déposez vos colis à
              l'agence, votre interlocuteur les enregistrera dans cette expédition.
            </p>
          )}

          {isOpen && canManageParcels && (
            <form
              className="grid2"
              onSubmit={(e) => {
                e.preventDefault();
                addParcel.mutate();
              }}
              style={{ gap: 8, marginBottom: 8 }}
            >
              <input
                placeholder="Nom du client"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                required
              />
              <input
                placeholder="Téléphone (optionnel)"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              <select
                value={destinationCityId}
                onChange={(e) => setDestinationCityId(e.target.value)}
                required
              >
                <option value="">Ville de destination…</option>
                {cities.data
                  ?.filter((c) => c.isDestination)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
              </select>
              <input
                placeholder="Poids (kg)"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
              <input
                placeholder={`Montant (${s.currency})`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <button className="btn primary" type="submit" disabled={addParcel.isPending}>
                + Ajouter ce colis
              </button>
            </form>
          )}
          <ErrorText error={error} />
        </>
      )}
    </Modal>
  );
}

/** Portail fournisseur en libre-service — docs/11, §7. */
export function SupplierPortal() {
  const { t } = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'shipments' | 'invoices'>('shipments');
  const [detailId, setDetailId] = useState<string | null>(null);

  const shipments = useQuery({
    queryKey: ['supplier-shipments'],
    queryFn: () => api<Shipment[]>('/supplier-portal/shipments'),
  });

  const invoices = useQuery({
    queryKey: ['supplier-invoices'],
    queryFn: () => api<SupplierInvoice[]>('/supplier-portal/invoices'),
    enabled: tab === 'invoices',
  });

  const openShipment = useMutation({
    mutationFn: () => api<Shipment>('/supplier-portal/shipments', { method: 'POST' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['supplier-shipments'] });
      setDetailId(s.id);
    },
  });

  const closeShipment = useMutation({
    mutationFn: (id: string) => api(`/supplier-portal/shipments/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-shipments'] });
      void qc.invalidateQueries({ queryKey: ['supplier-invoices'] });
    },
  });

  const downloadPdf = async (invoiceId: string) => {
    try {
      const { url } = await api<{ url: string }>(`/supplier-portal/invoices/${invoiceId}/pdf`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'PDF indisponible');
    }
  };

  return (
    <div>
      <h1>{t('nav.supplierPortal')}</h1>

      <div className="tabs" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={tab === 'shipments' ? 'btn primary' : 'btn ghost'} onClick={() => setTab('shipments')}>
          Mes expéditions
        </button>
        <button className={tab === 'invoices' ? 'btn primary' : 'btn ghost'} onClick={() => setTab('invoices')}>
          Mes factures
        </button>
        <span className="spacer" />
        {tab === 'shipments' && (
          <button className="btn primary" onClick={() => openShipment.mutate()} disabled={openShipment.isPending}>
            + Nouvelle expédition
          </button>
        )}
      </div>

      {tab === 'shipments' && (
        <>
          {shipments.isLoading && <Loading />}
          {shipments.error && <ErrorText error={shipments.error} />}
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Statut</th>
                <th>Colis</th>
                <th>Poids</th>
                <th>Montant</th>
                <th>Ouverte le</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shipments.data?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="link" onClick={() => setDetailId(s.id)}>
                      {s.code}
                    </button>
                  </td>
                  <td>
                    <Pill kind={statusKind(s.status)}>{s.status}</Pill>
                  </td>
                  <td>{s.parcelCount}</td>
                  <td>{s.totalWeightKg} kg</td>
                  <td>
                    {s.totalAmountDue} {s.currency}
                  </td>
                  <td>{new Date(s.openedAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    {s.status === 'OUVERTE' && (
                      <button
                        className="btn"
                        disabled={s.parcelCount === 0 || closeShipment.isPending}
                        onClick={() => closeShipment.mutate(s.id)}
                        title={s.parcelCount === 0 ? 'Ajoutez au moins un colis' : undefined}
                      >
                        Clôturer et facturer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {shipments.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucune expédition. Créez-en une pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {tab === 'invoices' && (
        <>
          {invoices.isLoading && <Loading />}
          {invoices.error && <ErrorText error={invoices.error} />}
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>N° facture</th>
                <th>Montant</th>
                <th>Émise le</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.data?.map((f) => (
                <tr key={f.id}>
                  <td>{f.number}</td>
                  <td>
                    {f.amountGross} {f.currency}
                  </td>
                  <td>{new Date(f.issuedAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <button className="link" onClick={() => void downloadPdf(f.id)}>
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Aucune facture pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {detailId && <ShipmentDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
