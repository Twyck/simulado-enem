// Painel de evolução: junta todas as provas entregues — notas TRI ao longo do tempo,
// mapa das 120 habilidades da Matriz de Referência e o que priorizar nos estudos.
import { AREAS, DAYS, loadFor, nomeProva, loadHabilidades, loadPercentis, percentil } from './data.js';
import { listAttempts } from './store.js';
import { computeStats } from './stats.js';
import { newTreino } from './store.js';
import { uid } from './data.js';
import { porMateria, materiasHTML, resumoHTML } from './topics.js';
import { h, icon, pct, fmtPct, esc } from './ui.js';

const AREA_ORDER = ['LC', 'CH', 'CN', 'MT'];
const SERIES = { LC: 'var(--series-1)', CH: 'var(--series-2)', CN: 'var(--series-3)', MT: 'var(--series-4)' };
const nota = v => (v == null ? '—' : String(Math.round(v)));
const shortDate = t => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const STATUS_CLS = { certa: 'good', errada: 'bad', branco: 'blank', anulada: 'null' };

export async function evolutionScreen(app) {
  const attempts = (await listAttempts()).filter(a => a.status === 'done')
    .sort((a, b) => (a.finishedAt || a.startedAt) - (b.finishedAt || b.startedAt));
  const habText = await loadHabilidades();
  const dists = await loadPercentis();
  const runs = await Promise.all(attempts.map(async (a, i) => {
    const st = computeStats(await loadFor(a), a);
    return { a, st, i, when: a.finishedAt || a.startedAt };
  }));

  app.innerHTML = '';
  if (!runs.length) {
    app.append(h(`<div class="results"><div class="results-top"><a class="btn ghost sm" href="#/">${icon.back} Início</a><h1>Sua evolução</h1></div>
      <div class="panel"><p class="empty">Entregue pelo menos uma prova para ver sua evolução aqui.</p></div></div>`));
    return;
  }

  // ---- notas por área ao longo das provas ----
  const series = Object.fromEntries(AREA_ORDER.map(area => [area, runs
    .filter(r => r.st.tri[area])
    .map(r => ({ r, nota: r.st.tri[area].nota, area: r.st.areas.find(x => x.name === area) }))]));
  const tiles = AREA_ORDER.filter(a => series[a].length).map(a => {
    const pts = series[a];
    const last = pts.at(-1).nota, first = pts[0].nota, best = Math.max(...pts.map(p => p.nota));
    const delta = last - first;
    const lastRun = pts.at(-1).r.a;
    const p = percentil(dists[lastRun.year]?.[a], last);
    return `<div class="tile"><div class="k"><i class="dot" style="background:${SERIES[a]}"></i>${AREAS[a].name}</div>
      <div class="v tabular">${nota(last)}</div>
      <div class="s">${pts.length > 1 ? `<span class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(delta))}</span> desde a primeira, ` : ''}melhor ${nota(best)} em ${pts.length} prova${pts.length > 1 ? 's' : ''}</div>
      ${p != null ? `<div class="s pct-line">Melhor que ${Math.round(p)}% dos participantes de ${lastRun.year}</div>` : ''}</div>`;
  }).join('');
  const lastPerArea = AREA_ORDER.filter(a => series[a].length).map(a => series[a].at(-1).nota);
  const media = lastPerArea.reduce((s, v) => s + v, 0) / lastPerArea.length;

  // ---- habilidades de todas as provas ----
  const habs = new Map();
  for (const area of AREA_ORDER) for (let hh = 1; hh <= 30; hh++) {
    habs.set(`${area}-${hh}`, { area, hab: hh, desc: habText[area]?.habilidades?.[hh]?.d || '', comp: habText[area]?.habilidades?.[hh]?.c, total: 0, erros: 0, qs: [] });
  }
  const disc = new Map();
  for (const { a, st } of runs) {
    for (const q of st.qs) {
      if (q.status === 'anulada') continue;
      const errou = q.status !== 'certa';
      if (q.hab) {
        const g = habs.get(`${q.area}-${q.hab}`);
        g.total++; g.erros += errou;
        g.qs.push({ attempt: a, q });
      }
      if (q.disciplina) {
        if (!disc.has(q.disciplina)) disc.set(q.disciplina, { name: q.disciplina, area: q.area, total: 0, erros: 0 });
        const d = disc.get(q.disciplina);
        d.total++; d.erros += errou;
      }
    }
  }
  // prioridade: taxa de erro com "encolhimento" para não exagerar habilidades vistas 1 vez
  const prio = [...habs.values()].filter(g => g.total && g.erros)
    .map(g => ({ ...g, score: (g.erros + 0.5) / (g.total + 2) }))
    .sort((a, b) => b.score - a.score || b.erros - a.erros);
  const seen = [...habs.values()].filter(g => g.total).length;
  const discs = [...disc.values()].sort((a, b) => b.erros / b.total - a.erros / a.total || b.total - a.total);
  const facilTotal = runs.reduce((s, r) => s + r.st.facilErrada.length, 0);
  const materias = porMateria(runs.flatMap(r => r.st.qs));
  // caderno de erros: questões cuja resposta mais recente (prova ou treino) ficou errada ou em branco
  const ultima = new Map();
  for (const { a, st } of runs) {
    for (const q of st.qs) {
      if (q.status === 'anulada') continue;
      const item = a.mode === 'treino' ? q.src : { year: a.year, day: a.day, id: q.id };
      ultima.set(uid(item), { item, ok: q.status === 'certa', disciplina: q.disciplina });
    }
  }
  const pendentes = [...ultima.values()].filter(v => !v.ok);

  const el = h(`<div class="results evolution">
    <div class="results-top">
      <a class="btn ghost sm" href="#/">${icon.back} Início</a>
      <h1>Sua evolução</h1>
      <span class="muted">${runs.length} entrega${runs.length > 1 ? 's' : ''} (provas e treinos), ${seen} das 120 habilidades já cobradas</span>
    </div>

    ${lastPerArea.length ? `<div class="hero">
      <div class="tile big"><div class="k">Nota TRI atual</div><div class="v tabular">${nota(media)}</div>
        <div class="s">média da última prova de cada área${lastPerArea.length < 4 ? '; faça os dois dias para ter as quatro' : ''}</div></div>
      ${tiles}
    </div>

    <section class="panel"><h2>Notas ao longo das provas</h2>
      <p class="sub">Nota TRI estimada de cada área, na ordem em que você entregou as provas. Passe o mouse nos pontos para ver a prova.</p>
      <div class="legend">${AREA_ORDER.filter(a => series[a].length).map(a => `<span><i style="background:${SERIES[a]}"></i>${AREAS[a].name}</span>`).join('')}</div>
      <div class="chart-scroll"><div class="chart" id="notas-chart"></div></div>
    </section>` : `<div class="panel"><p class="empty">A nota TRI aparece aqui quando você entregar uma prova completa. Os treinos por matéria entram na análise de assuntos e habilidades abaixo.</p></div>`}

    <section class="panel" style="margin-top:18px"><h2>Mapa das habilidades</h2>
      <p class="sub">As 30 habilidades de cada área da Matriz de Referência, coloridas pela sua taxa de erro (veja a escala); tracejado = ainda não caiu em nenhuma prova sua. Clique para ver as questões.</p>
      <div class="legend seq-legend"><span>menos erro</span>${[1, 2, 3, 4, 5].map(i => `<i style="background:var(--seq-${i})"></i>`).join('')}<span>mais erro</span><span style="margin-left:10px"><i class="unseen"></i>não cobrada</span></div>
      <div class="heat" role="grid">${AREA_ORDER.map(area => `
        <div class="heat-row"><span class="heat-label">${AREAS[area].name}</span><div class="heat-cells">${Array.from({ length: 30 }, (_, i) => {
          const g = habs.get(`${area}-${i + 1}`);
          const bin = g.total ? 1 + Math.min(4, Math.floor((g.erros / g.total) * 5)) : 0; // 0% → 1, 100% → 5
          return `<button class="cell" data-k="${area}-${i + 1}" style="${bin ? `background:var(--seq-${bin})` : ''}" ${bin ? '' : 'data-unseen'}
            title="H${i + 1} · ${g.total ? `${g.erros} erro${g.erros === 1 ? '' : 's'} em ${g.total}` : 'ainda não cobrada'} — ${esc(g.desc)}">${i + 1}</button>`;
        }).join('')}</div></div>`).join('')}</div>
      <div class="heat-detail"><p class="muted">Selecione uma habilidade no mapa.</p></div>
    </section>

    <div class="grid2" style="margin-top:18px">
      <section class="panel"><h2>O que priorizar</h2>
        ${pendentes.length ? `<div class="redo-box"><p><b>${pendentes.length} questões</b> continuam erradas ou em branco na sua última tentativa.</p><button class="btn primary sm redo-all">Refazer caderno de erros</button></div>` : ''}
        <p class="sub">Habilidades com mais erros, somando todas as provas. As que caíram poucas vezes pesam menos até você ver mais questões delas.</p>
        <ul class="prio">${prio.slice(0, 10).map(g => `<li data-k="${g.area}-${g.hab}">
          <div class="prio-head"><b>H${g.hab}</b> <span class="muted">${AREAS[g.area].name}</span><span class="tabular prio-n">${g.erros} de ${g.total}</span></div>
          <div class="track"><div class="fill" style="width:${(g.erros / g.total) * 100}%;background:var(--bad)"></div></div>
          <p>${esc(g.desc)}</p></li>`).join('') || '<p class="empty">Nenhum erro até agora.</p>'}</ul>
      </section>
      <section class="panel"><h2>Matérias e assuntos</h2>
        <p class="sub">Somando todas as provas e treinos. Toque numa matéria para ver os assuntos, do pior para o melhor.</p>
        ${materiasHTML(materias)}
      </section>
    </div>

    ${resumoHTML(materias) ? `<section class="panel" style="margin-top:18px"><h2>Seus pontos fortes e fracos</h2>
      <p class="sub">Assuntos com pelo menos 2 questões feitas: 40% de acerto ou menos pede estudo; 70% ou mais é ponto forte. Use o treino por matéria para atacar os fracos.</p>
      ${resumoHTML(materias)}</section>` : ''}

    <section class="panel" style="margin-top:18px"><h2>Provas</h2>
      <p class="sub">${facilTotal ? `Ao todo, ${facilTotal} questões “fáceis para a sua nota” ficaram erradas ou em branco — são as que mais custam na TRI.` : ''}</p>
      <div class="table-wrap"><table class="qtable"><thead><tr><th>Data</th><th>Prova</th><th>Notas</th><th>Acertos</th><th>Fáceis erradas</th><th></th></tr></thead><tbody>
      ${[...runs].reverse().map(({ a, st, when }) => `<tr><td>${shortDate(when)}</td><td>${esc(nomeProva(a))}</td>
        <td>${st.areas.map(x => `${AREAS[x.name].name.split(' ').at(-1)} <b>${nota(st.tri[x.name]?.nota)}</b>`).join(' · ')}</td>
        <td>${st.certas}/${st.total}</td><td>${st.facilErrada.length}</td><td><a href="#/resultado/${a.id}">análise</a></td></tr>`).join('')}
      </tbody></table></div>
    </section>
  </div>`);
  app.append(el);
  window.scrollTo(0, 0);

  el.querySelector('.redo-all')?.addEventListener('click', async () => {
    const items = pendentes.map(p => p.item).sort((x, y) => y.year - x.year || x.day - y.day || parseInt(x.id, 10) - parseInt(y.id, 10));
    const a = await newTreino(items, { titulo: 'Caderno de erros', materia: 'Todas as matérias' });
    location.hash = `#/prova/${a.id}`;
  });
  const detail = el.querySelector('.heat-detail');
  const showHab = k => {
    const g = habs.get(k);
    el.querySelectorAll('.cell').forEach(c => c.classList.toggle('sel', c.dataset.k === k));
    detail.innerHTML = `<div class="hab"><div class="hab-head"><span class="hab-code">H${g.hab}</span><span class="muted">${AREAS[g.area].name}${g.comp ? ` · competência ${g.comp}` : ''}</span>
      <span class="hab-count tabular">${g.total ? `${g.erros} de ${g.total}` : 'não cobrada'}</span></div><p>${esc(g.desc)}</p>
      <div class="hab-qs">${g.qs.map(({ attempt, q }) => `<a href="#/revisao/${attempt.id}/${q.id}" class="badge ${STATUS_CLS[q.status]}" title="${attempt.year} · questão ${q.n}">${attempt.year} · Q${q.n}</a>`).join('') || '<span class="muted">Ainda não apareceu nas suas provas.</span>'}</div></div>`;
  };
  el.querySelector('.heat').addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) showHab(c.dataset.k); });
  el.querySelector('.prio').addEventListener('click', e => {
    const li = e.target.closest('li[data-k]');
    if (!li) return;
    showHab(li.dataset.k);
    detail.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  if (prio[0]) showHab(`${prio[0].area}-${prio[0].hab}`);

  if (lastPerArea.length) notasChart(el.querySelector('#notas-chart'), runs, series);
}

function notasChart(host, allRuns, series) {
  // só as provas completas têm nota TRI; os treinos ficam fora do gráfico
  const runs = allRuns.filter(r => r.a.mode !== 'treino');
  const pos = new Map(runs.map((r, i) => [r, i]));
  const W = 960, H = 260, L = 44, R = 70, T = 14, B = 40;
  const all = Object.values(series).flat().map(p => p.nota);
  const lo = Math.floor((Math.min(...all) - 30) / 50) * 50, hi = Math.ceil((Math.max(...all) + 30) / 50) * 50;
  const n = runs.length;
  const x = i => (n === 1 ? L + (W - L - R) / 2 : L + ((W - L - R) * i) / (n - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = [];
  for (let v = lo; v <= hi; v += 50) ticks.push(v);
  const pts = [];
  const lines = AREA_ORDER.filter(a => series[a].length).map(a => {
    const s = series[a];
    s.forEach(p => pts.push({ ...p, a, cx: x(pos.get(p.r)), cy: y(p.nota) }));
    const d = s.map((p, i) => `${i ? 'L' : 'M'}${x(pos.get(p.r)).toFixed(1)},${y(p.nota).toFixed(1)}`).join(' ');
    const last = s.at(-1);
    return `<path d="${d}" fill="none" stroke="${SERIES[a]}" stroke-width="2" stroke-linejoin="round"/>
 <text x="${x(pos.get(last.r)) + 10}" y="${y(last.nota) + 4}" class="end-label">${AREAS[a].name.split(' ').at(-1)} ${Math.round(last.nota)}</text>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Notas TRI por área ao longo das provas">
    <g class="grid">${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map(v => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${runs.map((r, i) => `<text x="${x(i)}" y="${H - 22}" text-anchor="middle">${shortDate(r.when)}</text><text x="${x(i)}" y="${H - 8}" text-anchor="middle">${r.a.year} · ${r.a.day}º</text>`).join('')}</g>
    ${lines}
    ${pts.map((p, i) => `<circle class="pt" data-i="${i}" cx="${p.cx.toFixed(1)}" cy="${p.cy.toFixed(1)}" r="5" fill="${SERIES[p.a]}" stroke="var(--surface)" stroke-width="2"/>`).join('')}
  </svg>`;
  const svg = host.querySelector('svg');
  const tip = h('<div class="tip hidden"></div>');
  host.append(tip);
  svg.addEventListener('mousemove', e => {
    const c = e.target.closest('.pt');
    if (!c) return tip.classList.add('hidden');
    const p = pts[+c.dataset.i], box = svg.getBoundingClientRect();
    tip.innerHTML = `<b>${AREAS[p.a].name}: ${Math.round(p.nota)}</b><br>${esc(nomeProva(p.r.a))}, ${shortDate(p.r.when)}<br>${p.area.certas}/${p.area.total} acertos`;
    tip.style.left = `${p.cx * (box.width / W)}px`;
    tip.style.top = `${(p.cy - 6) * (box.height / H)}px`;
    tip.classList.remove('hidden');
  });
  svg.addEventListener('mouseleave', () => tip.classList.add('hidden'));
  svg.addEventListener('click', e => { const c = e.target.closest('.pt'); if (c) location.hash = `#/resultado/${pts[+c.dataset.i].r.a.id}`; });
}
