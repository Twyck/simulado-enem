// Imagem do boletim para mandar aos amigos: notas TRI, acertos e percentil, no visual do cartão-resposta.
import { toast } from './ui.js';

const W = 1080;
const C = { navy: '#13223f', ink2: '#44506a', muted: '#7a8499', form: '#1597cf', soft: '#e4f3fa', line: '#e1e5ec', paper: '#ffffff', bg: '#eceff3', good: '#0ca30c' };

// linhas: [{ label, nota, acertos, pct }]; destaque: { label, valor, sub }
export async function compartilharBoletim({ titulo, data, linhas, destaque, rodape }) {
  await Promise.all(['700 40px Archivo', '400 20px Archivo'].map(f => document.fonts?.load(f).catch(() => null)));
  const H = 760 + linhas.length * 132; // a altura acompanha o número de áreas
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const font = (w, s) => `${w} ${s}px Archivo, system-ui, sans-serif`;
  const text = (t, x, y, { f = font(400, 28), c = C.navy, a = 'left' } = {}) => { g.font = f; g.fillStyle = c; g.textAlign = a; g.fillText(t, x, y); };

  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  // folha
  const X = 60, Y = 60, FW = W - 120, FH = H - 120;
  g.fillStyle = C.paper; g.beginPath(); g.roundRect(X, Y, FW, FH, 28); g.fill();
  // marcas de sincronismo na borda
  g.fillStyle = C.navy;
  for (let y = Y + 50; y < Y + FH - 40; y += 44) g.fillRect(X + 26, y, 12, 7);

  const L = X + 80;
  text('SIMULADO ENEM', L, Y + 90, { f: font(800, 26), c: C.form });
  text(titulo, L, Y + 150, { f: font(800, 52) });
  text(data, L, Y + 196, { f: font(400, 28), c: C.ink2 });
  g.fillStyle = C.form; g.fillRect(L, Y + 230, FW - 140, 3);

  // destaque
  g.fillStyle = C.soft; g.beginPath(); g.roundRect(L, Y + 268, FW - 140, 270, 20); g.fill();
  text(destaque.label, L + 36, Y + 326, { f: font(600, 30), c: C.ink2 });
  text(destaque.valor, L + 36, Y + 440, { f: font(800, 120) });
  if (destaque.sub) text(destaque.sub, L + 36, Y + 500, { f: font(700, 30), c: C.form });

  // linhas por área
  let y = Y + 630;
  for (const l of linhas) {
    text(l.label, L, y, { f: font(650, 34) });
    text(l.acertos, L, y + 42, { f: font(400, 26), c: C.muted });
    text(l.nota, L + FW - 140, y + 6, { f: font(800, 56), a: 'right' });
    if (l.pct) text(l.pct, L + FW - 140, y + 46, { f: font(600, 24), c: C.form, a: 'right' });
    g.fillStyle = C.line; g.fillRect(L, y + 72, FW - 140, 2);
    y += 132;
  }
  text(rodape, L, Y + FH - 50, { f: font(400, 19), c: C.muted });

  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], 'boletim-simulado-enem.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titulo }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Imagem do boletim baixada');
}
