import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading, Modal, Pill } from '../components/ui';

interface City {
  id: string;
  code: string;
  status: 'HUB' | 'PARTNER' | 'PLANNED';
}

interface Partner {
  id: string;
  cityId: string;
  cityCode: string;
  name: string;
  coverageZone: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  commissionPct: string | null;
  settlementMode: 'PER_KG' | 'PERCENT_COLLECTED';
  reliabilityNote: string | null;
  isPreferred: boolean;
  isActive: boolean;
}

interface PartnerTariff {
  id: string;
  pricePerKg: string;
  currency: string;
  minWeightKg: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

const emptyForm = {
  cityId: '',
  name: '',
  coverageZone: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  commissionPct: '',
  settlementMode: 'PER_KG' as Partner['settlementMode'],
  reliabilityNote: '',
  isPreferred: false,
  isActive: true,
};

/**
 * Administration des partenaires de livraison — dernier kilomètre pour les
 * villes en statut PARTNER (addendum 08 §1.4-1.6, docs/09). Plusieurs
 * partenaires actifs peuvent desservir la même ville, chacun avec sa propre
 * zone de couverture et son propre tarif (onglet Tarifs).
 */
export function DeliveryPartners() {
  const qc = useQueryClient();
  const [cityFilter, setCityFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tariffsFor, setTariffsFor] = useState<Partner | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const cities = useQuery({ queryKey: ['ref-cities-all'], queryFn: () => api<City[]>('/reference/cities') });
  const partnerCities = useMemo(
    () => (cities.data ?? []).filter((c) => c.status === 'PARTNER'),
    [cities.data],
  );

  const partners = useQuery({
    queryKey: ['admin-delivery-partners', cityFilter],
    queryFn: () => api<Partner[]>('/admin/delivery-partners', { query: { cityId: cityFilter || undefined } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-delivery-partners'] });

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api(`/admin/delivery-partners/${editingId}`, { method: 'PATCH', body: form })
        : api('/admin/delivery-partners', { method: 'POST', body: form }),
    onSuccess: () => {
      setForm(emptyForm);
      setEditingId(null);
      invalidate();
    },
  });

  const edit = (p: Partner) => {
    setEditingId(p.id);
    setForm({
      cityId: p.cityId,
      name: p.name,
      coverageZone: p.coverageZone ?? '',
      contactName: p.contactName ?? '',
      contactPhone: p.contactPhone ?? '',
      contactEmail: p.contactEmail ?? '',
      commissionPct: p.commissionPct ?? '',
      settlementMode: p.settlementMode,
      reliabilityNote: p.reliabilityNote ?? '',
      isPreferred: p.isPreferred,
      isActive: p.isActive,
    });
  };

  return (
    <>
      <h1>Partenaires de livraison</h1>
      <div className="card">
        <div className="field" style={{ maxWidth: 280 }}>
          <label>Filtrer par ville</label>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">Toutes</option>
            {partnerCities.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
        </div>
        {partners.isLoading ? (
          <Loading />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Ville</th>
                <th>Nom</th>
                <th>Zone couverte</th>
                <th>Contact</th>
                <th>Rémunération</th>
                <th>Préféré</th>
                <th>Actif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(partners.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.cityCode}</td>
                  <td>{p.name}</td>
                  <td className="muted">{p.coverageZone ?? '—'}</td>
                  <td className="muted">{p.contactPhone ?? p.contactEmail ?? '—'}</td>
                  <td>
                    {p.settlementMode === 'PER_KG' ? 'Prix/kg' : `${p.commissionPct ?? '0'} % encaissé`}
                  </td>
                  <td>{p.isPreferred ? <Pill kind="ok">★</Pill> : '—'}</td>
                  <td>{p.isActive ? <Pill kind="ok">oui</Pill> : <Pill kind="err">non</Pill>}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn ghost" onClick={() => edit(p)}>Éditer</button>
                    <button className="btn ghost" onClick={() => setTariffsFor(p)}>Tarifs</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>{editingId ? 'Modifier le partenaire' : 'Nouveau partenaire'}</h3>
        <div className="row">
          <div className="field">
            <label>Ville *</label>
            <select value={form.cityId} onChange={(e) => set('cityId', e.target.value)}>
              <option value="">—</option>
              {(cities.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.code}{c.status !== 'PARTNER' ? ` (${c.status})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Raison sociale *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Zone de couverture</label>
            <input
              value={form.coverageZone}
              placeholder="ex. axe Kolwezi–Fungurume"
              onChange={(e) => set('coverageZone', e.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Contact — nom</label>
            <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </div>
          <div className="field">
            <label>Contact — téléphone</label>
            <input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          </div>
          <div className="field">
            <label>Contact — e-mail</label>
            <input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Mode de rémunération</label>
            <select
              value={form.settlementMode}
              onChange={(e) => set('settlementMode', e.target.value as Partner['settlementMode'])}
            >
              <option value="PER_KG">Prix par kg (voir onglet Tarifs)</option>
              <option value="PERCENT_COLLECTED">% du montant encaissé</option>
            </select>
          </div>
          {form.settlementMode === 'PERCENT_COLLECTED' && (
            <div className="field">
              <label>Commission (%)</label>
              <input
                value={form.commissionPct}
                inputMode="decimal"
                placeholder="ex. 0.12 pour 12 %"
                onChange={(e) => set('commissionPct', e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label>Note de fiabilité</label>
            <input value={form.reliabilityNote} onChange={(e) => set('reliabilityNote', e.target.value)} />
          </div>
        </div>
        <div className="row">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.isPreferred} onChange={(e) => set('isPreferred', e.target.checked)} />
            Partenaire préféré de cette ville
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            Actif
          </label>
        </div>
        <ErrorText error={save.error} />
        <div className="btnrow" style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn primary"
            disabled={!form.cityId || !form.name || save.isPending}
            onClick={() => save.mutate()}
          >
            {editingId ? 'Enregistrer les modifications' : 'Créer le partenaire'}
          </button>
          {editingId && (
            <button
              className="btn"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      {tariffsFor && <PartnerTariffsModal partner={tariffsFor} onClose={() => setTariffsFor(null)} />}
    </>
  );
}

function PartnerTariffsModal({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const qc = useQueryClient();
  const tariffs = useQuery({
    queryKey: ['partner-tariffs', partner.id],
    queryFn: () => api<PartnerTariff[]>(`/admin/delivery-partners/${partner.id}/tariffs`),
  });
  const [pricePerKg, setPricePerKg] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [minWeightKg, setMinWeightKg] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api(`/admin/delivery-partners/${partner.id}/tariffs`, {
        method: 'POST',
        body: { pricePerKg, currency, minWeightKg: minWeightKg || undefined },
      }),
    onSuccess: () => {
      setPricePerKg('');
      void qc.invalidateQueries({ queryKey: ['partner-tariffs', partner.id] });
    },
  });

  return (
    <Modal title={`Tarifs — ${partner.name} (${partner.cityCode})`} onClose={onClose}>
      {tariffs.isLoading ? (
        <Loading />
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Prix/kg</th>
              <th>Poids min.</th>
              <th>Depuis</th>
              <th>Jusqu’à</th>
            </tr>
          </thead>
          <tbody>
            {(tariffs.data ?? []).map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.pricePerKg} {t.currency}</td>
                <td>{t.minWeightKg ?? '—'}</td>
                <td className="muted">{t.effectiveFrom}</td>
                <td className="muted">{t.effectiveTo ?? '—'}</td>
              </tr>
            ))}
            {(tariffs.data ?? []).length === 0 && (
              <tr><td colSpan={4} className="muted">Aucun tarif — la réconciliation PER_KG sera nulle.</td></tr>
            )}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Prix par kg *</label>
          <input value={pricePerKg} inputMode="decimal" onChange={(e) => setPricePerKg(e.target.value)} />
        </div>
        <div className="field">
          <label>Devise</label>
          <input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </div>
        <div className="field">
          <label>Poids minimum (kg)</label>
          <input value={minWeightKg} inputMode="decimal" onChange={(e) => setMinWeightKg(e.target.value)} />
        </div>
      </div>
      <ErrorText error={create.error} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn" onClick={onClose}>Fermer</button>
        <button className="btn primary" disabled={!pricePerKg || create.isPending} onClick={() => create.mutate()}>
          Ajouter le tarif (nouvelle version datée)
        </button>
      </div>
    </Modal>
  );
}
