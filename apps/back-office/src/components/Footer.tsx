import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';

interface BrandingDto {
  contactEmail: string;
  slogans: Record<string, string>;
}

/** Pied de page global — identité configurable (W-SAD-03) + copyright Okapi Group. */
export function Footer() {
  const { t, locale } = useT();
  const year = new Date().getFullYear();
  const { data } = useQuery({
    queryKey: ['public-branding'],
    queryFn: () => api<BrandingDto>('/public/branding'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const slogan = data?.slogans?.[locale] || t('footer.slogan');
  const contactEmail = data?.contactEmail || 'contact.gokapi@gmail.com';

  return (
    <footer className="footer">
      <span>{slogan}</span>
      <span className="sep">·</span>
      <span>{contactEmail}</span>
      <span className="sep">·</span>
      <span className="copyright">
        © {year} Okapi Group. {t('footer.rights')}
      </span>
    </footer>
  );
}
