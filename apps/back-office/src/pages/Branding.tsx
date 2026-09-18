import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading } from '../components/ui';

const BRAND_COLOR_KEYS = ['brand.navy', 'brand.orange', 'brand.turquoise', 'brand.anthracite'] as const;
const UI_COLOR_KEYS = ['brand.bg', 'brand.surface', 'brand.ink', 'brand.mute', 'brand.line'] as const;
const STATUS_COLOR_KEYS = ['brand.ok', 'brand.warn', 'brand.err'] as const;
const COLOR_KEYS = [...BRAND_COLOR_KEYS, ...UI_COLOR_KEYS, ...STATUS_COLOR_KEYS] as const;

// Ligne 1 : e-mail + site web. Ligne 2 (dédiée) : téléphone + WhatsApp.
const CONTACT_ROW_1 = ['contact.email', 'contact.website'] as const;
const CONTACT_ROW_2 = ['contact.phone', 'contact.whatsapp'] as const;
const SOCIAL_KEYS = ['social.facebook', 'social.instagram', 'social.tiktok', 'social.x'] as const;
const SLOGAN_KEYS = ['footer.slogan.fr', 'footer.slogan.en', 'footer.slogan.zh'] as const;
const TEXT_KEYS = [...CONTACT_ROW_1, ...CONTACT_ROW_2, ...SOCIAL_KEYS, ...SLOGAN_KEYS] as const;
const KEYS = [...COLOR_KEYS, ...TEXT_KEYS, 'branding.logoUrl'] as const;

const LABELS: Record<string, string> = {
  'brand.navy': 'Marine',
  'brand.orange': 'Orange (accent)',
  'brand.turquoise': 'Turquoise',
  'brand.anthracite': 'Anthracite (texte titres)',
  'brand.bg': 'Fond de page',
  'brand.surface': 'Fond des cartes',
  'brand.ink': 'Texte principal',
  'brand.mute': 'Texte secondaire',
  'brand.line': 'Bordures / séparateurs',
  'brand.ok': 'Succès / payé',
  'brand.warn': 'Alerte / partiel',
  'brand.err': 'Erreur / impayé',
  'contact.email': 'E-mail de contact',
  'contact.phone': 'Téléphone',
  'contact.whatsapp': 'WhatsApp (numéro international, ex. +229...)',
  'contact.website': 'Site web',
  'social.facebook': 'Facebook (URL)',
  'social.instagram': 'Instagram (URL)',
  'social.tiktok': 'TikTok (URL)',
  'social.x': 'X / Twitter (URL)',
  'footer.slogan.fr': 'Slogan — FR',
  'footer.slogan.en': 'Slogan — EN',
  'footer.slogan.zh': 'Slogan — 中文',
};

const MAX_LOGO_BYTES = 400 * 1024;

type Values = Record<string, string>;
type SetValues = React.Dispatch<React.SetStateAction<Values>>;

function ColorField({ k, values, setValues }: { k: string; values: Values; setValues: SetValues }) {
  return (
    <div className="field">
      <label>{LABELS[k]}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(values[k] ?? '') ? values[k] : '#170655'}
          onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
          style={{ width: 44, padding: 2, flex: '0 0 auto' }}
        />
        <input value={values[k] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} style={{ flex: 1 }} />
      </div>
    </div>
  );
}

function TextField({ k, values, setValues }: { k: string; values: Values; setValues: SetValues }) {
  return (
    <div className="field">
      <label>{LABELS[k]}</label>
      <input
        value={values[k] ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
        placeholder={
          k === 'contact.whatsapp' ? '+229XXXXXXXX' : k.startsWith('social.') || k === 'contact.website' ? 'https://…' : undefined
        }
      />
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Branding() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const settings = useQuery({
    queryKey: ['settings', 'brand'],
    queryFn: () => api<Record<string, unknown>>('/admin/settings'),
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      const v: Record<string, string> = {};
      for (const k of KEYS) v[k] = String(settings.data[k] ?? '');
      setValues(v);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      for (const k of KEYS) {
        await api(`/admin/settings/${encodeURIComponent(k)}`, {
          method: 'PUT',
          body: { value: values[k] ?? '' },
        });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings', 'public-branding'] }),
  });

  const onLogoPick = async (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|svg\+xml|jpeg|webp)$/.test(file.type)) {
      setLogoError('Format accepté : PNG, JPEG, WebP ou SVG.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Fichier trop volumineux (${Math.round(file.size / 1024)} Ko) — 400 Ko max.`);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setValues((v) => ({ ...v, 'branding.logoUrl': dataUrl }));
  };

  if (settings.isLoading) return <Loading />;

  return (
    <>
      <h1>Identité visuelle & pied de page</h1>

      <div className="card">
        <h3>Logo</h3>
        <div className="row" style={{ alignItems: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              border: '1px solid var(--line)',
              display: 'grid',
              placeItems: 'center',
              background: values['branding.logoUrl'] ? '#fff' : 'var(--navy)',
              flex: '0 0 auto',
            }}
          >
            {values['branding.logoUrl'] ? (
              <img src={values['branding.logoUrl']} alt="Logo" style={{ maxWidth: 56, maxHeight: 56 }} />
            ) : null}
          </div>
          <div style={{ flex: 1 }}>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => void onLogoPick(e.target.files?.[0])}
            />
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
              PNG, JPEG, WebP ou SVG — 400 Ko max, idéalement carré (ex. 512×512 px) pour un rendu net
              partout où il est réduit. Remplace le logo par défaut partout (back-office, connexion, site
              public) ainsi que l'icône d'onglet du navigateur — quelques secondes après
              l'enregistrement.
            </p>
            {logoError && <p className="error">{logoError}</p>}
            {values['branding.logoUrl'] && (
              <button
                type="button"
                className="btn ghost"
                style={{ marginTop: 6 }}
                onClick={() => {
                  setValues((v) => ({ ...v, 'branding.logoUrl': '' }));
                  if (fileInput.current) fileInput.current.value = '';
                }}
              >
                Revenir au logo par défaut
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Couleurs — palette entièrement personnalisable</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
          Chaque couleur ci-dessous s'applique immédiatement, sur le back-office comme sur le site
          public, sans redéploiement. Restez vigilant sur le contraste texte/fond si vous
          personnalisez « Fond de page », « Fond des cartes » ou « Texte ».
        </p>

        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mute)', margin: '14px 0 8px' }}>
          Marque
        </h4>
        <div className="row">{BRAND_COLOR_KEYS.map((k) => <ColorField key={k} k={k} values={values} setValues={setValues} />)}</div>

        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mute)', margin: '14px 0 8px' }}>
          Interface
        </h4>
        <div className="row">{UI_COLOR_KEYS.map((k) => <ColorField key={k} k={k} values={values} setValues={setValues} />)}</div>

        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mute)', margin: '14px 0 8px' }}>
          Statuts
        </h4>
        <div className="row">{STATUS_COLOR_KEYS.map((k) => <ColorField key={k} k={k} values={values} setValues={setValues} />)}</div>
      </div>

      <div className="card">
        <h3>Coordonnées & réseaux sociaux</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
          Chaque champ rempli fait apparaître son icône, cliquable, dans le pied de page du site
          public et du back-office. Laisser vide pour masquer l'icône.
        </p>
        <div className="grid2">
          {CONTACT_ROW_1.map((k) => <TextField key={k} k={k} values={values} setValues={setValues} />)}
        </div>
        <div className="grid2">
          {CONTACT_ROW_2.map((k) => <TextField key={k} k={k} values={values} setValues={setValues} />)}
        </div>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mute)', margin: '14px 0 8px' }}>
          Réseaux sociaux
        </h4>
        <div className="grid2">
          {SOCIAL_KEYS.map((k) => <TextField key={k} k={k} values={values} setValues={setValues} />)}
        </div>
        <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mute)', margin: '14px 0 8px' }}>
          Slogan
        </h4>
        <div className="grid2">
          {SLOGAN_KEYS.map((k) => <TextField key={k} k={k} values={values} setValues={setValues} />)}
        </div>
        <ErrorText error={save.error} />
        <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? '…' : 'Enregistrer (versionné + tracé)'}
        </button>
      </div>

      <p className="muted">
        Les modifications sont journalisées (audit) et prises en compte immédiatement, sans
        redéploiement, par le back-office et par la page publique de suivi via{' '}
        <span className="mono">/api/v1/public/branding</span>.
      </p>
    </>
  );
}
