import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { resolveLocale } from '../lib/i18n';

export const metadata: Metadata = {
  title: 'Okapi Logistics — Suivi de colis',
  description: 'Suivez votre colis Okapi Logistics en temps réel avec votre numéro de suivi.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = resolveLocale((await headers()).get('x-lang') ?? undefined);
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
