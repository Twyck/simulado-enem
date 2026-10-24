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
  const pageItems = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    // coordenadas do PDF: a área visível (CropBox) pode começar deslocada (34 pt nos cadernos de 2022+)
    const [vx0, vy0] = page.view;
    const W = vp.width, H = vp.height, mid = vx0 + W / 2;
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
      items.push({ str: it.str, x, y, w: it.width, h: Math.abs(d), font: it.fontName });
    }
    pages.push({ w: +W.toFixed(1), h: +H.toFixed(1), mid: +mid.toFixed(1), x0: +vx0.toFixed(1), y0: +vy0.toFixed(1) });
    // corpo da página: sem código de barras do topo e sem rodapé
    // rodapé de cada página ("LC - 1º dia | Caderno 1 - AZUL", número da página...), detectado pelo conteúdo
    const footer = items.filter(i => i.y < vy0 + H * 0.1 && /caderno|enem|tecnologias|\bdia\b|^\s*\d{1,2}\s*$/i.test(i.str));
    const floor = footer.length ? Math.max(...footer.map(i => i.y + i.h)) + 3 : vy0 + H * 0.03;
    const body = items.filter(i => !/^\*.*\*$/.test(i.str.trim()) && i.y > floor && i.y < vy0 + H * 0.985);
    // linhas cujo texto atravessa o meio da página (sem o vão entre colunas) indicam coluna única
    const rows = new Map();
    for (const it of body) {
      const k = Math.round(it.y / 2);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push(it);
    }
    let spanning = 0;
    for (const row of rows.values()) {
      row.sort((a, b) => a.x - b.x);
      let x0 = row[0].x, x1 = row[0].x + row[0].w, hit = false;
      for (const it of row.slice(1)) {
        if (it.x - x1 < 14) x1 = Math.max(x1, it.x + it.w);
        else { if (x0 < mid - 15 && x1 > mid + 15) hit = true; x0 = it.x; x1 = it.x + it.w; }
      }
      if (hit || (x0 < mid - 15 && x1 > mid + 15)) spanning++;
    }
    pageItems.push({ body, single: spanning >= 4, mid, W, H, floor,
      left: Math.max(vx0, Math.min(...body.map(i => i.x)) - 6), right: Math.min(vx0 + W, Math.max(...body.map(i => i.x + i.w)) + 6) });

    let lang = null;
    for (const l of lines(items, mid)) {
      const lm = l.str.match(LANG);
      if (lm) anchors.push({ t: 'lang', p, x: l.x, y: l.y, lang: lm[1].toLowerCase().startsWith('ingl') ? 'en' : 'es' });
      const hm = l.str.replace(/\s+/g, ' ').trim().match(HEADER);
      if (hm) anchors.push({ t: 'q', p, x: l.x, y: l.y, n: +hm[1], h: l.h });
    }
    for (const it of items) {
      if (/^[A-E]$/.test(it.str) && Math.abs(it.w - it.h) < 3) {
        anchors.push({ t: 'alt', p, x: it.x, y: it.y, L: it.str, s: it.h, font: it.font });
      }
    }
  }
  // as letras das alternativas usam uma fonte própria (a mais comum entre letras A–E isoladas);
  // letras soltas em fórmulas e figuras ("C" de C6H12O6, pontos A e B de um desenho) ficam de fora
  const freq = {};
  for (const a of anchors) if (a.t === 'alt') freq[a.font] = (freq[a.font] || 0) + 1;
  // (alguns cadernos usam duas: soma as mais comuns até dar 5 letras por questão do dia)
  const esperado = (day === 1 ? 95 : 90) * 5;
  const altFonts = new Set();
  let total = 0;
  for (const [font, n] of Object.entries(freq).sort((x, y) => y[1] - x[1])) {
    if (total >= esperado) break;
    altFonts.add(font); total += n;
  }
  return { pages, anchors: anchors.filter(a => a.t !== 'alt' || altFonts.has(a.font)), pageItems, numPages: doc.numPages };
}

// ordem de leitura do caderno (sempre em duas colunas): página → coluna → de cima para baixo
const readKey = (pages, p, x, y) => [p, x < pages[p - 1].mid - 5 ? 0 : 1, -y];
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

const outDir = path.join(root, 'data/layout');
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(path.join(root, 'provas')).filter(f => f.includes('_PV_'));
for (const f of files.sort()) {
  const [, year, day] = f.match(/(\d{4})_PV_impresso_D(\d)/);
  const { pages, anchors, pageItems, numPages } = await analyze(path.join(root, 'provas', f), year, +day);
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
      cur = questions[id] = { n: a.n, id, p: a.p, x: +a.x.toFixed(1), y: +a.y.toFixed(1), hh: +a.h.toFixed(1), alts: [] };
      if (a.n > 5) lang = null;
      continue;
    }
    // alternativas podem vir em grade (A|D, B|E, C): fica a primeira ocorrência de cada letra
    if (a.t === 'alt' && cur && !cur.alts.some(x => x.L === a.L)) {
      cur.alts.push({ L: a.L, p: a.p, x: +a.x.toFixed(1), y: +a.y.toFixed(1), s: +a.s.toFixed(1) });
    }
  }
  // grade que atravessa o meio da página (A|D, B|E, C): as letras da direita caem na outra coluna na
  // ordem de leitura; completa com a letra que falta na mesma linha de uma alternativa já achada
  for (const q of Object.values(questions)) {
    if (q.alts.length >= 5 || !q.alts.length) continue;
    for (const L of 'ABCDE'.split('').filter(L => !q.alts.some(a => a.L === L))) {
      const hit = anchors.find(a => a.t === 'alt' && a.L === L && q.alts.some(b => b.p === a.p && Math.abs(b.y - a.y) < 1 && a.x > b.x));
      if (hit) q.alts.push({ L, p: hit.p, x: +hit.x.toFixed(1), y: +hit.y.toFixed(1), s: +hit.s.toFixed(1) });
    }
  }
  Object.values(questions).forEach(fix);
  buildParts(questions, pageItems);
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

// Recorte de cada questão: trechos (página, coluna, faixa vertical) do cabeçalho até o próximo cabeçalho.
// Páginas em que o texto atravessa o meio são tratadas como coluna única.
function buildParts(questions, pageItems) {
  // página de coluna única só se nenhum cabeçalho/alternativa estiver na metade direita
  const rightAnchor = new Set();
  for (const q of Object.values(questions)) {
    if (q.x > pageItems[q.p - 1].mid) rightAnchor.add(q.p);
    for (const a of q.alts) if (a.x > pageItems[a.p - 1].mid) rightAnchor.add(a.p);
  }
  pageItems.forEach((pg, i) => { if (rightAnchor.has(i + 1)) pg.single = false; });
  const unitOf = (p, x) => (pageItems[p - 1].single ? 0 : x < pageItems[p - 1].mid - 5 ? 0 : 1);
  const units = []; // todas as colunas de todas as páginas, em ordem de leitura
  pageItems.forEach((pg, i) => {
    const cols = pg.single ? [0] : [0, 1];
    for (const c of cols) {
      const its = pg.body.filter(it => pg.single || (c === 0 ? it.x < pg.mid - 5 : it.x >= pg.mid - 5));
      if (!its.length) continue;
      // limites da coluna pelas margens da página (figuras podem ir além do texto)
      units.push({
        p: i + 1, c,
        x0: pg.single || c === 0 ? pg.left : pg.mid + 1,
        x1: pg.single || c === 1 ? pg.right : pg.mid - 1,
        top: Math.max(...its.map(it => it.y + it.h)) + 3,
        bottom: Math.min(...its.map(it => it.y)) - 6,
      });
    }
  });
  const uIndex = (p, c) => units.findIndex(u => u.p === p && u.c === c);
  const heads = Object.values(questions).map(q => ({ q, u: uIndex(q.p, unitOf(q.p, q.x)), top: q.y + q.hh + 3 }))
    .filter(h => h.u >= 0).sort((a, b) => a.u - b.u || b.top - a.top);
  heads.forEach((h, i) => {
    const next = heads[i + 1];
    const parts = [];
    // a questão termina na coluna da sua última alternativa (evita invadir a página da redação)
    const lastU = Math.max(h.u, ...h.q.alts.map(a => uIndex(a.p, unitOf(a.p, a.x))));
    for (let u = h.u; u <= lastU && u < units.length; u++) {
      const U = units[u];
      const y0 = u === h.u ? h.top : U.top;
      const ends = next && next.u === u;
      const lowestAlt = Math.min(...h.q.alts.filter(a => uIndex(a.p, unitOf(a.p, a.x)) === u).map(a => a.y - 5), Infinity);
      // na coluna da última alternativa, vai até o rodapé: alternativas em figura ficam abaixo da letra
      const isLast = u === lastU;
      const y1 = Math.min(ends ? next.top + 2 : isLast ? pageItems[U.p - 1].floor : U.bottom, lowestAlt);
      if (y0 - y1 > 12) parts.push({ p: U.p, x0: +U.x0.toFixed(1), x1: +U.x1.toFixed(1), y0: +y0.toFixed(1), y1: +y1.toFixed(1) });
      if (ends) break;
    }
    // alternativas em grade (A|D, B|E) ou figuras lado a lado: a questão ocupa a largura toda da página
    // (só quando nenhuma outra questão ocupa a outra coluna da mesma página)
    const altXs = h.q.alts.map(a => a.x);
    if (Math.max(...altXs) - Math.min(...altXs) > 80) {
      for (const pt of parts) {
        const pg = pageItems[pt.p - 1];
        if (!h.q.alts.some(a => a.p === pt.p)) continue;
        const myCol = h.q.alts.find(a => a.p === pt.p).x < pg.mid ? 0 : 1;
        const others = Object.values(questions).filter(o => o !== h.q)
          .flatMap(o => [{ p: o.p, x: o.x }, ...o.alts]).filter(a => a.p === pt.p && (a.x < pg.mid ? 0 : 1) !== myCol);
        if (others.length) continue;
        pt.x0 = +pg.left.toFixed(1); pt.x1 = +pg.right.toFixed(1); pt.wide = true;
      }
      // trechos alargados da mesma página viram um só
      for (let i = parts.length - 1; i > 0; i--) {
        const a = parts[i - 1], b = parts[i];
        if (a.p === b.p && a.wide && b.wide) { a.y0 = Math.max(a.y0, b.y0); a.y1 = Math.min(a.y1, b.y1); parts.splice(i, 1); }
      }
    }
    h.q.parts = parts;
  });
}
