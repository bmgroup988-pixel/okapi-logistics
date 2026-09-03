import type { ReactNode } from 'react';

export function Pill({ kind, children }: { kind?: string; children: ReactNode }) {
  return <span className={`pill ${kind ?? ''}`}>{children}</span>;
}

export function statusKind(status: string): string {
  return status === 'LIVRE' ? 'ok' : status === 'ANNULE' ? 'err' : status === 'EN_TRANSIT' ? 'info' : '';
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
