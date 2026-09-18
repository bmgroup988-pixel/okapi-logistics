import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, uuid } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useT } from '../lib/i18n';
import type { City, ParcelDetail } from '../lib/types';
import { CityLabel, ErrorText } from '../components/ui';

interface CityRef extends City {
  name: string;
  countryIso2: string;
  countryName: string;
  isOrigin: boolean;
  isDestination: boolean;
  status: 'HUB' | 'PARTNER' | 'PLANNED';
}

interface PartnerOption {
  id: string;
  name: string;
  coverageZone: string | null;
  isPreferred: boolean;
  currentTariff: { pricePerKg: string; currency: string } | null;
}

interface AgencyOption {
  id: string;
  code: string;
  name: string;
  cityId: string;
}

function Steps({ n }: { n: number }) {
  const { t } = useT();
  return (
    <div className="steps">
      {[1, 2, 3].map((i, idx) => (
        <span key={i} style={{ display: 'contents' }}>
          {idx > 0 && <span className="bar" />}
          <span className={`n${i === n ? ' on' : ''}`}>{i}</span>
        </span>
      ))}
      <span style={{ marginLeft: 8 }}>
        {t(`wizard.step${n}`)} — {n}/3
      </span>
    </div>
  );
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function ParcelNew() {
  const { t } = useT();
  const { me } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [parcel, setParcel] = useState<ParcelDetail | null>(null);
  const idemRef = useRef(uuid());

  const cities = useQuery({
    queryKey: ['ref-cities'],
    queryFn: () => api<CityRef[]>('/reference/cities'),
  });

  // Un agent est toujours rattaché à une seule agence (attribuée par un
  // admin) : pas besoin de choisir. Un DAF national ou super-admin n'en a
  // aucune par défaut — secours en cas d'indisponibilité des agents,
  // choix explicite obligatoire.
  const myAgencyIds = useMemo(
    () => [...new Set((me?.roles ?? []).map((r) => r.scopeAgencyId).filter((v): v is string => !!v))],
    [me],
  );
  const needsRegistrationAgencyChoice = myAgencyIds.length !== 1;

  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    recipientName: '',
    recipientPhone: '',
    originCityId: '',
    destinationCityId: '',
    transportMode: 'AIR',
    weightKg: '',
    contentNature: '',
    declaredValue: '',
    declaredCurrency: 'USD',
    pricingOverridePct: '',
    clientChannel: 'WHATSAPP',
    clientLocale: 'fr',
    deliveryPartnerId: '',
    destinationAgencyId: '',
    registrationAgencyId: '',
    consent: false,
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const quote = useQuery({
    queryKey: ['quote', form.originCityId, form.destinationCityId, form.transportMode, form.weightKg],
    enabled: !!form.originCityId && !!form.destinationCityId && Number(form.weightKg) > 0,
    queryFn: () =>
      api<{
        tariffCurrency: string;
        pricePerKg: string;
        amountBillingCurrency: { amount: string; currency: string };
      }>('/pricing/quote', {
        method: 'POST',
        body: {
          originCityId: form.originCityId,
          destinationCityId: form.destinationCityId,
          mode: form.transportMode,
          weightKg: form.weightKg,
        },
      }),
  });

  const origins = useMemo(() => (cities.data ?? []).filter((c) => c.isOrigin), [cities.data]);
  const dests = useMemo(() => (cities.data ?? []).filter((c) => c.isDestination), [cities.data]);
  const destinationCity = useMemo(
    () => dests.find((c) => c.id === form.destinationCityId),
    [dests, form.destinationCityId],
  );
  const isPartnerDestination = destinationCity?.status === 'PARTNER';
  const isHubDestination = destinationCity?.status === 'HUB';

  const partners = useQuery({
    queryKey: ['delivery-partners-for-city', form.destinationCityId],
    queryFn: () => api<PartnerOption[]>('/reference/delivery-partners', { query: { cityId: form.destinationCityId } }),
    enabled: isPartnerDestination,
  });

  const agencies = useQuery({
    queryKey: ['ref-agencies'],
    queryFn: () => api<AgencyOption[]>('/reference/agencies'),
    enabled: isHubDestination || needsRegistrationAgencyChoice,
  });
  const agenciesForDestination = useMemo(
    () => (agencies.data ?? []).filter((a) => a.cityId === form.destinationCityId),
    [agencies.data, form.destinationCityId],
  );

  // Présélectionne le partenaire préféré, ou l'unique partenaire actif — l'agent
  // peut toujours changer si la zone exacte du destinataire l'exige.
  useEffect(() => {
    if (!isPartnerDestination) {
      if (form.deliveryPartnerId) set('deliveryPartnerId', '');
      return;
    }
    if (form.deliveryPartnerId || !partners.data) return;
    const preferred = partners.data.find((p) => p.isPreferred);
    if (preferred) set('deliveryPartnerId', preferred.id);
    else if (partners.data.length === 1) set('deliveryPartnerId', partners.data[0]!.id);
    // volontairement sans form.deliveryPartnerId dans les deps : ne réagit qu'aux
    // changements de destination/liste de partenaires, pas au choix de l'agent.
  }, [isPartnerDestination, partners.data]);

  // Présélectionne l'unique agence active de la ville — l'agent garde la main
  // pour en choisir une autre si plusieurs agences Okapi desservent la ville.
  useEffect(() => {
    if (!isHubDestination) {
      if (form.destinationAgencyId) set('destinationAgencyId', '');
      return;
    }
    if (form.destinationAgencyId) return;
    if (agenciesForDestination.length === 1) set('destinationAgencyId', agenciesForDestination[0]!.id);
    // volontairement sans form.destinationAgencyId dans les deps : même logique
    // que le préchoix de partenaire ci-dessus.
  }, [isHubDestination, agenciesForDestination]);

  const submitStep1 = async () => {
    setError(null);
    setBusy(true);
    try {
      const created = await api<ParcelDetail>('/parcels', {
        method: 'POST',
        idempotencyKey: idemRef.current,
        body: {
          sender: { name: form.senderName, phone: form.senderPhone || null },
          recipient: { name: form.recipientName, phone: form.recipientPhone || null },
          originCityId: form.originCityId,
          destinationCityId: form.destinationCityId,
          transportMode: form.transportMode,
          weightKg: form.weightKg,
          contentNature: form.contentNature,
          declaredValue: form.declaredValue
            ? { amount: form.declaredValue, currency: form.declaredCurrency }
            : undefined,
          pricingOverridePct: form.pricingOverridePct || undefined,
          clientChannel: form.clientChannel,
          clientLocale: form.clientLocale,
          deliveryPartnerId: form.deliveryPartnerId || undefined,
          destinationAgencyId: form.destinationAgencyId || undefined,
          registrationAgencyId: form.registrationAgencyId || undefined,
          consent: { given: true, textVersion: 'v1-2026-01' },
        },
      });
      setParcel(created);
      setStep(2);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!parcel) return;
    setError(null);
    setBusy(true);
    try {
      const presign = await api<{ url: string; key: string }>(
        `/parcels/${parcel.id}/photos/presign`,
        { method: 'POST' },
      );
      const buf = await file.arrayBuffer();
      const put = await fetch(presign.url, {
        method: 'PUT',
        body: buf,
        headers: { 'content-type': file.type || 'image/jpeg' },
      });
      if (!put.ok) throw new Error(`Upload refusé (${put.status}). Vérifiez le stockage objet.`);
      await api(`/parcels/${parcel.id}/photos`, {
        method: 'POST',
        body: {
          storageKey: presign.key,
          sha256: await sha256Hex(buf),
          bytes: buf.byteLength,
          mimeType: file.type || 'image/jpeg',
          isPrimary: true,
        },
      });
      setStep(3);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const needsPartnerChoice = isPartnerDestination && (partners.data ?? []).length > 0;
  const needsAgencyChoice = isHubDestination && agenciesForDestination.length > 0;
  const valid1 =
    form.senderName &&
    form.recipientName &&
    form.originCityId &&
    form.destinationCityId &&
    Number(form.weightKg) > 0 &&
    form.contentNature &&
    form.consent &&
    (!needsPartnerChoice || form.deliveryPartnerId) &&
    (!needsAgencyChoice || form.destinationAgencyId) &&
    (!needsRegistrationAgencyChoice || form.registrationAgencyId);

  return (
    <>
      <h1>{t('nav.new')}</h1>
      <Steps n={step} />
      <ErrorText error={error} />

      {step === 1 && (
        <>
          {needsRegistrationAgencyChoice && (
            <div className="card">
              <h3>Agence d'enregistrement</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Votre compte n'est pas rattaché à une seule agence — choisissez celle où ce colis est
                physiquement pris en charge (secours agent indisponible, ou compte DAF/super-admin).
              </p>
              <div className="field">
                <label>Agence *</label>
                <select
                  value={form.registrationAgencyId}
                  onChange={(e) => set('registrationAgencyId', e.target.value)}
                >
                  <option value="">—</option>
                  {(agencies.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid2">
            <div className="card">
              <h3>Expéditeur</h3>
              <div className="field">
                <label>Nom *</label>
                <input value={form.senderName} onChange={(e) => set('senderName', e.target.value)} />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input value={form.senderPhone} onChange={(e) => set('senderPhone', e.target.value)} />
              </div>
            </div>
            <div className="card">
              <h3>Destinataire</h3>
              <div className="field">
                <label>Nom *</label>
                <input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input value={form.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Trajet & colis</h3>
            <div className="row">
              <div className="field">
                <label>Ville de départ *</label>
                <select value={form.originCityId} onChange={(e) => set('originCityId', e.target.value)}>
                  <option value="">—</option>
                  {origins.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.countryName})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ville de destination *</label>
                <select
                  value={form.destinationCityId}
                  onChange={(e) => {
                    set('destinationCityId', e.target.value);
                    set('deliveryPartnerId', '');
                  }}
                >
                  <option value="">—</option>
                  {dests.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.countryName}){c.status === 'PARTNER' ? ' — partenaire' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Mode</label>
                <select value={form.transportMode} onChange={(e) => set('transportMode', e.target.value)}>
                  <option value="AIR">Aérien</option>
                  <option value="SEA">Maritime</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Poids (kg) *</label>
                <input value={form.weightKg} inputMode="decimal" onChange={(e) => set('weightKg', e.target.value)} />
              </div>
              <div className="field">
                <label>Nature du contenu *</label>
                <input value={form.contentNature} onChange={(e) => set('contentNature', e.target.value)} />
              </div>
              <div className="field">
                <label>Valeur déclarée</label>
                <input value={form.declaredValue} inputMode="decimal" onChange={(e) => set('declaredValue', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Ajustement agent (ex. -0.1)</label>
                <input value={form.pricingOverridePct} onChange={(e) => set('pricingOverridePct', e.target.value)} />
              </div>
              <div className="field">
                <label>Canal client</label>
                <select value={form.clientChannel} onChange={(e) => set('clientChannel', e.target.value)}>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">E-mail</option>
                </select>
              </div>
              <div className="field">
                <label>Langue client</label>
                <select value={form.clientLocale} onChange={(e) => set('clientLocale', e.target.value)}>
                  <option value="fr">FR</option>
                  <option value="en">EN</option>
                  <option value="zh">中</option>
                </select>
              </div>
            </div>
            {quote.data && (
              <p className="muted">
                Tarif : {quote.data.pricePerKg} {quote.data.tariffCurrency}/kg · Montant estimé :{' '}
                <b>
                  {quote.data.amountBillingCurrency.amount} {quote.data.amountBillingCurrency.currency}
                </b>
              </p>
            )}
            {quote.isError && <p className="error">Aucun tarif défini pour cette destination.</p>}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} />
              <span>Le client accepte les mentions d’information (suivi, notifications).</span>
            </label>
          </div>

          {isHubDestination && (
            <div className="card">
              <h3>Agence de destination — <CityLabel code={destinationCity?.code} /></h3>
              {agencies.isLoading ? (
                <p className="muted">Chargement…</p>
              ) : agenciesForDestination.length === 0 ? (
                <p className="error">
                  Aucune agence active dans cette ville — vérifiez la configuration (écran « Villes »).
                </p>
              ) : (
                <div className="field">
                  <label>Agence {agenciesForDestination.length > 1 ? '*' : ''}</label>
                  <select
                    value={form.destinationAgencyId}
                    onChange={(e) => set('destinationAgencyId', e.target.value)}
                  >
                    {agenciesForDestination.length > 1 && <option value="">—</option>}
                    {agenciesForDestination.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {isPartnerDestination && (
            <div className="card">
              <h3>Partenaire de livraison — <CityLabel code={destinationCity?.code} /></h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {destinationCity?.name ?? destinationCity?.code} n’a pas d’agence Okapi propre : la
                dernière étape est assurée par un partenaire tiers, avec son propre tarif ajouté au
                montant dû.
              </p>
              {partners.isLoading ? (
                <p className="muted">Chargement…</p>
              ) : (partners.data ?? []).length === 0 ? (
                <p className="error">
                  Aucun partenaire actif pour cette ville — le dernier kilomètre ne sera pas
                  facturé tant qu’aucun n’est configuré (écran « Partenaires de livraison »).
                </p>
              ) : (
                <div className="field">
                  <label>Partenaire *</label>
                  <select
                    value={form.deliveryPartnerId}
                    onChange={(e) => set('deliveryPartnerId', e.target.value)}
                  >
                    <option value="">—</option>
                    {(partners.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.isPreferred ? ' ★ préféré' : ''}
                        {p.coverageZone ? ` — ${p.coverageZone}` : ''}
                        {p.currentTariff ? ` (${p.currentTariff.pricePerKg} ${p.currentTariff.currency}/kg)` : ' (aucun tarif configuré)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Link className="btn" to="/parcels">{t('common.cancel')}</Link>
            <button className="btn primary" disabled={!valid1 || busy} onClick={submitStep1}>
              {busy ? '…' : `${t('common.next')} : ${t('wizard.step2')} ›`}
            </button>
          </div>
        </>
      )}

      {step === 2 && parcel && (
        <div className="card">
          <h3>Photo — {parcel.trackingNumber}</h3>
          <p className="muted">
            Prenez ou importez une photo du colis (preuve en cas de litige). Facultatif : vous pouvez
            l'ajouter plus tard depuis la fiche du colis pour accélérer l'enregistrement.
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPhoto(f);
            }}
            disabled={busy}
          />
          {busy && <p className="muted">Envoi…</p>}
          <div style={{ marginTop: 12 }}>
            <button className="btn ghost" disabled={busy} onClick={() => setStep(3)}>
              Passer cette étape — ajouter la photo plus tard
            </button>
          </div>
        </div>
      )}

      {step === 3 && parcel && (
        <div className="card">
          <h3>Colis enregistré ✔</h3>
          <p style={{ fontSize: 22 }} className="mono">
            {parcel.trackingNumber}
          </p>
          <p>
            Montant dû : <b>{parcel.amountDue.amount} {parcel.amountDue.currency}</b> · Statut :{' '}
            <span className="pill err">IMPAYÉ</span>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn primary" onClick={() => nav(`/parcels/${parcel.id}`)}>
              Ouvrir la fiche
            </button>
            <button
              className="btn"
              onClick={() => {
                idemRef.current = uuid();
                setParcel(null);
                setStep(1);
              }}
            >
              ＋ Enregistrer un autre colis
            </button>
          </div>
        </div>
      )}
    </>
  );
}
