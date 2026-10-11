// =====================================================================
//  Stockage local + synchronisation avec Supabase ("hors ligne d'abord")
// ---------------------------------------------------------------------
//  * Toutes les données vivent d'abord sur le téléphone (localStorage).
//  * Chaque modification est marquée "à envoyer" puis poussée au serveur
//    dès qu'il y a du réseau. En cas de conflit, la modification la plus
//    récente gagne (horodatage ts en millisecondes).
//  * On récupère régulièrement les modifications des autres téléphones
//    (toutes les 4 s pendant une partie, 30 s sinon).
//  * Sans configuration Supabase (js/config.js vide) : mode local seul.
// =====================================================================

const LS_KEY = 'fdc:v1';
const OVERLAP_MS = 15000; // marge de recouvrement du curseur de synchro

const cfg = (typeof window !== 'undefined' && window.CONTREE_CONFIG) || {};
export const cloudConfigured = !!(cfg.supabaseUrl && cfg.supabaseKey);

let state = blankState();
const listeners = new Set();
let syncing = null;
let pollTimer = null;
let pollEvery = 30000;

function blankState() {
  return { group: null, records: {}, dirty: [], cursor: null, lastSync: null, lastError: null };
}

// ---------------------------------------------------------------- local
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Sauvegarde locale impossible', e);
    state.lastError = 'Mémoire du téléphone pleine (photos trop nombreuses ?)';
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = { ...blankState(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Lecture locale impossible', e);
  }
  return state;
}

function emit(dataChanged = true) {
  for (const fn of listeners) {
    try { fn(state, dataChanged); } catch (e) { console.error(e); }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getState = () => state;
export const isLocal = () => !state.group || state.group.local;

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Liste des objets d'un type, non supprimés : [{id, ...data}] */
export function list(kind) {
  const out = [];
  for (const r of Object.values(state.records)) {
    if (r.kind === kind && !r.deleted) out.push({ id: r.id, ...r.data });
  }
  return out;
}

export function get(id) {
  const r = state.records[id];
  return r && !r.deleted ? { id: r.id, ...r.data } : null;
}

/** Crée ou remplace un objet. Retourne son id. */
export function put(kind, data, id = data.id || uuid()) {
  const clean = { ...data };
  delete clean.id;
  const prev = state.records[id];
  const ts = Math.max(Date.now(), (prev?.ts ?? 0) + 1);
  state.records[id] = { id, kind, data: clean, deleted: false, ts };
  markDirty(id);
  return id;
}

/** Modifie partiellement un objet existant. */
export function patch(id, partial) {
  const r = state.records[id];
  if (!r) return;
  return put(r.kind, { ...r.data, ...partial }, id);
}

export function remove(id) {
  const r = state.records[id];
  if (!r) return;
  state.records[id] = { ...r, deleted: true, ts: Math.max(Date.now(), r.ts + 1) };
  markDirty(id);
}

function markDirty(id) {
  if (!state.dirty.includes(id)) state.dirty.push(id);
  save();
  emit();
  scheduleSync(300);
}

// ---------------------------------------------------------------- cloud
async function rpc(fn, args) {
  const headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey };
  // Ancienne clé "anon" (JWT) : il faut aussi l'en-tête Authorization.
  if (cfg.supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.supabaseKey}`;
  const res = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.message || `Erreur serveur ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function createGroup(name, { local = false } = {}) {
  if (local || !cloudConfigured) {
    state = { ...blankState(), group: { id: uuid(), code: 'LOCAL', name, local: true } };
  } else {
    const g = await rpc('create_group', { p_name: name });
    state = { ...blankState(), group: { id: g.id, code: g.code, name: g.name } };
  }
  save();
  emit();
  return state.group;
}

export async function joinGroup(code) {
  const g = await rpc('join_group', { p_code: code.trim().toUpperCase() });
  state = { ...blankState(), group: { id: g.id, code: g.code, name: g.name } };
  save();
  emit();
  await sync();
  return state.group;
}

/** Quitter le groupe sur ce téléphone (les données restent sur le serveur). */
export function leaveGroup() {
  state = blankState();
  save();
  emit();
}

/** Remplace tout l'état local (import / démo). */
export function replaceAll(newState) {
  state = { ...blankState(), ...newState };
  save();
  emit();
}

export async function sync() {
  if (isLocal() || !cloudConfigured) return;
  if (!navigator.onLine) {
    state.lastError = 'Hors ligne — les donnes seront envoyées plus tard';
    emit(false);
    return;
  }
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      // 1. Envoyer les modifications locales
      const ids = [...state.dirty];
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200).map((id) => state.records[id]).filter(Boolean)
          .map((r) => ({ id: r.id, kind: r.kind, data: r.data, deleted: r.deleted, ts: r.ts }));
        if (batch.length) await rpc('push_records', { p_code: state.group.code, p_records: batch });
      }
      // On ne retire que ce qui n'a pas été remodifié pendant l'envoi
      const sentTs = Object.fromEntries(ids.map((id) => [id, state.records[id]?.ts]));
      state.dirty = state.dirty.filter((id) => state.records[id]?.ts !== sentTs[id]);

      // 2. Récupérer les modifications des autres
      const since = state.cursor ? new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString() : null;
      const rows = await rpc('pull_records', { p_code: state.group.code, p_since: since });
      let changed = false;
      for (const row of rows) {
        const local = state.records[row.id];
        const remoteTs = Number(row.ts);
        // La version la plus récente gagne (même règle que sur le serveur)
        if (!local || remoteTs > local.ts) {
          state.records[row.id] = { id: row.id, kind: row.kind, data: row.data, deleted: row.deleted, ts: remoteTs };
          state.dirty = state.dirty.filter((id) => id !== row.id);
          changed = true;
        }
        if (!state.cursor || row.srv > state.cursor) state.cursor = row.srv;
      }
      state.lastSync = Date.now();
      state.lastError = null;
      save();
      emit(changed); // met aussi à jour l'indicateur de synchro
    } catch (e) {
      console.warn('Synchro', e);
      state.lastError = e.status === 404
        ? 'Serveur non configuré (fonctions SQL absentes ?)'
        : (e.message?.includes('Failed to fetch') ? 'Serveur injoignable' : e.message);
      if (/inconnu/i.test(e.message || '')) state.lastError = 'Ce groupe n\'existe plus sur le serveur';
      emit(false);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

let soonTimer = null;
function scheduleSync(delay) {
  if (isLocal() || !cloudConfigured) return;
  clearTimeout(soonTimer);
  soonTimer = setTimeout(sync, delay);
}

/** Rythme de récupération : rapide pendant une partie, lent sinon. */
export function setPolling(fast) {
  const every = fast ? 4000 : 30000;
  if (every === pollEvery && pollTimer) return;
  pollEvery = every;
  startPolling();
}

export function startPolling() {
  clearInterval(pollTimer);
  if (isLocal() || !cloudConfigured) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') sync();
  }, pollEvery);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleSync(100));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(100);
  });
}
