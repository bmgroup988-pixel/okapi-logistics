'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '../../lib/i18n';

const TRACKING_FORMAT = /^OKP\d{8}[A-Z]{3}$/;

export function SearchForm({
  lang,
  placeholder,
  example,
  submit,
  invalidFormatBody,
}: {
  lang: Locale;
  placeholder: string;
  example: string;
  submit: string;
  invalidFormatBody: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = value.trim().toUpperCase();
    if (!TRACKING_FORMAT.test(n)) {
      setError(invalidFormatBody);
      return;
    }
    setError(null);
    setBusy(true);
    router.push(`/${lang}/suivi/${encodeURIComponent(n)}`);
  };

  return (
    <form className="search" onSubmit={onSubmit} noValidate>
      <input
        id="tracking"
        name="tracking"
        autoComplete="off"
        spellCheck={false}
        placeholder={example.replace(/^[^:]*:\s*/, '')}
        aria-label={placeholder}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? 'tracking-error' : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
      />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? '…' : submit}
      </button>
      {error ? (
        <span id="tracking-error" className="field-error" role="alert">
          {error}
        </span>
      ) : (
        <span className="hint">{example}</span>
      )}
    </form>
  );
}
