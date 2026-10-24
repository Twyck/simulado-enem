// Texto de cada questão tirado do próprio PDF (dentro dos recortes do layout) → JSON, para classificar o assunto.
// Uso: node scripts/textos_pdf.mjs <app> <saida.json> <ano> [<ano>...]
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

const [root, saida, ...anos] = process.argv.slice(2);
const out = {};
for (const ano of anos) for (const day of [1, 2]) {
  const L = JSON.parse(fs.readFileSync(path.join(root, `data/layout/${ano}_d${day}.json`)));
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(root, `provas/${ano}_PV_impresso_D${day}_CD${day === 1 ? 1 : 7}.pdf`))), verbosity: 0 }).promise;
  const porPagina = {};
  for (let p = 1; p <= doc.numPages; p++) {
    porPagina[p] = (await (await doc.getPage(p)).getTextContent()).items.filter(i => i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] }));
  }
  for (const q of Object.values(L.questions)) {
    const partes = q.parts.map(pt => porPagina[pt.p]
      .filter(i => i.x >= pt.x0 - 1 && i.x <= pt.x1 && i.y <= pt.y0 + 1 && i.y >= pt.y1 - 1)
      .sort((a, b) => b.y - a.y || a.x - b.x).map(i => i.s).join(' '));
    (out[ano] ??= {})[`d${day}`] ??= {};
    out[ano][`d${day}`][q.id] = partes.join(' ').replace(/\s+/g, ' ').trim();
  }
  console.log(ano, day, Object.keys(L.questions).length);
}
fs.writeFileSync(saida, JSON.stringify(out));
