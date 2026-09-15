import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface BrandingDto {
  brand: { navy: string; orange: string; turquoise: string; anthracite: string };
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  website: string | null;
  social: { facebook: string | null; instagram: string | null; tiktok: string | null; x: string | null };
  slogans: Record<string, string>;
}

export function useBranding() {
  return useQuery({
    queryKey: ['public-branding'],
    queryFn: () => api<BrandingDto>('/public/branding'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const CSS_VARS: Record<string, string> = {
  navy: '--navy',
  orange: '--orange',
  turquoise: '--turquoise',
  anthracite: '--anthracite',
};

/** Applique les couleurs de marque configurées comme variables CSS (EF-CFG-01). */
export function useApplyBrandColors() {
  const { data } = useBranding();
  useEffect(() => {
    if (!data?.brand) return;
    for (const [key, cssVar] of Object.entries(CSS_VARS)) {
      const value = data.brand[key as keyof typeof data.brand];
      if (value && HEX.test(value)) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    }
  }, [data]);
}

export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
}
