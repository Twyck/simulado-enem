// Armazenamento local (IndexedDB) — tentativas, anotações à caneta e preferências.
const DB_NAME = 'simulado-enem';
let dbPromise;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('kv', mode);
    const req = fn(t.objectStore('kv'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const kv = {
  get: key => tx('readonly', s => s.get(key)),
  set: (key, value) => tx('readwrite', s => s.put(value, key)),
  del: key => tx('readwrite', s => s.delete(key)),
  keys: () => tx('readonly', s => s.getAllKeys()),
};

export async function listAttempts() {
  const keys = (await kv.keys()).filter(k => String(k).startsWith('attempt:'));
  const all = await Promise.all(keys.map(k => kv.get(k)));
  return all.filter(Boolean).sort((a, b) => b.startedAt - a.startedAt);
}

export const saveAttempt = a => kv.set(`attempt:${a.id}`, a);
export const getAttempt = id => kv.get(`attempt:${id}`);

export async function deleteAttempt(id) {
  const keys = (await kv.keys()).filter(k => k === `attempt:${id}` || String(k).startsWith(`ink:${id}:`));
  await Promise.all(keys.map(k => kv.del(k)));
}

export const getInk = (id, page) => kv.get(`ink:${id}:${page}`);
export const saveInk = (id, page, strokes) => kv.set(`ink:${id}:${page}`, strokes);

// Novo treino a partir de uma lista de questões ({ year, day, id }), ex.: caderno de erros
export async function newTreino(items, extra = {}) {
  const a = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    mode: 'treino', materia: 'Várias matérias', assunto: null, items,
    limitSec: 0, startedAt: Date.now(), elapsed: 0, status: 'running',
    answers: {}, crossed: {}, time: {}, changes: {}, flags: {}, history: [], ...extra,
  };
  await saveAttempt(a);
  return a;
}

// ---------- backup: tudo o que o app guarda, num arquivo ----------
const BACKUP_KIND = 'simulado-enem-backup';

const lastBackup = () => { try { return +localStorage.getItem('lastBackup') || 0; } catch { return 0; } };
// provas entregues depois do último backup baixado neste aparelho
export const semBackup = attempts => attempts.filter(a => a.status === 'done' && (a.finishedAt || a.startedAt) > lastBackup());

export async function downloadBackup() {
  const blob = new Blob([JSON.stringify(await exportBackup())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `simulado-enem-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  try { localStorage.setItem('lastBackup', String(Date.now())); } catch { /* sem storage */ }
}

// pede ao navegador para não apagar os dados do site quando faltar espaço ou o site ficar sem uso
// (o Safari apaga sites não instalados após 7 dias sem visita)
export const pedirPersistencia = () => navigator.storage?.persist?.().catch(() => false) ?? Promise.resolve(false);

export async function exportBackup() {
  const keys = (await kv.keys()).filter(k => /^(attempt|ink):/.test(String(k)));
  const entries = await Promise.all(keys.map(async k => [k, await kv.get(k)]));
  return { kind: BACKUP_KIND, version: 1, exportedAt: new Date().toISOString(), entries };
}

// Junta o backup ao que já existe. Uma prova que existe nos dois lados fica com a versão mais avançada.
export async function importBackup(data) {
  if (data?.kind !== BACKUP_KIND || !Array.isArray(data.entries)) throw new Error('Este arquivo não é um backup do Simulado ENEM.');
  let added = 0, updated = 0;
  const attempts = new Map(data.entries.filter(([k]) => String(k).startsWith('attempt:')).map(([k, v]) => [k, v]));
  for (const [k, a] of attempts) {
    // prova completa tem ano e dia; treino tem a lista de questões
    if (!a?.id || !((a.year && a.day) || (a.mode === 'treino' && Array.isArray(a.items)))) continue;
    const cur = await kv.get(k);
    const newer = !cur || (a.status === 'done' && cur.status !== 'done') || (a.status === cur.status && (a.elapsed || 0) > (cur.elapsed || 0));
    if (!newer) continue;
    await kv.set(k, a);
    for (const [ik, iv] of data.entries) if (String(ik).startsWith(`ink:${a.id}:`)) await kv.set(ik, iv);
    cur ? updated++ : added++;
  }
  return { added, updated };
}
