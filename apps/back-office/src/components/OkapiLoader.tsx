/**
 * Logo Okapi animé — deux usages :
 *  - `variant="boot"` : écran de démarrage de l'app (grand, avec halo
 *    pulsant), entrée en fondu/zoom puis rotation continue.
 *  - `variant="inline"` : petit indicateur (ex. bouton de connexion pendant
 *    l'envoi), rotation continue seule, pas de halo.
 */
export function OkapiLoader({
  variant = 'inline',
  tone = 'orange',
  size,
  label,
}: {
  variant?: 'boot' | 'inline';
  /** 'white' — pour un fond de couleur (ex. bouton orange) où l'orange se fondrait. */
  tone?: 'orange' | 'white';
  size?: number;
  label?: string;
}) {
  const px = size ?? (variant === 'boot' ? 72 : 20);
  const src = tone === 'white' ? '/okapi-o-mark-white.png' : '/okapi-o-mark.png';
  return (
    <span
      className={`okapi-loader okapi-loader-${variant}`}
      role="status"
      aria-label={label ?? 'Chargement en cours'}
      style={{ width: px, height: px }}
    >
      {variant === 'boot' && <span className="okapi-loader-ring" />}
      <img src={src} alt="" className="okapi-loader-mark" />
    </span>
  );
}
