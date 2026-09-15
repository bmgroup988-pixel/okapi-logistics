import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  ExternalHyperlink,
  LevelFormat,
  convertInchesToTwip,
} from 'docx';

const NAVY = '170655';
const ORANGE = 'E47911';
const TURQ = '1CA9C9';
const INK = '2E3138';
const MUTE = '6A6976';
const LINE = 'D8D6E6';

const root = fileURLToPath(new URL('..', import.meta.url));
const assetsDir = path.join(root, 'docs', 'word', 'assets');
const outDir = path.join(root, 'docs', 'word');
mkdirSync(outDir, { recursive: true });

// Dimensions connues des PNG générés par scripts/generate-diagrams.mjs
// (évite une dépendance à une lib de lecture d'images).
const KNOWN_DIMENSIONS = {
  'architecture.png': { width: 960, height: 560 },
  'cycle-colis.png': { width: 980, height: 340 },
};

function img(name, maxWidthPx = 600) {
  const file = path.join(assetsDir, name);
  const buf = readFileSync(file);
  const dim = KNOWN_DIMENSIONS[name];
  if (!dim) throw new Error(`Dimensions inconnues pour ${name} — ajouter une entrée à KNOWN_DIMENSIONS`);
  const w = Math.min(maxWidthPx, dim.width);
  const h = Math.round((w / dim.width) * dim.height);
  return new ImageRun({ data: buf, transformation: { width: w, height: h }, type: 'png' });
}

/* ------------------------------------------------------------ inline runs */
function parseInline(text) {
  const runs = [];
  let rest = text;
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/;
  while (rest.length) {
    const m = re.exec(rest);
    if (!m) {
      runs.push(new TextRun(rest));
      break;
    }
    if (m.index > 0) runs.push(new TextRun(rest.slice(0, m.index)));
    const token = m[0];
    if (token.startsWith('**')) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    } else if (token.startsWith('`')) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: 'Consolas', color: 'B5451B', shading: { type: ShadingType.CLEAR, fill: 'F4F0FF' } }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    }
    rest = rest.slice(m.index + token.length);
  }
  return runs.length ? runs : [new TextRun(text)];
}

function cellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 2, color: LINE };
  return { top: b, bottom: b, left: b, right: b };
}

function headerCell(text) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: NAVY },
    borders: cellBorders(),
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 19 })] })],
  });
}

function bodyCell(text) {
  return new TableCell({
    borders: cellBorders(),
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: [new Paragraph({ children: parseInline(text), spacing: { after: 0 } })],
  });
}

/* --------------------------------------------------------------- parser */
function parseMarkdown(md, { imagesByHeading = {} } = {}) {
  const lines = md.split('\n');
  const children = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];

  function flushCode() {
    if (!codeBuf.length) return;
    children.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: '1E1D2A' },
        spacing: { before: 80, after: 160 },
        children: [new TextRun({ text: codeBuf.join('\n'), font: 'Consolas', size: 18, color: 'E9E8F0' })],
      }),
    );
    codeBuf = [];
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, '');

    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      i++;
      continue;
    }

    // Mermaid blocks are skipped (rendered as diagrams separately / noted)
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Tables
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const headerCells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: headerCells.map(headerCell) }),
            ...rows.map(
              (r) =>
                new TableRow({
                  children: headerCells.map((_, ci) => bodyCell(r[ci] ?? '')),
                }),
            ),
          ],
        }),
      );
      children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].replace(/\s*\{#.*\}\s*$/, '');
      const headingLevel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][level - 1];
      children.push(
        new Paragraph({
          heading: headingLevel,
          spacing: { before: level === 1 ? 400 : 260, after: 140 },
          children: parseInline(text),
        }),
      );
      const key = text.trim();
      if (imagesByHeading[key]) {
        children.push(new Paragraph({ children: [imagesByHeading[key]], spacing: { before: 100, after: 200 }, alignment: AlignmentType.CENTER }));
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
          spacing: { after: 200 },
        }),
      );
      i++;
      continue;
    }

    // Blockquote / callout
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      children.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: 'FFF3E6' },
          border: { left: { style: BorderStyle.SINGLE, size: 24, color: ORANGE } },
          indent: { left: 200 },
          spacing: { before: 100, after: 200 },
          children: parseInline(buf.join(' ')),
        }),
      );
      continue;
    }

    // Numbered / bullet lists (including checkboxes)
    const bullet = /^(\s*)([-*])\s+(.*)$/.exec(line);
    const numbered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const indent = (bullet ?? numbered)[1].length;
      let text = (bullet ?? numbered)[3];
      const checkbox = /^\[( |x)\]\s*(.*)$/i.exec(text);
      let prefix = '';
      if (checkbox) {
        prefix = checkbox[1].toLowerCase() === 'x' ? '☑ ' : '☐ ';
        text = checkbox[2];
      }
      children.push(
        new Paragraph({
          numbering: checkbox
            ? undefined
            : { reference: bullet ? 'bullets' : 'numbers', level: Math.min(2, Math.floor(indent / 2)) },
          indent: checkbox ? { left: convertInchesToTwip(0.25 + indent / 40) } : undefined,
          spacing: { after: 60 },
          children: prefix ? [new TextRun(prefix), ...parseInline(text)] : parseInline(text),
        }),
      );
      i++;
      continue;
    }

    // Regular paragraph (collect wrapped lines until blank)
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|\s*\||\s*[-*]\s|\s*\d+\.\s|>|```|-{3,}$)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    children.push(new Paragraph({ spacing: { after: 160 }, children: parseInline(buf.join(' ')) }));
  }
  flushCode();
  return children;
}

function coverPage({ title, subtitle }) {
  return [
    new Paragraph({ spacing: { before: 1200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'OKAPI LOGISTICS', bold: true, size: 30, color: NAVY, font: 'Segoe UI' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: ORANGE } },
      children: [new TextRun({ text: ' ', size: 2 })],
    }),
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 46, color: INK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: subtitle, size: 24, color: MUTE })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1600 },
      children: [new TextRun({ text: `Version 1.0 — ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}`, size: 20, color: MUTE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60 },
      children: [new TextRun({ text: '« Le futur du commerce africain »', size: 18, italics: true, color: ORANGE })],
    }),
    new Paragraph({ children: [], pageBreakBefore: true }),
  ];
}

function docStyles() {
  return {
    default: {
      document: { run: { font: 'Segoe UI', size: 21, color: INK }, paragraph: { spacing: { line: 300 } } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 32, bold: true, color: NAVY, font: 'Segoe UI' }, paragraph: { spacing: { before: 400, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ORANGE } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 320, after: 140 } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { size: 23, bold: true, color: TURQ }, paragraph: { spacing: { before: 240, after: 100 } } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', run: { size: 21, bold: true, italics: true, color: MUTE }, paragraph: { spacing: { before: 200, after: 80 } } },
    ],
  };
}

function buildDoc({ title, subtitle, source, imagesByHeading }) {
  const md = readFileSync(source, 'utf8');
  const body = parseMarkdown(md, { imagesByHeading });
  return new Document({
    styles: docStyles(),
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }, { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 820, hanging: 260 } } } }] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
                children: [new TextRun({ text: 'OKAPI LOGISTICS', bold: true, size: 16, color: NAVY }), new TextRun({ text: '   ·   ' + title, size: 16, color: MUTE })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '© ' + new Date().getFullYear() + ' Global Okapi Group. Tous droits réservés.   —   Page ', size: 15, color: MUTE }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTE }),
                  new TextRun({ text: ' / ', size: 15, color: MUTE }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTE }),
                ],
              }),
            ],
          }),
        },
        children: [...coverPage({ title, subtitle }), ...body],
      },
    ],
  });
}

const jobs = [
  {
    source: path.join(root, 'docs', '05-manuel-installation-configuration.md'),
    out: 'Okapi-Logistics-Manuel-Installation-Configuration.docx',
    title: 'Manuel d’installation & de configuration',
    subtitle: 'Mise en service, environnement, paramétrage initial',
    imagesByHeading: {
      "1. Vue d'ensemble": img('architecture.png'),
    },
  },
  {
    source: path.join(root, 'docs', '06-manuel-agent.md'),
    out: 'Okapi-Logistics-Manuel-Agent-Fret.docx',
    title: 'Manuel de l’agent fret',
    subtitle: 'Enregistrement, encaissement et suivi des colis en agence',
    imagesByHeading: {
      '7. Faire avancer un colis (changer le statut)': img('cycle-colis.png'),
    },
  },
  {
    source: path.join(root, 'docs', '07-manuel-administration.md'),
    out: 'Okapi-Logistics-Manuel-Administration-DAF.docx',
    title: 'Manuel de l’administration DAF & super-administrateur',
    subtitle: 'Pilotage, tarifs, configuration et reporting multi-pays',
    imagesByHeading: {},
  },
];

for (const job of jobs) {
  const doc = buildDoc(job);
  const buf = await Packer.toBuffer(doc);
  writeFileSync(path.join(outDir, job.out), buf);
  console.log('wrote', job.out);
}
