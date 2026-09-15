import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ErrorText, Loading } from '../components/ui';

const COLOR_KEYS = ['brand.navy', 'brand.orange', 'brand.turquoise', 'brand.anthracite'] as const;
const TEXT_KEYS = [
  'contact.email',
  'contact.phone',
  'contact.whatsapp',
  'contact.website',
  'social.facebook',
  'social.instagram',
  'social.tiktok',
  'social.x',
  'footer.slogan.fr',
  'footer.slogan.en',
  'footer.slogan.zh',
] as const;
const KEYS = [...COLOR_KEYS, ...TEXT_KEYS, 'branding.logoUrl'] as const;

const LABELS: Record<string, string> = {
  'brand.navy': 'Couleur marine',
  'brand.orange': 'Couleur orange (accent)',
  'brand.turquoise': 'Couleur turquoise',
  'brand.anthracite': 'Couleur anthracite (texte)',
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
              PNG, JPEG, WebP ou SVG — 400 Ko max. Remplace le logo par défaut partout (back-office,
              connexion, site public).
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
        <h3>Couleurs de la marque</h3>
        <div className="row">
          {COLOR_KEYS.map((k) => (
            <div className="field" key={k}>
              <label>{LABELS[k]}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(values[k] ?? '') ? values[k] : '#170655'}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                  style={{ width: 44, padding: 2, flex: '0 0 auto' }}
                />
                <input
                  value={values[k] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Coordonnées & réseaux sociaux</h3>
        <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
          Chaque champ rempli fait apparaître son icône, cliquable, dans le pied de page du site
          public et du back-office. Laisser vide pour masquer l'icône.
        </p>
        <div className="grid2">
          {TEXT_KEYS.map((k) => (
            <div className="field" key={k}>
              <label>{LABELS[k]}</label>
              <input
                value={values[k] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                placeholder={
                  k === 'contact.whatsapp'
                    ? '+229XXXXXXXX'
                    : k.startsWith('social.') || k === 'contact.website'
                      ? 'https://…'
                      : undefined
                }
              />
            </div>
          ))}
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
