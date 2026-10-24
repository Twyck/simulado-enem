// Confere js/tri.js contra notas oficiais: participantes que fizeram o caderno Azul nos microdados.
// Uso: node scripts/check_tri.mjs <dir com PART_<ano>.csv e ITENS_<ano>.csv>
import fs from 'fs';
import { notaTRI } from '../js/tri.js';

const dir = process.argv[2];
const itens = JSON.parse(fs.readFileSync(new URL('../data/itens.json', import.meta.url)));
const START = { LC: 1, CH: 46, CN: 91, MT: 136 };
const csv = f => { const [h, ...rows] = fs.readFileSync(f, 'latin1').trim().split('\n'); const k = h.split(';'); return rows.map(r => Object.fromEntries(r.split(';').map((v, i) => [k[i], v]))); };

for (const year of Object.keys(itens)) {
  const f = `${dir}/PART_${year}.csv`;
  if (!fs.existsSync(f)) continue;
  // códigos do caderno Azul usado no app
  const azul = {};
  const its = csv(`${dir}/ITENS_${year}.csv`);
  // 2017: o INEP numera os itens dentro de cada área (ver scripts/inep_itens.py)
  const rel = Math.min(...its.filter(r => r.SG_AREA === 'CH').map(r => +r.CO_POSICAO)) === 1;
  const pos = r => {
    const p = +r.CO_POSICAO;
    if (!rel) return r.SG_AREA === 'LC' && p <= 5 ? `${p}${r.TP_LINGUA === '0' ? 'en' : 'es'}` : `${p}`;
    if (r.SG_AREA === 'LC') return p <= 5 ? `${p}en` : p <= 10 ? `${p - 5}es` : `${p - 5}`;
    return `${p + { CH: 45, CN: 90, MT: 135 }[r.SG_AREA]}`;
  };
  for (const r of its) {
    const day = ['LC', 'CH'].includes(r.SG_AREA) ? 'd1' : 'd2';
    const q = itens[year][day][pos(r)];
    if (r.TX_COR.toUpperCase() === 'AZUL' && q && q.b !== undefined && Math.abs(q.b - +r.NU_PARAM_B) < 1e-4 && Math.abs(q.a - +r.NU_PARAM_A) < 1e-4) (azul[r.SG_AREA] ??= new Set()).add(r.CO_PROVA);
  }
  const errs = {};
  for (const r of csv(f)) {
    for (const area of Object.keys(START)) {
      if (!azul[area]?.has(r[`CO_PROVA_${area}`]) || !+r[`NU_NOTA_${area}`]) continue;
      let resp = r[`TX_RESPOSTAS_${area}`], gab = r[`TX_GABARITO_${area}`];
      const lang = r.TP_LINGUA === '0' ? 'en' : 'es';
      if (area === 'LC') {
        if (resp.length === 50) resp = (lang === 'en' ? resp.slice(0, 5) : resp.slice(5, 10)) + resp.slice(10);
        gab = (lang === 'en' ? gab.slice(0, 5) : gab.slice(5, 10)) + gab.slice(10);
      }
      const day = ['LC', 'CH'].includes(area) ? 'd1' : 'd2';
      const its = [];
      [...resp].forEach((ans, i) => {
        const n = START[area] + i;
        const it = itens[year][day][area === 'LC' && n <= 5 ? `${n}${lang}` : `${n}`];
        if (it?.b !== undefined) its.push({ ...it, certo: ans === gab[i] });
      });
      (errs[area] ??= []).push(notaTRI(area, its) - +r[`NU_NOTA_${area}`]);
    }
  }
  const fmt = e => `n=${e.length} erro médio ${(e.reduce((s, x) => s + Math.abs(x), 0) / e.length).toFixed(2)} máx ${Math.max(...e.map(Math.abs)).toFixed(1)}`;
  console.log(year, Object.entries(errs).map(([a, e]) => `${a}: ${fmt(e)}`).join(' | '));
}
