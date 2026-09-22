import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { LOCALES, setLocale, useT, type Locale } from '../lib/i18n';
import { useApplyBrandColors, useBranding } from '../lib/branding';
import { Footer } from './Footer';

export function Shell({ children }: { children: React.ReactNode }) {
  const { me, logout, can, isSupplierOnly } = useAuth();
  const { t, locale } = useT();
  const { data: branding } = useBranding();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  useApplyBrandColors();

  // Ferme le menu mobile automatiquement à chaque changement de page.
  useEffect(() => setNavOpen(false), [location.pathname]);

  const item = (to: string, label: string) => (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')} end={to === '/'}>
      {label}
    </NavLink>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          ☰
        </button>
        {branding?.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="brand-logo" /> : null}
        <span className={branding?.logoUrl ? 'brand no-dot' : 'brand'}>Okapi Logistics</span>
        <span className="spacer" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label="Langue"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l === 'zh' ? '中文' : l === 'sw' ? 'Kiswahili' : l === 'ln' ? 'Lingála' : l.toUpperCase()}
            </option>
          ))}
        </select>
        <NavLink to="/profile" title={me?.email} style={{ color: '#eae7ff', textDecoration: 'none' }}>
          {me?.fullName}
        </NavLink>
        <button className="btn ghost" style={{ color: '#eae7ff' }} onClick={() => void logout()}>
          {t('auth.logout')}
        </button>
      </header>

      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <nav className={navOpen ? 'sidenav open' : 'sidenav'}>
        {isSupplierOnly ? item('/supplier-portal', t('nav.supplierPortal')) : item('/', t('nav.dashboard'))}
        {can('parcel:create') && item('/parcels/new', t('nav.new'))}
        {can('parcel:read') && item('/parcels', t('nav.parcels'))}
        {can('groupage:manage') && item('/groupages', t('nav.groupages'))}
        {can('supplier-parcel:create') && item('/supplier-parcels', t('nav.supplierParcels'))}

        {(can('report:read') || can('tariff:write') || can('fx:write') || can('settlement:read')) && (
          <div className="sep">{t('nav.admin')}</div>
        )}
        {can('report:read') && item('/reports', t('nav.reports'))}
        {can('tariff:read') && item('/tariffs', t('nav.tariffs'))}
        {can('fx:read') && item('/exchange-rates', t('nav.fx'))}
        {can('settlement:read') && item('/partner-settlements', t('nav.settlements'))}
        {can('supplier:manage') && item('/suppliers', t('nav.suppliers'))}
        {can('carrier:manage') && item('/carriers', t('nav.carriers'))}

        {(can('user:manage') || can('config:write') || can('city:write')) && (
          <div className="sep">{t('nav.config')}</div>
        )}
        {can('user:manage') && item('/users', t('nav.users'))}
        {can('city:write') && item('/cities', t('nav.cities'))}
        {can('city:write') && item('/delivery-partners', t('nav.deliveryPartners'))}
        {can('config:write') && item('/branding', t('nav.branding'))}
      </nav>

      <main className="main">{children}</main>
      <Footer />
    </div>
  );
}
