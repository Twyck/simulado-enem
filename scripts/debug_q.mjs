import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const [file, n] = process.argv.slice(2);
const L = JSON.parse(fs.readFileSync(file.replace('provas/', 'data/layout/').replace(/_PV_impresso_D(\d)_CD\d+\.pdf/, '_d$1.json')));
const q = Object.values(L.questions).find(q => q.id === n || String(q.n) === n);
console.log('q', JSON.stringify(q)?.slice(0, 300));
const pg = q ? q.p : 1;
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
for (const p of [pg, pg + 1]) {
  const tc = await (await doc.getPage(p)).getTextContent();
  console.log('--- page', p, JSON.stringify(L.pages[p - 1]));
  for (const it of tc.items) if (/^\s*[A-E]\s*$/.test(it.str) || /QUEST|Quest|^Q$|^UEST|^\d\d\d?$/.test(it.str)) console.log(JSON.stringify(it.str), it.transform.map(v => +v.toFixed(1)).join(','), +it.width.toFixed(1), it.fontName);
}
