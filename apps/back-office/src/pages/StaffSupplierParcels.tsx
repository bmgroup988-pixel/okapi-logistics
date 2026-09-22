import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCities } from '../lib/geo';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';

interface SupplierLite {
  id: string;
  code: string;
  name: string;
  defaultAgencyId: string;
}

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

function statusKind(s: Shipment['status']): string {
  return s === 'CLOTUREE' ? 'ok' : s === 'ANNULEE' ? 'err' : 'info';
}

function ShipmentDetailModal({
  supplierId,
  id,
  onClose,
}: {
  supplierId: string;
  id: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const cities = useCities();
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<unknown>(null);

  const base = `/staff/suppliers/${supplierId}/shipments/${id}`;

  const detail = useQuery({
    queryKey: ['staff-supplier-shipment', supplierId, id],
    queryFn: () => api<ShipmentDetail>(base),
  });

  const addParcel = useMutation({
    mutationFn: () =>
      api(`${base}/parcels`, {
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
      void qc.invalidateQueries({ queryKey: ['staff-supplier-shipment', supplierId, id] });
      void qc.invalidateQueries({ queryKey: ['staff-supplier-shipments', supplierId] });
    },
    onError: setError,
  });

  const removeParcel = useMutation({
    mutationFn: (parcelId: string) => api(`${base}/parcels/${parcelId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-supplier-shipment', supplierId, id] });
      void qc.invalidateQueries({ queryKey: ['staff-supplier-shipments', supplierId] });
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
                {isOpen && <th />}
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
                  {isOpen && (
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
                  <td colSpan={isOpen ? 6 : 5} className="muted">
                    Aucun colis pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {isOpen && (
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
              <select value={destinationCityId} onChange={(e) => setDestinationCityId(e.target.value)} required>
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

/**
 * Enregistrement de colis pour un fournisseur qui dépose physiquement à
 * l'agence — le personnel choisit le fournisseur, puis gère ses expéditions
 * exactement comme le portail self-service (voir SupplierPortal.tsx).
 */
export function StaffSupplierParcels() {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const suppliers = useQuery({
    queryKey: ['staff-suppliers'],
    queryFn: () => api<SupplierLite[]>('/staff/suppliers'),
  });

  const shipments = useQuery({
    queryKey: ['staff-supplier-shipments', supplierId],
    queryFn: () => api<Shipment[]>(`/staff/suppliers/${supplierId}/shipments`),
    enabled: !!supplierId,
  });

  const openShipment = useMutation({
    mutationFn: () => api<Shipment>(`/staff/suppliers/${supplierId}/shipments`, { method: 'POST' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff-supplier-shipments', supplierId] });
      setDetailId(s.id);
    },
  });

  const closeShipment = useMutation({
    mutationFn: (id: string) => api(`/staff/suppliers/${supplierId}/shipments/${id}/close`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-supplier-shipments', supplierId] }),
  });

  return (
    <div>
      <h1>Colis fournisseur</h1>
      <p className="muted">
        Pour un fournisseur qui dépose ses colis physiquement à l'agence sans utiliser lui-même le
        portail. Choisis le fournisseur, puis enregistre ses colis dans son expédition en cours —
        exactement comme s'il le faisait lui-même.
      </p>

      <div className="field" style={{ maxWidth: 360 }}>
        <label>Fournisseur</label>
        <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setDetailId(null); }}>
          <option value="">— Choisir —</option>
          {suppliers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>

      {supplierId && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Expéditions</h3>
            <span className="spacer" />
            <button className="btn primary" onClick={() => openShipment.mutate()} disabled={openShipment.isPending}>
              + Nouvelle expédition
            </button>
          </div>

          {shipments.isLoading && <Loading />}
          {shipments.error && <ErrorText error={shipments.error} />}
          <table className="data">
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

      {detailId && supplierId && (
        <ShipmentDetailModal supplierId={supplierId} id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
