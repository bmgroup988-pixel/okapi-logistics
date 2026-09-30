import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CityLabel, ErrorText, Loading, Modal, Pill, statusKind } from '../components/ui';

interface GroupageSummary {
  id: string;
  code: string;
  status: 'OUVERT' | 'CLOTURE' | 'ANNULE';
  destinationAgencyId: string;
  destinationAgencyName: string;
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

interface AvailableParcel {
  id: string;
  trackingNumber: string;
  weightKg: string;
  destinationCityCode: string;
  destinationCityName: string;
  recipientName: string;
}

interface Agency {
  id: string;
  code: string;
  name: string;
}

function groupageStatusKind(s: string): string {
  return s === 'CLOTURE' ? 'ok' : s === 'ANNULE' ? 'err' : 'info';
}

const BULK_STATUS_OPTIONS = [
  { value: 'EN_TRANSIT', label: 'En transit (nouveau point de passage)' },
  { value: 'ARRIVE', label: 'Arrivé' },
  { value: 'LIVRE', label: 'Livré' },
  { value: 'RETOURNE', label: 'Retourné' },
];

/**
 * Change le statut de tous les colis du groupage en une fois — une
 * transition par colis (mêmes règles que depuis la fiche colis), pas un
 * statut propre au groupage. Un colis déjà incompatible (ex. livré à part)
 * est simplement ignoré, sans bloquer les autres.
 */
function BulkTransitionModal({ groupageId, onClose, onDone }: { groupageId: string; onClose: () => void; onDone: () => void }) {
  const [to, setTo] = useState('EN_TRANSIT');
  const [locationLabel, setLocationLabel] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ succeeded: string[]; failed: Array<{ trackingNumber: string; reason: string }> } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const run = useMutation({
    mutationFn: () =>
      api<{ succeeded: string[]; failed: Array<{ trackingNumber: string; reason: string }> }>(
        `/groupages/${groupageId}/transition`,
        { method: 'POST', body: { to, locationLabel: locationLabel || undefined, note: note || undefined, visibleToClient: true } },
      ),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      onDone();
    },
    onError: setError,
  });

  return (
    <Modal title="Changer le statut de tous les colis du groupage" onClose={onClose}>
      {result ? (
        <>
          <p style={{ color: 'var(--ok)' }}>{result.succeeded.length} colis passés à « {to} ».</p>
          {result.failed.length > 0 && (
            <>
              <p style={{ color: 'var(--err)' }}>{result.failed.length} colis non modifiés :</p>
              <ul style={{ fontSize: 13 }}>
                {result.failed.map((f) => (
                  <li key={f.trackingNumber}>
                    <span className="mono">{f.trackingNumber}</span> — {f.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="btn primary" onClick={onClose}>
            Fermer
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run.mutate();
          }}
          style={{ display: 'grid', gap: 8 }}
        >
          <div className="field">
            <label>Nouveau statut *</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {BULK_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Lieu / pays de transit (optionnel)</label>
            <input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Ex. Douala, Cameroun" />
          </div>
          <div className="field">
            <label>Note (optionnel)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            S'applique à chaque colis du groupage individuellement — un colis déjà à un autre
            stade (ex. livré séparément) sera simplement ignoré.
          </p>
          <ErrorText error={error} />
          <button className="btn primary" type="submit" disabled={run.isPending}>
            Appliquer à tous les colis
          </button>
        </form>
      )}
    </Modal>
  );
}

/**
 * Champ de recherche + suggestions pour choisir un colis à ajouter à un
 * groupage — tape le code complet, ou juste les derniers chiffres et la
 * ville de destination (ex. « 0043 FIH ») pour le retrouver vite.
 */
function ParcelPicker({
  parcels,
  value,
  onSelect,
}: {
  parcels: AvailableParcel[];
  value: AvailableParcel | null;
  onSelect: (p: AvailableParcel | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const normalized = query.replace(/\s+/g, '').toUpperCase();
  const matches = normalized
    ? parcels
        .filter((p) => p.trackingNumber.replace(/\s+/g, '').toUpperCase().includes(normalized))
        .slice(0, 8)
    : [];

  return (
    <div className="msd" style={{ flex: '1 1 280px', marginBottom: 0 }}>
      <input
        placeholder="Code du colis, ou 4 derniers chiffres + ville (ex. 0043 FIH)"
        value={value ? value.trackingNumber : query}
        onChange={(e) => {
          if (value) onSelect(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && !value && matches.length > 0 && (
        <div className="msd-panel">
          {matches.map((p) => (
            <div
              key={p.id}
              className="msd-option"
              onMouseDown={() => {
                onSelect(p);
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="mono">{p.trackingNumber}</span> · {p.destinationCityCode}{' '}
              {p.destinationCityName} · {p.recipientName} · {p.weightKg} kg
            </div>
          ))}
        </div>
      )}
      {open && !value && normalized && matches.length === 0 && (
        <div className="msd-panel">
          <div className="msd-option muted">Aucun colis disponible ne correspond.</div>
        </div>
      )}
    </div>
  );
}

function CreateGroupageModal({ onClose }: { onClose: (id?: string) => void }) {
  const agencies = useQuery({ queryKey: ['reference-agencies'], queryFn: () => api<Agency[]>('/reference/agencies') });
  const [destinationAgencyId, setDestinationAgencyId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const create = useMutation({
    mutationFn: () =>
      api<GroupageSummary>('/groupages', {
        method: 'POST',
        body: { destinationAgencyId, note: note || undefined },
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
          <label>Agence de destination</label>
          <select value={destinationAgencyId} onChange={(e) => setDestinationAgencyId(e.target.value)} required>
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
        <button className="btn primary" type="submit" disabled={create.isPending || !destinationAgencyId}>
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
    refetchInterval: 5_000,
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
        réglée à l'enregistrement de chaque colis. Un colis d'une autre destination peut être
        intégré à un groupage pour combler un vide ou une urgence, sans effet sur sa propre
        destination.
      </p>

      {groupages.isLoading && <Loading />}
      {groupages.error && <ErrorText error={groupages.error} />}
      <table className="data">
        <thead>
          <tr>
            <th>Code</th>
            <th>Agence de destination</th>
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
              <td>{g.destinationAgencyName}</td>
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
  const [selectedParcel, setSelectedParcel] = useState<AvailableParcel | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [bulkTransitionOpen, setBulkTransitionOpen] = useState(false);

  const groupage = useQuery({
    queryKey: ['groupage', id],
    queryFn: () => api<GroupageDetail>(`/groupages/${id}`),
    refetchInterval: 5_000,
  });

  const availableParcels = useQuery({
    queryKey: ['groupage-available-parcels'],
    queryFn: () => api<AvailableParcel[]>('/groupages/parcels/available'),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['groupage', id] });
    void qc.invalidateQueries({ queryKey: ['groupage-available-parcels'] });
  };

  const addParcel = useMutation({
    mutationFn: () => api(`/groupages/${id}/parcels`, { method: 'POST', body: { parcelId: selectedParcel?.id } }),
    onSuccess: () => {
      setSelectedParcel(null);
      setError(null);
      refresh();
    },
    onError: setError,
  });

  const removeParcel = useMutation({
    mutationFn: (removedId: string) => api(`/groupages/${id}/parcels/${removedId}`, { method: 'DELETE' }),
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
        {g.parcels.length > 0 && (
          <button className="btn" onClick={() => setBulkTransitionOpen(true)}>
            Changer le statut des colis
          </button>
        )}
        {isOpen && (
          <button className="btn" onClick={() => close.mutate()} disabled={close.isPending}>
            Clôturer
          </button>
        )}
      </div>
      <p className="muted">
        {g.destinationAgencyName} · {g.parcelCount} colis · {g.totalWeightKg} kg
        {g.note ? ` · ${g.note}` : ''}
      </p>

      <div className="card">
        <h3>
          Suivi d'arrivée — {arrivedCount} / {g.parcels.length} arrivés
        </h3>
        {isOpen && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addParcel.mutate();
              }}
              className="row"
              style={{ marginBottom: 4 }}
            >
              <ParcelPicker parcels={availableParcels.data ?? []} value={selectedParcel} onSelect={setSelectedParcel} />
              <button className="btn primary" type="submit" disabled={addParcel.isPending || !selectedParcel}>
                + Ajouter
              </button>
            </form>
            <p className="muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
              Seuls les colis enregistrés, non annulés et pas déjà dans un autre groupage
              apparaissent ici — n'importe quelle destination, y compris différente de celle du
              groupage (décision administrative sans effet sur le colis).
            </p>
          </>
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

      {bulkTransitionOpen && (
        <BulkTransitionModal
          groupageId={id}
          onClose={() => setBulkTransitionOpen(false)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
