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

let gabaritos, disciplinas, itens, habilidades;
const layouts = {};

export async function loadGabaritos() {
  gabaritos ??= await fetch('data/gabaritos.json').then(r => r.json());
  return gabaritos;
}

export async function loadDisciplinas() {
  disciplinas ??= await fetch('data/disciplinas.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return disciplinas;
}

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
      disciplina: disc[year]?.[`d${day}`]?.[id] ?? null,
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
