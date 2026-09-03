import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LOCALES, setLocale, useT, type Locale } from '../lib/i18n';

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout, can } = useAuth();
  const { t, locale } = useT();

  const item = (to: string, label: string) => (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')} end={to === '/'}>
      {label}
    </NavLink>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Okapi Logistics</span>
        <span className="spacer" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label="Langue"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l === 'zh' ? '中文' : l.toUpperCase()}
            </option>
          ))}
        </select>
        <span title={me?.email}>{me?.fullName}</span>
        <button className="btn ghost" style={{ color: '#eae7ff' }} onClick={() => void logout()}>
          {t('auth.logout')}
        </button>
      </header>

      <nav className="sidenav">
        {item('/', t('nav.dashboard'))}
        {can('parcel:create') && item('/parcels/new', t('nav.new'))}
        {can('parcel:read') && item('/parcels', t('nav.parcels'))}

        {(can('report:read') || can('tariff:write') || can('fx:write')) && (
          <div className="sep">{t('nav.admin')}</div>
        )}
        {can('report:read') && item('/reports', t('nav.reports'))}
        {can('tariff:read') && item('/tariffs', t('nav.tariffs'))}
        {can('fx:read') && item('/exchange-rates', t('nav.fx'))}

        {(can('user:manage') || can('config:write')) && <div className="sep">{t('nav.config')}</div>}
        {can('user:manage') && item('/users', t('nav.users'))}
        {can('config:write') && item('/branding', t('nav.branding'))}
      </nav>

      <main className="main">{children}</main>
    </div>
  );
}
