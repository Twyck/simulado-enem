// Entrada do app: rotas (início, prova, resultado, revisão) e tela inicial.
import { YEARS, DAYS, LANGS, pdfLocal, pdfInep, loadExam } from './data.js';
import { listAttempts, saveAttempt, getAttempt, deleteAttempt } from './store.js';
import { examScreen } from './exam.js';
import { resultsScreen } from './results.js';
import { evolutionScreen } from './evolution.js';
import { introHTML, mountIntro } from './intro.js';
import { computeStats } from './stats.js';
import { h, icon, clock, pct, fmtPct, modal, toast, esc } from './ui.js';

const app = document.getElementById('app');
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

const prefs = (() => {
  try { return JSON.parse(localStorage.getItem('prefs')) || {}; } catch { return {}; }
})();
const savePrefs = () => { try { localStorage.setItem('prefs', JSON.stringify(prefs)); } catch { /* sem storage */ } };

let leave = null;
const setLeave = fn => { leave = fn; };

async function route() {
  leave?.();
  leave = null;
  const [, view, id, q] = location.hash.split('/');
  try {
    if (view === 'prova' && id) {
      const a = await getAttempt(id);
      if (!a) return go('#/');
      if (a.status === 'done') return go(`#/resultado/${id}`);
      return examScreen(app, a, { go, setLeave });
    }
    if (view === 'resultado' && id) {
      const a = await getAttempt(id);
      return a ? resultsScreen(app, a, { go }) : go('#/');
    }
    if (view === 'evolucao') return evolutionScreen(app);
    if (view === 'sobre') return home({ intro: true });
    if (view === 'revisao' && id) {
      const a = await getAttempt(id);
      return a ? examScreen(app, a, { review: true, focusQ: q ? decodeURIComponent(q) : null, go, setLeave }) : go('#/');
    }
    return home();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="home"><div class="card"><h2>Algo deu errado</h2><p class="muted">${esc(e.message)}</p><a class="btn" href="#/">Voltar</a></div></div>`;
  }
}

async function home({ intro = false } = {}) {
  const attempts = await listAttempts();
  const sel = {
    year: prefs.year ?? YEARS[0],
    day: prefs.day ?? 1,
    lang: prefs.lang ?? 'en',
    time: prefs.time ?? 'oficial',
    custom: prefs.custom ?? 180,
  };
  const running = attempts.filter(a => a.status !== 'done');
  const done = attempts.filter(a => a.status === 'done');

  // primeira visita (nenhuma prova) ou #/sobre: apresentação completa antes do formulário
  const showIntro = intro || attempts.length === 0;
  app.innerHTML = '';
  if (showIntro) {
    app.append(h(`<nav class="l-nav"><a class="brand" href="#/"><img src="icons/icon.svg" alt="">Simulado ENEM</a>
      <a class="l-nav-cta" href="#nova">Fazer uma prova</a></nav>`));
    const landing = h(introHTML());
    app.append(landing);
    mountIntro(landing);
    app.querySelector('.l-nav-cta').addEventListener('click', e => { e.preventDefault(); document.getElementById('nova')?.scrollIntoView({ behavior: 'smooth' }); });
  }
  const oval = '<i class="oval" aria-hidden="true"></i>';
  const el = h(`<div class="home ${showIntro ? 'after-intro' : ''}">
    ${showIntro ? '' : `<header class="topbar">
      <a class="brand" href="#/"><img src="icons/icon.svg" alt="">Simulado ENEM</a>
      <nav class="row-actions"><a class="btn sm ghost" href="#/sobre">Sobre o app</a>${done.length ? '<a class="btn sm" href="#/evolucao">Sua evolução</a>' : ''}</nav>
    </header>

    <section class="intro">
      <h1>A prova oficial, do jeito que cai no dia.</h1>
      <p>Os cadernos do INEP de 2021 a 2025 na tela, com cartão-resposta, cronômetro e nota calculada pela TRI como a oficial.</p>
    </section>`}

    ${running.length ? `<section class="section"><h2>Continue de onde parou</h2>${running.map(a => `
      <div class="resume"><div><b>ENEM ${a.year}, ${DAYS[a.day].label}</b>
        <div class="meta">${Object.keys(a.answers || {}).length} de 90 respondidas, ${clock(a.elapsed)} de prova</div></div>
        <div class="row-actions"><button class="btn sm ghost danger" data-del="${a.id}" title="Excluir">${icon.trash}</button><a class="btn primary sm" href="#/prova/${a.id}">Continuar prova</a></div></div>`).join('')}</section>` : ''}

    <section class="section" id="nova">
      <div class="answer-form timing">
        <div class="form-head"><h2>Nova prova</h2><span class="code">Caderno Azul</span></div>
        <div class="field"><span class="label">Ano</span><div class="choices years">${YEARS.map(y => `<button class="choice" data-year="${y}">${oval}<span>${y}</span></button>`).join('')}</div></div>
        <div class="field"><span class="label">Dia</span><div class="choices days">${Object.entries(DAYS).map(([d, v]) => `
          <button class="choice" data-day="${d}">${oval}<span>${v.label}<span class="sub">${v.note.replace(' (+ redação)', '')}, 90 questões em ${clock(v.minutes * 60).slice(0, -3).replace(':', 'h')}</span></span></button>`).join('')}</div></div>
        <div class="field lang-field"><span class="label">Língua<small>questões 1 a 5</small></span><div class="choices langs">${Object.entries(LANGS).map(([k, v]) => `<button class="choice" data-lang="${k}">${oval}<span>${v}</span></button>`).join('')}</div></div>
        <div class="field"><span class="label">Tempo</span><div class="choices time-row">
          <button class="choice" data-time="oficial">${oval}<span>Oficial</span></button>
          <button class="choice" data-time="livre">${oval}<span>Sem limite</span></button>
          <button class="choice" data-time="custom">${oval}<span>Personalizado</span></button>
          <input type="number" min="10" max="600" step="5" class="custom" aria-label="Minutos"> <span class="muted custom-l">minutos</span></div></div>
        <div class="start-row"><span class="src">Você resolve no <a class="src-link" target="_blank" rel="noopener">PDF oficial do INEP</a>, marcando direto nas alternativas.</span>
          <button class="btn primary start">Começar prova</button></div>
      </div>
    </section>

    <section class="section ${showIntro && !done.length ? 'hidden' : ''}">
      <div class="section-head"><h2>Histórico</h2>${done.length ? '<a href="#/evolucao">Ver evolução</a>' : ''}</div>
      ${done.length ? `<table class="history"><thead><tr><th>Prova</th><th class="hide-sm">Data</th><th>Nota TRI</th><th class="hide-sm">Tempo</th><th></th></tr></thead><tbody>
      ${done.map(a => `<tr data-id="${a.id}"><td><b>${a.year}</b>, ${DAYS[a.day].label}</td><td class="hide-sm muted">${new Date(a.startedAt).toLocaleDateString('pt-BR')}</td>
        <td class="tabular score">…</td><td class="hide-sm tabular">${clock(a.elapsed)}</td>
        <td><a class="btn sm" href="#/resultado/${a.id}">Ver análise</a> <button class="btn sm ghost danger" data-del="${a.id}" title="Excluir">${icon.trash}</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">Entregue sua primeira prova para ver a nota e a análise aqui.</p>'}
    </section>

    <section class="section">
      <div class="offline-row"><p>Para usar sem internet, instale o app (menu do navegador, “Adicionar à tela de início”) e salve os cadernos no aparelho.</p>
      <div class="progress hidden"><i></i></div><button class="btn dl">${icon.download} Salvar as 10 provas</button></div>
    </section>

    <footer class="fine">Cadernos, gabaritos, parâmetros da TRI e Matriz de Referência: publicações oficiais do INEP (download.inep.gov.br).
      Este é um app independente de estudo, sem vínculo com o INEP ou o MEC.</footer>
  </div>`);
  app.append(el);

  const sync = () => {
    el.querySelectorAll('[data-year]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.year === sel.year));
    el.querySelectorAll('[data-day]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.day === sel.day));
    el.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === sel.lang));
    el.querySelectorAll('[data-time]').forEach(b => b.setAttribute('aria-pressed', b.dataset.time === sel.time));
    el.querySelector('.lang-field').classList.toggle('hidden', sel.day !== 1);
    el.querySelector('.custom').classList.toggle('hidden', sel.time !== 'custom');
    el.querySelector('.custom-l').classList.toggle('hidden', sel.time !== 'custom');
    el.querySelector('.custom').value = sel.custom;
    el.querySelector('[data-time="oficial"] span').textContent = `Oficial, ${clock(DAYS[sel.day].minutes * 60).slice(0, -3).replace(':', 'h')}`;
    el.querySelector('.src-link').href = pdfInep(sel.year, sel.day);
    Object.assign(prefs, sel);
    savePrefs();
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-year],[data-day],[data-lang],[data-time]');
    if (!b) return;
    if (b.dataset.year) sel.year = +b.dataset.year;
    if (b.dataset.day) sel.day = +b.dataset.day;
    if (b.dataset.lang) sel.lang = b.dataset.lang;
    if (b.dataset.time) sel.time = b.dataset.time;
    sync();
  });
  el.querySelector('.custom').addEventListener('change', e => { sel.custom = Math.max(10, +e.target.value || 180); sync(); });
  sync();

  el.querySelector('.start').onclick = async () => {
    const limitSec = sel.time === 'oficial' ? DAYS[sel.day].minutes * 60 : sel.time === 'custom' ? sel.custom * 60 : 0;
    const a = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      year: sel.year, day: sel.day, lang: sel.day === 1 ? sel.lang : null,
      limitSec, startedAt: Date.now(), elapsed: 0, status: 'running',
      answers: {}, crossed: {}, time: {}, changes: {}, flags: {}, history: [],
    };
    await saveAttempt(a);
    go(`#/prova/${a.id}`);
  };

  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async e => {
    e.preventDefault();
    const ok = await modal({ title: 'Excluir esta prova?', body: 'As respostas, anotações e a análise dela serão apagadas deste aparelho.', actions: [{ label: 'Cancelar', value: false }, { label: 'Excluir', value: true, kind: 'primary' }] });
    if (ok) { await deleteAttempt(b.dataset.del); home(); }
  }));

  el.querySelector('.dl').onclick = () => downloadAll(el);

  // pontuação no histórico
  for (const a of done) {
    loadExam(a.year, a.day, a.lang).then(ex => {
      const s = computeStats(ex, a);
      const cell = el.querySelector(`tr[data-id="${a.id}"] .score`);
      if (cell) cell.innerHTML = s.notaMedia != null
        ? `<b>${Math.round(s.notaMedia)}</b> <span class="muted">${s.certas} acertos</span>`
        : `<b>${s.certas}</b>/${s.total} <span class="muted">${fmtPct(pct(s.certas, s.total))}</span>`;
    });
  }
}

async function downloadAll(el) {
  if (!('caches' in window)) return toast('Este navegador não permite salvar offline');
  const bar = el.querySelector('.offline-row .progress');
  const btn = el.querySelector('.dl');
  bar.classList.remove('hidden');
  btn.disabled = true;
  const cache = await caches.open('enem-pdfs-v1');
  const jobs = [];
  for (const y of YEARS) for (const d of [1, 2]) jobs.push([y, d]);
  let done = 0, failed = 0;
  for (const [y, d] of jobs) {
    const url = new URL(pdfLocal(y, d), location.href).href;
    try {
      if (!(await cache.match(url))) {
        let res = await fetch(url);
        if (!res.ok) res = await fetch(pdfInep(y, d));
        if (!res.ok) throw new Error(res.status);
        await cache.put(url, res);
      }
    } catch { failed++; }
    done++;
    bar.querySelector('i').style.width = `${(done / jobs.length) * 100}%`;
  }
  btn.disabled = false;
  btn.innerHTML = `${icon.check} ${failed ? `${jobs.length - failed} de ${jobs.length} salvas` : 'Provas salvas no aparelho'}`;
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
}
