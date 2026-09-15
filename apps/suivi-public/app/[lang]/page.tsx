import { DICT, NETWORK_CITIES, resolveLocale } from '../../lib/i18n';
import { SearchForm } from './SearchForm';

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang = resolveLocale(raw);
  const t = DICT[lang];

  return (
    <main className="home">
      <section className="hero">
        <div className="cities-strip" aria-hidden="true">
          {NETWORK_CITIES.map((c) => (
            <span key={c}>{c.toUpperCase()}</span>
          ))}
        </div>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="hero-title">
          {t.title}
          <br />
          <span className="accent">{t.titleAccent}</span>
        </h1>
        <p className="sub">{t.subtitle}</p>

        <SearchForm
          lang={lang}
          placeholder={t.placeholder}
          example={t.example}
          submit={t.submit}
          invalidFormatBody={t.invalidFormatBody}
        />
        <p className="hint" style={{ marginTop: 4 }}>
          {t.noAccount}
        </p>
      </section>

      <section className="how">
        <h2>{t.howItWorksTitle}</h2>
        <div className="steps-grid">
          <div className="step-card">
            <span className="step-n">1</span>
            <h3>{t.step1Title}</h3>
            <p>{t.step1Body}</p>
          </div>
          <div className="step-card">
            <span className="step-n">2</span>
            <h3>{t.step2Title}</h3>
            <p>{t.step2Body}</p>
          </div>
          <div className="step-card">
            <span className="step-n">3</span>
            <h3>{t.step3Title}</h3>
            <p>{t.step3Body}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
