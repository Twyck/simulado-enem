// Tela da prova: caderno em PDF + cronômetro + cartão-resposta, e o modo revisão depois de terminar.
import { AREAS, DAYS, LANGS, loadExam, loadTreino, nomeProva } from './data.js';
import { Viewer, openPdf } from './viewer.js';
import { CropViewer } from './cards.js';
import { saveAttempt } from './store.js';
import { h, icon, clock, dur, modal, toast, esc } from './ui.js';

const OFFSCREEN_SECONDS = 3; // após quanto tempo fora da tela a questão "em foco" muda pela rolagem
const IDLE_SECONDS = 180; // sem tocar, rolar ou digitar por 3 min, o relógio da questão para (o da prova continua)

export async function examScreen(app, attempt, { review = false, focusQ = null, go, setLeave }) {
  // treino por matéria: questões recortadas de vários cadernos; senão, a prova completa de um dia
  const treino = attempt.mode === 'treino';
  const exam = treino ? await loadTreino(attempt.items) : await loadExam(attempt.year, attempt.day, attempt.lang);
  const day = treino ? null : DAYS[attempt.day];
  const titulo = treino ? nomeProva(attempt) : `ENEM ${attempt.year} · ${day.label}`;
  const subtitulo = treino ? `${attempt.titulo ? attempt.materia : attempt.assunto || 'Todos os assuntos'}, ${exam.ids.length} questões` : `Caderno 1 Azul${attempt.day === 1 ? ` · ${LANGS[attempt.lang]}` : ''}`;
  const limit = attempt.limitSec;
  const ids = exam.ids;

  app.innerHTML = '';
  const el = h(`<div class="exam ${review ? 'review' : ''}">
    <header class="exam-bar">
      <button class="btn ghost sm back" title="Voltar">${icon.back}</button>
      <div class="title">${esc(titulo)}<small>${review ? 'Revisão: verde é o gabarito, vermelho é o seu erro' : esc(subtitulo)}</small></div>
      ${review ? '<div class="timer"><b class="tabular">' + clock(attempt.elapsed) + '</b><small>tempo de prova</small></div>' : `
      <div class="timer" title="Tempo de prova"><b class="tabular t-main">0:00:00</b><small class="t-sub"></small></div>`}
      <div class="qnow"></div>
      <div class="tools" role="toolbar" aria-label="Ferramentas">
        ${review ? '' : `
        <button class="tool" data-tool="mark" title="Marcar alternativa (clique na letra)">${icon.mark}</button>
        <button class="tool" data-tool="cross" title="Riscar alternativa (ou clique direito / toque longo)">${icon.cross}</button>
        ${treino ? '' : `<button class="tool" data-tool="pen" title="Caneta">${icon.pen}</button>
        <button class="tool" data-tool="highlighter" title="Marca-texto">${icon.highlighter}</button>
        <button class="tool" data-tool="eraser" title="Borracha">${icon.eraser}</button>`}`}
        <button class="tool zoom" data-zoom="-1" title="Diminuir zoom">${icon.zoomOut}</button>
        <button class="tool zoom" data-zoom="1" title="Aumentar zoom">${icon.zoomIn}</button>
      </div>
      <div class="bar-group end">
        ${review ? `<div class="err-nav" role="group" aria-label="Navegar pelos erros">
          <button class="btn sm ghost err-prev" title="Erro anterior">‹</button><span class="err-pos tabular"></span><button class="btn sm err-next" title="Próximo erro">Próximo erro ›</button></div>` : `<button class="btn sm ghost pause" title="Pausar">${icon.pause}</button>`}
        <button class="btn sm sheet-toggle" title="Cartão-resposta">${icon.sheet}<span class="cnt tabular"></span></button>
      </div>
    </header>
    <div class="exam-main">
      <div class="scroller"><div class="pages"></div>
        <div class="loading"><div>${treino ? 'Separando as questões nos cadernos do INEP…' : 'Abrindo o caderno oficial do INEP…'}<div class="progress"><i></i></div></div></div>
      </div>
      <aside class="sheet" aria-label="Cartão-resposta"></aside>
    </div>
  </div>`);
  app.append(el);

  const $ = s => el.querySelector(s);
  const scroller = $('.scroller');
  const sheet = $('.sheet');
  let viewer;
  let dirty = false;
  let destroyed = false;

  attempt.answers ??= {};
  attempt.crossed ??= {};
  attempt.time ??= {};
  attempt.changes ??= {};
  attempt.flags ??= {};
  attempt.history ??= [];
  attempt.current ??= ids[0];

  const save = () => { dirty = false; return saveAttempt(attempt); };

  // ---------------- cartão-resposta ----------------
  function buildSheet() {
    const rows = [];
    const groups = treino ? [[attempt.materia, exam.questions]] : day.areas.map(a => [AREAS[a].name, exam.questions.filter(q => q.area === a)]);
    for (const [name, qs] of groups) {
      rows.push(`<div class="sheet-area">${esc(name)}</div>`);
      for (const q of qs) {
        const label = treino ? String(q.idx).padStart(2, '0') : String(q.n).padStart(2, '0');
        rows.push(`<div class="row" data-q="${q.id}">
          <button class="num" title="${treino ? esc(q.origem) : `Ir para a questão ${q.n}`}">${label}</button>
          <div class="opts">${'ABCDE'.split('').map(L => `<button class="opt" data-l="${L}" aria-label="Questão ${label}, ${L}">${L}</button>`).join('')}</div>
          ${review ? `<span class="t">${dur(attempt.time[q.id] || 0)}</span>` : `<button class="flag" title="Marcar para revisar">${icon.flag}</button>`}
        </div>`);
      }
    }
    sheet.innerHTML = `<div class="sheet-head"><h3>Cartão-resposta <span class="muted tabular s-count"></span></h3><div class="progress"><i></i></div></div>
      ${rows.join('')}
      ${review ? '' : `<div class="kbd-hint"><kbd>A</kbd>–<kbd>E</kbd> marcam a questão em foco · <kbd>J</kbd>/<kbd>K</kbd> próxima/anterior · clique direito risca</div>
      <div class="sheet-foot"><button class="btn primary finish">${icon.check} ${treino ? 'Entregar treino' : 'Entregar prova'}</button></div>`}`;
    sheet.addEventListener('click', e => {
      const row = e.target.closest('.row');
      if (!row) return;
      const qid = row.dataset.q;
      if (e.target.closest('.num')) { viewer?.scrollToQuestion(qid); setCurrent(qid); closeSheetOnMobile(); }
      else if (e.target.closest('.opt') && !review) mark(qid, e.target.closest('.opt').dataset.l, { fromSheet: true });
      else if (e.target.closest('.flag')) { attempt.flags[qid] = !attempt.flags[qid]; refreshRow(qid); dirty = true; }
    });
    sheet.querySelector('.finish')?.addEventListener('click', finish);
    ids.forEach(refreshRow);
  }

  function refreshRow(qid) {
    const row = sheet.querySelector(`.row[data-q="${qid}"]`);
    if (!row) return;
    const q = exam.byId[qid];
    const a = attempt.answers[qid];
    row.querySelectorAll('.opt').forEach(o => {
      const L = o.dataset.l;
      o.classList.toggle('on', a === L);
      o.classList.toggle('x', !!attempt.crossed[qid]?.includes(L));
      if (review) {
        o.classList.toggle('key', q.key === L);
        o.classList.toggle('bad', a === L && q.key !== L && q.key !== 'X');
      }
    });
    row.querySelector('.flag')?.classList.toggle('on', !!attempt.flags[qid]);
    row.classList.toggle('current', attempt.current === qid && !review);
  }

  function refreshCounts() {
    const n = ids.filter(id => attempt.answers[id]).length;
    sheet.querySelector('.s-count').textContent = `${n}/${ids.length}`;
    sheet.querySelector('.progress i').style.width = `${(n / ids.length) * 100}%`;
    $('.sheet-toggle .cnt').textContent = `${n}/${ids.length}`;
  }

  // ---------------- marcação e foco ----------------
  function setCurrent(qid) {
    if (!qid || review) return;
    const prev = attempt.current;
    attempt.current = qid;
    offscreen = 0;
    viewer?.setCurrent(qid);
    if (prev !== qid) { refreshRow(prev); refreshRow(qid); }
    updateQNow();
  }

  function mark(qid, L, { fromSheet = false } = {}) {
    if (review || attempt.status !== 'running') return;
    const prev = attempt.answers[qid];
    if (prev === L) delete attempt.answers[qid];
    else attempt.answers[qid] = L;
    if (prev && attempt.answers[qid] && prev !== L) attempt.changes[qid] = (attempt.changes[qid] || 0) + 1;
    const cr = attempt.crossed[qid];
    if (cr?.includes(L)) attempt.crossed[qid] = cr.filter(x => x !== L);
    attempt.history.push({ q: qid, a: attempt.answers[qid] ?? null, t: Math.round(attempt.elapsed) });
    viewer?.refresh(qid);
    refreshRow(qid);
    refreshCounts();
    dirty = true;
    // ao responder, o relógio passa para a próxima questão (fluxo normal de quem resolve em ordem)
    if (!prev && attempt.answers[qid]) {
      const next = ids[ids.indexOf(qid) + 1];
      setCurrent(next && !fromSheet ? next : qid);
    } else setCurrent(qid);
  }

  function cross(qid, L) {
    if (review || attempt.status !== 'running') return;
    const cr = new Set(attempt.crossed[qid] || []);
    cr.has(L) ? cr.delete(L) : cr.add(L);
    attempt.crossed[qid] = [...cr];
    viewer?.refresh(qid);
    refreshRow(qid);
    setCurrent(qid);
    dirty = true;
  }

  let lastInput = performance.now();
  let idle = false;
  function updateQNow() {
    const q = exam.byId[attempt.current];
    if (!q || review) { $('.qnow').textContent = ''; return; }
    $('.qnow').innerHTML = `Questão <b>${treino ? q.idx : q.n}</b> · ${clock(attempt.time[q.id] || 0, false)}${idle ? ' <span class="idle" title="Sem interação há mais de 3 minutos: o tempo desta questão está parado">parado</span>' : ''}`;
  }

  // ---------------- cronômetro ----------------
  let offscreen = 0;
  let last = performance.now();
  let saveTick = 0;
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 2);
    last = now;
    if (destroyed || review || attempt.status !== 'running' || document.hidden || !viewer) return;
    attempt.elapsed += dt;
    idle = (now - lastInput) / 1000 > IDLE_SECONDS;
    if (attempt.current && !idle) attempt.time[attempt.current] = (attempt.time[attempt.current] || 0) + dt;

    // se a questão em foco saiu da tela, o foco vai para a primeira questão visível
    const vis = viewer.visibleQuestions();
    if (vis.length && !vis.includes(attempt.current)) {
      offscreen += dt;
      if (offscreen >= OFFSCREEN_SECONDS) setCurrent(vis.find(id => !attempt.answers[id]) || vis[0]);
    } else offscreen = 0;

    renderTimer();
    updateQNow();
    if (limit && attempt.elapsed >= limit && !attempt.timeUpAt) {
      attempt.timeUpAt = Math.round(attempt.elapsed);
      save();
      modal({
        title: 'Tempo esgotado',
        body: `As ${dur(limit)} de prova acabaram. No ENEM real você entregaria agora. Quer entregar ou continuar (o tempo extra fica registrado)?`,
        actions: [{ label: 'Continuar', value: 'go' }, { label: 'Entregar prova', value: 'end', kind: 'primary' }],
      }).then(v => v === 'end' && finish(true));
    }
    if (++saveTick % 5 === 0 || dirty) save();
  }

  function renderTimer() {
    if (review) return;
    const t = $('.timer');
    if (limit) {
      const left = limit - attempt.elapsed;
      $('.t-main').textContent = left >= 0 ? clock(left) : `+${clock(-left)}`;
      $('.t-sub').textContent = left >= 0 ? `restante · ${clock(attempt.elapsed)} decorrido` : 'tempo extra';
      t.classList.toggle('low', left < 30 * 60);
    } else {
      $('.t-main').textContent = clock(attempt.elapsed);
      $('.t-sub').textContent = 'decorrido · sem limite';
    }
    t.classList.toggle('paused', attempt.status === 'paused');
  }
  const timer = setInterval(tick, 1000);

  // ---------------- pausa / entrega / saída ----------------
  function setPaused(p) {
    attempt.status = p ? 'paused' : 'running';
    last = performance.now();
    el.querySelector('.pause').innerHTML = p ? icon.play : icon.pause;
    el.querySelector('.pause-veil')?.remove();
    if (p) {
      const veil = h(`<div class="pause-veil"><div class="card"><h2>Prova pausada</h2><p class="muted">O cronômetro está parado e o caderno fica oculto.</p><button class="btn primary">${icon.play} Continuar</button></div></div>`);
      veil.querySelector('button').onclick = () => setPaused(false);
      $('.exam-main').append(veil);
    }
    renderTimer();
    save();
  }

  async function finish(skipConfirm) {
    const blank = ids.filter(id => !attempt.answers[id]).length;
    const flagged = ids.filter(id => attempt.flags[id]).length;
    if (skipConfirm !== true) {
      const ok = await modal({
        title: 'Entregar a prova?',
        body: `${blank ? `<b>${blank}</b> questões em branco. ` : 'Todas as questões respondidas. '}${flagged ? `${flagged} marcadas para revisar. ` : ''}Depois de entregar você vê o gabarito e a análise.`,
        actions: [{ label: 'Voltar à prova', value: false }, { label: 'Entregar', value: true, kind: 'primary' }],
      });
      if (!ok) return;
    }
    attempt.status = 'done';
    attempt.finishedAt = Date.now();
    await save();
    cleanup();
    go(`#/resultado/${attempt.id}`);
  }

  function closeSheetOnMobile() { el.classList.remove('sheet-open'); }

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    viewer?.destroy();
  }

  const onVis = () => { last = performance.now(); if (document.hidden) save(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', () => save(), { once: true });

  function onKey(e) {
    if (review || attempt.status !== 'running' || e.metaKey || e.ctrlKey || e.target.closest('input,textarea')) return;
    const k = e.key.toUpperCase();
    if ('ABCDE'.includes(k) && k.length === 1) { mark(attempt.current, k); e.preventDefault(); }
    else if (k === 'J' || k === 'K') {
      const i = ids.indexOf(attempt.current) + (k === 'J' ? 1 : -1);
      if (ids[i]) { setCurrent(ids[i]); viewer.scrollToQuestion(ids[i]); }
    }
  }
  document.addEventListener('keydown', onKey);
  // qualquer interação conta como "estou fazendo a prova"
  const touch = () => { lastInput = performance.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => el.addEventListener(ev, touch, { passive: true }));
  scroller.addEventListener('scroll', touch, { passive: true });

  $('.back').onclick = async () => {
    if (!review) {
      if (attempt.status === 'running') attempt.status = 'paused';
      await save();
      toast('Prova salva — continue de onde parou quando quiser');
    }
    cleanup();
    go(review ? `#/resultado/${attempt.id}` : '#/');
  };
  el.querySelector('.pause')?.addEventListener('click', () => setPaused(attempt.status === 'running'));
  $('.sheet-toggle').onclick = () => el.classList.toggle('sheet-open');
  el.querySelectorAll('.tool[data-tool]').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('.tool[data-tool]').forEach(x => x.setAttribute('aria-pressed', x === b));
    viewer?.setTool(b.dataset.tool);
  }));
  el.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => viewer?.setZoom(viewer.zoom + 0.2 * +b.dataset.zoom)));
  el.querySelector('.tool[data-tool="mark"]')?.setAttribute('aria-pressed', 'true');

  // saída por navegação do navegador (voltar, outro link): salva e para o cronômetro
  setLeave?.(() => {
    if (!review && attempt.status === 'running') attempt.status = 'paused';
    if (!review) save();
    cleanup();
  });

  // revisão: pular direto entre as questões erradas ou em branco
  if (review) {
    const erros = ids.filter(id => { const q = exam.byId[id]; return q.key !== 'X' && attempt.answers[id] !== q.key; });
    let pos = focusQ ? erros.indexOf(focusQ) : -1;
    const show = () => { $('.err-pos').textContent = erros.length ? `${pos >= 0 ? pos + 1 : '–'} de ${erros.length}` : 'nenhum erro'; };
    const goErr = d => {
      if (!erros.length) return;
      pos = (pos + d + erros.length) % erros.length;
      viewer?.scrollToQuestion(erros[pos]);
      show();
    };
    el.querySelector('.err-next').onclick = () => goErr(1);
    el.querySelector('.err-prev').onclick = () => goErr(pos < 0 ? 0 : -1);
    show();
  }

  buildSheet();
  refreshCounts();
  renderTimer();
  updateQNow();

  // ---------------- carrega o PDF ----------------
  try {
    const vopts = {
      attemptId: attempt.id,
      mode: review ? 'review' : 'exam',
      state: () => attempt,
      onMark: mark,
      onCross: cross,
      onFocus: setCurrent,
    };
    if (treino) {
      viewer = new CropViewer($('.pages'), exam, vopts);
      await viewer.load();
      if (destroyed) return viewer.destroy();
    } else {
      const pdf = await openPdf(attempt.year, attempt.day, f => { $('.loading .progress i').style.width = `${f * 100}%`; });
      if (destroyed) return pdf.destroy();
      viewer = new Viewer($('.pages'), exam, vopts);
      await viewer.load(pdf);
    }
    viewer.setTool('mark');
    $('.loading').remove();
    if (attempt.status === 'paused' && !review) setPaused(false);
    const target = focusQ || (review ? ids[0] : attempt.current);
    viewer.setCurrent(attempt.current);
    if (focusQ || attempt.history.length) requestAnimationFrame(() => viewer.scrollToQuestion(target, false));
    last = performance.now();
  } catch (err) {
    console.error(err);
    $('.loading').innerHTML = `<div class="card"><h2>Não foi possível abrir a prova</h2><p class="muted">${esc(err.message)}</p><p>Verifique sua conexão — o caderno vem do servidor do INEP quando não está salvo no aparelho.</p></div>`;
  }
}
