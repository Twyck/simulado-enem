// Simulação do SISU: com as suas notas, em quais cursos você teria passado na última edição.
// Notas de corte, pesos e mínimas de cada curso vêm da API oficial do SISU (scripts/build_sisu.py).
import { AREAS, loadFor, nomeProva } from './data.js';
import { listAttempts, kv } from './store.js';
import { computeStats } from './stats.js';
import { notaRedacao, avaliada } from './redacao.js';
import { h, icon, esc } from './ui.js';

export const SISU_ANO = 2025; // SISU 2025 usou as notas do ENEM 2024
export const CAMPOS = [...Object.keys(AREAS), 'RED'];
export const NOME = { ...Object.fromEntries(Object.entries(AREAS).map(([k, v]) => [k, v.name])), RED: 'Redação' };
const QUASE = 20; // "quase lá": até 20 pontos abaixo da nota de corte
const PAGINA = 60;

let dados;
const loadSisu = () => (dados ??= fetch(`data/sisu/${SISU_ANO}.json`).then(r => {
  if (!r.ok) throw new Error('Não foi possível carregar as notas de corte do SISU.');
  return r.json();
}));

export const num = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// modalidades da Lei de Cotas: E escola pública, R renda até 1 salário mínimo per capita,
// PPI / PP / I / Q grupo étnico-racial, D pessoa com deficiência
const GRUPO = { PPI: 'pretos, pardos e indígenas', PP: 'pretos e pardos', I: 'indígenas', Q: 'quilombolas' };
function partes(code) {
  if (code === 'A') return null;
  let r = code.slice(1);
  const renda = r.startsWith('R');
  if (renda) r = r.slice(1);
  const pcd = r.endsWith('D');
  if (pcd) r = r.slice(0, -1);
  return { renda, pcd, grupo: r };
}
export function nomeModalidade(code) {
  const p = partes(code);
  if (!p) return 'Ampla concorrência';
  return ['Escola pública', p.renda && 'renda até 1 salário mínimo', p.grupo && GRUPO[p.grupo], p.pcd && 'com deficiência'].filter(Boolean).join(', ');
}
function elegivel(code, perfil) {
  const p = partes(code);
  if (!p) return true;
  if (!perfil.ep || (p.renda && !perfil.renda) || (p.pcd && !perfil.pcd)) return false;
  if (p.grupo === 'PPI') return perfil.raca === 'pp' || perfil.raca === 'ind';
  if (p.grupo === 'PP') return perfil.raca === 'pp';
  if (p.grupo === 'I') return perfil.raca === 'ind';
  if (p.grupo === 'Q') return perfil.raca === 'quil';
  return true;
}

// meta: um curso escolhido na simulação, acompanhado na tela de evolução
export const getMeta = () => kv.get('meta');
export const getSisuState = () => kv.get('sisu');
function metaDe(d, o) {
  const [nomeCampus, cidade, uf] = d.campi[o[6]];
  return { ano: d.ano, o, curso: d.cursos[o[1]], grau: d.grau[o[2]], turno: d.turno[o[3]], sigla: d.ies[o[5]][0], ies: d.ies[o[5]][1], campus: nomeCampus, cidade, uf };
}
// perfil de cotas só vale para quem estudou em escola pública
export const perfilEfetivo = p => (p?.ep ? p : { ep: false });

// nota de cada área na prova completa mais recente do app
export async function notasDoApp() {
  const todas = (await listAttempts()).filter(a => a.status === 'done')
    .sort((a, b) => (b.finishedAt || b.startedAt) - (a.finishedAt || a.startedAt));
  const feitas = todas.filter(a => a.mode !== 'treino' && a.mode !== 'redacao');
  const out = {};
  // redação: a autoavaliação mais recente (redação avulsa ou a escrita no 1º dia)
  const red = todas.find(a => avaliada(a.avaliacao));
  if (red) out.RED = { v: notaRedacao(red.avaliacao), fonte: `autoavaliação: ${nomeProva(red)}` };
  for (const a of feitas) {
    const st = computeStats(await loadFor(a), a);
    for (const [area, t] of Object.entries(st.tri)) {
      out[area] ??= { v: Math.round(t.nota * 10) / 10, fonte: nomeProva(a), data: a.finishedAt || a.startedAt };
    }
    if (Object.keys(AREAS).every(k => out[k])) break;
  }
  return out;
}

// avalia uma oferta: nota com os pesos do curso, mínimas e a menor nota de corte entre as modalidades possíveis
export function avaliar(o, notas, perfil) {
  const [, , , , , , , pesos, minimas, cortes] = o;
  const vals = CAMPOS.map(c => notas[c]);
  const soma = pesos.reduce((s, p) => s + p, 0);
  const media = pesos.reduce((s, p, i) => s + p * vals[i], 0) / soma;
  const abaixo = CAMPOS.filter((c, i) => minimas[i] > 0 && vals[i] < minimas[i]);
  if (minimas[5] > 0 && media < minimas[5]) abaixo.push('média');
  let melhor = null;
  for (const [code, corte, vagas] of cortes) {
    if (!elegivel(code, perfil)) continue;
    const c = corte ?? 0; // sem nota de corte: menos inscritos que vagas
    if (!melhor || c < melhor.corte) melhor = { code, corte: c, vagas, semCorte: corte == null };
  }
  if (!melhor) return null; // curso só com vagas de cotas que você não pode usar
  const ampla = cortes.find(c => c[0] === 'A');
  const margem = media - melhor.corte;
  const status = abaixo.length ? 'minima' : margem >= 0 ? 'passa' : margem >= -QUASE ? 'quase' : 'falta';
  return { o, media, melhor, ampla, margem, abaixo, status };
}

export async function sisuScreen(app) {
  app.innerHTML = `<div class="results"><div class="results-top"><a class="btn ghost sm" href="#/">${icon.back} Início</a><h1>Simulação do SISU</h1></div>
    <div class="panel"><p class="empty">Carregando as notas de corte…</p></div></div>`;
  const [d, doApp, salvo, metaSalva] = await Promise.all([loadSisu(), notasDoApp(), kv.get('sisu'), getMeta()]);
  let meta = metaSalva?.ano === SISU_ANO ? metaSalva : null;
  const st = {
    manual: salvo?.manual || {}, // notas digitadas (substituem as do app)
    perfil: { ep: false, renda: false, raca: '', pcd: false, ...salvo?.perfil },
    filtro: { q: '', uf: '', turno: '', grau: '', ver: 'passa', ordem: 'corte', ...salvo?.filtro },
  };
  const save = () => kv.set('sisu', { manual: st.manual, perfil: st.perfil, filtro: st.filtro });
  const notaDe = c => (st.manual[c] ?? doApp[c]?.v ?? null);

  const ufs = [...new Set(d.campi.map(c => c[2]))].sort();
  // busca pelo começo das palavras: "medicina" não traz biomedicina
  const busca = d.ofertas.map(o => ` ${semAcento(`${d.cursos[o[1]]} ${d.ies[o[5]].join(' ')} ${d.campi[o[6]].join(' ')}`).replace(/[^a-z0-9/]+/g, ' ')}`);
  const oval = '<i class="oval" aria-hidden="true"></i>';
  const choice = (attr, v, label, sub = '') => `<button class="choice" data-${attr}="${v}">${oval}<span>${label}${sub ? `<span class="sub">${sub}</span>` : ''}</span></button>`;
  const quando = new Date(d.atualizado).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const el = h(`<div class="results sisu">
    <div class="results-top">
      <a class="btn ghost sm" href="#/">${icon.back} Início</a>
      <h1>Simulação do SISU</h1>
      <span class="muted">Notas de corte reais do SISU ${d.ano}, ${d.ofertas.length.toLocaleString('pt-BR')} cursos</span>
    </div>

    <div class="answer-form timing sisu-form">
      <div class="form-head"><h2>Suas notas</h2><span class="code">ENEM → SISU ${d.ano}</span></div>
      <div class="field"><span class="label">Notas<small>de 0 a 1000</small></span>
        <div class="notas">${CAMPOS.map(c => `<label class="nota-in"><span class="k">${NOME[c]}</span>
          <input type="number" inputmode="decimal" min="0" max="1000" step="0.1" data-c="${c}" placeholder="—">
          <span class="src" data-src="${c}"></span></label>`).join('')}</div></div>
      <div class="field"><span class="label">Ensino médio</span><div class="choices">
        ${choice('ep', '0', 'Escola particular ou parte nela')}${choice('ep', '1', 'Todo em escola pública', 'pode concorrer pelas cotas da Lei 12.711')}</div></div>
      <div class="field cota"><span class="label">Renda<small>por pessoa da família</small></span><div class="choices">
        ${choice('renda', '0', 'Acima de 1 salário mínimo')}${choice('renda', '1', 'Até 1 salário mínimo')}</div></div>
      <div class="field cota"><span class="label">Cor ou etnia</span><div class="choices">
        ${choice('raca', '', 'Não concorro por cor ou etnia')}${choice('raca', 'pp', 'Preto ou pardo')}${choice('raca', 'ind', 'Indígena')}${choice('raca', 'quil', 'Quilombola')}</div></div>
      <div class="field cota"><span class="label">Deficiência</span><div class="choices">
        ${choice('pcd', '0', 'Não')}${choice('pcd', '1', 'Pessoa com deficiência')}</div></div>
    </div>

    <div class="panel sisu-aviso hidden"></div>
    <div class="sisu-out">
      <div class="sisu-meta"></div>
      <div class="hero sisu-hero"></div>
      <section class="panel">
        <div class="sisu-filters">
          <input type="search" class="q" placeholder="Curso, universidade ou cidade (ex.: medicina, UFMG)" value="${esc(st.filtro.q)}" aria-label="Buscar">
          <select class="uf" aria-label="Estado"><option value="">Todos os estados</option>${ufs.map(u => `<option ${st.filtro.uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
          <select class="turno" aria-label="Turno"><option value="">Todos os turnos</option>${d.turno.map((t, i) => `<option value="${i}" ${st.filtro.turno === String(i) ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select class="grau" aria-label="Grau"><option value="">Todos os graus</option>${d.grau.map((g, i) => `<option value="${i}" ${st.filtro.grau === String(i) ? 'selected' : ''}>${g}</option>`).join('')}</select>
        </div>
        <div class="filters sisu-ver"><div class="chips"></div>
          <select class="ordem" aria-label="Ordem">
            <option value="corte" ${st.filtro.ordem === 'corte' ? 'selected' : ''}>Maior nota de corte</option>
            <option value="perto" ${st.filtro.ordem === 'perto' ? 'selected' : ''}>Mais perto da sua nota</option>
            <option value="nome" ${st.filtro.ordem === 'nome' ? 'selected' : ''}>Curso de A a Z</option></select>
        </div>
        <div class="sisu-lista"></div>
      </section>
      <p class="note sisu-note">Notas de corte do fim das inscrições do SISU ${d.ano} (${quando}), lidas da API oficial do SISU, com os pesos e as notas mínimas que cada instituição definiu.
        A cada edição o corte muda, então trate o resultado como referência. A sua nota de cada área é a estimativa TRI do app, a não ser que você digite outra.
        Ficaram de fora as ações afirmativas próprias de cada instituição e os bônus regionais; entram a ampla concorrência e as cotas da Lei 12.711.</p>
    </div>
  </div>`);
  app.innerHTML = '';
  app.append(el);
  window.scrollTo(0, 0);

  const out = el.querySelector('.sisu-out');
  const aviso = el.querySelector('.sisu-aviso');
  const hero = el.querySelector('.sisu-hero');
  const chips = el.querySelector('.sisu-ver .chips');
  const lista_ = el.querySelector('.sisu-lista');
  const metaBox = el.querySelector('.sisu-meta');
  lista_.addEventListener('click', async e => {
    const b = e.target.closest('.star[data-cod]');
    if (!b) return;
    const o = d.ofertas.find(x => x[0] === +b.dataset.cod);
    if (meta?.o[0] === o[0]) { meta = null; await kv.del('meta'); }
    else { meta = metaDe(d, o); await kv.set('meta', meta); }
    render();
  });
  const inputs = [...el.querySelectorAll('.notas input')];
  const paintNotas = () => {
    for (const inp of inputs) {
      const c = inp.dataset.c, v = notaDe(c);
      if (document.activeElement !== inp) inp.value = v ?? '';
      const src = el.querySelector(`[data-src="${c}"]`);
      if (st.manual[c] != null) {
        src.innerHTML = doApp[c] ? `digitada por você · <button class="linkish" data-reset="${c}">usar ${String(doApp[c].v).replace('.', ',')} do app</button>` : 'digitada por você';
      } else if (doApp[c]) {
        src.textContent = c === 'RED' ? `da sua ${doApp[c].fonte}` : `da prova ${doApp[c].fonte}`;
      } else {
        src.textContent = c === 'RED' ? 'o app não corrige redação: digite a sua nota' : 'faça a prova no app ou digite';
      }
    }
  };
  const paintPerfil = () => {
    const p = st.perfil;
    const on = (attr, v) => el.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === v)));
    on('ep', p.ep ? '1' : '0'); on('renda', p.renda ? '1' : '0'); on('raca', p.raca); on('pcd', p.pcd ? '1' : '0');
    el.querySelectorAll('.field.cota').forEach(f => f.classList.toggle('hidden', !p.ep));
  };

  let shown = PAGINA;
  const render = () => {
    const notas = Object.fromEntries(CAMPOS.map(c => [c, notaDe(c)]));
    const faltam = CAMPOS.filter(c => notas[c] == null || Number.isNaN(notas[c]));
    if (faltam.length) {
      out.classList.add('hidden');
      aviso.classList.remove('hidden');
      aviso.innerHTML = `<p class="empty">Preencha ${faltam.map(c => NOME[c]).join(', ').replace(/, ([^,]*)$/, ' e $1')} para ver em quais cursos você passaria. O SISU usa as quatro áreas e a redação.</p>`;
      return;
    }
    out.classList.remove('hidden');
    aviso.classList.add('hidden');
    const perfil = perfilEfetivo(st.perfil);
    const todos = d.ofertas.map(o => avaliar(o, notas, perfil));
    const f = st.filtro;
    const termos = semAcento(f.q).split(/[^a-z0-9/]+/).filter(Boolean);
    const filtrados = todos.filter((r, i) => r && (!f.uf || d.campi[r.o[6]][2] === f.uf) && (f.turno === '' || r.o[3] === +f.turno)
      && (f.grau === '' || r.o[2] === +f.grau) && termos.every(t => busca[i].includes(` ${t}`)));
    const cont = s => filtrados.filter(r => r.status === s).length;
    const passa = filtrados.filter(r => r.status === 'passa');
    const topo = [...passa].sort((a, b) => b.melhor.corte - a.melhor.corte)[0];
    const lista = filtrados.filter(r => f.ver === 'todos' || r.status === f.ver || (f.ver === 'falta' && r.status === 'minima'));
    const ordem = { corte: (a, b) => b.melhor.corte - a.melhor.corte, perto: (a, b) => Math.abs(a.margem) - Math.abs(b.margem), nome: (a, b) => d.cursos[a.o[1]].localeCompare(d.cursos[b.o[1]], 'pt') || b.melhor.corte - a.melhor.corte }[f.ordem];
    lista.sort(ordem);
    const simples = CAMPOS.reduce((s, c) => s + notas[c], 0) / CAMPOS.length;
    const recorte = termos.length || f.uf || f.turno !== '' || f.grau !== '';

    hero.innerHTML = `
        <div class="tile big"><div class="k">Você passaria em</div><div class="v tabular">${passa.length.toLocaleString('pt-BR')} <small>de ${filtrados.length.toLocaleString('pt-BR')}</small></div>
          <div class="s">${recorte ? 'cursos com os filtros abaixo, no' : 'cursos do'} SISU ${d.ano}${st.perfil.ep ? ', contando as cotas que você pode usar' : ', pela ampla concorrência'}</div></div>
        <div class="tile"><div class="k">Quase lá</div><div class="v tabular">${cont('quase').toLocaleString('pt-BR')}</div><div class="s">até ${QUASE} pontos abaixo do corte</div></div>
        <div class="tile"><div class="k">Barrados pela nota mínima</div><div class="v tabular">${cont('minima').toLocaleString('pt-BR')}</div><div class="s">o curso exige mínimo em alguma prova</div></div>
        <div class="tile"><div class="k">Sua média simples</div><div class="v tabular">${num(simples)}</div><div class="s">cada curso usa os próprios pesos</div></div>
        <div class="tile"><div class="k">Corte mais alto que você alcança</div><div class="v tabular">${topo ? num(topo.melhor.corte) : '—'}</div>
          <div class="s">${topo ? `${esc(d.cursos[topo.o[1]])}, ${esc(d.ies[topo.o[5]][0])}` : 'nenhum curso com esses filtros'}</div></div>`;
    const n = v => v.toLocaleString('pt-BR');
    chips.innerHTML = [['passa', `Passaria (${n(cont('passa'))})`], ['quase', `Quase lá (${n(cont('quase'))})`], ['falta', `Não passaria (${n(cont('falta') + cont('minima'))})`], ['todos', `Todos (${n(filtrados.length)})`]]
      .map(([v, l]) => `<button class="chip" data-ver="${v}" aria-pressed="${f.ver === v}">${l}</button>`).join('');
    lista_.innerHTML = lista.length ? `<div class="table-wrap"><table class="qtable sisu-table"><thead><tr><th>Curso</th><th>Instituição</th><th class="r">Sua nota</th><th class="r">Nota de corte</th><th class="r">Diferença</th></tr></thead><tbody>
          ${lista.slice(0, shown).map(r => linha(d, r, meta?.o[0])).join('')}</tbody></table></div>
          ${lista.length > shown ? `<button class="btn more">Mostrar mais ${Math.min(PAGINA, lista.length - shown)} de ${n(lista.length - shown)}</button>` : ''}`
      : `<p class="empty">${f.ver === 'passa' ? 'Nenhum curso com nota de corte abaixo da sua nesses filtros. Veja os que estão “quase lá”.' : 'Nenhum curso nesses filtros.'}</p>`;
    lista_.querySelector('.more')?.addEventListener('click', () => { shown += PAGINA; render(); });
    const rm = meta && todos.find(r => r?.o[0] === meta.o[0]);
    metaBox.innerHTML = meta ? `<div class="meta-card"><span class="star on" aria-hidden="true">★</span>
      <div><div class="k">Sua meta</div><b>${esc(meta.curso)}, ${esc(meta.sigla)}</b> <span class="muted">${esc(meta.cidade)}, ${meta.uf} · ${meta.turno}</span>
      ${rm ? `<div class="s">${rm.status === 'passa' ? `Você passaria, com <b class="good">${num(rm.margem)}</b> pontos de folga.` : rm.status === 'minima' ? 'Você não atinge a nota mínima de ' + esc(rm.abaixo.join(', ')) + '.' : `Faltam <b class="bad">${num(-rm.margem)}</b> pontos para o corte de ${num(rm.melhor.corte)}.`} Acompanhe em <a href="#/evolucao">Sua evolução</a>.</div>` : ''}</div>
      <button class="btn sm ghost meta-off">Tirar meta</button></div>` : '';
    metaBox.querySelector('.meta-off')?.addEventListener('click', async () => { meta = null; await kv.del('meta'); render(); });
  };

  const f = st.filtro;
  const q = el.querySelector('.q');
  let tq;
  q.addEventListener('input', () => { clearTimeout(tq); tq = setTimeout(() => { f.q = q.value; shown = PAGINA; save(); render(); }, 200); });
  for (const k of ['uf', 'turno', 'grau', 'ordem']) el.querySelector(`.${k}`).addEventListener('change', e => { f[k] = e.target.value; shown = PAGINA; save(); render(); });
  chips.addEventListener('click', e => { const b = e.target.closest('[data-ver]'); if (!b) return; f.ver = b.dataset.ver; shown = PAGINA; save(); render(); });

  let tNotas;
  el.querySelector('.notas').addEventListener('input', e => {
    const inp = e.target.closest('input');
    if (!inp) return;
    const v = inp.value === '' ? null : Math.min(1000, Math.max(0, parseFloat(inp.value.replace(',', '.'))));
    if (v == null || Number.isNaN(v)) delete st.manual[inp.dataset.c];
    else st.manual[inp.dataset.c] = v;
    clearTimeout(tNotas);
    tNotas = setTimeout(() => { save(); paintNotas(); shown = PAGINA; render(); }, 250);
  });
  el.querySelector('.notas').addEventListener('click', e => {
    const b = e.target.closest('[data-reset]');
    if (!b) return;
    e.preventDefault();
    delete st.manual[b.dataset.reset];
    save(); paintNotas(); render();
  });
  el.querySelector('.sisu-form').addEventListener('click', e => {
    const b = e.target.closest('.choice');
    if (!b) return;
    const p = st.perfil;
    if (b.dataset.ep != null) p.ep = b.dataset.ep === '1';
    if (b.dataset.renda != null) p.renda = b.dataset.renda === '1';
    if (b.dataset.raca != null) p.raca = b.dataset.raca;
    if (b.dataset.pcd != null) p.pcd = b.dataset.pcd === '1';
    save(); paintPerfil(); render();
  });

  paintNotas();
  paintPerfil();
  render();
}

function linha(d, r, metaCod) {
  const [, curso, grau, turno, vagas, ies, campus] = r.o;
  const [sigla, nomeIes] = d.ies[ies];
  const [nomeCampus, cidade, uf] = d.campi[campus];
  const m = r.melhor;
  const cota = m.code !== 'A';
  const dif = r.status === 'minima'
    ? `<span class="badge bad" title="Nota mínima exigida em: ${esc(r.abaixo.join(', '))}">nota mínima</span>`
    : `<b class="dif ${r.status}">${r.margem >= 0 ? '+' : '−'}${num(Math.abs(r.margem))}</b>`;
  return `<tr class="${r.status}">
    <td><button class="star${metaCod === r.o[0] ? ' on' : ''}" data-cod="${r.o[0]}" title="${metaCod === r.o[0] ? 'Tirar meta' : 'Definir como sua meta'}" aria-pressed="${metaCod === r.o[0]}">★</button><b class="curso">${esc(d.cursos[curso])}</b><span class="meta">${d.grau[grau].replace(' (ABI)', '')} · ${d.turno[turno]} · ${vagas} vagas</span></td>
    <td><b title="${esc(nomeIes)}">${esc(sigla)}</b><span class="meta" title="${esc(nomeCampus)}">${esc(cidade)}, ${uf}</span></td>
    <td class="r tabular">${num(r.media)}</td>
    <td class="r tabular">${m.semCorte ? '<span class="muted" title="Menos inscritos que vagas nessa modalidade">sem corte</span>' : num(m.corte)}
      <span class="meta">${cota ? `cota: ${esc(nomeModalidade(m.code))}` : 'ampla concorrência'}</span>
      ${cota && r.ampla ? `<span class="meta">ampla: ${r.ampla[1] == null ? 'sem corte' : num(r.ampla[1])}</span>` : ''}</td>
    <td class="r tabular">${dif}</td></tr>`;
}
