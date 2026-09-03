import { redirect } from 'next/navigation';
import { DICT, resolveLocale } from '../../lib/i18n';

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = resolveLocale(raw);
  const t = DICT[lang];

  async function search(formData: FormData) {
    'use server';
    const n = String(formData.get('tracking') ?? '')
      .trim()
      .toUpperCase();
    if (n) redirect(`/${lang}/suivi/${encodeURIComponent(n)}`);
  }

  return (
    <main>
      <h1>{t.title}</h1>
      <p className="sub">{t.subtitle}</p>
      <form className="search" action={search}>
        <label htmlFor="tracking" style={{ fontSize: 13, color: 'var(--mute)' }}>
          {t.placeholder}
        </label>
        <input
          id="tracking"
          name="tracking"
          autoComplete="off"
          spellCheck={false}
          placeholder="OKP26090043FIH"
          pattern="[A-Za-z]{3}\d{8,}[A-Za-z]{3}"
          required
        />
        <button className="primary" type="submit">
          {t.submit}
        </button>
        <span className="hint">{t.example}</span>
        <span className="hint">{t.noAccount}</span>
      </form>
    </main>
  );
}
