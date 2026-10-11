// =====================================================================
//  Stockage local + synchronisation avec Supabase ("hors ligne d'abord")
// ---------------------------------------------------------------------
//  * Un téléphone peut suivre PLUSIEURS groupes. Chacun a ses propres
//    données (records), sa file d'envoi (dirty) et son curseur de synchro.
//    Un seul groupe est « actif » à l'écran ; les autres restent à jour.
//  * Toutes les données vivent d'abord sur le téléphone (localStorage).
//  * Chaque modification est marquée "à envoyer" puis poussée au serveur
//    dès qu'il y a du réseau. En cas de conflit, la modification la plus
//    récente gagne (horodatage ts en millisecondes).
//  * Sans configuration Supabase (js/config.js vide) : mode local seul.
// =====================================================================

const LS_KEY = 'fdc:v2';
const OLD_KEY = 'fdc:v1';          // format d'avant la v7 (un seul groupe)
const OVERLAP_MS = 15000;          // marge de recouvrement du curseur de synchro

const cfg = (typeof window !== 'undefined' && window.CONTREE_CONFIG) || {};
export const cloudConfigured = !!(cfg.supabaseUrl && cfg.supabaseKey);

/** root = { active: id du groupe affiché, groups: { [id]: état du groupe } } */
let root = { active: null, groups: {} };
let state = blankState();          // état du groupe actif (référence dans root.groups)
const listeners = new Set();
let syncing = null;
let pollTimer = null;
let pollEvery = 30000;
let pollTick = 0;

function blankState() {
  return { group: null, records: {}, dirty: [], cursor: null, lastSync: null, lastError: null };
}

// ---------------------------------------------------------------- local
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(root));
  } catch (e) {
    console.warn('Sauvegarde locale impossible', e);
    state.lastError = 'Mémoire du téléphone pleine (photos trop nombreuses ?)';
  }
}

function activate(id) {
  root.active = id && root.groups[id] ? id : null;
  state = root.active ? root.groups[root.active] : blankState();
}

export function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      root = { active: null, groups: {}, ...JSON.parse(raw) };
    } else {
      // Migration depuis l'ancien format (un seul groupe)
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const st = { ...blankState(), ...JSON.parse(old) };
        if (st.group) root = { active: st.group.id, groups: { [st.group.id]: st } };
        localStorage.setItem(LS_KEY, JSON.stringify(root));
        localStorage.removeItem(OLD_KEY);
      }
    }
    for (const [id, s] of Object.entries(root.groups)) root.groups[id] = { ...blankState(), ...s };
  } catch (e) {
    console.warn('Lecture locale impossible', e);
  }
  activate(root.active || Object.keys(root.groups)[0]);
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

// ---------------------------------------------------------------- groupes
/** Groupes suivis sur ce téléphone : [{ id, code, name, local }] */
export function listGroups() {
  return Object.values(root.groups).map((s) => s.group).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function switchGroup(id) {
  if (!root.groups[id] || root.active === id) return;
  activate(id);
  save();
  emit();
}

function addGroupState(st) {
  root.groups[st.group.id] = { ...blankState(), ...st };
  activate(st.group.id);
  save();
  emit();
}

// ---------------------------------------------------------------- lecture / écriture
function listOf(s, kind) {
  const out = [];
  for (const r of Object.values(s.records)) {
    if (r.kind === kind && !r.deleted) out.push({ id: r.id, ...r.data });
  }
  return out;
}

/** Liste des objets d'un type dans le groupe actif : [{id, ...data}] */
export const list = (kind) => listOf(state, kind);

/** Même chose dans un autre groupe suivi par ce téléphone. */
export function listIn(groupId, kind) {
  const s = root.groups[groupId];
  return s ? listOf(s, kind) : [];
}

export function get(id) {
  const r = state.records[id];
  return r && !r.deleted ? { id: r.id, ...r.data } : null;
}

function putInState(s, kind, data, id) {
  const clean = { ...data };
  delete clean.id;
  const prev = s.records[id];
  const ts = Math.max(Date.now(), (prev?.ts ?? 0) + 1);
  s.records[id] = { id, kind, data: clean, deleted: false, ts };
  if (!s.dirty.includes(id)) s.dirty.push(id);
}

/** Crée ou remplace un objet du groupe actif. Retourne son id. */
export function put(kind, data, id = data.id || uuid()) {
  putInState(state, kind, data, id);
  changed(state);
  return id;
}

/** Modifie partiellement un objet du groupe actif. */
export function patch(id, partial) {
  const r = state.records[id];
  if (!r) return;
  return put(r.kind, { ...r.data, ...partial }, id);
}

/** Modifie partiellement un objet d'un autre groupe (liens entre profils, photo). */
export function patchIn(groupId, id, partial) {
  const s = root.groups[groupId];
  const r = s?.records[id];
  if (!r) return;
  putInState(s, r.kind, { ...r.data, ...partial }, id);
  changed(s);
}

export function remove(id) {
  const r = state.records[id];
  if (!r) return;
  state.records[id] = { ...r, deleted: true, ts: Math.max(Date.now(), r.ts + 1) };
  if (!state.dirty.includes(id)) state.dirty.push(id);
  changed(state);
}

function changed(s) {
  save();
  emit();
  scheduleSync(300, s !== state);
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

/** Crée un groupe et l'ajoute aux groupes de ce téléphone (il devient le groupe affiché). */
export async function createGroup(name, { local = false } = {}) {
  if (local || !cloudConfigured) {
    addGroupState({ group: { id: uuid(), code: 'LOCAL', name, local: true } });
  } else {
    const g = await rpc('create_group', { p_name: name });
    addGroupState({ group: { id: g.id, code: g.code, name: g.name } });
  }
  return state.group;
}

/** Rejoint un groupe avec son code (ou l'affiche s'il est déjà suivi). */
export async function joinGroup(code) {
  const g = await rpc('join_group', { p_code: code.trim().toUpperCase() });
  if (root.groups[g.id]) switchGroup(g.id);
  else addGroupState({ group: { id: g.id, code: g.code, name: g.name } });
  await sync();
  return state.group;
}

/** Retire le groupe affiché de ce téléphone (les données restent sur le serveur). */
export function leaveGroup() {
  if (root.active) delete root.groups[root.active];
  activate(Object.keys(root.groups)[0]);
  save();
  emit();
}

/** Ajoute des groupes tout prêts (démo). Le premier devient le groupe affiché. */
export function addGroups(states) {
  for (const st of states) root.groups[st.group.id] = { ...blankState(), ...st };
  activate(states[0].group.id);
  save();
  emit();
}

async function syncOne(s) {
  if (!s.group || s.group.local) return false;
  try {
    // 1. Envoyer les modifications locales
    const ids = [...s.dirty];
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200).map((id) => s.records[id]).filter(Boolean)
        .map((r) => ({ id: r.id, kind: r.kind, data: r.data, deleted: r.deleted, ts: r.ts }));
      if (batch.length) await rpc('push_records', { p_code: s.group.code, p_records: batch });
    }
    // On ne retire que ce qui n'a pas été remodifié pendant l'envoi
    const sentTs = Object.fromEntries(ids.map((id) => [id, s.records[id]?.ts]));
    s.dirty = s.dirty.filter((id) => s.records[id]?.ts !== sentTs[id]);

    // 2. Récupérer les modifications des autres
    const since = s.cursor ? new Date(Date.parse(s.cursor) - OVERLAP_MS).toISOString() : null;
    const rows = await rpc('pull_records', { p_code: s.group.code, p_since: since });
    let changedAny = false;
    for (const row of rows) {
      const local = s.records[row.id];
      const remoteTs = Number(row.ts);
      // La version la plus récente gagne (même règle que sur le serveur)
      if (!local || remoteTs > local.ts) {
        s.records[row.id] = { id: row.id, kind: row.kind, data: row.data, deleted: row.deleted, ts: remoteTs };
        s.dirty = s.dirty.filter((id) => id !== row.id);
        changedAny = true;
      }
      if (!s.cursor || row.srv > s.cursor) s.cursor = row.srv;
    }
    s.lastSync = Date.now();
    s.lastError = null;
    return changedAny;
  } catch (e) {
    console.warn('Synchro', s.group.name, e);
    s.lastError = e.status === 404
      ? 'Serveur non configuré (fonctions SQL absentes ?)'
      : (e.message?.includes('Failed to fetch') ? 'Serveur injoignable' : e.message);
    if (/inconnu/i.test(e.message || '')) s.lastError = 'Ce groupe n\'existe plus sur le serveur';
    return false;
  }
}

/**
 * Synchronise le groupe affiché (all = false) ou tous les groupes suivis.
 */
export async function sync(all = false) {
  if (!cloudConfigured) return;
  if (!navigator.onLine) {
    if (!isLocal()) state.lastError = 'Hors ligne — les donnes seront envoyées plus tard';
    emit(false);
    return;
  }
  if (syncing) return syncing;
  const run = (async () => {
    const targets = all ? Object.values(root.groups) : [state];
    let changedAny = false;
    for (const s of targets) changedAny = (await syncOne(s)) || changedAny;
    save();
    emit(changedAny);
  })();
  // Le verrou est levé après coup : la synchro peut se terminer sans rien attendre
  // (aucun groupe en ligne) et le verrou ne doit jamais rester bloqué.
  syncing = run;
  run.finally(() => { if (syncing === run) syncing = null; });
  return run;
}

let soonTimer = null;
let soonAll = false;
function scheduleSync(delay, all = false) {
  if (!cloudConfigured) return;
  soonAll = soonAll || all;
  clearTimeout(soonTimer);
  soonTimer = setTimeout(() => { const a = soonAll; soonAll = false; sync(a); }, delay);
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
  if (!cloudConfigured) return;
  pollTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    pollTick++;
    // Le groupe affiché à chaque fois ; tous les groupes environ toutes les minutes
    sync(pollTick % Math.max(1, Math.round(60000 / pollEvery)) === 0);
  }, pollEvery);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleSync(100, true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(100, true);
  });
}
