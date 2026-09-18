import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uuid } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { DocumentItem, ParcelDetail as ParcelD, Payment } from '../lib/types';
import { CityLabel, CityPair, ErrorText, Loading, Modal, Money, Pill, paymentKind, statusKind } from '../components/ui';

type Tab = 'suivi' | 'paiements' | 'photos' | 'documents';

export function ParcelDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('suivi');
  const [showPay, setShowPay] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const parcel = useQuery({ queryKey: ['parcel', id], queryFn: () => api<ParcelD>(`/parcels/${id}`) });
  const payments = useQuery({
    queryKey: ['payments', id],
    queryFn: () => api<Payment[]>(`/parcels/${id}/payments`),
    enabled: tab === 'paiements' || showPay,
  });
  const docs = useQuery({
    queryKey: ['docs', id],
    queryFn: () => api<DocumentItem[]>(`/parcels/${id}/documents`),
    enabled: tab === 'documents',
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['parcel', id] });
    void qc.invalidateQueries({ queryKey: ['payments', id] });
    void qc.invalidateQueries({ queryKey: ['docs', id] });
  };

  if (parcel.isLoading) return <Loading />;
  if (!parcel.data) return <ErrorText error={parcel.error ?? 'Colis introuvable'} />;
  const p = parcel.data;

  return (
    <>
      <h1 className="mono">{p.trackingNumber}</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Pill kind={statusKind(p.status)}>{p.status}</Pill>
        <Pill kind={paymentKind(p.paymentStatus)}>
          {p.paymentStatus} — solde <Money m={p.balance} />
        </Pill>
        <span style={{ flex: 1 }} />
        {can('parcel:update') && p.status !== 'LIVRE' && p.status !== 'ANNULE' && (
          <button className="btn ghost" onClick={() => setShowEdit(true)}>
            Modifier
          </button>
        )}
        {can('parcel:cancel') && p.status !== 'LIVRE' && p.status !== 'ANNULE' && (
          <button className="btn ghost" style={{ color: 'var(--err)' }} onClick={() => setShowCancel(true)}>
            Annuler le colis
          </button>
        )}
        {can('parcel:transition') && p.status !== 'LIVRE' && p.status !== 'ANNULE' && (
          <button className="btn" onClick={() => setShowTransition(true)}>
            Changer le statut
          </button>
        )}
      </div>

      <div className="tabs">
        {(['suivi', 'paiements', 'photos', 'documents'] as Tab[]).map((x) => (
          <button key={x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'suivi' && (
        <>
          <div className="card">
            <h3>Historique</h3>
            <table className="data">
              <tbody>
                {p.events.map((e) => (
                  <tr key={e.id}>
                    <td><Pill kind={statusKind(e.status)}>{e.status}</Pill></td>
                    <td>{e.locationLabel ?? '—'}</td>
                    <td>{e.note ?? ''}</td>
                    <td className="muted">{new Date(e.createdAt).toLocaleString('fr')}</td>
                    <td className="muted">{e.createdByName ?? 'système'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid2">
            <div className="card">
              <h3>Expéditeur</h3>
              <p>{p.sender.name}<br /><span className="muted">{p.sender.phone ?? ''}</span></p>
            </div>
            <div className="card">
              <h3>Destinataire</h3>
              <p>{p.recipient.name}<br /><span className="muted">{p.recipient.phone ?? ''}</span></p>
            </div>
          </div>
          <div className="card">
            <h3>Détails</h3>
            <p>
              <CityPair origin={p.originCityCode} destination={p.destinationCityCode} /> · {p.transportMode} · {p.weightKg} kg ·{' '}
              {p.contentNature}
            </p>
            <p className="muted">
              Montant dû <Money m={p.amountDue} /> · réf. <Money m={p.amountDueReference} /> · canal{' '}
              {p.clientChannel ?? '—'} · langue {p.clientLocale}
            </p>
          </div>
        </>
      )}

      {tab === 'paiements' && (
        <div className="card">
          <h3>Paiements</h3>
          <p>
            Dû <Money m={p.amountDue} /> · Encaissé <Money m={p.amountPaid} /> · Solde{' '}
            <b><Money m={p.balance} /></b>
          </p>
          {can('payment:create') && p.status !== 'ANNULE' && (
            <button className="btn primary" onClick={() => setShowPay(true)}>
              Encaisser un paiement
            </button>
          )}
          <table className="data" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Montant</th>
                <th>Moyen</th>
                <th>Réf.</th>
                <th>État</th>
                <th>Agent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(payments.data ?? []).map((pay) => (
                <tr key={pay.id}>
                  <td className="muted">{new Date(pay.receivedAt).toLocaleString('fr')}</td>
                  <td>
                    <Money m={pay.amount} />
                    {pay.amount.currency !== pay.amountInBillingCurrency.currency && (
                      <span className="muted"> ≈ <Money m={pay.amountInBillingCurrency} /></span>
                    )}
                  </td>
                  <td>{pay.method}{pay.mobileMoneyProvider ? ` (${pay.mobileMoneyProvider})` : ''}</td>
                  <td className="mono">{pay.externalRef ?? '—'}</td>
                  <td>
                    <Pill kind={pay.state === 'CONFIRME' ? 'ok' : pay.state === 'EN_ATTENTE' ? 'warn' : ''}>
                      {pay.state}
                    </Pill>
                  </td>
                  <td className="muted">{pay.collectedByName}</td>
                  <td>
                    {pay.state === 'EN_ATTENTE' && can('payment:confirm') && (
                      <button
                        className="btn ghost"
                        onClick={async () => {
                          await api(`/payments/${pay.id}/confirm`, { method: 'POST' });
                          refresh();
                        }}
                      >
                        Confirmer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'photos' && (
        <div className="card">
          <h3>Photos</h3>
          <div className="row">
            {p.photos.length === 0 && <p className="muted">Aucune photo.</p>}
            {p.photos.map((ph) => (
              <figure key={ph.id} style={{ margin: 0 }}>
                <img
                  src={ph.url}
                  alt=""
                  style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)' }}
                />
                <figcaption className="muted">
                  {ph.isPrimary ? '★ principale · ' : ''}
                  {ph.locked ? 'verrouillée' : 'modifiable'}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="card">
          <h3>Documents</h3>
          <table className="data">
            <thead>
              <tr>
                <th>Type</th>
                <th>Numéro</th>
                <th>Généré</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(docs.data ?? []).map((d) => (
                <tr key={d.id}>
                  <td>{d.type}</td>
                  <td className="mono">{d.number ?? '—'}</td>
                  <td className="muted">{new Date(d.generatedAt).toLocaleString('fr')}</td>
                  <td>
                    <a href={d.url} target="_blank" rel="noreferrer">Télécharger</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPay && (
        <EncaissementModal
          parcelId={id}
          billingCurrency={p.amountDue.currency}
          balance={p.balance.amount}
          onClose={() => setShowPay(false)}
          onDone={() => {
            setShowPay(false);
            refresh();
          }}
        />
      )}
      {showTransition && (
        <TransitionModal
          parcelId={id}
          status={p.status}
          destinationCityCode={p.destinationCityCode}
          onClose={() => setShowTransition(false)}
          onDone={() => {
            setShowTransition(false);
            refresh();
          }}
        />
      )}
      {showEdit && (
        <EditModal
          parcelId={id}
          parcel={p}
          onClose={() => setShowEdit(false)}
          onDone={() => {
            setShowEdit(false);
            refresh();
          }}
        />
      )}
      {showCancel && (
        <CancelModal
          parcelId={id}
          onClose={() => setShowCancel(false)}
          onDone={() => {
            setShowCancel(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

function EditModal({
  parcelId,
  parcel,
  onClose,
  onDone,
}: {
  parcelId: string;
  parcel: ParcelD;
  onClose: () => void;
  onDone: () => void;
}) {
  const [senderName, setSenderName] = useState(parcel.sender.name);
  const [senderPhone, setSenderPhone] = useState(parcel.sender.phone ?? '');
  const [recipientName, setRecipientName] = useState(parcel.recipient.name);
  const [recipientPhone, setRecipientPhone] = useState(parcel.recipient.phone ?? '');
  const [contentNature, setContentNature] = useState(parcel.contentNature);
  const [weightKg, setWeightKg] = useState(parcel.weightKg);

  const m = useMutation({
    mutationFn: () =>
      api(`/parcels/${parcelId}`, {
        method: 'PATCH',
        body: {
          sender: { name: senderName, phone: senderPhone || null },
          recipient: { name: recipientName, phone: recipientPhone || null },
          contentNature,
          weightKg,
        },
      }),
    onSuccess: onDone,
  });

  return (
    <Modal title="Modifier le colis" onClose={onClose}>
      <div className="grid2">
        <div className="field">
          <label>Expéditeur — nom</label>
          <input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
        </div>
        <div className="field">
          <label>Expéditeur — téléphone</label>
          <input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Destinataire — nom</label>
          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
        <div className="field">
          <label>Destinataire — téléphone</label>
          <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Nature du contenu</label>
          <input value={contentNature} onChange={(e) => setContentNature(e.target.value)} />
        </div>
        <div className="field">
          <label>Poids (kg)</label>
          <input value={weightKg} inputMode="decimal" onChange={(e) => setWeightKg(e.target.value)} />
        </div>
      </div>
      <ErrorText error={m.error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={m.isPending} onClick={() => m.mutate()}>
          Enregistrer les modifications
        </button>
      </div>
    </Modal>
  );
}

function CancelModal({
  parcelId,
  onClose,
  onDone,
}: {
  parcelId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');

  const m = useMutation({
    mutationFn: () => api(`/parcels/${parcelId}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: onDone,
  });

  return (
    <Modal title="Annuler ce colis" onClose={onClose}>
      <p className="error">Cette action est définitive — le colis passera au statut ANNULÉ.</p>
      <div className="field">
        <label>Motif de l'annulation * (min. 3 caractères)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <ErrorText error={m.error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onClose}>Retour</button>
        <button
          className="btn primary"
          style={{ background: 'var(--err)', borderColor: 'var(--err)' }}
          disabled={reason.trim().length < 3 || m.isPending}
          onClick={() => m.mutate()}
        >
          Confirmer l'annulation
        </button>
      </div>
    </Modal>
  );
}

function EncaissementModal({
  parcelId,
  billingCurrency,
  balance,
  onClose,
  onDone,
}: {
  parcelId: string;
  billingCurrency: string;
  balance: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(balance);
  const [currency, setCurrency] = useState(billingCurrency);
  const [method, setMethod] = useState('CASH');
  const [provider, setProvider] = useState('MPESA');
  const [ref, setRef] = useState('');
  const idem = useState(() => uuid())[0];

  const m = useMutation({
    mutationFn: () =>
      api(`/parcels/${parcelId}/payments`, {
        method: 'POST',
        idempotencyKey: idem,
        body: {
          amount,
          currency,
          method,
          mobileMoneyProvider: method === 'MOBILE_MONEY' ? provider : undefined,
          externalRef: ref || undefined,
        },
      }),
    onSuccess: onDone,
  });

  return (
    <Modal title={`Encaisser un paiement — solde ${balance} ${billingCurrency}`} onClose={onClose}>
      <div className="row">
        <div className="field">
          <label>Montant *</label>
          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Devise</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </div>
      </div>
      <div className="field">
        <label>Moyen de paiement *</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="CASH">Espèces</option>
          <option value="MOBILE_MONEY">Mobile Money</option>
          <option value="CARD">Carte bancaire</option>
          <option value="BANK_TRANSFER">Virement</option>
        </select>
      </div>
      {method === 'MOBILE_MONEY' && (
        <div className="field">
          <label>Fournisseur</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="MPESA">M-Pesa</option>
            <option value="ORANGE_MONEY">Orange Money</option>
            <option value="AIRTEL_MONEY">Airtel Money</option>
          </select>
        </div>
      )}
      <div className="field">
        <label>Référence de transaction</label>
        <input value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Espèces → confirmé immédiatement. Mobile Money / carte / virement → « en attente » puis à
        confirmer.
      </p>
      <ErrorText error={m.error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={m.isPending} onClick={() => m.mutate()}>
          Enregistrer le paiement
        </button>
      </div>
    </Modal>
  );
}

interface CityRefLite {
  id: string;
  code: string;
  status: 'HUB' | 'PARTNER' | 'PLANNED';
}
interface PartnerOption {
  id: string;
  name: string;
  coverageZone: string | null;
  isPreferred: boolean;
  currentTariff: { pricePerKg: string; currency: string } | null;
}

/** Statuts atteignables depuis chaque statut — miroir de PARCEL_STATUS_FLOW (@okapi/shared). */
const NEXT: Record<string, string[]> = {
  ENREGISTRE: ['EN_TRANSIT'],
  EN_TRANSIT: ['ARRIVE', 'RETOURNE'],
  ARRIVE: ['LIVRE', 'HANDED_TO_PARTNER', 'RETOURNE'],
  HANDED_TO_PARTNER: ['LIVRE', 'RETOURNE'],
  RETOURNE: ['ARRIVE'],
};

function TransitionModal({
  parcelId,
  status,
  destinationCityCode,
  onClose,
  onDone,
}: {
  parcelId: string;
  status: string;
  destinationCityCode: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const options = NEXT[status] ?? [];
  const [to, setTo] = useState(options[0] ?? '');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [deliveryPartnerId, setDeliveryPartnerId] = useState('');

  const cities = useQuery({
    queryKey: ['ref-cities-all'],
    queryFn: () => api<CityRefLite[]>('/reference/cities'),
    enabled: to === 'HANDED_TO_PARTNER',
  });
  const destCityId = cities.data?.find((c) => c.code === destinationCityCode)?.id;
  const partners = useQuery({
    queryKey: ['delivery-partners-for-city', destCityId],
    queryFn: () => api<PartnerOption[]>('/reference/delivery-partners', { query: { cityId: destCityId } }),
    enabled: to === 'HANDED_TO_PARTNER' && !!destCityId,
  });

  const m = useMutation({
    mutationFn: () =>
      api(`/parcels/${parcelId}/transition`, {
        method: 'POST',
        body: {
          to,
          note: note || undefined,
          unpaidOverrideReason: reason || undefined,
          deliveryPartnerId: to === 'HANDED_TO_PARTNER' ? deliveryPartnerId : undefined,
          visibleToClient: true,
        },
      }),
    onSuccess: onDone,
  });

  const needsPartner = to === 'HANDED_TO_PARTNER';
  const blocked = needsPartner && !deliveryPartnerId;

  return (
    <Modal title={`Changer le statut — actuel : ${status}`} onClose={onClose}>
      <div className="field">
        <label>Nouveau statut *</label>
        <select
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setDeliveryPartnerId('');
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      {needsPartner && (
        <div className="field">
          <label>Partenaire de livraison *</label>
          {partners.isLoading ? (
            <p className="muted">Chargement…</p>
          ) : (partners.data ?? []).length === 0 ? (
            <p className="error">
              Aucun partenaire actif pour <CityLabel code={destinationCityCode} /> — créez-en un dans
              « Partenaires de livraison » avant de remettre ce colis.
            </p>
          ) : (
            <select value={deliveryPartnerId} onChange={(e) => setDeliveryPartnerId(e.target.value)}>
              <option value="">—</option>
              {(partners.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isPreferred ? ' ★' : ''}
                  {p.coverageZone ? ` — ${p.coverageZone}` : ''}
                  {p.currentTariff ? ` (${p.currentTariff.pricePerKg} ${p.currentTariff.currency}/kg)` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="field">
        <label>Commentaire</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {to === 'LIVRE' && (
        <div className="field">
          <label>Justification si solde impayé</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      <ErrorText error={m.error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={!to || blocked || m.isPending} onClick={() => m.mutate()}>
          Confirmer
        </button>
      </div>
    </Modal>
  );
}
