import { useT } from '../lib/i18n';
import { useBranding, whatsappHref } from '../lib/branding';
import { IconFacebook, IconGlobe, IconInstagram, IconMail, IconPhone, IconTiktok, IconWhatsapp, IconX } from './icons';

/** Pied de page global — identité configurable (W-SAD-03) + copyright Global Okapi Group. */
export function Footer() {
  const { t, locale } = useT();
  const year = new Date().getFullYear();
  const { data } = useBranding();

  const slogan = data?.slogans?.[locale] || t('footer.slogan');
  const contactEmail = data?.contactEmail || 'contact.gokapi@gmail.com';

  const links: Array<{ href: string; label: string; icon: React.ReactNode }> = [];
  if (contactEmail) links.push({ href: `mailto:${contactEmail}`, label: 'E-mail', icon: <IconMail /> });
  if (data?.contactPhone) links.push({ href: `tel:${data.contactPhone}`, label: 'Téléphone', icon: <IconPhone /> });
  if (data?.contactWhatsapp)
    links.push({ href: whatsappHref(data.contactWhatsapp), label: 'WhatsApp', icon: <IconWhatsapp /> });
  if (data?.website) links.push({ href: data.website, label: 'Site web', icon: <IconGlobe /> });
  if (data?.social.facebook) links.push({ href: data.social.facebook, label: 'Facebook', icon: <IconFacebook /> });
  if (data?.social.instagram) links.push({ href: data.social.instagram, label: 'Instagram', icon: <IconInstagram /> });
  if (data?.social.tiktok) links.push({ href: data.social.tiktok, label: 'TikTok', icon: <IconTiktok /> });
  if (data?.social.x) links.push({ href: data.social.x, label: 'X', icon: <IconX /> });

  return (
    <footer className="footer">
      <div className="footer-icons">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" title={l.label} aria-label={l.label}>
            {l.icon}
          </a>
        ))}
      </div>
      <div className="footer-text">
        <span>{slogan}</span>
        <span className="sep">·</span>
        <span className="copyright">
          © {year} Global Okapi Group. {t('footer.rights')}
        </span>
      </div>
    </footer>
  );
}
