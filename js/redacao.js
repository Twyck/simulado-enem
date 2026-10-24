// Redação: proposta oficial (as páginas do próprio caderno do 1º dia), folha de 30 linhas e autoavaliação
// pelas 5 competências da matriz do INEP. O app não corrige a redação: a nota é a que você se dá.
import { loadLayout, qNumber } from './data.js';
import { openPdf } from './viewer.js';
import { saveAttempt } from './store.js';
import { h, icon, clock, esc, modal } from './ui.js';

export const TEMAS = {
  2017: 'Desafios para a formação educacional de surdos no Brasil',
  2018: 'Manipulação do comportamento do usuário pelo controle de dados na internet',
  2019: 'Democratização do acesso ao cinema no Brasil',
  2020: 'O estigma associado às doenças mentais na sociedade brasileira',
  2021: 'Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil',
  2022: 'Desafios para a valorização de comunidades e povos tradicionais no Brasil',
  2023: 'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil',
  2024: 'Desafios para a valorização da herança africana no Brasil',
  2025: 'Perspectivas acerca do envelhecimento na sociedade brasileira',
};
export const REDACAO_MINUTOS = 60; // costuma-se reservar cerca de 1 hora do 1º dia para a redação

// a folha oficial tem 30 linhas; digitando, contamos ~70 caracteres por linha manuscrita
const CHARS_LINHA = 70;
export const contarLinhas = texto => (texto || '').split('\n').map(p => p.trim()).filter(Boolean)
  .reduce((s, p) => s + Math.ceil(p.length / CHARS_LINHA), 0);

// páginas da proposta: entre a última de Linguagens e a primeira de Ciências Humanas
export async function paginasRedacao(year) {
  const layout = await loadLayout(year, 1);
  const qs = Object.entries(layout.questions);
  const ult = Math.max(...qs.filter(([id]) => qNumber(id) <= 45).flatMap(([, q]) => [q.p, ...q.alts.map(a => a.p)]));
  const pri = Math.min(...qs.filter(([id]) => qNumber(id) >= 46).map(([, q]) => q.p));
  return Array.from({ length: pri - ult - 1 }, (_, i) => ult + 1 + i);
}

export async function renderProposta(host, year, pdf) {
  pdf ??= await openPdf(year, 1);
  const pages = await paginasRedacao(year);
  host.innerHTML = '';
  for (const p of pages) {
    const page = await pdf.getPage(p);
    const w = Math.min(host.clientWidth || 700, 900);
    const vp1 = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const vp = page.getViewport({ scale: (w / vp1.width) * dpr });
    const c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    c.style.width = `${w}px`;
    host.append(c);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
  return pdf;
}

// ---------------- folha ----------------
export const folhaHTML = (texto = '', readOnly = false) => `<div class="folha">
  <div class="folha-head"><b>Folha de redação</b><span class="linhas tabular"></span></div>
  <textarea class="folha-txt" spellcheck="false" ${readOnly ? 'readonly' : ''} placeholder="${readOnly ? '' : 'Escreva aqui o texto definitivo, em até 30 linhas. Deixe uma linha em branco entre os parágrafos.'}">${esc(texto)}</textarea>
  <p class="folha-aviso"></p></div>`;

export function mountFolha(root, { onInput } = {}) {
  const ta = root.querySelector('.folha-txt');
  const linhas = root.querySelector('.linhas');
  const aviso = root.querySelector('.folha-aviso');
  const upd = () => {
    const n = contarLinhas(ta.value);
    linhas.textContent = `≈ ${n} de 30 linhas`;
    linhas.classList.toggle('over', n > 30);
    aviso.textContent = !n ? '' : n <= 7 ? 'Até 7 linhas é “texto insuficiente” e recebe nota zero.' : n > 30 ? 'Passou de 30 linhas: o que passar não cabe na folha oficial.' : '';
    // a folha cresce com o texto e mantém as linhas pautadas
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 30 * 32 + 16)}px`;
  };
  ta.addEventListener('input', () => { upd(); onInput?.(ta.value); });
  requestAnimationFrame(upd);
  return { get: () => ta.value, focus: () => ta.focus() };
}

// ---------------- autoavaliação ----------------
export const COMPETENCIAS = [
  { nome: 'Demonstrar domínio da modalidade escrita formal da língua portuguesa.',
    guia: ['Ortografia, acentuação, concordância, regência e pontuação estão corretas?', 'As frases estão completas, sem períodos truncados ou longos demais?', 'O vocabulário é formal, sem gírias ou marcas de oralidade?'] },
  { nome: 'Compreender a proposta de redação e aplicar conceitos das várias áreas de conhecimento para desenvolver o tema, dentro dos limites estruturais do texto dissertativo-argumentativo em prosa.',
    guia: ['Você tratou o tema inteiro, e não só um assunto próximo?', 'O texto tem introdução com tese, desenvolvimento e conclusão?', 'Usou repertório (dados, autores, fatos históricos, leis) ligado ao tema e à discussão?'] },
  { nome: 'Selecionar, relacionar, organizar e interpretar informações, fatos, opiniões e argumentos em defesa de um ponto de vista.',
    guia: ['Há um ponto de vista claro do começo ao fim?', 'Cada argumento é explicado e ligado à tese, sem contradições?', 'O texto vai além de repetir os textos motivadores?'] },
  { nome: 'Demonstrar conhecimento dos mecanismos linguísticos necessários para a construção da argumentação.',
    guia: ['Os parágrafos se ligam por conectivos variados?', 'Dentro dos parágrafos, as ideias se encadeiam sem saltos?', 'Você evita repetir palavras, usando pronomes e sinônimos?'] },
  { nome: 'Elaborar proposta de intervenção para o problema abordado, respeitando os direitos humanos.',
    elementos: ['Agente (quem vai agir)', 'Ação (o que fazer)', 'Modo ou meio (como fazer)', 'Efeito ou finalidade (para quê)', 'Detalhamento (mais informação sobre um dos elementos)'] },
];
export const ZEROS = [
  'Tem até 7 linhas escritas (“texto insuficiente”)',
  'Foge ao tema ou não é dissertativo-argumentativo',
  'Tem parte deliberadamente desconectada do tema',
  'Tem nome, assinatura, rubrica ou outra identificação',
];
const NIVEIS = [0, 40, 80, 120, 160, 200];

export const notaRedacao = av => (!av || av.zero?.some(Boolean) ? 0 : av.c.reduce((s, v) => s + (v || 0), 0));
export const avaliada = av => !!av && (av.zero?.some(Boolean) || av.c.every(v => v != null));

export function autoavaliacaoHTML(av) {
  return `<div class="autoav">
    <div class="av-zero"><b>Antes: algum motivo de nota zero?</b><span class="muted"> (instruções do caderno oficial)</span>
      ${ZEROS.map((z, i) => `<label><input type="checkbox" data-zero="${i}" ${av.zero?.[i] ? 'checked' : ''}> ${z}</label>`).join('')}</div>
    ${COMPETENCIAS.map((c, i) => `<div class="av-comp" data-c="${i}">
      <div class="av-head"><span class="av-n">C${i + 1}</span><p>${c.nome}</p></div>
      ${c.guia ? `<ul class="av-guia">${c.guia.map(g => `<li>${g}</li>`).join('')}</ul>` : `<div class="av-el"><span class="muted">Marque os elementos que a sua proposta tem; na correção, cada um vale 40 pontos.</span>
        ${c.elementos.map((e, j) => `<label><input type="checkbox" data-el="${j}" ${av.el?.[j] ? 'checked' : ''}> ${e}</label>`).join('')}</div>`}
      <div class="av-niveis" role="group" aria-label="Nota da competência ${i + 1}">${NIVEIS.map(v => `<button class="chip" data-v="${v}" aria-pressed="${av.c[i] === v}">${v}</button>`).join('')}</div>
    </div>`).join('')}
    <div class="av-total"><span>Sua nota na redação</span><b class="tabular"></b><small class="muted"></small></div>
  </div>`;
}

export function mountAutoavaliacao(root, av, onChange) {
  const paint = () => {
    const zero = av.zero?.some(Boolean);
    root.querySelectorAll('.av-comp').forEach((el, i) => {
      el.classList.toggle('off', zero);
      el.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', String(av.c[i] === +b.dataset.v)));
    });
    const ok = avaliada(av);
    root.querySelector('.av-total b').textContent = ok ? String(notaRedacao(av)) : '—';
    root.querySelector('.av-total small').textContent = zero ? 'nota zero' : ok ? 'autoavaliação' : `faltam ${av.c.filter(v => v == null).length} competências`;
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    av.c[+b.closest('.av-comp').dataset.c] = +b.dataset.v;
    paint(); onChange(av);
  });
  root.addEventListener('change', e => {
    const z = e.target.closest('[data-zero]'), el = e.target.closest('[data-el]');
    if (z) { av.zero ??= []; av.zero[+z.dataset.zero] = z.checked; }
    if (el) {
      av.el ??= [];
      av.el[+el.dataset.el] = el.checked;
      av.c[4] = 40 * av.el.filter(Boolean).length; // competência 5: 40 pontos por elemento
    }
    paint(); onChange(av);
  });
  paint();
}

export const novaAvaliacao = () => ({ c: [null, null, null, null, null], zero: [], el: [] });

// ---------------- redação avulsa (tipo "Redação" na nova prova) ----------------
export async function redacaoScreen(app, attempt, { go, setLeave }) {
  attempt.texto ??= '';
  const limit = attempt.limitSec;
  app.innerHTML = '';
  const el = h(`<div class="exam redacao-tela">
    <header class="exam-bar">
      <button class="btn ghost sm back" title="Voltar">${icon.back}</button>
      <div class="title">Redação ENEM ${attempt.year}<small>${esc(TEMAS[attempt.year])}</small></div>
      <div class="timer"><b class="tabular t-main">0:00:00</b><small class="t-sub"></small></div>
      <div class="bar-group end">
        <div class="red-tabs" role="tablist"><button class="chip" data-tab="prop" aria-pressed="true">Proposta</button><button class="chip" data-tab="folha" aria-pressed="false">Folha</button></div>
        <button class="btn sm primary finish">${icon.check} Entregar</button>
      </div>
    </header>
    <div class="red-main">
      <section class="red-prop"><div class="red-pages"><p class="muted">Abrindo a proposta no caderno oficial do INEP…</p></div></section>
      <section class="red-folha">${folhaHTML(attempt.texto)}</section>
    </div>
  </div>`);
  app.append(el);
  let dirty = false, destroyed = false, pdf;
  const save = () => { dirty = false; return saveAttempt(attempt); };
  mountFolha(el.querySelector('.red-folha'), { onInput: v => { attempt.texto = v; dirty = true; } });

  if (attempt.status === 'paused') attempt.status = 'running';
  let last = performance.now();
  const tMain = el.querySelector('.t-main'), tSub = el.querySelector('.t-sub');
  const tick = () => {
    const now = performance.now();
    if (attempt.status === 'running' && !document.hidden) attempt.elapsed += (now - last) / 1000;
    last = now;
    tMain.textContent = clock(limit ? limit - attempt.elapsed : attempt.elapsed);
    tSub.textContent = limit ? 'restante' : 'tempo';
    el.querySelector('.timer').classList.toggle('low', !!limit && limit - attempt.elapsed < 300);
    if (dirty) save();
    if (limit && attempt.elapsed >= limit && attempt.status === 'running') {
      attempt.status = 'paused';
      modal({ title: 'Tempo esgotado', body: 'O tempo que você reservou para a redação acabou. Pode entregar agora ou continuar escrevendo.', actions: [{ label: 'Continuar escrevendo', value: false }, { label: 'Entregar', value: true, kind: 'primary' }] })
        .then(v => { if (v) entregar(); else { attempt.status = 'running'; attempt.limitSec = 0; } });
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  const cleanup = () => { if (destroyed) return; destroyed = true; clearInterval(timer); pdf?.destroy(); };
  setLeave?.(() => { if (attempt.status === 'running') attempt.status = 'paused'; save(); cleanup(); });

  async function entregar() {
    if (!contarLinhas(attempt.texto)) {
      const ok = await modal({ title: 'Folha em branco', body: 'Você ainda não escreveu nada. Entregar mesmo assim?', actions: [{ label: 'Voltar', value: false }, { label: 'Entregar', value: true, kind: 'danger' }] });
      if (!ok) return;
    }
    attempt.status = 'done';
    attempt.finishedAt = Date.now();
    attempt.avaliacao ??= novaAvaliacao();
    await save();
    cleanup();
    go(`#/resultado/${attempt.id}`);
  }
  el.querySelector('.finish').onclick = entregar;
  el.querySelector('.back').onclick = async () => { attempt.status = 'paused'; await save(); cleanup(); go('#/'); };
  el.querySelector('.red-tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    el.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    el.classList.toggle('show-folha', b.dataset.tab === 'folha');
  });

  try {
    pdf = await renderProposta(el.querySelector('.red-pages'), attempt.year);
    if (destroyed) pdf.destroy();
  } catch (err) {
    el.querySelector('.red-pages').innerHTML = `<p class="muted">Não foi possível abrir o caderno (${esc(err.message)}). O tema é: <b>${esc(TEMAS[attempt.year])}</b>.</p>`;
  }
}

// resultado da redação avulsa: o texto e a autoavaliação
export function redacaoResultado(app, attempt) {
  attempt.avaliacao ??= novaAvaliacao();
  app.innerHTML = '';
  const el = h(`<div class="results">
    <div class="results-top"><a class="btn ghost sm" href="#/">${icon.back} Início</a><h1>Redação ENEM ${attempt.year}</h1>
      <span class="muted">${esc(TEMAS[attempt.year])}</span></div>
    ${redacaoPainel(attempt)}
  </div>`);
  app.append(el);
  montarPainel(el, attempt);
  window.scrollTo(0, 0);
}

// painel com o texto entregue e a autoavaliação (também no resultado do 1º dia)
export const redacaoPainel = attempt => `<section class="panel red-panel">
  <h2>Sua redação</h2>
  <p class="sub">O app não corrige redação. Releia o texto e dê a nota de cada competência como um corretor do ENEM daria; ela entra na simulação do SISU como “autoavaliação”.</p>
  <div class="grid2 red-grid">
    <div>${folhaHTML(attempt.texto ?? attempt.redacao ?? '', true)}</div>
    <div>${autoavaliacaoHTML(attempt.avaliacao ?? novaAvaliacao())}</div>
  </div></section>`;

export function montarPainel(root, attempt) {
  const folha = root.querySelector('.red-panel .folha');
  if (!folha) return;
  mountFolha(folha);
  attempt.avaliacao ??= novaAvaliacao();
  mountAutoavaliacao(root.querySelector('.red-panel .autoav'), attempt.avaliacao, () => saveAttempt(attempt));
}
