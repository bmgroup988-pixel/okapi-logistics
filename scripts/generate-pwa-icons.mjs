import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NAVY = '#170655';
const ORANGE = '#E47911';

function svg(size, { maskable = false } = {}) {
  const pad = maskable ? size * 0.16 : size * 0.06;
  const r = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const d = size * 0.34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" fill="${NAVY}"/>
    <g transform="translate(${cx} ${cy}) rotate(45)">
      <rect x="${-d / 2}" y="${-d / 2}" width="${d}" height="${d}" rx="${size * 0.03}" fill="${ORANGE}"/>
    </g>
  </svg>`;
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
  const buf = Buffer.from(svg(t.size, { maskable: t.maskable }));
  await sharp(buf).png().toFile(fileURLToPath(new URL(t.file, outDir)));
  console.log('wrote', t.file);
}
