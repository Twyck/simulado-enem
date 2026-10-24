// Apresentação do app (primeira visita e #/sobre). Tudo o que aparece aqui é real:
// a página do caderno de 2024 com o gabarito oficial da questão 2, a validação da nota contra os
// microdados e a dificuldade oficial das 180 questões do ENEM 2024.
import { AREAS, loadItens } from './data.js';
import { dificuldade } from './tri.js';

// posição (em % da imagem) das alternativas da questão 2 no recorte img/caderno-2024.webp
// (calculado com a CropBox da página: o PDF do INEP tem margem de sangria de 34 pt)
const Q2 = { A: 56.44, B: 59.15, C: 61.85, D: 64.56, E: 67.26 };
const Q2_X = 51.92;
const SERIES = { LC: 'var(--series-1)', CH: 'var(--series-2)', CN: 'var(--series-3)', MT: 'var(--series-4)' };

const bubble = (L, cls = '') => `<span class="mk ${cls}" style="left:${Q2_X}%;top:${Q2[L]}%"></span>`;

export function introHTML() {
  return `<div class="landing">
    <section class="l-hero">
      <h1 class="l-title">ENEM.<br>Do jeito que cai.</h1>
      <p class="l-lead">As provas oficiais do INEP, de 2017 a 2025, na tela. Com cartão-resposta, cronômetro e a nota calculada pela TRI.</p>
      <div class="l-ctas"><a class="pill" href="#nova" data-go="nova">Fazer uma prova</a><a class="more" href="#como" data-go="como">Como funciona</a></div>
      <figure class="device reveal" aria-label="Tela de prova do Simulado ENEM com o caderno oficial de 2024">
        <div class="device-bar"><span class="d-title">ENEM 2024, 1º dia</span><span class="d-timer">5:30:00</span><span class="d-tools"><i></i><i></i><i></i><i></i></span></div>
        <div class="device-body">
          <div class="d-page"><img src="img/caderno-2024.webp" alt="Página 2 do caderno Azul do ENEM 2024, com as questões 1 e 2" width="1100" height="936">
            ${bubble('A', 'on')}${bubble('C', 'x')}${bubble('E', 'x')}</div>
          <div class="d-sheet">
            <div class="d-sheet-head">Cartão-resposta</div>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<div class="d-row"><b>${String(n).padStart(2, '0')}</b>${'ABCDE'.split('').map(L => `<span class="${n === 2 && L === 'A' ? 'on' : ''}">${L}</span>`).join('')}</div>`).join('')}
          </div>
        </div>
      </figure>
    </section>

    <section class="l-section l-alt" id="como">
      <div class="l-split">
        <div class="l-copy">
          <h2 class="l-h2">Marque na própria prova.</h2>
          <p>Toque na letra para marcar. Toque e segure para riscar a alternativa que você descartou. Caneta e marca-texto para anotar, como no caderno impresso.</p>
          <p class="l-small">Na imagem, a questão 2 de 2024 marcada com o gabarito oficial.</p>
        </div>
        <div class="zoom-card"><div class="zoom-inner"><img src="img/caderno-2024.webp" alt="" aria-hidden="true">
          ${bubble('A', 'on')}${bubble('C', 'x')}${bubble('E', 'x')}</div></div>
      </div>
    </section>

    <section class="l-section l-dark">
      <p class="l-kicker">Nota pela TRI</p>
      <div class="l-stat">0,03</div>
      <p class="l-stat-text">ponto de diferença, em média, entre a nota calculada aqui e a nota oficial do INEP.</p>
      <p class="l-small">Conferido com as respostas de cerca de 250 mil participantes de 2017 a 2025, usando os parâmetros de cada questão publicados nos microdados do ENEM.</p>
    </section>

    <section class="l-section">
      <h2 class="l-h2 center">Cada questão tem um peso.</h2>
      <p class="l-lead center">Cada ponto é uma questão do ENEM 2024, na posição da sua dificuldade oficial. Depois da prova, você vê quais fáceis errou: são os erros que mais derrubam a nota.</p>
      <div class="l-chart" id="l-dif"></div>
    </section>

    <section class="l-section l-alt">
      <h2 class="l-h2 center">Tudo o que a prova mede.</h2>
      <div class="bento">
        <div class="b-tile b-wide"><div class="b-big">5h30</div><h3>Cronômetro oficial</h3><p>5h30 no 1º dia e 5h no 2º, como no exame. Ou sem limite, para treinar com calma.</p></div>
        <div class="b-tile"><div class="b-ovals"><i></i><i class="on"></i><i></i><i></i><i></i></div><h3>Cartão-resposta</h3><p>Marque pelo PDF ou pelo cartão, e revise com o gabarito.</p></div>
        <div class="b-tile"><div class="b-big">120</div><h3>Habilidades oficiais</h3><p>O mapa da Matriz de Referência mostra o que você mais erra.</p></div>
        <div class="b-tile"><div class="b-big">18</div><h3>Provas</h3><p>2017 a 2025, primeiro e segundo dia, inglês ou espanhol.</p></div>
        <div class="b-tile b-wide"><div class="b-big">3:20</div><h3>Tempo de cada questão</h3><p>É o tempo por questão para fechar o 2º dia no limite. O app mede o seu em cada uma e mostra onde você travou e onde passou rápido demais.</p></div>
        <div class="b-tile"><h3>Funciona sem internet</h3><p>Instale no celular e faça a prova em qualquer lugar.</p></div>
        <div class="b-tile"><h3>Grátis e sem conta</h3><p>Suas respostas ficam só no seu aparelho.</p></div>
      </div>
    </section>

    <section class="l-section l-end">
      <h2 class="l-h2 center">Escolha a prova e comece.</h2>
      <div class="l-ctas center"><a class="pill" href="#nova" data-go="nova">Fazer uma prova</a></div>
    </section>
  </div>`;
}

export async function mountIntro(root) {
  root.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById(a.dataset.go)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  // a imagem principal aparece uma vez, ao entrar na tela
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  root.querySelectorAll('.reveal').forEach(el => io.observe(el));
  difStrip(root.querySelector('#l-dif'), await loadItens());
}

// as 180 questões de 2024 na escala da nota, uma faixa por área
function difStrip(host, itens) {
  if (!host) return;
  const rows = ['LC', 'CH', 'CN', 'MT'].map(area => {
    const day = area === 'LC' || area === 'CH' ? 'd1' : 'd2';
    const from = AREAS[area].from, to = AREAS[area].to;
    const pts = Object.entries(itens['2024']?.[day] || {})
      .filter(([id, it]) => { const n = parseInt(id, 10); return n >= from && n <= to && it.b !== undefined && !id.endsWith('es'); })
      .map(([, it]) => dificuldade(area, it.b));
    return { area, pts };
  });
  const W = 980, L = 170, R = 20, ROW = 46, T = 6, B = 30, lo = 300, hi = 1000, r = 5;
  const H = T + ROW * rows.length + B;
  const x = v => L + (W - L - R) * ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
  const ticks = [300, 400, 500, 600, 700, 800, 900, 1000];
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dificuldade oficial das questões do ENEM 2024 por área">
    ${ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - B}" class="gl"/><text x="${x(v)}" y="${H - 8}" text-anchor="middle" class="ax">${v === hi ? '1000+' : v}</text>`).join('')}
    ${rows.map((row, i) => {
      const cy = T + ROW * i + ROW / 2;
      const placed = [];
      const dots = row.pts.sort((a, b) => a - b).map(v => {
        const cx = x(v);
        let k = 0, dy;
        do { dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 6; k++; } while (placed.some(p => Math.abs(p.cx - cx) < r * 2 && Math.abs(p.dy - dy) < 6) && k < 7);
        placed.push({ cx, dy });
        return `<circle cx="${cx.toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="${r}" fill="${SERIES[row.area]}" fill-opacity=".85"/>`;
      }).join('');
      return `<text x="0" y="${cy + 5}" class="lb">${AREAS[row.area].name}</text>${dots}`;
    }).join('')}
  </svg>
  <div class="l-axis-note"><span>mais fácil</span><span>escala da nota do ENEM</span><span>mais difícil</span></div>`;
}
