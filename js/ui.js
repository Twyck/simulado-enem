// Pequenos utilitários de interface: ícones, modal, toast e formatação.
const path = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const icon = {
  back: path('<path d="M15 18l-6-6 6-6"/>'),
  pause: path('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'),
  play: path('<path d="M7 5l12 7-12 7z"/>'),
  mark: path('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="currentColor"/>'),
  cross: path('<circle cx="12" cy="12" r="8"/><path d="M5 17L19 7"/>'),
  pen: path('<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 6l3 3"/>'),
  highlighter: path('<path d="M9 14l-4 4v2h4l4-4"/><path d="M9 14l7-9 4 4-9 7z"/>'),
  eraser: path('<path d="M7 20h11"/><path d="M4.5 14.5l9-9a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3L13 18H8z"/>'),
  zoomIn: path('<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M11 8v6M8 11h6"/>'),
  zoomOut: path('<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6"/>'),
  sheet: path('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
  flag: path('<path d="M5 21V4h11l-2 4 2 4H5" fill="currentColor"/>'),
  check: path('<path d="M5 12l5 5 9-10"/>'),
  download: path('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  trash: path('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  eye: path('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: path('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
};

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function clock(sec, withHours = true) {
  sec = Math.max(0, Math.floor(sec));
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return withHours || hh ? `${hh}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
}

// "3 min 20 s", "45 s", "1 h 05 min"
export function dur(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s ? `${m} min ${String(s).padStart(2, '0')} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const fmtPct = v => `${String(v).replace('.', ',')}%`;

export function modal({ title, body, actions }) {
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    const el = h(`<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">
      <h3>${title}</h3><p>${body}</p><div class="actions"></div></div></div>`);
    const box = el.querySelector('.actions');
    const close = v => { el.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    for (const a of actions) {
      const b = h(`<button class="btn ${a.kind || ''}">${a.label}</button>`);
      b.onclick = () => close(a.value);
      box.append(b);
    }
    el.addEventListener('click', e => { if (e.target === el) close(null); });
    document.addEventListener('keydown', onKey);
    root.append(el);
    box.lastElementChild?.focus();
  });
}

export function toast(msg, ms = 2200) {
  const el = h(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}
