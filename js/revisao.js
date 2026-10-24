// Revisão espaçada do caderno de erros, calculada a partir das provas e treinos entregues
// (nada guardado à parte, então o backup já leva tudo).
// Errou: a questão volta no dia seguinte. Acertou na revisão: volta em 3 dias, depois em 7;
// acertando na terceira revisão seguida ela sai do caderno.
import { uid } from './data.js';
import { newTreino } from './store.js';

const DIA = 86400000;
const INTERVALO = [1, 3, 7]; // dias até a próxima revisão em cada etapa

// runs: [{ a, st, when }] em ordem de entrega
export function caderno(runs) {
  const m = new Map();
  for (const { a, st, when } of runs) {
    for (const q of st.qs) {
      if (q.status === 'anulada') continue;
      const item = a.mode === 'treino' ? q.src : { year: a.year, day: a.day, id: q.id };
      const k = uid(item);
      const cur = m.get(k);
      if (q.status !== 'certa') m.set(k, { item, disciplina: q.disciplina, etapa: 0, due: when + INTERVALO[0] * DIA });
      else if (cur && !cur.dominada) {
        const etapa = cur.etapa + 1;
        m.set(k, etapa >= INTERVALO.length ? { ...cur, etapa, dominada: true } : { ...cur, etapa, due: when + INTERVALO[etapa] * DIA });
      }
    }
  }
  const all = [...m.values()];
  const ativos = all.filter(v => !v.dominada);
  const now = Date.now();
  const futuras = ativos.filter(v => v.due > now).map(v => v.due);
  return {
    ativos,
    hoje: ativos.filter(v => v.due <= now),
    dominadas: all.filter(v => v.dominada).length,
    proxima: futuras.length ? Math.min(...futuras) : null,
  };
}

const ordem = (x, y) => y.year - x.year || x.day - y.day || parseInt(x.id, 10) - parseInt(y.id, 10);

export async function comecarRevisao(lista, titulo) {
  const a = await newTreino(lista.map(v => v.item).sort(ordem), { titulo, materia: 'Todas as matérias' });
  location.hash = `#/prova/${a.id}`;
}

export function quando(t) {
  const dias = Math.ceil((t - Date.now()) / DIA);
  return dias <= 1 ? 'amanhã' : `em ${dias} dias`;
}
