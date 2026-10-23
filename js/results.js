// Tela de resultado: acertos, onde errou mais, tempo por questão, ritmo e lista detalhada.
import { DAYS, LANGS, AREAS, loadExam } from './data.js';
import { computeStats } from './stats.js';
import { h, icon, clock, dur, pct, fmtPct, esc } from './ui.js';

const nota = v => (v == null ? '—' : v.toFixed(1).replace('.', ','));

const STATUS = {
  certa: { label: 'Certa', cls: 'good', color: 'var(--good)' },
  errada: { label: 'Errada', cls: 'bad', color: 'var(--bad)' },
  branco: { label: 'Em branco', cls: 'blank', color: 'var(--blank)' },
  anulada: { label: 'Anulada', cls: 'null', color: 'var(--line-2)' },
};

export async function resultsScreen(app, attempt, { go }) {
  const exam = await loadExam(attempt.year, attempt.day, attempt.lang);
  const st = computeStats(exam, attempt);
  const day = DAYS[attempt.day];
  const reviewLink = qid => `#/revisao/${attempt.id}/${qid}`;
  const qLabel = q => `${q.n}${attempt.day === 1 && q.n <= 5 ? ` (${LANGS[attempt.lang].slice(0, 3)})` : ''}`;
  const qMeta = q => esc([q.hab ? `H${q.hab}` : null, q.disciplina || AREAS[q.area].name, q.nivel ? `dificuldade ${q.nivel}` : null, q.ans ? `marcou ${q.ans}` : 'em branco', `gabarito ${q.key}`].filter(Boolean).join(' · '));
  const hasTri = st.notaMedia != null;
  const hasDisc = st.disciplinas.length > 0;

  const qItem = (q, extra = '') => `<li><a class="qn" href="${reviewLink(q.id)}">Q${qLabel(q)}</a>
    <span class="meta">${qMeta(q)}</span>${extra}<span class="badge ${STATUS[q.status].cls}">${STATUS[q.status].label}</span>
    <span class="time">${dur(q.time)}</span></li>`;
  const list = (arr, n = 5, extra) => (arr.length ? `<ul class="qlist">${arr.slice(0, n).map(q => qItem(q, extra?.(q))).join('')}</ul>` : '<p class="empty">Nenhuma questão aqui.</p>');
  const chanceTag = q => `<span class="muted tabular" title="chance de acerto de quem tem a sua nota">${Math.round(q.chance * 100)}%</span>`;

  const stackBar = (g, errors = false) => {
    const seg = (v, color) => (v ? `<div class="fill" style="width:${(v / g.total) * 100}%;background:${color}"></div>` : '');
    return `<div class="hbar" title="${esc(g.label || g.name)}: ${g.certas} certas, ${g.erradas} erradas, ${g.branco} em branco">
      <span class="name">${esc(g.label || g.name)}</span>
      <div class="track">${seg(g.certas, 'var(--good)')}${seg(g.erradas, 'var(--bad)')}${seg(g.branco, 'var(--blank)')}</div>
      <span class="val">${errors ? `${g.erradas + g.branco} de ${g.total} · ${fmtPct(pct(g.erradas + g.branco, g.total))} erro` : `${g.certas}/${g.total} · ${fmtPct(pct(g.certas, g.total))}`}</span></div>`;
  };
  const legend = `<div class="legend"><span><i style="background:var(--good)"></i>Certas</span><span><i style="background:var(--bad)"></i>Erradas</span><span><i style="background:var(--blank)"></i>Em branco</span></div>`;

  const worstArea = [...st.areas].sort((a, b) => a.certas / a.total - b.certas / b.total)[0];
  const date = new Date(attempt.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  app.innerHTML = '';
  const el = h(`<div class="results">
    <div class="results-top">
      <a class="btn ghost sm" href="#/">${icon.back} Início</a>
      <h1>ENEM ${attempt.year}, ${day.label}</h1>
      <span class="muted">${date}${attempt.day === 1 ? `, ${LANGS[attempt.lang]}` : ''}</span>
      <a class="btn sm" href="${reviewLink(exam.ids[0])}">${icon.eye} Revisar no caderno</a>
      <a class="btn sm" href="#/evolucao">Sua evolução</a>
    </div>

    ${hasTri ? `<section class="boletim">
      <div class="boletim-main">
        <table>
          <thead><tr><th>Área</th><th class="num">Acertos</th><th class="num">Nota TRI</th><th class="hide-sm"></th></tr></thead>
          <tbody>
          ${st.areas.map(a => `<tr><td class="area">${a.label}</td><td class="num">${a.certas} de ${a.total}</td>
            <td class="num nota">${nota(st.tri[a.name]?.nota)}</td>
            <td class="gain">${st.tri[a.name]?.ganho >= 1 ? `+${Math.round(st.tri[a.name].ganho)} com as fáceis` : ''}</td></tr>`).join('')}
          <tr class="total"><td class="area">Média das áreas</td><td class="num">${st.certas} de ${st.total}</td><td class="num nota">${nota(st.notaMedia)}</td><td></td></tr>
          </tbody>
        </table>
        <p class="method">Estimativa com os parâmetros oficiais de cada questão, pelo mesmo método do INEP.</p>
      </div>
      <aside class="boletim-side">
        <div class="stat"><div class="k">Tempo de prova</div><div class="v">${clock(st.elapsed)}</div>
          <div class="s">${!attempt.limitSec ? 'sem limite' : st.elapsed > attempt.limitSec ? `passou ${dur(st.elapsed - attempt.limitSec)} do limite` : `sobraram ${dur(attempt.limitSec - st.elapsed)}`}</div></div>
        <div class="stat"><div class="k">Por questão</div><div class="v">${clock(st.avg, false)}</div><div class="s">em média${attempt.limitSec ? `; o ritmo para terminar no tempo é ${clock(attempt.limitSec / exam.ids.length, false)}` : ''}</div></div>
        <div class="stat"><div class="k">Erradas e em branco</div><div class="v">${st.erradas + st.branco}</div><div class="s">${st.branco} em branco${st.anuladas ? `, ${st.anuladas} anulada${st.anuladas > 1 ? 's' : ''} fora da conta` : ''}</div></div>
      </aside>
    </section>` : `<div class="hero">
      <div class="tile big"><div class="k">Acertos</div><div class="v tabular">${st.certas}<small>/${st.total}</small></div>
        <div class="s">${fmtPct(pct(st.certas, st.total))} de aproveitamento${st.anuladas ? `, ${st.anuladas} anulada${st.anuladas > 1 ? 's' : ''} fora da conta` : ''}</div></div>
      <div class="tile"><div class="k">Tempo de prova</div><div class="v tabular">${clock(st.elapsed)}</div>
        <div class="s">${!attempt.limitSec ? 'sem limite' : st.elapsed > attempt.limitSec ? `passou ${dur(st.elapsed - attempt.limitSec)} do limite` : `sobraram ${dur(attempt.limitSec - st.elapsed)}`}</div></div>
      <div class="tile"><div class="k">Por questão</div><div class="v tabular">${clock(st.avg, false)}</div><div class="s">em média</div></div>
      <div class="tile"><div class="k">Erradas</div><div class="v tabular">${st.erradas}</div><div class="s">${st.branco} em branco</div></div>
      <div class="tile"><div class="k">Trocas de resposta</div><div class="v tabular">${st.changeStats.total}</div><div class="s">${st.changeStats.paraCerta} viraram certa</div></div>
    </div>`}

    ${hasTri ? `<section class="panel"><h2>Dificuldade × resultado</h2>
      <p class="sub">Cada ponto é uma questão, posicionada pela dificuldade oficial (parâmetro da TRI, na escala da nota). A linha é a sua nota.
        Na TRI, o coerente é acertar o que está à esquerda da linha — erros ali são os que mais derrubam a nota.</p>
      <div class="legend"><span><i style="background:var(--good)"></i>Certa</span><span><i style="background:var(--bad)"></i>Errada</span><span><i style="background:var(--blank)"></i>Em branco</span><span><i style="background:transparent;border-left:2px solid var(--ink);border-radius:0;width:0;height:12px"></i>Sua nota</span></div>
      <div class="chart-scroll"><div class="chart" id="dif-chart"></div></div>
    </section>` : ''}

    <div class="grid2">
      <section class="panel"><h2>Matérias que você mais errou</h2>
        <p class="sub">${hasDisc ? 'Erradas e em branco, da pior para a melhor. A matéria de cada questão é uma classificação automática, aproximada.' : 'Sem classificação por matéria para esta prova.'}</p>
        ${hasDisc ? legend + st.disciplinas.map(g => stackBar(g, true)).join('') : ''}
      </section>
      <section class="panel"><h2>${hasTri ? 'Como você fez a prova' : 'Por área'}</h2>
        ${hasTri ? '' : `<p class="sub">${worstArea ? `Seu ponto mais fraco nesta prova: <b>${worstArea.label}</b>.` : ''}</p>${legend}${st.areas.map(g => stackBar(g)).join('')}`}
        <dl class="facts">
          ${st.areas.map(a => `<div><dt>Tempo médio em ${a.label}</dt><dd>${clock(a.avg, false)}</dd></div>`).join('')}
          <div><dt>Trocas de resposta</dt><dd>${st.changeStats.total}</dd></div>
          <div><dt>Trocas que viraram acerto</dt><dd>${st.changeStats.paraCerta}</dd></div>
          <div><dt>Trocas que viraram erro</dt><dd>${st.changeStats.paraErrada}</dd></div>
          <div><dt>Marcadas para revisar</dt><dd>${st.flagged}</dd></div>
          <div><dt>Em branco</dt><dd>${st.branco}</dd></div>
        </dl>
      </section>
    </div>

    <section class="panel"><h2>Tempo em cada questão</h2>
      <p class="sub">Altura = tempo gasto; cor = resultado. Passe o mouse para detalhes e clique para abrir a questão no caderno.</p>
      <div class="legend"><span><i style="background:var(--good)"></i>Certa</span><span><i style="background:var(--bad)"></i>Errada</span><span><i style="background:var(--blank)"></i>Em branco</span><span><i style="background:transparent;border-top:2px dashed var(--ink-2);border-radius:0;height:0"></i>Sua mediana</span></div>
      <div class="chart-scroll"><div class="chart" id="time-chart"></div></div>
    </section>

    ${st.habilidades.length ? `<section class="panel" style="margin-top:18px"><h2>Habilidades que você mais errou</h2>
      <p class="sub">Habilidades oficiais da Matriz de Referência do ENEM cobradas nesta prova (erradas + em branco).</p>
      <div class="habs">${st.habilidades.filter(g => g.erros).slice(0, 8).map(g => `
        <div class="hab"><div class="hab-head"><span class="hab-code">H${g.hab}</span><span class="muted">${AREAS[g.area].name}</span>
          <span class="hab-count tabular">${g.erros} de ${g.total}</span></div>
          <p>${esc(g.desc || '')}</p>
          <div class="hab-qs">${g.qs.map(q => `<a href="${reviewLink(q.id)}" class="badge ${STATUS[q.status].cls}" title="${STATUS[q.status].label}">Q${q.n}</a>`).join('')}</div></div>`).join('') || '<p class="empty">Você não errou nenhuma habilidade.</p>'}</div>
    </section>` : ''}

    <div class="insights" style="margin-top:18px">
      ${hasTri ? `<section class="panel insight"><h3>Fáceis que você errou</h3><p class="why">Quem tem a sua nota acerta estas com a chance indicada. Na TRI, são os erros que mais custam — revisar estas é o caminho mais rápido para subir.${
        st.areas.filter(a => st.tri[a.name]?.ganho >= 1).map(a => ` Acertando as de ${a.label}: <b>+${Math.round(st.tri[a.name].ganho)} pontos</b>.`).join('')}</p>${list(st.facilErrada, 6, chanceTag)}</section>
      <section class="panel insight"><h3>Difíceis que você acertou</h3><p class="why">Acertos improváveis para a sua nota. Se foram chute, a TRI desconfia e eles valem pouco; se você sabia, é sinal de que dá para ir além.</p>${list(st.dificilCerta, 6, chanceTag)}</section>` : ''}
      <section class="panel insight"><h3>Onde você passou mais tempo</h3><p class="why">As questões que mais consumiram sua prova.</p>${list(st.slowest)}</section>
      <section class="panel insight"><h3>Menos dificuldade</h3><p class="why">Acertou rápido — conteúdo dominado.</p>${list(st.easy)}</section>
      <section class="panel insight"><h3>Erros demorados</h3><p class="why">Você investiu tempo e mesmo assim errou: são os conteúdos para estudar primeiro.</p>${list(st.slowWrong)}</section>
      <section class="panel insight"><h3>Erros rápidos</h3><p class="why">Errou gastando bem menos que o seu normal: pressa, leitura apressada ou chute.</p>${list(st.quickWrong)}</section>
    </div>

    <section class="panel"><h2>Ritmo de prova</h2>
      <p class="sub">Questões respondidas ao longo do tempo, comparado ao ritmo necessário para fechar a prova no tempo${attempt.day === 1 ? ' (sem descontar a redação)' : ''}.</p>
      <div class="legend"><span><i style="background:var(--series-1)"></i>Você</span><span><i style="background:transparent;border-top:2px dashed var(--muted);border-radius:0;height:0"></i>Ritmo para terminar no tempo</span></div>
      <div class="chart-scroll"><div class="chart" id="pace-chart"></div></div>
    </section>

    <section class="panel"><h2>Todas as questões</h2>
      <div class="filters">${[['todas', 'Todas'], ['errada', 'Erradas'], ['certa', 'Certas'], ['branco', 'Em branco'], ...(hasTri ? [['facil', 'Fáceis que errou']] : []), ['flag', 'Marcadas p/ revisar'], ['troca', 'Trocou resposta']]
        .map(([k, l], i) => `<button class="chip" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
      <div class="table-wrap"><table class="qtable"><thead><tr><th>Questão</th><th>Matéria</th><th>Habilidade</th><th>Dificuldade</th><th>Sua</th><th>Gabarito</th><th>Resultado</th><th>Tempo</th><th></th></tr></thead><tbody></tbody></table></div>
      <p class="note">${hasTri ? `A nota usa o mesmo modelo do INEP (TRI de 3 parâmetros, estimativa EAP) com os parâmetros oficiais de cada questão publicados nos microdados. Conferida contra as notas reais de ~150 mil participantes de 2021 a 2025: diferença média de 0,03 ponto. Questões anuladas, ou retiradas do cálculo pelo INEP, não entram na nota; em branco conta como erro.` : 'Questões anuladas pelo INEP não entram na conta.'}</p>
    </section>
  </div>`);
  app.append(el);
  window.scrollTo(0, 0);

  // tabela
  const tbody = el.querySelector('.qtable tbody');
  const renderTable = f => {
    const facil = new Set(st.facilErrada.map(q => q.id));
    const rows = st.qs.filter(q => f === 'todas' || (f === 'flag' ? q.flagged : f === 'troca' ? q.changes > 0 : f === 'facil' ? facil.has(q.id) : q.status === f));
    tbody.innerHTML = rows.map(q => `<tr>
      <td><b>${qLabel(q)}</b>${q.flagged ? ' <span title="marcada p/ revisar" style="color:var(--warn)">⚑</span>' : ''}</td>
      <td>${esc(q.disciplina || AREAS[q.area].name)}</td>
      <td>${q.hab ? `<span title="${esc(q.habDesc || '')}">H${q.hab}</span>` : '—'}</td>
      <td>${q.dif ? `${Math.round(q.dif)} <span class="muted">${q.nivel}</span>` : q.status === 'anulada' ? '—' : '<span class="muted" title="O INEP retirou este item do cálculo da nota">fora da TRI</span>'}</td>
      <td class="ans">${q.ans || '—'}${q.changes ? ` <span class="muted" title="trocou de resposta">(${q.changes}×)</span>` : ''}</td>
      <td class="ans">${q.key === 'X' ? 'anulada' : q.key}</td>
      <td><span class="badge ${STATUS[q.status].cls}">${STATUS[q.status].label}</span></td>
      <td>${clock(q.time, false)}</td>
      <td><a href="${reviewLink(q.id)}">ver</a></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Nada aqui.</td></tr>';
  };
  el.querySelector('.filters').addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    el.querySelectorAll('.filters .chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    renderTable(b.dataset.f);
  });
  renderTable('todas');

  timeChart(el.querySelector('#time-chart'), st, q => go(reviewLink(q.id)), qLabel);
  if (hasTri) difChart(el.querySelector('#dif-chart'), st, q => go(reviewLink(q.id)), qLabel);
  paceChart(el.querySelector('#pace-chart'), st, attempt, exam.ids.length);
}

// ---------- gráficos (SVG simples, com tooltip) ----------
function tooltip(host) {
  const tip = h('<div class="tip hidden"></div>');
  host.append(tip);
  return {
    show(html, x, y) { tip.innerHTML = html; tip.style.left = `${x}px`; tip.style.top = `${y}px`; tip.classList.remove('hidden'); },
    hide() { tip.classList.add('hidden'); },
  };
}

function niceMax(v, steps = 4) {
  const raw = v / steps;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = [1, 2, 2.5, 5, 10].find(m => m * mag >= raw) * mag;
  return n * steps;
}

function timeChart(host, st, onClick, qLabel) {
  const W = 960, H = 240, L = 40, R = 8, T = 10, B = 26;
  const qs = st.qs;
  const maxMin = niceMax(Math.max(3, ...qs.map(q => q.time / 60)));
  const bw = (W - L - R) / qs.length;
  const y = m => T + (H - T - B) * (1 - m / maxMin);
  const ticks = [0, 1, 2, 3, 4].map(i => (maxMin / 4) * i);
  const bars = qs.map((q, i) => {
    const x = L + i * bw;
    const top = y(q.time / 60);
    const hgt = Math.max(H - B - top, q.time > 0 ? 2 : 0);
    const r = Math.min(4, (bw - 2) / 2);
    const color = STATUS[q.status].color;
    return `<path d="M${x + 1},${H - B} V${H - B - hgt + r} q0,-${r} ${r},-${r} h${bw - 2 - 2 * r} q${r},0 ${r},${r} V${H - B} Z" fill="${color}"/>
      <rect class="hit" data-i="${i}" x="${x}" y="${T}" width="${bw}" height="${H - T - B}"/>`;
  }).join('');
  const xLabels = qs.filter((q, i) => i % 5 === 0 || i === qs.length - 1).map(q => {
    const i = qs.indexOf(q);
    return `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${q.n}</text>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tempo por questão">
    <g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
    <g class="axis">${ticks.map(t => `<text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t % 1 ? t.toFixed(1).replace('.', ',') : t} min</text>`).join('')}${xLabels}</g>
    ${bars}
    <line x1="${L}" x2="${W - R}" y1="${y(st.median / 60)}" y2="${y(st.median / 60)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/>
  </svg>`;
  const tip = tooltip(host);
  const svg = host.querySelector('svg');
  svg.addEventListener('mousemove', e => {
    const r = e.target.closest('.hit');
    if (!r) return tip.hide();
    const q = qs[+r.dataset.i];
    const box = svg.getBoundingClientRect();
    const sx = box.width / W;
    tip.show(`<b>Questão ${qLabel(q)}</b> · ${STATUS[q.status].label}<br>Tempo: ${dur(q.time)}<br>Sua: ${q.ans || '—'} · Gabarito: ${q.key === 'X' ? 'anulada' : q.key}${q.dif ? `<br>Dificuldade ${Math.round(q.dif)} (${q.nivel})` : ''}${q.disciplina ? `<br>${esc(q.disciplina)}` : ''}`,
      (+r.getAttribute('x') + bw / 2) * sx, y(q.time / 60) * (box.height / H));
  });
  svg.addEventListener('mouseleave', () => tip.hide());
  svg.addEventListener('click', e => { const r = e.target.closest('.hit'); if (r) onClick(qs[+r.dataset.i]); });
}

function paceChart(host, st, attempt, total) {
  const W = 960, H = 240, L = 40, R = 16, T = 10, B = 26;
  const end = Math.max(attempt.limitSec || 0, st.elapsed, 60);
  const xMax = Math.ceil(end / 1800) * 1800;
  const x = t => L + (W - L - R) * (t / xMax);
  const y = n => T + (H - T - B) * (1 - n / total);
  const pts = [[0, 0], ...st.pace];
  const line = pts.map(([t, n], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  const goal = attempt.limitSec || st.elapsed;
  const xt = [];
  for (let t = 0; t <= xMax; t += 1800) xt.push(t);
  const yt = [0, 15, 30, 45, 60, 75, 90].filter(n => n <= total);
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ritmo de prova">
    <g class="grid">${yt.map(n => `<line x1="${L}" x2="${W - R}" y1="${y(n)}" y2="${y(n)}"/>`).join('')}</g>
    <g class="axis">${yt.map(n => `<text x="${L - 6}" y="${y(n) + 4}" text-anchor="end">${n}</text>`).join('')}
      ${xt.map(t => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle">${clock(t).slice(0, -3)}</text>`).join('')}</g>
    <line x1="${x(0)}" y1="${y(0)}" x2="${x(goal)}" y2="${y(total)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>
    <path d="${line}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round"/>
    <line class="cross" y1="${T}" y2="${H - B}" stroke="var(--line-2)" visibility="hidden"/>
    <circle class="dot" r="4.5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
    <rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/>
  </svg>`;
  const svg = host.querySelector('svg');
  const tip = tooltip(host);
  const cross = svg.querySelector('.cross'), dot = svg.querySelector('.dot');
  svg.addEventListener('mousemove', e => {
    const box = svg.getBoundingClientRect();
    const t = ((e.clientX - box.left) / box.width * W - L) / (W - L - R) * xMax;
    if (t < 0 || t > xMax) return;
    const n = pts.filter(p => p[0] <= t).at(-1)?.[1] ?? 0;
    const ideal = Math.min(total, Math.round((t / goal) * total));
    cross.setAttribute('x1', x(t)); cross.setAttribute('x2', x(t)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(t)); dot.setAttribute('cy', y(n)); dot.setAttribute('visibility', 'visible');
    tip.show(`<b>${clock(t)}</b><br>Você: ${n} respondidas<br>Ritmo ideal: ${ideal}`, x(t) * (box.width / W), y(n) * (box.height / H));
  });
  svg.addEventListener('mouseleave', () => { tip.hide(); cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
}

// Faixa por área: questões no eixo de dificuldade (escala da nota), cor = resultado, linha = sua nota.
function difChart(host, st, onClick, qLabel) {
  const areas = st.areas.map(a => a.name).filter(a => st.tri[a]);
  const W = 960, L = 150, R = 16, T = 8, B = 28, rad = 5, gap = 1.5;
  const qs = st.qs.filter(q => q.dif);
  // eixo da escala do ENEM; itens fora (muito fáceis ou muito difíceis) ficam presos na borda
  const lo = 300, hi = 1000;
  const x = v => L + (W - L - R) * ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
  const ticks = [];
  for (let v = lo; v <= hi; v += 100) ticks.push(v);
  // empilha os pontos que se sobrepõem (beeswarm) e calcula a altura de cada faixa
  const rows = areas.map(a => {
    const placed = [];
    for (const q of qs.filter(q => q.area === a).sort((p, r) => p.dif - r.dif)) {
      const cx = x(q.dif);
      let k = 0, dy;
      do { dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (rad * 2 + gap); k++; }
      while (placed.some(p => Math.abs(p.cx - cx) < rad * 2 + gap && Math.abs(p.dy - dy) < rad * 2 + gap));
      placed.push({ q, cx, dy });
    }
    const half = Math.max(30, ...placed.map(p => Math.abs(p.dy) + rad + 6));
    return { a, placed, half };
  });
  let yAcc = T;
  const dots = [];
  for (const r of rows) {
    r.mid = yAcc + r.half;
    r.top = yAcc;
    yAcc += r.half * 2;
    r.bottom = yAcc;
    for (const p of r.placed) dots.push({ q: p.q, cx: p.cx, cy: r.mid + p.dy });
  }
  const H = yAcc + B;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dificuldade das questões e resultado">
    <g class="grid">${ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - B}"/>`).join('')}</g>
    <g class="axis">${ticks.map(v => `<text x="${x(v)}" y="${H - 9}" text-anchor="middle">${v === hi ? `${v}+` : v}</text>`).join('')}
      ${rows.map(r => `<text x="0" y="${r.mid - 3}" style="font-size:14px;font-weight:650;fill:var(--ink)">${AREAS[r.a].name}</text>
        <text x="0" y="${r.mid + 14}">sua nota ${nota(st.tri[r.a].nota)}</text>`).join('')}</g>
    ${rows.slice(1).map(r => `<line x1="0" x2="${W - R}" y1="${r.top}" y2="${r.top}" stroke="var(--line)"/>`).join('')}
    ${rows.map(r => `<line x1="${x(st.tri[r.a].nota)}" x2="${x(st.tri[r.a].nota)}" y1="${r.top + 4}" y2="${r.bottom - 4}" stroke="var(--ink)" stroke-width="2"/>`).join('')}
    ${dots.map((d, i) => `<circle class="pt" data-i="${i}" cx="${d.cx.toFixed(1)}" cy="${d.cy.toFixed(1)}" r="${rad}" fill="${STATUS[d.q.status].color}" stroke="var(--surface)" stroke-width="2" style="cursor:pointer"/>`).join('')}
  </svg>`;
  const svg = host.querySelector('svg');
  const tip = tooltip(host);
  svg.addEventListener('mousemove', e => {
    const c = e.target.closest('.pt');
    if (!c) return tip.hide();
    const d = dots[+c.dataset.i], q = d.q, box = svg.getBoundingClientRect();
    tip.show(`<b>Questão ${qLabel(q)}</b> · ${STATUS[q.status].label}<br>Dificuldade ${Math.round(q.dif)} (${q.nivel})<br>Chance de acerto p/ sua nota: ${Math.round(q.chance * 100)}%${q.hab ? `<br>Habilidade H${q.hab}` : ''}`,
      d.cx * (box.width / W), (d.cy - rad) * (box.height / H));
  });
  svg.addEventListener('mouseleave', () => tip.hide());
  svg.addEventListener('click', e => { const c = e.target.closest('.pt'); if (c) onClick(dots[+c.dataset.i].q); });
}
