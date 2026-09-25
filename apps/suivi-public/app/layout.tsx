import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { resolveLocale } from '../lib/i18n';

export const metadata: Metadata = {
  title: 'Okapi Logistics — Suivi de colis',
  description: 'Suivez votre colis Okapi Logistics en temps réel avec votre numéro de suivi.',
  // Servies depuis /public (pas la convention app/icon.png) — cette dernière
  // génère une route Next.js qui n'est pas incluse dans l'image Docker
  // "standalone" (voir apps/suivi-public/Dockerfile, qui ne copie que
  // .next/standalone + .next/static + public/).
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = resolveLocale((await headers()).get('x-lang') ?? undefined);
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
