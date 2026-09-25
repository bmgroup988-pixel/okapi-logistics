import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NAVY = '#170655';

// Version blanche du logo — meilleur contraste/lisibilité sur le fond navy
// des icônes que la version orange d'origine (docs/registre 2026-09-25).
const markPath = fileURLToPath(new URL('../assets/brand/okapi-o-mark-white.png', import.meta.url));

/** Fond navy arrondi + le vrai logo « O » Okapi centré dessus. */
async function iconBuffer(size, { maskable = false } = {}) {
  const r = size * 0.22;
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>
    </svg>`,
  );
  // Zone de sécurité plus large pour les icônes maskable (recadrées en
  // cercle/squircle par l'OS) — voir W3C manifest "purpose: maskable".
  const markSize = Math.round(size * (maskable ? 0.62 : 0.8));
  const mark = await sharp(markPath).resize(markSize, markSize).toBuffer();
  return sharp(bg)
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

const outDir = new URL('../apps/back-office/public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  const buf = await iconBuffer(t.size, { maskable: t.maskable });
  await sharp(buf).toFile(fileURLToPath(new URL(t.file, outDir)));
  console.log('wrote', t.file);
}
