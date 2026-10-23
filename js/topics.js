// Desempenho por matéria e por assunto (ex.: Matemática → Logaritmo fraco, Geometria plana forte).
import { MATERIAS } from './data.js';
import { esc, pct, fmtPct } from './ui.js';

// quantas questões um assunto precisa ter para receber o selo de forte/fraco
const MIN_SELO = 2;

// qs: questões já corrigidas ({ disciplina, assunto, status })
export function porMateria(qs) {
  const mats = new Map();
  for (const q of qs) {
    if (!q.disciplina || q.status === 'anulada') continue;
    if (!mats.has(q.disciplina)) mats.set(q.disciplina, { name: q.disciplina, total: 0, certas: 0, assuntos: new Map() });
    const m = mats.get(q.disciplina);
    m.total++;
    m.certas += q.status === 'certa';
    const key = q.assunto || 'Outros';
    if (!m.assuntos.has(key)) m.assuntos.set(key, { name: key, total: 0, certas: 0 });
    const a = m.assuntos.get(key);
    a.total++;
    a.certas += q.status === 'certa';
  }
  const ordem = name => MATERIAS.findIndex(m => m.name === name);
  return [...mats.values()]
    .map(m => ({ ...m, assuntos: [...m.assuntos.values()].sort((x, y) => x.certas / x.total - y.certas / y.total || y.total - x.total) }))
    .sort((a, b) => ordem(a.name) - ordem(b.name));
}

export function selo(a) {
  if (a.total < MIN_SELO) return null;
  const r = a.certas / a.total;
  return r >= 0.7 ? 'forte' : r <= 0.4 ? 'fraco' : null;
}

// Resumo em frases: os assuntos mais fracos e mais fortes de todas as matérias
export function resumo(materias) {
  const todos = materias.flatMap(m => m.assuntos.map(a => ({ ...a, materia: m.name })));
  const fracos = todos.filter(a => selo(a) === 'fraco').sort((x, y) => x.certas / x.total - y.certas / y.total || y.total - x.total);
  const fortes = todos.filter(a => selo(a) === 'forte').sort((x, y) => y.certas / y.total - x.certas / x.total || y.total - x.total);
  return { fracos, fortes };
}

export function materiasHTML(materias, { aberto = 2 } = {}) {
  if (!materias.length) return '<p class="empty">Sem questões corrigidas ainda.</p>';
  const piores = [...materias].sort((a, b) => a.certas / a.total - b.certas / b.total).slice(0, aberto).map(m => m.name);
  return `<div class="mats">${materias.map(m => `
    <details class="mat" ${piores.includes(m.name) ? 'open' : ''}>
      <summary>
        <span class="mat-name">${esc(m.name)}</span>
        <span class="mat-bar"><i style="width:${(m.certas / m.total) * 100}%"></i></span>
        <span class="mat-val tabular">${m.certas} de ${m.total} <span class="muted">${fmtPct(pct(m.certas, m.total))}</span></span>
      </summary>
      <ul class="assuntos-list">${m.assuntos.map(a => {
        const s = selo(a);
        return `<li><span class="as-name">${esc(a.name)}</span>
          <span class="as-dots" aria-hidden="true">${Array.from({ length: Math.min(a.total, 12) }, (_, i) => `<i class="${i < a.certas ? 'ok' : ''}"></i>`).join('')}</span>
          <span class="as-val tabular">${a.certas} de ${a.total}</span>
          ${s ? `<span class="badge ${s === 'forte' ? 'good' : 'bad'}">${s === 'forte' ? 'ponto forte' : 'precisa estudar'}</span>` : '<span class="badge-space"></span>'}</li>`;
      }).join('')}</ul>
    </details>`).join('')}</div>`;
}

export function resumoHTML(materias) {
  const { fracos, fortes } = resumo(materias);
  const item = a => `<li><b>${esc(a.name)}</b> <span class="muted">${esc(a.materia)}, ${a.certas} de ${a.total}</span></li>`;
  if (!fracos.length && !fortes.length) return '';
  return `<div class="resumo-assuntos">
    <div><h3>Precisa estudar</h3>${fracos.length ? `<ul>${fracos.slice(0, 6).map(item).join('')}</ul>` : '<p class="empty">Nenhum assunto com 40% ou menos de acerto.</p>'}</div>
    <div><h3>Pontos fortes</h3>${fortes.length ? `<ul>${fortes.slice(0, 6).map(item).join('')}</ul>` : '<p class="empty">Nenhum assunto com 70% ou mais de acerto ainda.</p>'}</div>
  </div>`;
}
