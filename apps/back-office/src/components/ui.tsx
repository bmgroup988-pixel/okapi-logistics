import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCityLookup } from '../lib/geo';

/** Code ville + nom complet en gris, miniature — identification facile (ex. "FIH (Kinshasa)"). */
export function CityLabel({ code }: { code: string | null | undefined }) {
  const lookup = useCityLookup();
  if (!code) return <span className="muted">—</span>;
  const city = lookup[code];
  return (
    <span className="mono">
      {code}
      {city ? <span className="city-name"> ({city.name})</span> : null}
    </span>
  );
}

/** Trajet départ -> arrivée, chaque code avec son nom en regard. */
export function CityPair({ origin, destination }: { origin: string | null | undefined; destination: string | null | undefined }) {
  return (
    <span>
      <CityLabel code={origin} /> → <CityLabel code={destination} />
    </span>
  );
}

/** Code pays + nom complet en gris, miniature (ex. "BJ (Bénin)"). */
export function CountryLabel({ iso2, name }: { iso2: string | null | undefined; name?: string | null }) {
  if (!iso2) return <span className="muted">—</span>;
  return (
    <span className="mono">
      {iso2}
      {name ? <span className="city-name"> ({name})</span> : null}
    </span>
  );
}

export function Pill({ kind, children }: { kind?: string; children: ReactNode }) {
  return <span className={`pill ${kind ?? ''}`}>{children}</span>;
}

export function statusKind(status: string): string {
  if (status === 'LIVRE') return 'ok';
  if (status === 'ANNULE') return 'err';
  if (status === 'EN_TRANSIT') return 'info';
  if (status === 'HANDED_TO_PARTNER') return 'warn';
  return '';
}
export function paymentKind(s: string): string {
  return s === 'PAYE' ? 'ok' : s === 'PARTIEL' ? 'warn' : 'err';
}

export function Money({ m }: { m: { amount: string; currency: string } | null | undefined }) {
  if (!m) return <span>—</span>;
  return (
    <span className="mono">
      {m.amount} {m.currency}
    </span>
  );
}

interface CurrencyOptionRef {
  code: string;
  symbol: string;
  isActive: boolean;
}

/**
 * Montant avec menu déroulant de devise — conversion automatique au taux du
 * jour, devise par défaut USD. Réutilisable partout où un solde/montant colis
 * doit pouvoir être consulté dans une autre devise que celle de facturation.
 */
export function CurrencyAmount({
  m,
  defaultCurrency = 'USD',
}: {
  m: { amount: string; currency: string } | null | undefined;
  defaultCurrency?: string;
}) {
  const [target, setTarget] = useState(defaultCurrency);
  const currencies = useQuery({
    queryKey: ['ref-currencies'],
    queryFn: () => api<CurrencyOptionRef[]>('/reference/currencies'),
    staleTime: 5 * 60 * 1000,
  });
  const needsConversion = !!m && target !== m.currency;
  const converted = useQuery({
    queryKey: ['fx-convert', m?.currency, target, m?.amount],
    queryFn: () => api<{ amount: string }>('/exchange-rates', { query: { from: m!.currency, to: target, amount: m!.amount } }),
    enabled: needsConversion,
  });

  if (!m) return <span>—</span>;
  const display = needsConversion ? (converted.data?.amount ?? '…') : m.amount;

  return (
    <span className="currency-amount">
      <b className="mono">{display} {target}</b>
      <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Devise d'affichage">
        {(currencies.data ?? [])
          .filter((c) => c.isActive)
          .map((c) => (
            <option key={c.code} value={c.code}>{c.code}</option>
          ))}
      </select>
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return <p className="error">{msg}</p>;
}

export function Loading() {
  return (
    <div className="okapi-spinner-wrap" role="status" aria-label="Chargement en cours">
      <img src="/okapi-o-mark.png" alt="" className="okapi-spinner" />
      <span className="muted">Chargement…</span>
    </div>
  );
}
