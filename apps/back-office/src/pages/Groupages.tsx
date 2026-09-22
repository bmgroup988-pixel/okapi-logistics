import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CityLabel, ErrorText, Loading, Modal, Pill, statusKind } from '../components/ui';

interface GroupageSummary {
  id: string;
  code: string;
  status: 'OUVERT' | 'CLOTURE' | 'ANNULE';
  originAgencyId: string;
  originAgencyName: string;
  parcelCount: number;
  totalWeightKg: string;
  note: string | null;
  openedAt: string;
  closedAt: string | null;
}

interface GroupageParcel {
  id: string;
  trackingNumber: string;
  status: string;
  destinationCityCode: string;
  destinationCityName: string;
  weightKg: string;
  recipientName: string;
  supplierCode: string | null;
}

interface GroupageDetail extends GroupageSummary {
  parcels: GroupageParcel[];
}

interface Agency {
  id: string;
  code: string;
  name: string;
}

function groupageStatusKind(s: string): string {
  return s === 'CLOTURE' ? 'ok' : s === 'ANNULE' ? 'err' : 'info';
}

function CreateGroupageModal({ onClose }: { onClose: (id?: string) => void }) {
  const agencies = useQuery({ queryKey: ['reference-agencies'], queryFn: () => api<Agency[]>('/reference/agencies') });
  const [originAgencyId, setOriginAgencyId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () =>
      api<GroupageSummary>('/groupages', {
        method: 'POST',
        body: { originAgencyId, note: note || undefined },
      }),
    onSuccess: (g) => onClose(g.id),
    onError: setError,
  });

  return (
    <Modal title="Nouveau groupage" onClose={() => onClose()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <div className="field">
          <label>Agence de départ</label>
          <select value={originAgencyId} onChange={(e) => setOriginAgencyId(e.target.value)} required>
            <option value="">— Choisir —</option>
            {agencies.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Note (facultatif)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. vol Cotonou → Kinshasa du 25/09" />
        </div>
        <ErrorText error={error} />
        <button className="btn primary" type="submit" disabled={create.isPending || !originAgencyId}>
          Créer
        </button>
      </form>
    </Modal>
  );
}

/** Liste des groupages — regroupement de colis (walk-in et/ou fournisseur) pour un même trajet. */
export function Groupages() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const groupages = useQuery({
    queryKey: ['groupages'],
    queryFn: () => api<GroupageSummary[]>('/groupages'),
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Groupages</h1>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Nouveau groupage
        </button>
      </div>
      <p className="muted">
        Regroupez des colis (walk-in et/ou fournisseur) pour un même trajet et suivez précisément
        lesquels sont partis, arrivés, ou pas encore expédiés — sans impact sur la facturation, déjà
        réglée à l'enregistrement de chaque colis.
      </p>

      {groupages.isLoading && <Loading />}
      {groupages.error && <ErrorText error={groupages.error} />}
      <table className="data">
        <thead>
          <tr>
            <th>Code</th>
            <th>Agence de départ</th>
            <th>Statut</th>
            <th>Colis</th>
            <th>Poids</th>
            <th>Ouvert le</th>
          </tr>
        </thead>
        <tbody>
          {groupages.data?.map((g) => (
            <tr key={g.id} className="clickable" onClick={() => navigate(`/groupages/${g.id}`)}>
              <td className="mono">{g.code}</td>
              <td>{g.originAgencyName}</td>
              <td>
                <Pill kind={groupageStatusKind(g.status)}>{g.status}</Pill>
              </td>
              <td>{g.parcelCount}</td>
              <td>{g.totalWeightKg} kg</td>
              <td>{new Date(g.openedAt).toLocaleString('fr-FR')}</td>
            </tr>
          ))}
          {groupages.data?.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Aucun groupage pour l'instant.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {creating && (
        <CreateGroupageModal
          onClose={(id) => {
            setCreating(false);
            if (id) navigate(`/groupages/${id}`);
          }}
        />
      )}
    </div>
  );
}

/** Fiche d'un groupage — ajout/retrait de colis, suivi par colis, clôture. */
export function GroupageDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState<unknown>(null);

  const groupage = useQuery({
    queryKey: ['groupage', id],
    queryFn: () => api<GroupageDetail>(`/groupages/${id}`),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['groupage', id] });

  const addParcel = useMutation({
    mutationFn: () => api(`/groupages/${id}/parcels`, { method: 'POST', body: { trackingNumber } }),
    onSuccess: () => {
      setTrackingNumber('');
      setError(null);
      refresh();
    },
    onError: setError,
  });

  const removeParcel = useMutation({
    mutationFn: (parcelId: string) => api(`/groupages/${id}/parcels/${parcelId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const close = useMutation({
    mutationFn: () => api(`/groupages/${id}/close`, { method: 'POST' }),
    onSuccess: refresh,
  });

  if (groupage.isLoading) return <Loading />;
  if (!groupage.data) return <ErrorText error={groupage.error ?? 'Groupage introuvable'} />;
  const g = groupage.data;
  const isOpen = g.status === 'OUVERT';
  const arrivedStatuses = new Set(['ARRIVE', 'HANDED_TO_PARTNER', 'LIVRE']);
  const arrivedCount = g.parcels.filter((p) => arrivedStatuses.has(p.status)).length;

  return (
    <div>
      <p>
        <Link to="/groupages">← Groupages</Link>
      </p>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h1 className="mono" style={{ margin: 0 }}>
          {g.code}
        </h1>
        <Pill kind={groupageStatusKind(g.status)}>{g.status}</Pill>
        <span className="spacer" />
        {isOpen && (
          <button className="btn" onClick={() => close.mutate()} disabled={close.isPending}>
            Clôturer
          </button>
        )}
      </div>
      <p className="muted">
        {g.originAgencyName} · {g.parcelCount} colis · {g.totalWeightKg} kg
        {g.note ? ` · ${g.note}` : ''}
      </p>

      <div className="card">
        <h3>
          Suivi d'arrivée — {arrivedCount} / {g.parcels.length} arrivés
        </h3>
        {isOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addParcel.mutate();
            }}
            className="row"
            style={{ marginBottom: 12 }}
          >
            <input
              placeholder="Numéro de suivi (ex. OKP2209260043FIH)"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              required
            />
            <button className="btn primary" type="submit" disabled={addParcel.isPending || !trackingNumber}>
              + Ajouter
            </button>
          </form>
        )}
        <ErrorText error={error} />
        <table className="data">
          <thead>
            <tr>
              <th>N° de suivi</th>
              <th>Destination</th>
              <th>Destinataire</th>
              <th>Origine</th>
              <th>Statut</th>
              {isOpen && <th />}
            </tr>
          </thead>
          <tbody>
            {g.parcels.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.trackingNumber}</td>
                <td>
                  <CityLabel code={p.destinationCityCode} />
                </td>
                <td>{p.recipientName}</td>
                <td>{p.supplierCode ? <span className="mono">{p.supplierCode}</span> : <span className="muted">Walk-in</span>}</td>
                <td>
                  <Pill kind={statusKind(p.status)}>{p.status}</Pill>
                </td>
                {isOpen && (
                  <td>
                    <button
                      className="btn ghost"
                      onClick={() => removeParcel.mutate(p.id)}
                      disabled={removeParcel.isPending}
                    >
                      Retirer
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {g.parcels.length === 0 && (
              <tr>
                <td colSpan={isOpen ? 6 : 5} className="muted">
                  Aucun colis dans ce groupage pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
