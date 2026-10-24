// Catálogo das provas, gabaritos e layout (posição de questões/alternativas no PDF oficial).
export const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

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

// prova de uma área só: o dia em que ela cai e o tempo no ritmo do exame
// (2º dia: 5h para 90 questões; 1º dia: 5h30 menos ~1h de redação)
export const dayOfArea = area => (area === 'LC' || area === 'CH' ? 1 : 2);
export const AREA_MINUTES = { LC: 135, CH: 135, CN: 150, MT: 150 };

const caderno = day => (day === 1 ? 1 : 7);
const file = (kind, year, day) => `${year}_${kind}_impresso_D${day}_CD${caderno(day)}.pdf`;
export const pdfLocal = (year, day) => `provas/${file('PV', year, day)}`;
// até 2019 os cadernos ficam em outro endereço do INEP, com nomes próprios de cada ano
const INEP_ANTIGO = {
  2017: ['cad_1_prova_azul_5112017.pdf', 'cad_7_prova_azul_12112017.pdf'],
  2018: ['1DIA_01_AZUL_BAIXA.pdf', '2DIA_07_AZUL_BAIXA.pdf'],
  2019: ['caderno_de_questoes_1_dia_caderno_1_azul_aplicacao_regular.pdf', 'caderno_de_questoes_2_dia_caderno_7_azul_aplicacao_regular.pdf'],
};
export const pdfInep = (year, day) => (INEP_ANTIGO[year]
  ? `https://download.inep.gov.br/educacao_basica/enem/provas/${year}/${INEP_ANTIGO[year][day - 1]}`
  : `https://download.inep.gov.br/enem/provas_e_gabaritos/${file('PV', year, day)}`);
// baixa o caderno para o cache do app em segundo plano (usado para deixar pronto o próximo)
export async function prefetchPdf(year, day) {
  if (!('caches' in window) || navigator.connection?.saveData) return;
  const cache = await caches.open('enem-pdfs-v1');
  const url = new URL(pdfLocal(year, day), location.href).href;
  if (await cache.match(url)) return;
  const res = await fetch(url).catch(() => null);
  if (res?.ok) await cache.put(url, res);
}
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

// como todos os candidatos responderam cada questão do caderno Azul (microdados do INEP):
// quantos marcaram A, B, C, D, E e quantos deixaram em branco
let acertos;
export async function loadAcertos() {
  acertos ??= await fetch('data/acertos.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return acertos;
}
function povoDe(cont, key) {
  if (!cont || key === 'X') return null;
  const n = cont.reduce((s, v) => s + v, 0);
  if (!n) return null;
  const pct = i => (cont[i] / n) * 100;
  const k = 'ABCDE'.indexOf(key);
  // alternativa errada mais marcada (o "distrator")
  const d = [0, 1, 2, 3, 4].filter(i => i !== k).sort((a, b) => cont[b] - cont[a])[0];
  return { n, acerto: pct(k), letras: cont.slice(0, 5).map((_, i) => pct(i)), branco: pct(5), distrator: 'ABCDE'[d], distratorPct: pct(d) };
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

export async function loadExam(year, day, lang, area = null) {
  const [gab, layout, disc, its, habs, resp] = await Promise.all([loadGabaritos(), loadLayout(year, day), loadDisciplinas(), loadItens(), loadHabilidades(), loadAcertos()]);
  const ids = questionIds(day, lang).filter(id => !area || areaOf(qNumber(id)) === area);
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
      // prova cujos parâmetros publicados não reproduzem as notas oficiais (ver scripts/build_itens.py)
      semNota: !!item?.sn,
      hab,
      habDesc: hab ? habs[area]?.habilidades?.[hab]?.d ?? null : null,
      pos: layout.questions[id],
      povo: povoDe(resp[year]?.[`d${day}`]?.[id], answerKey(gab, year, day, id)),
    };
  });
  return { year, day, lang, area, ids, questions, byId: Object.fromEntries(questions.map(q => [q.id, q])), layout };
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
export const loadFor = a => (a.mode === 'treino' ? loadTreino(a.items) : loadExam(a.year, a.day, a.lang, a.area));

export const nomeProva = a => (a.mode === 'redacao' ? `Redação ENEM ${a.year}` : a.mode === 'treino'
  ? a.titulo || `Treino de ${a.materia}${a.assunto ? `: ${a.assunto}` : ''}`
  : a.area ? `ENEM ${a.year}, ${AREAS[a.area].name}` : `ENEM ${a.year}, ${DAYS[a.day].label}`);
