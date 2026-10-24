// Entrada do app: rotas (início, prova, resultado, revisão) e tela inicial.
import { YEARS, DAYS, LANGS, MATERIAS, AREAS, pdfLocal, pdfInep, loadExam, loadTreino, findQuestions, assuntosDe, loadFor, nomeProva } from './data.js';
import { listAttempts, saveAttempt, getAttempt, deleteAttempt, exportBackup, importBackup } from './store.js';
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
    tipo: prefs.tipo ?? 'prova',
    materia: prefs.materia ?? 'Matemática',
    assunto: prefs.assunto ?? '',
    anoTreino: prefs.anoTreino ?? 'todos',
    qtd: prefs.qtd ?? 20,
    tempoTreino: prefs.tempoTreino ?? 'livre',
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
      <div class="resume"><div><b>${esc(nomeProva(a))}</b>
        <div class="meta">${Object.keys(a.answers || {}).length} de ${a.mode === 'treino' ? a.items.length : 90} respondidas, ${clock(a.elapsed)} de prova</div></div>
        <div class="row-actions"><button class="btn sm ghost danger" data-del="${a.id}" title="Excluir">${icon.trash}</button><a class="btn primary sm" href="#/prova/${a.id}">Continuar prova</a></div></div>`).join('')}</section>` : ''}

    <section class="section" id="nova">
      <div class="answer-form timing">
        <div class="form-head"><h2>Nova prova</h2><span class="code">Caderno Azul</span></div>
        <div class="field"><span class="label">Tipo</span><div class="choices">
          <button class="choice" data-tipo="prova">${oval}<span>Prova completa<span class="sub">90 questões de um dia, como no exame</span></span></button>
          <button class="choice" data-tipo="treino">${oval}<span>Treino por matéria<span class="sub">só as questões da matéria e do assunto que você escolher</span></span></button></div></div>
        <div class="treino-fields">
          <div class="field"><span class="label">Matéria</span><div class="choices materias">${MATERIAS.map(m => `<button class="choice" data-materia="${m.name}">${oval}<span>${m.name}</span></button>`).join('')}</div></div>
          <div class="field"><span class="label">Assunto</span><div class="choices assuntos"></div></div>
          <div class="field"><span class="label">Anos</span><div class="choices">
            <button class="choice" data-anotreino="todos">${oval}<span>Todos</span></button>${YEARS.map(y => `<button class="choice" data-anotreino="${y}">${oval}<span>${y}</span></button>`).join('')}</div></div>
          <div class="field"><span class="label">Questões</span><div class="choices">
            <button class="choice" data-qtd="10">${oval}<span>10</span></button><button class="choice" data-qtd="20">${oval}<span>20</span></button>
            <button class="choice" data-qtd="0">${oval}<span class="qtd-all">Todas</span></button></div></div>
          <div class="field"><span class="label">Tempo</span><div class="choices">
            <button class="choice" data-tempotreino="livre">${oval}<span>Sem limite</span></button>
            <button class="choice" data-tempotreino="ritmo">${oval}<span>Ritmo do ENEM<span class="sub">3 minutos por questão</span></span></button></div></div>
        </div>
        <div class="prova-fields">
        <div class="field"><span class="label">Ano</span><div class="choices years">${YEARS.map(y => `<button class="choice" data-year="${y}">${oval}<span>${y}</span></button>`).join('')}</div></div>
        <div class="field"><span class="label">Dia</span><div class="choices days">${Object.entries(DAYS).map(([d, v]) => `
          <button class="choice" data-day="${d}">${oval}<span>${v.label}<span class="sub">${v.note.replace(' (+ redação)', '')}, 90 questões em ${clock(v.minutes * 60).slice(0, -3).replace(':', 'h')}</span></span></button>`).join('')}</div></div>
        <div class="field lang-field"><span class="label">Língua<small>questões 1 a 5</small></span><div class="choices langs">${Object.entries(LANGS).map(([k, v]) => `<button class="choice" data-lang="${k}">${oval}<span>${v}</span></button>`).join('')}</div></div>
        <div class="field"><span class="label">Tempo</span><div class="choices time-row">
          <button class="choice" data-time="oficial">${oval}<span>Oficial</span></button>
          <button class="choice" data-time="semredacao">${oval}<span>Sem a redação, 4h30<span class="sub">desconta 1 hora reservada à redação</span></span></button>
          <button class="choice" data-time="livre">${oval}<span>Sem limite</span></button>
          <button class="choice" data-time="custom">${oval}<span>Personalizado</span></button>
          <input type="number" min="10" max="600" step="5" class="custom" aria-label="Minutos"> <span class="muted custom-l">minutos</span></div></div>
        </div>
        <div class="start-row"><span class="src">Você resolve no <a class="src-link" target="_blank" rel="noopener">PDF oficial do INEP</a>, marcando direto nas alternativas.</span>
          <button class="btn primary start">Começar prova</button></div>
      </div>
    </section>

    <section class="section ${showIntro && !done.length ? 'hidden' : ''}">
      <div class="section-head"><h2>Histórico</h2>${done.length ? '<a href="#/evolucao">Ver evolução</a>' : ''}</div>
      ${done.length ? `<table class="history"><thead><tr><th>Prova</th><th class="hide-sm">Data</th><th>Nota TRI</th><th class="hide-sm">Tempo</th><th></th></tr></thead><tbody>
      ${done.map(a => `<tr data-id="${a.id}"><td>${a.mode === 'treino' ? esc(nomeProva(a)) : `<b>${a.year}</b>, ${DAYS[a.day].label}`}</td><td class="hide-sm muted">${new Date(a.startedAt).toLocaleDateString('pt-BR')}</td>
        <td class="tabular score">…</td><td class="hide-sm tabular">${clock(a.elapsed)}</td>
        <td><a class="btn sm" href="#/resultado/${a.id}">Ver análise</a> <button class="btn sm ghost danger" data-del="${a.id}" title="Excluir">${icon.trash}</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">Entregue sua primeira prova para ver a nota e a análise aqui.</p>'}
    </section>

    <section class="section" id="backup">
      <div class="section-head"><h2>Seus dados</h2></div>
      <div class="backup-row">
        <p>As provas, anotações e notas ficam só neste aparelho. Baixe um backup para não perder nada se o navegador for limpo, ou para continuar em outro aparelho.</p>
        <div class="row-actions">
          <button class="btn sm bk-out" ${attempts.length ? '' : 'disabled'}>${icon.download} Baixar backup</button>
          <label class="btn sm bk-in">Restaurar backup<input type="file" accept="application/json,.json" hidden></label>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="offline-row"><p>Para usar sem internet, instale o app (menu do navegador, “Adicionar à tela de início”) e salve os cadernos no aparelho.</p>
      <div class="progress hidden"><i></i></div><button class="btn dl">${icon.download} Salvar as 10 provas</button></div>
    </section>

    <footer class="fine">Cadernos, gabaritos, parâmetros da TRI e Matriz de Referência: publicações oficiais do INEP (download.inep.gov.br).
      Este é um app independente de estudo, sem vínculo com o INEP ou o MEC.</footer>
  </div>`);
  app.append(el);

  let pool = [];
  const syncTreino = async () => {
    const years = sel.anoTreino === 'todos' ? YEARS : [+sel.anoTreino];
    const lista = await assuntosDe(sel.materia, years);
    if (sel.assunto && !lista.some(([a]) => a === sel.assunto)) sel.assunto = '';
    el.querySelector('.assuntos').innerHTML = `<button class="choice" data-assunto="">${oval}<span>Todos</span></button>` +
      lista.map(([a, n]) => `<button class="choice" data-assunto="${esc(a)}">${oval}<span>${esc(a)} <span class="muted">${n}</span></span></button>`).join('');
    el.querySelectorAll('[data-assunto]').forEach(b => b.setAttribute('aria-pressed', b.dataset.assunto === sel.assunto));
    pool = await findQuestions({ materia: sel.materia, assunto: sel.assunto || null, years });
    el.querySelector('.qtd-all').textContent = `Todas (${pool.length})`;
    el.querySelector('.start').disabled = sel.tipo === 'treino' && !pool.length;
  };
  const sync = () => {
    el.querySelectorAll('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tipo === sel.tipo));
    el.querySelectorAll('[data-materia]').forEach(b => b.setAttribute('aria-pressed', b.dataset.materia === sel.materia));
    el.querySelectorAll('[data-anotreino]').forEach(b => b.setAttribute('aria-pressed', b.dataset.anotreino === String(sel.anoTreino)));
    el.querySelectorAll('[data-qtd]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.qtd === sel.qtd));
    el.querySelectorAll('[data-tempotreino]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tempotreino === sel.tempoTreino));
    el.querySelector('.treino-fields').classList.toggle('hidden', sel.tipo !== 'treino');
    el.querySelector('.prova-fields').classList.toggle('hidden', sel.tipo !== 'prova');
    el.querySelector('.start').textContent = sel.tipo === 'treino' ? 'Começar treino' : 'Começar prova';
    el.querySelectorAll('[data-year]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.year === sel.year));
    el.querySelectorAll('[data-day]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.day === sel.day));
    el.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === sel.lang));
    if (sel.day !== 1 && sel.time === 'semredacao') sel.time = 'oficial';
    el.querySelector('[data-time="semredacao"]').classList.toggle('hidden', sel.day !== 1);
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
    const b = e.target.closest('[data-year],[data-day],[data-lang],[data-time],[data-tipo],[data-materia],[data-assunto],[data-anotreino],[data-qtd],[data-tempotreino]');
    if (!b) return;
    if (b.dataset.tipo) sel.tipo = b.dataset.tipo;
    if (b.dataset.materia) { sel.materia = b.dataset.materia; sel.assunto = ''; }
    if (b.dataset.assunto !== undefined) sel.assunto = b.dataset.assunto;
    if (b.dataset.anotreino) sel.anoTreino = b.dataset.anotreino;
    if (b.dataset.qtd !== undefined) sel.qtd = +b.dataset.qtd;
    if (b.dataset.tempotreino) sel.tempoTreino = b.dataset.tempotreino;
    if (b.dataset.tipo || b.dataset.materia || b.dataset.assunto !== undefined || b.dataset.anotreino) syncTreino();
    if (b.dataset.year) sel.year = +b.dataset.year;
    if (b.dataset.day) sel.day = +b.dataset.day;
    if (b.dataset.lang) sel.lang = b.dataset.lang;
    if (b.dataset.time) sel.time = b.dataset.time;
    sync();
  });
  el.querySelector('.custom').addEventListener('change', e => { sel.custom = Math.max(10, +e.target.value || 180); sync(); });
  sync();
  syncTreino();

  el.querySelector('.start').onclick = async () => {
    if (sel.tipo === 'treino') {
      // sorteia a quantidade pedida entre as questões disponíveis e ordena do ano mais recente ao mais antigo
      let items = [...pool];
      if (sel.qtd && items.length > sel.qtd) {
        for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
        items = items.slice(0, sel.qtd).sort((p, q) => q.year - p.year || p.day - q.day || parseInt(p.id, 10) - parseInt(q.id, 10));
      }
      if (!items.length) return;
      const a = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        mode: 'treino', materia: sel.materia, assunto: sel.assunto || null, items,
        limitSec: sel.tempoTreino === 'ritmo' ? items.length * 180 : 0, startedAt: Date.now(), elapsed: 0, status: 'running',
        answers: {}, crossed: {}, time: {}, changes: {}, flags: {}, history: [],
      };
      await saveAttempt(a);
      return go(`#/prova/${a.id}`);
    }
    const limitSec = sel.time === 'oficial' ? DAYS[sel.day].minutes * 60
      : sel.time === 'semredacao' ? (DAYS[sel.day].minutes - 60) * 60
      : sel.time === 'custom' ? sel.custom * 60 : 0;
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

  el.querySelector('.bk-out').onclick = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `simulado-enem-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    try { localStorage.setItem('lastBackup', String(Date.now())); } catch { /* sem storage */ }
    toast('Backup baixado');
  };
  el.querySelector('.bk-in input').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { added, updated } = await importBackup(JSON.parse(await file.text()));
      toast(added + updated ? `Backup restaurado: ${added} prova${added === 1 ? '' : 's'} nova${added === 1 ? '' : 's'}${updated ? `, ${updated} atualizada${updated === 1 ? '' : 's'}` : ''}` : 'Nada novo nesse backup: você já tem essas provas');
      if (added + updated) home();
    } catch (err) {
      modal({ title: 'Não foi possível restaurar', body: esc(err.message || 'O arquivo está corrompido ou não é um backup do Simulado ENEM.'), actions: [{ label: 'Ok', value: true, kind: 'primary' }] });
    }
  });

  // pontuação no histórico
  for (const a of done) {
    loadFor(a).then(ex => {
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
  // quando sai uma versão nova, o service worker novo assume e a página recarrega sozinha uma vez
  // (só fora da prova, para não interromper ninguém no meio dela)
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || location.hash.startsWith('#/prova/')) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(err => console.warn('SW', err));
}
