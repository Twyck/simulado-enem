// Nota TRI estimada, no mesmo modelo do INEP: 3 parâmetros logístico (D = 1), proficiência estimada por
// EAP com priori normal padrão e transformada para a escala do ENEM por área.
// As constantes da transformação foram ajustadas com as respostas e notas oficiais dos microdados
// 2017–2025 (erro médio de 0,03 ponto; ver scripts/check_tri.mjs e README).
export const ESCALA = {
  LC: { a: 499.978, b: 108.09 },
  CH: { a: 501.489, b: 112.311 },
  CN: { a: 501.141, b: 113.109 },
  MT: { a: 500.018, b: 129.645 },
};

// limites de dificuldade (terços dos itens 2021–2025 de cada área, na escala do ENEM)
const TERCOS = { LC: [545, 604], CH: [569, 635], CN: [628, 694], MT: [698, 794] };

const GRID = Array.from({ length: 551 }, (_, i) => -4 + i * 0.02);

const prob = (it, t) => it.c + (1 - it.c) / (1 + Math.exp(-it.a * (t - it.b)));

// itens: [{ a, b, c, certo }] → proficiência θ (EAP)
export function eap(itens) {
  const logp = GRID.map(t => -(t * t) / 2);
  for (const it of itens) {
    for (let i = 0; i < GRID.length; i++) {
      const p = Math.min(Math.max(prob(it, GRID[i]), 1e-9), 1 - 1e-9);
      logp[i] += Math.log(it.certo ? p : 1 - p);
    }
  }
  const m = Math.max(...logp);
  let s = 0, st = 0;
  for (let i = 0; i < GRID.length; i++) {
    const w = Math.exp(logp[i] - m);
    s += w;
    st += w * GRID[i];
  }
  return st / s;
}

export const toEscala = (area, theta) => ESCALA[area].a + ESCALA[area].b * theta;
export const toTheta = (area, nota) => (nota - ESCALA[area].a) / ESCALA[area].b;

export const notaTRI = (area, itens) => toEscala(area, eap(itens));

// dificuldade oficial do item na escala da nota (parâmetro b transformado)
export const dificuldade = (area, b) => toEscala(area, b);

export function nivel(area, dif) {
  const [f, d] = TERCOS[area];
  return dif < f ? 'fácil' : dif <= d ? 'média' : 'difícil';
}

// chance de acerto de quem tem a nota `nota` (útil para dizer "era esperado você acertar")
export const chance = (area, it, nota) => prob(it, toTheta(area, nota));
