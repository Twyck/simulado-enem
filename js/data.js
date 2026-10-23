// Catálogo das provas, gabaritos e layout (posição de questões/alternativas no PDF oficial).
export const YEARS = [2025, 2024, 2023, 2022, 2021];

export const AREAS = {
  LC: { name: 'Linguagens', full: 'Linguagens, Códigos e suas Tecnologias', from: 1, to: 45 },
  CH: { name: 'Ciências Humanas', full: 'Ciências Humanas e suas Tecnologias', from: 46, to: 90 },
  CN: { name: 'Ciências da Natureza', full: 'Ciências da Natureza e suas Tecnologias', from: 91, to: 135 },
  MT: { name: 'Matemática', full: 'Matemática e suas Tecnologias', from: 136, to: 180 },
};

export const DAYS = {
  1: { label: '1º dia', areas: ['LC', 'CH'], minutes: 330, note: 'Linguagens + Ciências Humanas (+ redação)' },
  2: { label: '2º dia', areas: ['CN', 'MT'], minutes: 300, note: 'Ciências da Natureza + Matemática' },
};

export const LANGS = { en: 'Inglês', es: 'Espanhol' };

const caderno = day => (day === 1 ? 1 : 7);
const file = (kind, year, day) => `${year}_${kind}_impresso_D${day}_CD${caderno(day)}.pdf`;
export const pdfLocal = (year, day) => `provas/${file('PV', year, day)}`;
export const pdfInep = (year, day) => `https://download.inep.gov.br/enem/provas_e_gabaritos/${file('PV', year, day)}`;
export const gabaritoInep = (year, day) => `https://download.inep.gov.br/enem/provas_e_gabaritos/${file('GB', year, day)}`;

export const areaOf = n => Object.keys(AREAS).find(a => n >= AREAS[a].from && n <= AREAS[a].to);

let gabaritos, disciplinas, itens, habilidades, percentis;
const layouts = {};

export async function loadGabaritos() {
  gabaritos ??= await fetch('data/gabaritos.json').then(r => r.json());
  return gabaritos;
}

// matéria e assunto de cada questão (classificados lendo o enunciado): { ano: { d1: { id: [matéria, assunto] } } }
export async function loadDisciplinas() {
  disciplinas ??= await fetch('data/assuntos.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return disciplinas;
}

// matérias na ordem das áreas do ENEM
export const MATERIAS = [
  { name: 'Língua Portuguesa', area: 'LC' }, { name: 'Literatura', area: 'LC' }, { name: 'Artes', area: 'LC' },
  { name: 'Educação Física', area: 'LC' }, { name: 'Inglês', area: 'LC' }, { name: 'Espanhol', area: 'LC' },
  { name: 'História', area: 'CH' }, { name: 'Geografia', area: 'CH' }, { name: 'Filosofia', area: 'CH' }, { name: 'Sociologia', area: 'CH' },
  { name: 'Física', area: 'CN' }, { name: 'Química', area: 'CN' }, { name: 'Biologia', area: 'CN' },
  { name: 'Matemática', area: 'MT' },
];

// parâmetros TRI e habilidade de cada item (microdados do INEP)
export async function loadItens() {
  itens ??= await fetch('data/itens.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return itens;
}

// texto das habilidades da Matriz de Referência do ENEM
export async function loadHabilidades() {
  habilidades ??= await fetch('data/habilidades.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return habilidades;
}

// distribuição das notas oficiais de todos os participantes de cada ano (microdados do INEP)
export async function loadPercentis() {
  percentis ??= await fetch('data/percentis.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return percentis;
}

// % de participantes com nota menor que `nota` (metade do próprio ponto conta como empate)
export function percentil(dist, nota) {
  if (!dist?.h || nota == null) return null;
  const i = Math.floor(nota) - dist.min;
  if (i < 0) return 0;
  if (i >= dist.h.length) return 100;
  let below = 0;
  for (let k = 0; k < i; k++) below += dist.h[k];
  below += dist.h[i] * (nota - Math.floor(nota));
  return (below / dist.n) * 100;
}

export async function loadLayout(year, day) {
  layouts[`${year}_${day}`] ??= await fetch(`data/layout/${year}_d${day}.json`).then(r => r.json());
  return layouts[`${year}_${day}`];
}

// Lista ordenada das questões que valem para esta prova (no 1º dia, 1–5 seguem a língua escolhida).
export function questionIds(day, lang) {
  const ids = [];
  const from = day === 1 ? 1 : 91;
  for (let n = from; n < from + 90; n++) ids.push(day === 1 && n <= 5 ? `${n}${lang}` : `${n}`);
  return ids;
}

export const qNumber = id => parseInt(id, 10);

// Resposta oficial: letra, 'X' (anulada) ou undefined.
export function answerKey(gab, year, day, id) {
  const n = qNumber(id);
  const v = gab[year]?.[`d${day}`]?.[n];
  if (Array.isArray(v)) return id.endsWith('es') ? v[1] : v[0];
  return v;
}

export async function loadExam(year, day, lang) {
  const [gab, layout, disc, its, habs] = await Promise.all([loadGabaritos(), loadLayout(year, day), loadDisciplinas(), loadItens(), loadHabilidades()]);
  const ids = questionIds(day, lang);
  const questions = ids.map(id => {
    const area = areaOf(qNumber(id));
    const item = its[year]?.[`d${day}`]?.[id] ?? null;
    const hab = item?.h ?? null;
    return {
      id,
      n: qNumber(id),
      area,
      key: answerKey(gab, year, day, id),
      disciplina: disc[year]?.[`d${day}`]?.[id]?.[0] ?? null,
      assunto: disc[year]?.[`d${day}`]?.[id]?.[1] ?? null,
      label: `${qNumber(id)}${day === 1 && qNumber(id) <= 5 ? ` (${id.endsWith('es') ? 'Esp' : 'Ing'})` : ''}`,
      // a/b/c ausentes = item retirado do cálculo da nota pelo INEP
      tri: item && item.b !== undefined ? { a: item.a, b: item.b, c: item.c } : null,
      hab,
      habDesc: hab ? habs[area]?.habilidades?.[hab]?.d ?? null : null,
      pos: layout.questions[id],
    };
  });
  return { year, day, lang, ids, questions, byId: Object.fromEntries(questions.map(q => [q.id, q])), layout };
}

// Ordem de leitura do caderno: página → coluna (esquerda/direita) → de cima para baixo.
export function readKey(layout, p, x, y) {
  return [p, x < layout.pages[p - 1].mid - 5 ? 0 : 1, -y];
}
export function cmpKey(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// ---------- treino por matéria: questões de vários cadernos ----------
// Todas as questões (não anuladas) de uma matéria/assunto nos anos escolhidos.
export async function findQuestions({ materia, assunto = null, years = YEARS }) {
  const [disc, gab] = await Promise.all([loadDisciplinas(), loadGabaritos()]);
  const out = [];
  for (const year of years) {
    for (const day of [1, 2]) {
      for (const [id, [m, a]] of Object.entries(disc[year]?.[`d${day}`] || {})) {
        if (m !== materia || (assunto && a !== assunto)) continue;
        if (answerKey(gab, year, day, id) === 'X') continue;
        out.push({ year, day, id });
      }
    }
  }
  return out.sort((p, q) => q.year - p.year || p.day - q.day || qNumber(p.id) - qNumber(q.id));
}

export async function assuntosDe(materia, years = YEARS) {
  const disc = await loadDisciplinas();
  const count = new Map();
  for (const year of years) for (const d of ['d1', 'd2']) {
    for (const [m, a] of Object.values(disc[year]?.[d] || {})) if (m === materia) count.set(a, (count.get(a) || 0) + 1);
  }
  return [...count].sort((x, y) => y[1] - x[1]);
}

export const uid = it => `${it.year}-${it.day}-${it.id}`;

// Monta uma "prova" a partir dos itens de um treino (cada questão aponta para o seu caderno).
export async function loadTreino(items) {
  const langOf = it => (it.id.endsWith('es') ? 'es' : 'en');
  const keyOf = it => `${it.year}|${it.day}|${langOf(it)}`;
  const keys = [...new Set(items.map(keyOf))];
  const exams = Object.fromEntries(await Promise.all(keys.map(async k => {
    const [year, day, lang] = k.split('|');
    return [k, await loadExam(+year, +day, lang)];
  })));
  const questions = items.map((it, i) => {
    const base = exams[keyOf(it)].byId[it.id];
    return { ...base, id: uid(it), src: it, idx: i + 1, label: `${i + 1}`, origem: `ENEM ${it.year}, questão ${base.label}` };
  });
  return { treino: true, ids: questions.map(q => q.id), questions, byId: Object.fromEntries(questions.map(q => [q.id, q])) };
}

// a prova (ou o treino) de uma tentativa
export const loadFor = a => (a.mode === 'treino' ? loadTreino(a.items) : loadExam(a.year, a.day, a.lang));

export const nomeProva = a => (a.mode === 'treino'
  ? `Treino de ${a.materia}${a.assunto ? `: ${a.assunto}` : ''}`
  : `ENEM ${a.year}, ${DAYS[a.day].label}`);
