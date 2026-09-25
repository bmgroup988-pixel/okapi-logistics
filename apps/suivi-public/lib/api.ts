export interface PublicTracking {
  trackingNumber: string;
  status: string;
  paymentState: 'PAID' | 'PARTIAL' | 'PENDING';
  destinationCityCode: string;
  destinationCityName: string;
  registeredAt: string;
  photoUrl: string | null;
  steps: Array<{ status: string; locationLabel: string | null; at: string }>;
}

export interface BrandColors {
  navy: string;
  orange: string;
  turquoise: string;
  anthracite: string;
  bg: string;
  surface: string;
  ink: string;
  mute: string;
  line: string;
  ok: string;
  warn: string;
  err: string;
}

export interface Branding {
  brand: BrandColors;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  website: string | null;
  social: { facebook: string | null; instagram: string | null; tiktok: string | null; x: string | null };
  slogans: { fr: string; en: string; zh: string; sw?: string; ln?: string };
  locales: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

export type TrackingResult =
  | { kind: 'found'; data: PublicTracking }
  | { kind: 'not_found' }
  | { kind: 'invalid_format' }
  | { kind: 'error' };

// Accepte le format actuel (OKP + JJMMAA + séquentiel 4+ chiffres + ville,
// 10+ chiffres) et l'ancien format pré-2026-09-22 (OKP + AAMM + séquentiel
// 4+ chiffres + ville, 8+ chiffres) — les numéros déjà émis restent valides.
// Source unique — voir SearchForm.tsx, qui l'importe plutôt que de dupliquer
// sa propre copie (une regex différente ici avait bloqué la recherche des
// numéros au nouveau format, incident du 2026-09-25).
export const TRACKING_FORMAT = /^OKP\d{8,}[A-Z]{3}$/;

export async function fetchTracking(trackingNumberRaw: string): Promise<TrackingResult> {
  const trackingNumber = trackingNumberRaw.trim().toUpperCase();
  if (!TRACKING_FORMAT.test(trackingNumber)) return { kind: 'invalid_format' };
  try {
    const res = await fetch(`${API_BASE}/public/parcels/${encodeURIComponent(trackingNumber)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'found', data: (await res.json()) as PublicTracking };
  } catch {
    return { kind: 'error' };
  }
}

export async function fetchBranding(): Promise<Branding> {
  const fallback: Branding = {
    brand: {
      navy: '#170655',
      orange: '#E47911',
      turquoise: '#1CA9C9',
      anthracite: '#2E3138',
      bg: '#F5F5F7',
      surface: '#FFFFFF',
      ink: '#23222C',
      mute: '#6A6976',
      line: '#E2E2E8',
      ok: '#1F9D57',
      warn: '#C07700',
      err: '#C0392B',
    },
    logoUrl: null,
    contactEmail: 'contact.gokapi@gmail.com',
    contactPhone: null,
    contactWhatsapp: null,
    website: null,
    social: { facebook: null, instagram: null, tiktok: null, x: null },
    slogans: {
      fr: 'Le futur du commerce africain',
      en: 'The future of African trade',
      zh: '非洲贸易的未来',
      sw: 'Mustakabali wa biashara ya Afrika',
      ln: 'Avenir ya mombongo ya Afrika',
    },
    locales: ['fr', 'en', 'zh', 'sw', 'ln'],
  };
  try {
    const res = await fetch(`${API_BASE}/public/branding`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<Branding>;
    return {
      ...fallback,
      ...data,
      brand: { ...fallback.brand, ...data.brand },
      social: { ...fallback.social, ...data.social },
      slogans: { ...fallback.slogans, ...data.slogans },
    };
  } catch {
    return fallback;
  }
}
