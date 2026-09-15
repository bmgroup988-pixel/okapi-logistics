import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NAVY = '#170655';
const ORANGE = '#E47911';
const TURQ = '#1CA9C9';
const INK = '#2E3138';
const LINE = '#D8D6E6';
const BG = '#FFFFFF';

const outDir = new URL('../docs/word/assets/', import.meta.url);
mkdirSync(fileURLToPath(outDir), { recursive: true });

function box(x, y, w, h, label, sub, color = NAVY, textColor = '#fff') {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}" />
  <text x="${x + w / 2}" y="${y + h / 2 - (sub ? 8 : 0)}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="700" fill="${textColor}">${label}</text>
  ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11" fill="${textColor}" opacity="0.85">${sub}</text>` : ''}
  `;
}

function arrow(x1, y1, x2, y2, color = INK, label = '') {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `
  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="${color}" /></marker></defs>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" marker-end="url(#arrow)" />
  ${label ? `<rect x="${mx - label.length * 3.3 - 5}" y="${my - 10}" width="${label.length * 6.6 + 10}" height="16" fill="${BG}" />
  <text x="${mx}" y="${my + 2}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="10.5" fill="${color}">${label}</text>` : ''}
  `;
}

/* ------------------------------------------------------ 1. Architecture */
const archW = 960;
const archH = 560;
const arch = `<svg xmlns="http://www.w3.org/2000/svg" width="${archW}" height="${archH}" viewBox="0 0 ${archW} ${archH}">
  <rect width="${archW}" height="${archH}" fill="${BG}" />

  <text x="30" y="34" font-family="Segoe UI, Arial" font-size="18" font-weight="700" fill="${NAVY}">Architecture — vue d'ensemble</text>

  ${box(30, 70, 200, 70, 'Back-office', 'React + Vite (PWA)', NAVY)}
  ${box(260, 70, 200, 70, 'Suivi public', 'Next.js (client)', NAVY)}
  ${box(490, 70, 200, 70, 'Agent mobile', 'PWA installée', TURQ, '#0b2530')}

  ${arrow(130, 140, 130, 220)}
  ${arrow(360, 140, 360, 220)}
  ${arrow(590, 140, 480, 220, INK, 'HTTPS')}

  ${box(230, 230, 300, 80, 'API Okapi Logistics', 'NestJS — REST /api/v1 — JWT + RBAC', ORANGE, '#3a1e00')}

  ${arrow(300, 310, 250, 400)}
  ${arrow(430, 310, 480, 400)}
  ${arrow(380, 310, 700, 400, INK, 'notifications (file)')}

  ${box(120, 410, 260, 80, 'PostgreSQL', 'Données transactionnelles\n+ contraintes financières', NAVY)}
  ${box(430, 410, 260, 80, 'Object Storage S3', 'Photos colis, étiquettes,\nreçus/factures PDF (signé)', NAVY)}
  ${box(700, 410, 220, 80, 'Fournisseurs externes', 'SES / WhatsApp / SMS\n(connecteurs, v1.1)', '#6a6976', '#fff')}

  <rect x="20" y="20" width="${archW - 40}" height="${archH - 40}" fill="none" stroke="${LINE}" stroke-width="1.5" rx="14" />
</svg>`;

/* ------------------------------------------------- 2. Parcel status flow */
const flowW = 980;
const flowH = 340;
const flow = `<svg xmlns="http://www.w3.org/2000/svg" width="${flowW}" height="${flowH}" viewBox="0 0 ${flowW} ${flowH}">
  <rect width="${flowW}" height="${flowH}" fill="${BG}" />
  <text x="30" y="34" font-family="Segoe UI, Arial" font-size="18" font-weight="700" fill="${NAVY}">Cycle de vie d'un colis</text>

  ${box(30, 70, 150, 60, 'ENREGISTRÉ', '', '#6a6976')}
  ${arrow(180, 100, 250, 100)}
  ${box(250, 70, 150, 60, 'EN TRANSIT', '', TURQ, '#0b2530')}
  ${arrow(400, 100, 470, 100)}
  ${box(470, 70, 150, 60, 'ARRIVÉ', '', NAVY)}

  ${arrow(545, 130, 545, 190)}
  ${arrow(470, 100, 650, 220, INK, 'remise partenaire')}
  ${arrow(470, 130, 300, 220, INK, 'litige')}

  ${box(650, 220, 170, 60, 'REMIS AU PARTENAIRE', '', ORANGE, '#3a1e00')}
  ${box(230, 220, 150, 60, 'RETOURNÉ', 'retour possible vers ARRIVÉ', '#c0392b')}
  ${box(470, 220, 150, 60, 'LIVRÉ', 'état final', '#1f9d57')}

  ${arrow(650, 250, 550, 250)}
  ${arrow(305, 220, 470, 130)}

  <rect x="20" y="20" width="${flowW - 40}" height="${flowH - 40}" fill="none" stroke="${LINE}" stroke-width="1.5" rx="14" />
</svg>`;

const targets = [
  { name: 'architecture.png', svg: arch, w: archW },
  { name: 'cycle-colis.png', svg: flow, w: flowW },
];

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).png().toFile(fileURLToPath(new URL(t.name, outDir)));
  console.log('wrote', t.name);
}
