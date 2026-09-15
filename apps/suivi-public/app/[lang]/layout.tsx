import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DICT, LOCALES, isLocale } from '../../lib/i18n';
import { fetchBranding } from '../../lib/api';

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = DICT[lang];
  const branding = await fetchBranding();
  const slogan = branding.slogans[lang] ?? branding.slogans.fr;

  return (
    <>
      <header className="topbar">
        <Link href={`/${lang}`} className="brand" style={{ textDecoration: 'none' }}>
          {t.brand}
        </Link>
        <nav className="langs" aria-label="Langue">
          {LOCALES.map((l) => (
            <Link key={l} href={`/${l}`} aria-current={l === lang ? 'true' : undefined}>
              {l === 'zh' ? '中' : l.toUpperCase()}
            </Link>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <p>
          {branding.contactEmail} · {slogan}
        </p>
        <p>
          <span>{t.legal}</span> · <span>{t.privacy}</span>
        </p>
        <p className="copyright">
          © {new Date().getFullYear()} Okapi Group. {t.rightsReserved}
        </p>
      </footer>
    </>
  );
}
