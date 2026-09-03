import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, uuid } from '../lib/api';
import { useT } from '../lib/i18n';
import type { City, ParcelDetail } from '../lib/types';
import { ErrorText } from '../components/ui';

interface CityRef extends City {
  countryIso2: string;
  isOrigin: boolean;
  isDestination: boolean;
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

  const valid1 =
    form.senderName &&
    form.recipientName &&
    form.originCityId &&
    form.destinationCityId &&
    Number(form.weightKg) > 0 &&
    form.contentNature &&
    form.consent;

  return (
    <>
      <h1>{t('nav.new')}</h1>
      <Steps n={step} />
      <ErrorText error={error} />

      {step === 1 && (
        <>
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
                    <option key={c.id} value={c.id}>{c.code} ({c.countryIso2})</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ville de destination *</label>
                <select value={form.destinationCityId} onChange={(e) => set('destinationCityId', e.target.value)}>
                  <option value="">—</option>
                  {dests.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} ({c.countryIso2})</option>
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
          <h3>Photo obligatoire — {parcel.trackingNumber}</h3>
          <p className="muted">
            Prenez ou importez une photo du colis (preuve en cas de litige). L’enregistrement est
            déjà créé ; la photo lui est liée définitivement.
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
