import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';

interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  countryId: string;
  defaultAgencyId: string;
  billingCurrency: string;
  portalActivated: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Agency {
  id: string;
  code: string;
  name: string;
  countryId: string;
  billingCurrency: string;
}

function CreateSupplierModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const agencies = useQuery({ queryKey: ['reference-agencies'], queryFn: () => api<Agency[]>('/reference/agencies') });
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [error, setError] = useState<unknown>(null);

  const agency = agencies.data?.find((a) => a.id === agencyId);

  const create = useMutation({
    mutationFn: () =>
      api('/admin/suppliers', {
        method: 'POST',
        body: {
          name,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          countryId: agency?.countryId,
          defaultAgencyId: agencyId,
          billingCurrency: agency?.billingCurrency,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-suppliers'] });
      onClose();
    },
    onError: setError,
  });

  return (
    <Modal title="Nouveau fournisseur" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        style={{ display: 'grid', gap: 8 }}
      >
        <input placeholder="Raison sociale" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} required>
          <option value="">Agence de rattachement…</option>
          {agencies.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <input placeholder="Nom du contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <input placeholder="Téléphone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        <input placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        {agency && (
          <p className="muted">
            Devise de facturation : {agency.billingCurrency} (celle de l'agence choisie)
          </p>
        )}
        <ErrorText error={error} />
        <button className="btn primary" type="submit" disabled={create.isPending || !agency}>
          Créer
        </button>
      </form>
    </Modal>
  );
}

function ActivatePortalModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(supplier.contactEmail ?? '');
  const [fullName, setFullName] = useState(supplier.contactName ?? '');
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const activate = useMutation({
    mutationFn: () =>
      api<{ email: string; temporaryPassword: string }>(`/admin/suppliers/${supplier.id}/activate-portal`, {
        method: 'POST',
        body: { email, fullName },
      }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ['admin-suppliers'] });
    },
    onError: setError,
  });

  return (
    <Modal title={`Activer le portail — ${supplier.name}`} onClose={onClose}>
      {result ? (
        <div>
          <p>
            Compte créé pour <strong>{result.email}</strong>. Communiquez ce mot de passe temporaire au
            fournisseur par un canal sûr — il ne sera plus jamais affiché :
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: 18, padding: 8, background: 'var(--surface2, #f4f4f7)' }}>
            {result.temporaryPassword}
          </p>
          <button className="btn primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            activate.mutate();
          }}
          style={{ display: 'grid', gap: 8 }}
        >
          <input
            placeholder="Email de connexion"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            placeholder="Nom du titulaire du compte"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <ErrorText error={error} />
          <button className="btn primary" type="submit" disabled={activate.isPending}>
            Créer le compte
          </button>
        </form>
      )}
    </Modal>
  );
}

/** Gestion interne des fournisseurs — docs/11, §6.1. */
export function Suppliers() {
  const [showCreate, setShowCreate] = useState(false);
  const [activateFor, setActivateFor] = useState<Supplier | null>(null);

  const suppliers = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: () => api<Supplier[]>('/admin/suppliers'),
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0 }}>Fournisseurs</h1>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setShowCreate(true)}>
          + Nouveau fournisseur
        </button>
      </div>

      {suppliers.isLoading && <Loading />}
      {suppliers.error && <ErrorText error={suppliers.error} />}
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Contact</th>
            <th>Devise</th>
            <th>Portail</th>
            <th>Statut</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {suppliers.data?.map((s) => (
            <tr key={s.id}>
              <td style={{ fontFamily: 'monospace' }}>{s.code}</td>
              <td>{s.name}</td>
              <td>
                {s.contactName}
                {s.contactPhone ? ` — ${s.contactPhone}` : ''}
              </td>
              <td>{s.billingCurrency}</td>
              <td>
                <Pill kind={s.portalActivated ? 'ok' : 'warn'}>
                  {s.portalActivated ? 'Activé' : 'Non activé'}
                </Pill>
              </td>
              <td>
                <Pill kind={s.isActive ? 'ok' : 'err'}>{s.isActive ? 'Actif' : 'Inactif'}</Pill>
              </td>
              <td>
                {!s.portalActivated && (
                  <button className="btn" onClick={() => setActivateFor(s)}>
                    Activer le portail
                  </button>
                )}
              </td>
            </tr>
          ))}
          {suppliers.data?.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Aucun fournisseur pour l'instant.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showCreate && <CreateSupplierModal onClose={() => setShowCreate(false)} />}
      {activateFor && <ActivatePortalModal supplier={activateFor} onClose={() => setActivateFor(null)} />}
    </div>
  );
}
