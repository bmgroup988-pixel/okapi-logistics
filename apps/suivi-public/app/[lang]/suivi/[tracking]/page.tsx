import Link from 'next/link';
import type { Metadata } from 'next';
import { DICT, resolveLocale } from '../../../../lib/i18n';
import { fetchTracking } from '../../../../lib/api';

const ORDER = ['ENREGISTRE', 'EN_TRANSIT', 'ARRIVE', 'LIVRE'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tracking: string }>;
}): Promise<Metadata> {
  const { tracking } = await params;
  return { title: `Okapi Logistics — ${tracking}` };
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ lang: string; tracking: string }>;
}) {
  const { lang: rawLang, tracking } = await params;
  const lang = resolveLocale(rawLang);
  const t = DICT[lang];
  const data = await fetchTracking(tracking.toUpperCase());

  if (!data) {
    return (
      <main>
        <h1>{t.notFoundTitle}</h1>
        <p className="sub">{t.notFoundBody}</p>
        <Link className="primary" href={`/${lang}`} style={{ display: 'inline-block', textDecoration: 'none' }}>
          {t.retry}
        </Link>
      </main>
    );
  }

  // HANDED_TO_PARTNER n'est pas une étape de la frise principale : le colis a
  // dépassé « Arrivé » (remis à un partenaire de livraison locale) sans être
  // encore « Livré ». On l'affiche visuellement au niveau d'« Arrivé ».
  const reachedIndex =
    data.status === 'HANDED_TO_PARTNER' ? ORDER.indexOf('ARRIVE') : ORDER.indexOf(data.status);
  const paymentPill =
    data.paymentState === 'PAID'
      ? { cls: 'paid', label: t.paymentPaid }
      : data.paymentState === 'PARTIAL'
        ? { cls: 'partial', label: t.paymentPartial }
        : { cls: 'pending', label: t.paymentPending };

  return (
    <main>
      <div className="mono">
        {t.parcel} {data.trackingNumber}
      </div>
      <h1 style={{ marginTop: 8 }}>
        <span className="pill status">● {t.steps[data.status] ?? data.status}</span>
      </h1>

      <div className="stepper" aria-hidden="true">
        {ORDER.map((s, i) => (
          <span key={s} style={{ display: 'contents' }}>
            {i > 0 && <span className="seg" />}
            <span className={`dot${reachedIndex >= i && reachedIndex >= 0 ? ' done' : ''}`} />
          </span>
        ))}
        <span style={{ marginLeft: 8 }}>{ORDER.map((s) => t.steps[s]).join(' · ')}</span>
      </div>

      <div>
        <span className={`pill ${paymentPill.cls}`}>⬤ {paymentPill.label}</span>
      </div>

      <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {data.photoUrl ? (
          <img className="photo" src={data.photoUrl} alt={`${t.parcel} ${data.trackingNumber}`} />
        ) : null}
        <div>
          <div>
            <strong>{t.destination} :</strong> {data.destinationCityCode}
          </div>
          <div style={{ color: 'var(--mute)' }}>
            {t.registeredOn} {new Date(data.registeredAt).toLocaleDateString(lang)}
          </div>
        </div>
      </div>

      <div className="card">
        <strong>{t.history}</strong>
        <ul className="timeline">
          {[...data.steps].reverse().map((s, idx) => (
            <li key={idx}>
              <span>
                {t.steps[s.status] ?? s.status}
                {s.locationLabel ? ` — ${s.locationLabel}` : ''}
              </span>
              <span className="when">{new Date(s.at).toLocaleString(lang)}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
