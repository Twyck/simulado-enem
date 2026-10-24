// Cálculo do desempenho de uma tentativa: acertos por área/disciplina, tempos e padrões.
import { AREAS } from './data.js';
import { notaTRI, dificuldade, nivel, chance } from './tri.js';

const triItens = (qs, flip = new Set()) => qs.filter(q => q.tri && q.status !== 'anulada')
  .map(q => ({ ...q.tri, certo: flip.has(q.id) || q.status === 'certa' })); // em branco conta como erro, como no INEP

export function computeStats(exam, attempt) {
  const qs = exam.questions.map(q => {
    const ans = attempt.answers[q.id] ?? null;
    const status = q.key === 'X' ? 'anulada' : !ans ? 'branco' : ans === q.key ? 'certa' : 'errada';
    const hist = attempt.history.filter(h => h.q === q.id && h.a);
    return {
      ...q,
      ans,
      status,
      time: attempt.time[q.id] || 0,
      changes: attempt.changes[q.id] || 0,
      flagged: !!attempt.flags[q.id],
      crossed: attempt.crossed[q.id]?.length || 0,
      firstAnswer: hist[0]?.a ?? null,
    };
  });
  const valid = qs.filter(q => q.status !== 'anulada');

  // ---- TRI: nota estimada por área, dificuldade oficial de cada item e coerência ----
  const tri = {};
  for (const area of new Set(qs.map(q => q.area))) {
    const aqs = qs.filter(q => q.area === area);
    if (!aqs.some(q => q.tri)) continue;
    // treino por matéria: só a dificuldade oficial de cada questão; nota TRI exige a prova inteira
    if (exam.treino) {
      for (const q of aqs) if (q.tri) { q.dif = dificuldade(area, q.tri.b); q.nivel = nivel(area, q.dif); }
      continue;
    }
    const nota = notaTRI(area, triItens(aqs));
    for (const q of aqs) {
      if (!q.tri) continue;
      q.dif = dificuldade(area, q.tri.b);
      q.nivel = nivel(area, q.dif);
      q.chance = chance(area, q.tri, nota); // chance de acerto de quem tem a sua nota
    }
    // "fáceis para você" que errou: alguém com a sua nota acertaria com ≥ 65% de chance
    const facilErrada = aqs.filter(q => q.tri && q.status !== 'certa' && q.status !== 'anulada' && q.chance >= 0.65)
      .sort((a, b) => b.chance - a.chance);
    const ganho = facilErrada.length ? notaTRI(area, triItens(aqs, new Set(facilErrada.map(q => q.id)))) - nota : 0;
    tri[area] = { nota, facilErrada, ganho };
  }
  const triAreas = Object.keys(tri);
  const areasProva = [...new Set(valid.map(q => q.area))];
  // áreas em que o INEP publicou parâmetros que não reproduzem a nota oficial: sem nota TRI
  const semNota = areasProva.filter(a => qs.some(q => q.area === a && q.semNota));
  const facilErrada = triAreas.flatMap(a => tri[a].facilErrada).sort((a, b) => b.chance - a.chance);
  // acertos improváveis para a sua nota: a TRI trata como possível chute e eles valem pouco
  const dificilCerta = qs.filter(q => q.tri && q.status === 'certa' && q.chance < 0.35).sort((a, b) => a.chance - b.chance);

  // ---- habilidades da Matriz de Referência ----
  const habMap = new Map();
  for (const q of valid) {
    if (!q.hab) continue;
    const k = `${q.area}-${q.hab}`;
    if (!habMap.has(k)) habMap.set(k, { area: q.area, hab: q.hab, desc: q.habDesc, qs: [] });
    habMap.get(k).qs.push(q);
  }
  const habilidades = [...habMap.values()].map(g => ({
    ...g,
    total: g.qs.length,
    erros: g.qs.filter(q => q.status !== 'certa').length,
  })).sort((a, b) => b.erros - a.erros || b.erros / b.total - a.erros / a.total || a.hab - b.hab);
  const count = (arr, st) => arr.filter(q => q.status === st).length;

  const group = keyFn => {
    const map = new Map();
    for (const q of valid) {
      const k = keyFn(q);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(q);
    }
    return [...map].map(([name, arr]) => ({
      name,
      total: arr.length,
      certas: count(arr, 'certa'),
      erradas: count(arr, 'errada'),
      branco: count(arr, 'branco'),
      time: arr.reduce((s, q) => s + q.time, 0),
      avg: arr.reduce((s, q) => s + q.time, 0) / arr.length,
    }));
  };

  const answered = valid.filter(q => q.ans);
  const times = answered.map(q => q.time).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : 0;

  const byTimeDesc = [...answered].sort((a, b) => b.time - a.time);
  // "erros rápidos": errou gastando bem menos que o seu tempo típico → pressa/desatenção/chute
  const quickWrong = answered.filter(q => q.status === 'errada' && q.time < Math.max(45, median * 0.5)).sort((a, b) => a.time - b.time);
  // "erros demorados": errou depois de investir muito tempo → conteúdo a estudar
  const slowWrong = answered.filter(q => q.status === 'errada' && q.time >= median * 1.4).sort((a, b) => b.time - a.time);
  // "menos dificuldade": acertou rápido
  const easy = answered.filter(q => q.status === 'certa').sort((a, b) => a.time - b.time);
  // trocas de resposta
  const changed = answered.filter(q => q.changes > 0 && q.firstAnswer);
  const changeStats = {
    total: changed.length,
    paraCerta: changed.filter(q => q.firstAnswer !== q.key && q.ans === q.key).length,
    paraErrada: changed.filter(q => q.firstAnswer === q.key && q.ans !== q.key).length,
  };

  // ritmo: questões respondidas acumuladas ao longo do tempo
  const firstAt = new Map();
  for (const h of attempt.history) if (h.a && !firstAt.has(h.q)) firstAt.set(h.q, h.t);
  const pace = [...firstAt.values()].sort((a, b) => a - b).map((t, i) => [t, i + 1]);

  return {
    qs,
    total: valid.length,
    certas: count(valid, 'certa'),
    erradas: count(valid, 'errada'),
    branco: count(valid, 'branco'),
    anuladas: qs.length - valid.length,
    flagged: qs.filter(q => q.flagged).length,
    elapsed: attempt.elapsed,
    avg: answered.length ? answered.reduce((s, q) => s + q.time, 0) / answered.length : 0,
    median,
    areas: group(q => q.area).map(a => ({ ...a, label: AREAS[a.name].name })),
    tri,
    // média só com todas as áreas da prova; com alguma sem nota, fica a nota de cada área
    notaMedia: triAreas.length && triAreas.length === areasProva.length ? triAreas.reduce((s, a) => s + tri[a].nota, 0) / triAreas.length : null,
    temTri: triAreas.length > 0,
    semNota,
    facilErrada,
    dificilCerta,
    habilidades,
    disciplinas: group(q => q.disciplina).sort((a, b) => (b.erradas + b.branco) / b.total - (a.erradas + a.branco) / a.total || b.total - a.total),
    slowest: byTimeDesc,
    quickWrong,
    slowWrong,
    easy,
    changeStats,
    pace,
  };
}
