// Gera data/layout/{ano}_d{dia}.json: posição de cada questão e de cada alternativa (A–E)
// dentro do PDF oficial, para marcar a resposta clicando direto na prova.
// Uso: node build_layout.mjs <raiz-do-app>   (precisa de pdfjs-dist instalado)
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

const root = process.argv[2];
const HEADER = /^Q\s*U\s*E\s*S\s*T\s*\S?\s*O\s*(\d{1,3})\b/i;
const LANG = /op[çc][ãa]o:?\s+(ingl[êe]s|espanhol)/i;

function lines(items, mid) {
  // agrupa itens na mesma linha (mesmo y) e mesma coluna aproximada
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const out = [];
  for (const it of sorted) {
    const l = out.find(l => Math.abs(l.y - it.y) < 1.5 && (l.x < mid) === (it.x < mid) && it.x >= l.x1 - 1 && it.x - l.x1 < 15);
    if (l) { l.str += (it.x - l.x1 > 1.5 ? ' ' : '') + it.str; l.x1 = it.x + it.w; }
    else out.push({ x: it.x, y: it.y, x1: it.x + it.w, str: it.str, h: it.h });
  }
  return out;
}

async function analyze(file, year, day) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const pages = [];
  const anchors = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const W = vp.width, H = vp.height, mid = W / 2;
    const tc = await page.getTextContent();
    const seen = new Set();
    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const [a, b, , d, x, y] = it.transform;
      if (b !== 0 || Math.abs(d) < 4) continue; // ignora texto rotacionado e marca d'água miúda
      const k = `${it.str}|${x.toFixed(1)}|${y.toFixed(1)}`;
      if (seen.has(k)) continue; // alguns anos duplicam cada glifo
      seen.add(k);
      items.push({ str: it.str, x, y, w: it.width, h: Math.abs(d) });
    }
    pages.push({ w: +W.toFixed(1), h: +H.toFixed(1), mid: +mid.toFixed(1) });

    let lang = null;
    for (const l of lines(items, mid)) {
      const lm = l.str.match(LANG);
      if (lm) anchors.push({ t: 'lang', p, x: l.x, y: l.y, lang: lm[1].toLowerCase().startsWith('ingl') ? 'en' : 'es' });
      const hm = l.str.replace(/\s+/g, ' ').trim().match(HEADER);
      if (hm) anchors.push({ t: 'q', p, x: l.x, y: l.y, n: +hm[1], h: l.h });
    }
    for (const it of items) {
      if (/^[A-E]$/.test(it.str) && Math.abs(it.w - it.h) < 3) {
        anchors.push({ t: 'alt', p, x: it.x, y: it.y, L: it.str, s: it.h });
      }
    }
  }
  return { pages, anchors, numPages: doc.numPages };
}

// ordem de leitura do caderno (sempre em duas colunas): página → coluna → de cima para baixo
const readKey = (pages, p, x, y) => [p, x < pages[p - 1].mid - 5 ? 0 : 1, -y];
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

const outDir = path.join(root, 'data/layout');
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(path.join(root, 'provas')).filter(f => f.includes('_PV_'));
for (const f of files.sort()) {
  const [, year, day] = f.match(/(\d{4})_PV_impresso_D(\d)/);
  const { pages, anchors, numPages } = await analyze(path.join(root, 'provas', f), year, +day);
  anchors.forEach(a => (a.k = readKey(pages, a.p, a.x, a.y)));
  anchors.sort((a, b) => cmp(a.k, b.k));
  const questions = {};
  const fix = q => q.alts.sort((a, b) => a.L.localeCompare(b.L));
  let cur = null, lang = null;
  const problems = [];
  for (const a of anchors) {
    if (a.t === 'lang') { lang = a.lang; continue; }
    if (a.t === 'q') {
      const id = +day === 1 && a.n <= 5 && lang ? `${a.n}${lang}` : `${a.n}`;
      if (questions[id]) { cur = null; continue; } // repetição (ex.: sumário) — ignora
      cur = questions[id] = { n: a.n, id, p: a.p, x: +a.x.toFixed(1), y: +a.y.toFixed(1), alts: [] };
      if (a.n > 5) lang = null;
      continue;
    }
    // alternativas podem vir em grade (A|D, B|E, C): fica a primeira ocorrência de cada letra
    if (a.t === 'alt' && cur && !cur.alts.some(x => x.L === a.L)) {
      cur.alts.push({ L: a.L, p: a.p, x: +a.x.toFixed(1), y: +a.y.toFixed(1), s: +a.s.toFixed(1) });
    }
  }
  Object.values(questions).forEach(fix);
  const lo = +day === 1 ? 1 : 91, hi = lo + 89;
  for (let n = lo; n <= hi; n++) {
    const ids = +day === 1 && n <= 5 ? [`${n}en`, `${n}es`] : [`${n}`];
    for (const id of ids) {
      const q = questions[id];
      if (!q) problems.push(`${id}:sem-cabeçalho`);
      else if (q.alts.length !== 5) problems.push(`${id}:${q.alts.length}alts`);
    }
  }
  console.log(year, 'D' + day, 'páginas', numPages, 'questões', Object.keys(questions).length, problems.length ? 'PROBLEMAS ' + problems.join(' ') : 'ok');
  fs.writeFileSync(path.join(outDir, `${year}_d${day}.json`), JSON.stringify({ pages, questions }));
}
