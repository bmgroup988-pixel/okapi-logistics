import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';

interface Carrier {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
}

function CarrierModal({ carrier, onClose }: { carrier: Carrier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(carrier?.name ?? '');
  const [contactName, setContactName] = useState(carrier?.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(carrier?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(carrier?.contactEmail ?? '');
  const [isActive, setIsActive] = useState(carrier?.isActive ?? true);
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: () =>
      api(carrier ? `/admin/carriers/${carrier.id}` : '/admin/carriers', {
        method: carrier ? 'PATCH' : 'POST',
        body: {
          name,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          isActive,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-carriers'] });
      void qc.invalidateQueries({ queryKey: ['ref-carriers'] });
      onClose();
    },
    onError: setError,
  });

  return (
    <Modal title={carrier ? `Modifier — ${carrier.name}` : 'Nouvelle compagnie de transport'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <input placeholder="Raison sociale" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Nom du contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <input placeholder="Téléphone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        <input placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (proposée lors de l'expédition)
        </label>
        <ErrorText error={error} />
        <button className="btn primary" type="submit" disabled={save.isPending || !name}>
          Enregistrer
        </button>
      </form>
    </Modal>
  );
}

/** Compagnies de transport sous-traitées — gestion réservée au super-admin. */
export function Carriers() {
  const [editing, setEditing] = useState<Carrier | null | undefined>(undefined);

  const carriers = useQuery({
    queryKey: ['admin-carriers'],
    queryFn: () => api<Carrier[]>('/admin/carriers'),
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Compagnies de transport</h1>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing(null)}>
          + Nouvelle compagnie
        </button>
      </div>
      <p className="muted">
        Ces compagnies apparaissent dans le choix du transporteur lors de l'expédition d'un colis,
        pour tout le personnel interne (agent, DAF, super-admin).
      </p>

      {carriers.isLoading && <Loading />}
      {carriers.error && <ErrorText error={carriers.error} />}
      <table className="data">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Contact</th>
            <th>Statut</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {carriers.data?.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>
                {c.contactName}
                {c.contactPhone ? ` — ${c.contactPhone}` : ''}
              </td>
              <td>
                <Pill kind={c.isActive ? 'ok' : 'err'}>{c.isActive ? 'Active' : 'Inactive'}</Pill>
              </td>
              <td>
                <button className="btn ghost" onClick={() => setEditing(c)}>
                  Modifier
                </button>
              </td>
            </tr>
          ))}
          {carriers.data?.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Aucune compagnie pour l'instant.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing !== undefined && <CarrierModal carrier={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
