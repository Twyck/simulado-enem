// Visor do treino por matéria: cada questão aparece recortada do caderno oficial (pode vir de anos
// diferentes), com as mesmas bolinhas clicáveis do visor da prova completa.
import { openPdf } from './viewer.js';

export class CropViewer {
  constructor(root, exam, opts) {
    this.root = root;
    this.exam = exam;
    this.opts = opts; // { mode, state(), onMark, onCross, onFocus }
    this.zoom = 1;
    this.tool = 'mark';
    this.docs = new Map(); // "ano-dia" -> Promise<PDFDocumentProxy>
    this.cards = new Map(); // qid -> { el, crops: [...] }
    this.bubbles = new Map();
    this.onResize = () => this.relayout();
  }

  get scroller() { return this.root.parentElement; }

  doc(year, day) {
    const k = `${year}-${day}`;
    if (!this.docs.has(k)) this.docs.set(k, openPdf(year, day));
    return this.docs.get(k);
  }

  async load() {
    this.root.innerHTML = '';
    this.root.classList.add('crop-cards');
    for (const q of this.exam.questions) {
      const el = document.createElement('article');
      el.className = 'qcard';
      el.dataset.q = q.id;
      el.innerHTML = `<header><b>${q.idx}</b><span>${q.origem}</span></header><div class="crops"></div>`;
      const box = el.querySelector('.crops');
      const crops = (q.pos?.parts || []).map(part => {
        const c = document.createElement('div');
        c.className = 'crop';
        c.innerHTML = '<canvas></canvas><div class="overlay"></div>';
        box.append(c);
        return { part, el: c, canvas: c.querySelector('canvas'), overlay: c.querySelector('.overlay'), rendered: 0 };
      });
      el.addEventListener('click', () => this.opts.onFocus?.(q.id));
      this.root.append(el);
      this.cards.set(q.id, { q, el, crops, ready: null });
    }
    this.observer = new IntersectionObserver(entries => {
      for (const en of entries) {
        const card = this.cards.get(en.target.dataset.q);
        card.visible = en.isIntersecting;
        if (en.isIntersecting) this.renderCard(card);
      }
    }, { root: this.scroller, rootMargin: '1200px 0px' });
    this.cards.forEach(c => this.observer.observe(c.el));
    window.addEventListener('resize', this.onResize);
    // o primeiro caderno precisa abrir antes de a tela aparecer
    const first = this.exam.questions[0];
    if (first) await this.doc(first.src.year, first.src.day);
    this.relayout();
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.docs.forEach(p => p.then(d => d.destroy()).catch(() => {}));
  }

  // escala: uma coluna do caderno ocupa até ~640 px; questões de página inteira cabem na largura disponível
  scaleFor(w, pageW) {
    const avail = Math.max(260, Math.min(this.scroller.clientWidth - 40, 1000));
    const base = (Math.min(avail, 640) / (pageW * 0.46)) * this.zoom;
    return Math.min(base, (avail * this.zoom) / w);
  }

  async prepare(card) {
    card.ready ??= (async () => {
      const { year, day } = card.q.src;
      const doc = await this.doc(year, day);
      for (const cr of card.crops) {
        cr.page = await doc.getPage(cr.part.p);
        const vp = cr.page.getViewport({ scale: 1 });
        const [vx0, vy0] = vp.convertToViewportPoint(cr.part.x0, cr.part.y0);
        const [vx1, vy1] = vp.convertToViewportPoint(cr.part.x1, cr.part.y1);
        Object.assign(cr, { vp, vx0, vy0, w: vx1 - vx0, h: vy1 - vy0 });
      }
      this.buildBubbles(card);
    })();
    return card.ready;
  }

  relayout() {
    for (const card of this.cards.values()) {
      if (card.visible) this.renderCard(card);
      else card.crops.forEach(cr => { cr.rendered = 0; });
    }
  }

  setZoom(z) {
    this.zoom = Math.min(2.5, Math.max(0.6, z));
    this.relayout();
  }

  async renderCard(card) {
    await this.prepare(card);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const cr of card.crops) {
      const s = this.scaleFor(cr.w, cr.vp.width);
      cr.el.style.width = `${cr.w * s}px`;
      cr.el.style.height = `${cr.h * s}px`;
      cr.el.style.setProperty('--s', s);
      if (cr.rendered === s) continue;
      cr.rendered = s;
      cr.task?.cancel();
      const k = s * dpr;
      const off = document.createElement('canvas');
      off.width = Math.ceil(cr.w * k);
      off.height = Math.ceil(cr.h * k);
      const viewport = cr.page.getViewport({ scale: k, offsetX: -cr.vx0 * k, offsetY: -cr.vy0 * k });
      cr.task = cr.page.render({ canvasContext: off.getContext('2d'), viewport });
      try {
        await cr.task.promise;
        cr.canvas.width = off.width;
        cr.canvas.height = off.height;
        cr.canvas.getContext('2d').drawImage(off, 0, 0);
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.error(e);
      }
    }
  }

  buildBubbles(card) {
    const q = card.q;
    for (const a of q.pos?.alts || []) {
      // trecho do recorte que contém a alternativa
      const cr = card.crops.find(c => c.part.p === a.p && a.x >= c.part.x0 - 2 && a.x <= c.part.x1 && a.y <= c.part.y0 && a.y >= c.part.y1 - 2);
      if (!cr) continue;
      const [cx, cy] = cr.vp.convertToViewportPoint(a.x + a.s / 2, a.y + a.s * 0.34);
      const sameRow = q.pos.alts.filter(o => o !== a && o.p === a.p && Math.abs(o.y - a.y) < 2 && o.x > a.x).map(o => o.x - 6);
      const len = Math.max(40, Math.min(cr.part.x1 - 4, ...sameRow) - a.x);
      const b = document.createElement('button');
      b.className = 'bubble';
      b.type = 'button';
      b.dataset.q = q.id;
      b.dataset.l = a.L;
      b.title = `Questão ${q.idx}: alternativa ${a.L}`;
      b.style.cssText = `--x:${cx - cr.vx0};--y:${cy - cr.vy0};--r:${a.s * 0.62};--len:${len}`;
      b.innerHTML = `<span>${a.L}</span>`;
      cr.overlay.append(b);
      this.bubbles.set(`${q.id}:${a.L}`, b);
      let press;
      b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') press = setTimeout(() => { press = 'fired'; this.opts.onCross?.(q.id, a.L); }, 480); });
      const clear = () => { if (press !== 'fired') clearTimeout(press); };
      b.addEventListener('pointerup', clear);
      b.addEventListener('pointerleave', clear);
      b.addEventListener('contextmenu', e => { e.preventDefault(); if (press !== 'fired') this.opts.onCross?.(q.id, a.L); });
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (press === 'fired') { press = null; return; }
        if (this.opts.mode !== 'exam') return;
        if (this.tool === 'cross' || e.altKey) this.opts.onCross?.(q.id, a.L);
        else this.opts.onMark?.(q.id, a.L);
      });
    }
    this.refresh(q.id);
  }

  refresh(qid) {
    const st = this.opts.state();
    const q = this.exam.byId[qid];
    for (const L of 'ABCDE') {
      const b = this.bubbles.get(`${qid}:${L}`);
      if (!b) continue;
      const mine = st.answers[qid] === L;
      b.classList.toggle('marked', mine);
      b.classList.toggle('crossed', !!st.crossed[qid]?.includes(L));
      if (this.opts.mode === 'review') {
        b.classList.toggle('key', q.key === L);
        b.classList.toggle('wrong', mine && q.key !== L && q.key !== 'X');
      }
    }
  }

  refreshAll() { this.exam.ids.forEach(id => this.refresh(id)); }

  setCurrent(qid) {
    this.cards.forEach((c, id) => c.el.classList.toggle('current', id === qid && this.opts.mode === 'exam'));
  }

  scrollToQuestion(qid, smooth = true) {
    const c = this.cards.get(qid);
    if (c) this.scroller.scrollTo({ top: c.el.offsetTop - 12, behavior: smooth ? 'smooth' : 'auto' });
  }

  visibleQuestions() {
    const sc = this.scroller.getBoundingClientRect();
    const out = [];
    for (const [id, c] of this.cards) {
      const r = c.el.getBoundingClientRect();
      if (r.bottom > sc.top + 60 && r.top < sc.bottom - 60) out.push(id);
    }
    return out;
  }

  setTool(tool) {
    this.tool = tool;
    this.root.dataset.tool = tool;
  }
}
