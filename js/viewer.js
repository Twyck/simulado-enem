// Visor do caderno oficial em PDF: páginas renderizadas com pdf.js, bolinhas clicáveis sobre
// as alternativas impressas e uma camada de tinta (caneta, marca-texto, borracha) por página.
import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { pdfLocal, pdfInep, readKey, cmpKey } from './data.js';
import { getInk, saveInk } from './store.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

const INK_STYLE = {
  pen: { color: '#1d3fb8', width: 1.4, alpha: 1, blend: 'source-over' },
  highlighter: { color: '#ffd400', width: 11, alpha: 0.4, blend: 'multiply' },
};

export async function openPdf(year, day, onProgress) {
  const tryLoad = url => {
    const task = pdfjsLib.getDocument({ url, disableRange: true });
    task.onProgress = p => p.total && onProgress?.(p.loaded / p.total);
    return task.promise;
  };
  try {
    return await tryLoad(pdfLocal(year, day));
  } catch {
    return await tryLoad(pdfInep(year, day)); // fallback: direto do servidor do INEP
  }
}

export class Viewer {
  constructor(root, exam, opts) {
    this.root = root;
    this.exam = exam;
    this.opts = opts; // { attemptId, mode: 'exam'|'review', onMark, onCross, onFocus, state() }
    this.zoom = 1;
    this.tool = 'mark';
    this.pages = [];
    this.renderTasks = new Map();
    this.inkCache = new Map();
    this.bubbles = new Map(); // `${qid}:${L}` -> elemento
    this.pageForQ = new Map();
    this.onResize = () => this.relayout();
  }

  async load(pdf) {
    this.pdf = pdf;
    this.root.innerHTML = '';
    this.root.classList.add('pdf-pages');
    const layout = this.exam.layout;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const el = document.createElement('div');
      el.className = 'page';
      el.dataset.page = p;
      el.innerHTML = `<canvas class="pdf"></canvas><canvas class="ink"></canvas><div class="overlay"></div><span class="page-no">${p}</span>`;
      this.root.append(el);
      this.pages.push({ p, page, vp, el, canvas: el.querySelector('.pdf'), ink: el.querySelector('.ink'), overlay: el.querySelector('.overlay'), rendered: 0 });
    }
    // prova de uma área: só as páginas que têm questões dela
    if (this.exam.area) {
      const ps = this.exam.questions.flatMap(q => (q.pos ? [q.pos.p, ...q.pos.alts.map(a => a.p)] : []));
      const lo = Math.min(...ps), hi = Math.max(...ps);
      for (const pg of this.pages) if (pg.p < lo || pg.p > hi) { pg.el.style.display = 'none'; pg.skip = true; }
    }
    // chaves de ordem de leitura de cada questão (início = cabeçalho, fim = última alternativa)
    for (const q of this.exam.questions) {
      const pos = q.pos;
      if (!pos) continue;
      q.startKey = readKey(layout, pos.p, pos.x, pos.y);
      q.endKey = pos.alts.map(a => readKey(layout, a.p, a.x, a.y)).sort(cmpKey).at(-1);
    }
    this.sortedQs = this.exam.questions.filter(q => q.pos).sort((a, b) => cmpKey(a.startKey, b.startKey));
    // inclui as questões da outra língua estrangeira para que um clique nelas não conte para a vizinha
    this.lookup = Object.values(layout.questions)
      .map(q => ({ id: q.id, startKey: readKey(layout, q.p, q.x, q.y) }))
      .sort((a, b) => cmpKey(a.startKey, b.startKey));
    // anotações carregadas antes, para o primeiro traço não esperar o banco de dados
    await Promise.all(this.pages.map(pg => this.loadInk(pg.p)));
    this.buildBubbles();
    this.bindInk();
    this.root.addEventListener('click', e => this.onPageClick(e));
    this.observer = new IntersectionObserver(entries => {
      for (const en of entries) {
        const pg = this.pages[+en.target.dataset.page - 1];
        pg.visible = en.isIntersecting;
        if (en.isIntersecting) this.renderPage(pg);
      }
    }, { root: this.root.parentElement, rootMargin: '1200px 0px' });
    this.pages.forEach(pg => pg.skip || this.observer.observe(pg.el));
    window.addEventListener('resize', this.onResize);
    this.relayout();
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.pdf?.destroy();
  }

  get scroller() { return this.root.parentElement; }

  get scale() {
    // no computador, a página fica num tamanho de leitura confortável; o zoom amplia
    const avail = Math.min(this.scroller.clientWidth - 24, 940);
    return (avail / this.pages[0].vp.width) * this.zoom;
  }

  relayout() {
    const s = this.scale;
    if (!s || !isFinite(s) || s === this.currentScale) return;
    // mantém o mesmo ponto do caderno no topo da tela ao mudar escala/tamanho da janela
    const sc = this.scroller;
    const top = sc.scrollTop;
    const ref = this.pages.find(pg => !pg.skip && pg.el.offsetTop + pg.el.offsetHeight > top);
    const frac = ref && ref.el.offsetHeight ? (top - ref.el.offsetTop) / ref.el.offsetHeight : 0;
    this.currentScale = s;
    for (const pg of this.pages) {
      pg.el.style.width = `${pg.vp.width * s}px`;
      pg.el.style.height = `${pg.vp.height * s}px`;
      pg.el.style.setProperty('--s', s);
      if (pg.visible) this.renderPage(pg);
    }
    if (ref && top > 0) sc.scrollTop = ref.el.offsetTop + frac * ref.el.offsetHeight;
  }

  setZoom(z) {
    this.zoom = Math.min(3, Math.max(0.5, z));
    this.relayout();
  }

  async renderPage(pg) {
    const s = this.currentScale;
    if (pg.rendered === s) return;
    pg.rendered = s;
    this.renderTasks.get(pg.p)?.cancel();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const vp = pg.page.getViewport({ scale: s * dpr });
    const off = document.createElement('canvas');
    off.width = Math.floor(vp.width);
    off.height = Math.floor(vp.height);
    const task = pg.page.render({ canvasContext: off.getContext('2d'), viewport: vp });
    this.renderTasks.set(pg.p, task);
    try {
      await task.promise;
      // troca o canvas só depois de pronto, para não piscar durante o zoom
      pg.canvas.width = off.width;
      pg.canvas.height = off.height;
      pg.canvas.getContext('2d').drawImage(off, 0, 0);
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') console.error(e);
      return;
    }
    pg.ink.width = off.width;
    pg.ink.height = off.height;
    pg.dpr = dpr;
    await this.drawInk(pg);
  }

  // ---------- bolinhas sobre as alternativas ----------
  buildBubbles() {
    for (const q of this.exam.questions) {
      if (!q.pos) continue;
      this.pageForQ.set(q.id, q.pos.p);
      for (const a of q.pos.alts) {
        const pg = this.pages[a.p - 1];
        // centro do glifo da letra (linha de base + ~1/3 da altura)
        const [cx, cy] = pg.vp.convertToViewportPoint(a.x + a.s / 2, a.y + a.s * 0.34);
        const b = document.createElement('button');
        b.className = 'bubble';
        b.type = 'button';
        b.dataset.q = q.id;
        b.dataset.l = a.L;
        b.title = `Questão ${q.n} — alternativa ${a.L}`;
        // comprimento do risco: até o fim da coluna ou até a próxima alternativa na mesma linha
        const mid = this.exam.layout.pages[a.p - 1].mid;
        const colEnd = a.x < mid ? mid - 8 : pg.vp.viewBox[2] - 40;
        const sameRow = q.pos.alts.filter(o => o !== a && o.p === a.p && Math.abs(o.y - a.y) < 2 && o.x > a.x).map(o => o.x - 6);
        const len = Math.max(40, Math.min(colEnd, ...sameRow) - a.x);
        b.style.cssText = `--x:${cx};--y:${cy};--r:${a.s * 0.62};--len:${len}`;
        b.innerHTML = `<span>${a.L}</span>`;
        pg.overlay.append(b);
        this.bubbles.set(`${q.id}:${a.L}`, b);
        let pressTimer;
        b.addEventListener('pointerdown', e => {
          if (e.pointerType !== 'mouse') pressTimer = setTimeout(() => { pressTimer = 'fired'; this.opts.onCross?.(q.id, a.L); }, 480);
        });
        const clear = () => { if (pressTimer !== 'fired') clearTimeout(pressTimer); };
        b.addEventListener('pointerup', clear);
        b.addEventListener('pointerleave', clear);
        b.addEventListener('contextmenu', e => { e.preventDefault(); if (pressTimer !== 'fired') this.opts.onCross?.(q.id, a.L); });
        b.addEventListener('click', e => {
          e.stopPropagation();
          if (pressTimer === 'fired') { pressTimer = null; return; }
          if (this.tool === 'cross' || e.altKey) this.opts.onCross?.(q.id, a.L);
          else this.opts.onMark?.(q.id, a.L);
        });
      }
    }
    this.refreshAll();
  }

  refresh(qid) {
    const st = this.opts.state();
    const q = this.exam.byId[qid];
    if (!q?.pos) return;
    for (const a of q.pos.alts) {
      const b = this.bubbles.get(`${qid}:${a.L}`);
      const mine = st.answers[qid] === a.L;
      b.classList.toggle('marked', mine);
      b.classList.toggle('crossed', !!st.crossed[qid]?.includes(a.L));
      if (this.opts.mode === 'review') {
        b.classList.toggle('key', q.key === a.L);
        b.classList.toggle('wrong', mine && q.key !== a.L && q.key !== 'X');
      }
    }
  }

  refreshAll() { this.exam.questions.forEach(q => this.refresh(q.id)); }

  setCurrent(qid) {
    this.root.querySelectorAll('.bubble.current').forEach(b => b.classList.remove('current'));
    if (this.opts.mode === 'exam') this.root.querySelectorAll(`.bubble[data-q="${qid}"]`).forEach(b => b.classList.add('current'));
  }

  scrollToQuestion(qid, smooth = true) {
    const q = this.exam.byId[qid];
    if (!q?.pos) return;
    const pg = this.pages[q.pos.p - 1];
    const [, top] = pg.vp.convertToViewportPoint(q.pos.x, q.pos.y + 14);
    const y = pg.el.offsetTop + top * this.currentScale - 12;
    this.scroller.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  }

  // ---------- localização: que questão está neste ponto / na tela ----------
  questionAt(p, vx, vy) {
    const pg = this.pages[p - 1];
    const [x, y] = pg.vp.convertToPdfPoint(vx, vy);
    const k = readKey(this.exam.layout, p, x, y);
    let found = null;
    for (const q of this.lookup) {
      if (cmpKey(q.startKey, k) <= 0) found = q; else break;
    }
    return found && this.exam.byId[found.id] ? found.id : null;
  }

  // Questões cujo trecho (do cabeçalho à última alternativa) aparece na área visível.
  visibleQuestions() {
    const sc = this.scroller.getBoundingClientRect();
    const segs = [];
    for (const pg of this.pages) {
      if (!pg.visible) continue;
      const r = pg.el.getBoundingClientRect();
      const top = Math.max(sc.top, r.top) - r.top, bottom = Math.min(sc.bottom, r.bottom) - r.top;
      if (bottom - top < 40) continue;
      const s = this.currentScale;
      const [, yTop] = pg.vp.convertToPdfPoint(0, top / s);
      const [, yBot] = pg.vp.convertToPdfPoint(0, bottom / s);
      const mid = this.exam.layout.pages[pg.p - 1].mid;
      for (const x of [mid - 50, mid + 50]) {
        segs.push([readKey(this.exam.layout, pg.p, x, yTop), readKey(this.exam.layout, pg.p, x, yBot)]);
      }
    }
    return this.sortedQs.filter(q => segs.some(([a, b]) => cmpKey(q.startKey, b) <= 0 && cmpKey(q.endKey, a) >= 0)).map(q => q.id);
  }

  onPageClick(e) {
    if (this.tool !== 'mark' && this.tool !== 'cross') return;
    const el = e.target.closest('.page');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const qid = this.questionAt(+el.dataset.page, (e.clientX - r.left) / this.currentScale, (e.clientY - r.top) / this.currentScale);
    if (qid && this.exam.byId[qid]) this.opts.onFocus?.(qid);
  }

  // ---------- tinta ----------
  setTool(tool) {
    this.tool = tool;
    this.root.dataset.tool = tool;
  }

  async loadInk(p) {
    if (!this.inkCache.has(p)) this.inkCache.set(p, (await getInk(this.opts.attemptId, p)) || []);
    return this.inkCache.get(p);
  }

  async drawInk(pg) {
    const strokes = await this.loadInk(pg.p);
    const ctx = pg.ink.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pg.ink.width, pg.ink.height);
    const k = this.currentScale * (pg.dpr || 1);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    for (const st of strokes) this.strokePath(ctx, st);
  }

  strokePath(ctx, st) {
    const style = INK_STYLE[st.tool];
    if (!style || st.pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = style.alpha;
    ctx.globalCompositeOperation = style.blend;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = st.tool === 'highlighter' ? 'butt' : 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(st.pts[0][0], st.pts[0][1]);
    for (let i = 1; i < st.pts.length; i++) ctx.lineTo(st.pts[i][0], st.pts[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  bindInk() {
    let active = null;
    const toPt = (e, pg) => {
      const r = pg.el.getBoundingClientRect();
      return [+((e.clientX - r.left) / this.currentScale).toFixed(1), +((e.clientY - r.top) / this.currentScale).toFixed(1)];
    };
    this.root.addEventListener('pointerdown', e => {
      if (!['pen', 'highlighter', 'eraser'].includes(this.tool) || this.opts.mode !== 'exam') return;
      const el = e.target.closest('.page');
      if (!el) return;
      e.preventDefault();
      const pg = this.pages[+el.dataset.page - 1];
      const strokes = this.inkCache.get(pg.p);
      const pt = toPt(e, pg);
      const qid = this.questionAt(pg.p, pt[0], pt[1]);
      if (qid && this.exam.byId[qid]) this.opts.onFocus?.(qid);
      active = { pg, strokes, stroke: this.tool === 'eraser' ? null : { tool: this.tool, pts: [pt] } };
      if (active.stroke) strokes.push(active.stroke);
      else this.erase(active, pt);
      el.setPointerCapture?.(e.pointerId);
    });
    this.root.addEventListener('pointermove', e => {
      if (!active) return;
      const pt = toPt(e, active.pg);
      if (!active.stroke) return this.erase(active, pt);
      let p = pt;
      if (active.stroke.tool === 'highlighter') p = [pt[0], active.stroke.pts[0][1]]; // marca-texto segue a linha
      active.stroke.pts.push(p);
      const ctx = active.pg.ink.getContext('2d');
      const k = this.currentScale * (active.pg.dpr || 1);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      if (active.stroke.tool === 'highlighter') this.drawInk(active.pg);
      else this.strokePath(ctx, { tool: active.stroke.tool, pts: active.stroke.pts.slice(-2) });
    });
    const end = () => {
      if (!active) return;
      const { pg, strokes } = active;
      active = null;
      saveInk(this.opts.attemptId, pg.p, strokes);
      this.drawInk(pg);
    };
    this.root.addEventListener('pointerup', end);
    this.root.addEventListener('pointercancel', end);
  }

  erase(active, [x, y]) {
    const before = active.strokes.length;
    const r = 8;
    for (let i = active.strokes.length - 1; i >= 0; i--) {
      if (active.strokes[i].pts.some(([px, py]) => Math.abs(px - x) < r && Math.abs(py - y) < r)) active.strokes.splice(i, 1);
    }
    if (active.strokes.length !== before) this.drawInk(active.pg);
  }

  async clearInk(p) {
    const strokes = await this.loadInk(p);
    strokes.length = 0;
    await saveInk(this.opts.attemptId, p, strokes);
    this.drawInk(this.pages[p - 1]);
  }
}
