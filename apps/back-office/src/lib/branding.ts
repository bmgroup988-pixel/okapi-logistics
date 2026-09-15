import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

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

export interface BrandingDto {
  brand: BrandColors;
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
const CSS_VARS: Record<keyof BrandColors, string> = {
  navy: '--navy',
  orange: '--orange',
  turquoise: '--turquoise',
  anthracite: '--anthracite',
  bg: '--bg',
  surface: '--surface',
  ink: '--ink',
  mute: '--mute',
  line: '--line',
  ok: '--ok',
  warn: '--warn',
  err: '--err',
};

/** Applique toutes les couleurs configurées comme variables CSS (EF-CFG-01) — palette entièrement personnalisable. */
export function useApplyBrandColors() {
  const { data } = useBranding();
  useEffect(() => {
    if (!data?.brand) return;
    for (const key of Object.keys(CSS_VARS) as Array<keyof BrandColors>) {
      const value = data.brand[key];
      if (value && HEX.test(value)) {
        document.documentElement.style.setProperty(CSS_VARS[key], value);
      }
    }
  }, [data]);
}

export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
}
