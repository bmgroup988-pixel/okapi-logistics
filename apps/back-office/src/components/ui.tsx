import type { ReactNode } from 'react';
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
  return <p className="muted">Chargement…</p>;
}
