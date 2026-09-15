import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DICT, LOCALES, isLocale } from '../../lib/i18n';
import { fetchBranding } from '../../lib/api';
import { IconFacebook, IconGlobe, IconInstagram, IconMail, IconPhone, IconTiktok, IconWhatsapp, IconX } from '../icons';

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
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

  const brandVars = (['navy', 'orange', 'turquoise', 'anthracite'] as const)
    .filter((k) => HEX.test(branding.brand[k]))
    .map((k) => `--${k}:${branding.brand[k]};`)
    .join('');

  const links: Array<{ href: string; label: string; icon: React.ReactNode }> = [];
  if (branding.contactEmail) links.push({ href: `mailto:${branding.contactEmail}`, label: 'E-mail', icon: <IconMail /> });
  if (branding.contactPhone) links.push({ href: `tel:${branding.contactPhone}`, label: 'Téléphone', icon: <IconPhone /> });
  if (branding.contactWhatsapp)
    links.push({ href: whatsappHref(branding.contactWhatsapp), label: 'WhatsApp', icon: <IconWhatsapp /> });
  if (branding.website) links.push({ href: branding.website, label: 'Site web', icon: <IconGlobe /> });
  if (branding.social.facebook) links.push({ href: branding.social.facebook, label: 'Facebook', icon: <IconFacebook /> });
  if (branding.social.instagram)
    links.push({ href: branding.social.instagram, label: 'Instagram', icon: <IconInstagram /> });
  if (branding.social.tiktok) links.push({ href: branding.social.tiktok, label: 'TikTok', icon: <IconTiktok /> });
  if (branding.social.x) links.push({ href: branding.social.x, label: 'X', icon: <IconX /> });

  return (
    <>
      {brandVars ? <style>{`:root{${brandVars}}`}</style> : null}
      <header className="topbar">
        <Link href={`/${lang}`} className="brand" style={{ textDecoration: 'none' }}>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={t.brand} className="brand-logo" />
          ) : null}
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
        {links.length > 0 && (
          <p className="footer-icons">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" title={l.label} aria-label={l.label}>
                {l.icon}
              </a>
            ))}
          </p>
        )}
        <p>
          {branding.contactEmail} · {slogan}
        </p>
        <p>
          <span>{t.legal}</span> · <span>{t.privacy}</span>
        </p>
        <p className="copyright">
          © {new Date().getFullYear()} Global Okapi Group. {t.rightsReserved}
        </p>
      </footer>
    </>
  );
}
