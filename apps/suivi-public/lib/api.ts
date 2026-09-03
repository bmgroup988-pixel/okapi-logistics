export interface PublicTracking {
  trackingNumber: string;
  status: string;
  paymentState: 'PAID' | 'PARTIAL' | 'PENDING';
  destinationCityCode: string;
  registeredAt: string;
  photoUrl: string | null;
  steps: Array<{ status: string; locationLabel: string | null; at: string }>;
}

export interface Branding {
  brand: { navy: string; orange: string; turquoise: string; anthracite: string };
  contactEmail: string;
  slogans: { fr: string; en: string; zh: string };
  locales: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

export async function fetchTracking(trackingNumber: string): Promise<PublicTracking | null> {
  try {
    const res = await fetch(`${API_BASE}/public/parcels/${encodeURIComponent(trackingNumber)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as PublicTracking;
  } catch {
    return null;
  }
}

export async function fetchBranding(): Promise<Branding> {
  const fallback: Branding = {
    brand: { navy: '#170655', orange: '#E47911', turquoise: '#1CA9C9', anthracite: '#2E3138' },
    contactEmail: 'contact.gokapi@gmail.com',
    slogans: {
      fr: 'Le futur du commerce africain',
      en: 'The future of African trade',
      zh: '非洲贸易的未来',
    },
    locales: ['fr', 'en', 'zh'],
  };
  try {
    const res = await fetch(`${API_BASE}/public/branding`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return { ...fallback, ...((await res.json()) as Partial<Branding>) };
  } catch {
    return fallback;
  }
}
