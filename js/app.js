// =====================================================================
//  Les Fous de la Contrée — application (interface)
// =====================================================================
import * as store from './store.js';
import {
  SUITS, NUMERIC_BIDS, DEFAULT_RULES, scoreHand, gameTotals, bidLabel, explain, teamOf,
} from './scoring.js';
import { computeStats, computeDuos, gameStats, handsByGame, timeline, TIMELINE_STATS } from './stats.js';
import { lineChart, multiLineChart, bindMultiLine } from './charts.js';
import { fileToAvatar } from './photo.js';
import { toCsv, download } from './csv.js';
import { buildDemoGroups } from './demo.js';
import {
  CONTRACTS, CONTRACT_KEYS, OBJECTIVES, POIGNEES, POIGNEE_TRUMPS, CHELEMS, DEFAULT_TAROT_RULES,
  tarotHand, tarotTotals, explainTarot,
} from './tarot.js';
import { computeTarotStats, evaluateTarot, tarotTimeline, TAROT_TIMELINE_STATS } from './tarot-stats.js';

// Numéro de version affiché dans l'onglet Groupe (pour vérifier une mise à jour)
const APP_BUILD = 13;   // doit correspondre à 'fdc-v13' dans sw.js
const APP_VERSION = `${APP_BUILD} — renommer un groupe`;
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet');
const overlayRoot = document.getElementById('overlay');

// ------------------------------------------------------------ utilitaires
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => (v == null ? '–' : `${Math.round(v)} %`);
const num = (v, d = 0) => (v == null ? '–' : v.toLocaleString('fr-FR', { maximumFractionDigits: d }));
const date = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const dateTime = (t) => (t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const TEAM_NAMES = ['Bleus', 'Rouges'];
const TEAM_PIPS = ['♠', '♥'];
const AV_COLORS = ['#3a50c2', '#d7263d', '#12936a', '#b07800', '#7b3fc4', '#e0661b', '#0f8fa8', '#c2337a'];

function colorFor(id = '') {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
function initials(name = '?') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}
function avatar(p, cls = '') {
  if (!p) return `<span class="av ${cls}" style="--c:#9aa0b8">?</span>`;
  const inner = p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(initials(p.name));
  return `<span class="av ${cls}" style="--c:${colorFor(p.id)}">${inner}</span>`;
}
function suitHtml(s) {
  const su = SUITS[s];
  if (!su) return '';
  return `<span class="suit ${su.red ? 'red' : ''}" title="${su.label}">${su.symbol}</span>`;
}

// ------------------------------------------------------------ données
let version = 0;
let cache = null;

function D() {
  if (cache && cache.v === version) return cache;
  const group = store.getState().group;
  const settings = group ? store.get(group.id) : null;
  cache = {
    v: version,
    ...buildData(store.list('player'), store.list('game'), store.list('hand')),
    rules: { ...DEFAULT_RULES, ...(settings?.rules || {}) },
    trules: { ...DEFAULT_TAROT_RULES, ...(settings?.tarot || {}) },
  };
  return cache;
}

/** Toutes les statistiques à partir de listes de joueurs / parties / donnes. */
function buildData(playersIn, allGames, allHands) {
  const players = [...playersIn].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  // Contrée (parties sans type, historiques) et tarot (type 'tarot') sont séparés
  const games = allGames.filter((g) => (g.type || 'contree') === 'contree');
  const tgames = allGames.filter((g) => g.type === 'tarot');
  const contreeIds = new Set(games.map((g) => g.id));
  const tarotIds = new Set(tgames.map((g) => g.id));
  const hands = allHands.filter((h) => contreeIds.has(h.gameId));
  const thands = allHands.filter((h) => tarotIds.has(h.gameId));
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const byGame = handsByGame(allHands);
  const evaluated = games.map((g) => {
    const hs = byGame.get(g.id) || [];
    return { game: g, hands: hs, ...gameTotals(hs, g.teams, g.rules) };
  }).sort((a, b) => (b.game.startedAt ?? 0) - (a.game.startedAt ?? 0));
  const tevaluated = evaluateTarot(tgames, thands).sort((a, b) => (b.game.startedAt ?? 0) - (a.game.startedAt ?? 0));
  return {
    players, games, hands, byId, byGame, evaluated,
    stats: computeStats(players, games, hands), timeline: timeline(players, games, hands),
    tgames, thands, tevaluated,
    tstats: computeTarotStats(players, tgames, thands), ttimeline: tarotTimeline(players, tgames, thands),
  };
}

// ------------------------------------------------------------ données tous groupes
// Les fiches reliées (même personId) de tous les groupes du téléphone ne forment
// qu'une seule personne : on renomme leurs identifiants puis on recalcule tout.
let crossCache = null;
function cross() {
  if (crossCache && crossCache.v === version) return crossCache;
  const groups = store.listGroups();
  const people = {};
  const games = [];
  const hands = [];
  for (const g of groups) {
    const map = {};
    for (const p of store.listIn(g.id, 'player')) {
      const cid = p.personId || `${g.id}:${p.id}`;
      map[p.id] = cid;
      if (!people[cid]) people[cid] = { id: cid, name: p.name, photo: p.photo || null, personId: p.personId || null, groups: [] };
      people[cid].groups.push({ id: g.id, name: g.name, pid: p.id });
      if (!people[cid].photo && p.photo) people[cid].photo = p.photo;
    }
    const R = (pid) => (pid ? map[pid] || `${g.id}:${pid}` : pid);
    for (const gm of store.listIn(g.id, 'game')) {
      games.push(gm.type === 'tarot'
        ? { ...gm, players: gm.players.map(R) }
        : { ...gm, teams: gm.teams.map((t) => t.map(R)) });
    }
    for (const h of store.listIn(g.id, 'hand')) {
      hands.push({
        ...h,
        taker: R(h.taker), called: R(h.called), coincheBy: R(h.coincheBy), surcoincheBy: R(h.surcoincheBy),
        beloteBy: R(h.beloteBy), pabBy: R(h.pabBy),
        poignees: (h.poignees || []).map((x) => ({ ...x, by: R(x.by) })),
        miseres: (h.miseres || []).map(R),
      });
    }
  }
  crossCache = { v: version, ...buildData(Object.values(people), games, hands), people };
  return crossCache;
}

/** Fiches reliées à une personne, tous groupes du téléphone : [{ id, name, pid }] */
function linkedProfiles(personId) {
  if (!personId) return [];
  return cross().people[personId]?.groups || [];
}

// Pendant l'affichage d'un profil « tous groupes », P() cherche d'abord ici
let pMap = null;
const P = (id) => (pMap && pMap[id]) || D().byId[id] || { id, name: 'Joueur supprimé' };
const teamNames = (team) => team.map((id) => esc(P(id).name)).join(' & ');

// ------------------------------------------------------------ état d'interface
const ui = {
  sheet: null,          // { kind, draft, ... }
  gameView: 'game',     // 'game' | 'career' (stats affichées pendant une partie)
  toast: null,
  installPrompt: null,
  joinCode: '',
  chartStat: 'winPct',  // statistique affichée dans Graphiques
  chartSel: null,       // [{ id, slot }] joueurs choisis, slot = couleur attribuée
  chartModel: null,
  tchartStat: 'winPct', // statistique affichée dans Graphiques (tarot)
  pchartC: 'winPct',    // statistique du graphique d'un profil (contrée)
  pchartT: 'winPct',    // … (tarot)
  gstatC: 'takeMadePct', // statistique du graphique pendant une partie (contrée)
  gstatT: 'takePct',     // … (tarot)
  bindQueue: [],        // graphiques à rendre interactifs après l'affichage
  kind: loadKind(),     // jeu affiché : 'contree' | 'tarot'
};

function loadKind() {
  try { return localStorage.getItem('fdc:kind') === 'tarot' ? 'tarot' : 'contree'; } catch { return 'contree'; }
}
function setKind(k) {
  ui.kind = k;
  try { localStorage.setItem('fdc:kind', k); } catch { /* stockage indisponible */ }
}
/** Sélecteur Contrée | Tarot en haut des écrans. */
function kindSwitch() {
  return `<div class="kind-switch" role="group" aria-label="Jeu">
    <button data-act="kind" data-v="contree" aria-pressed="${ui.kind === 'contree'}"><span class="suit red">♥</span> Contrée</button>
    <button data-act="kind" data-v="tarot" aria-pressed="${ui.kind === 'tarot'}"><span class="tk">21</span> Tarot</button>
  </div>`;
}

// Couleurs des courbes (ordre fixe, validé pour le daltonisme) ; une couleur reste
// attachée à un joueur tant qu'il est sélectionné.
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// ------------------------------------------------------------ routage
// En démo intégrée (artifact), la navigation se fait en mémoire.
const EMBED = !!window.CONTREE_ARTIFACT;
let memHash = '#/';
const currentHash = () => (EMBED ? memHash : location.hash);
function go(h) {
  if (EMBED) { memHash = h || '#/'; render(); window.scrollTo(0, 0); } else location.hash = h;
}
if (EMBED) {
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    ev.preventDefault();
    go(a.getAttribute('href'));
  });
}
function route() {
  const h = currentHash().replace(/^#\/?/, '');
  const [name, id, id2] = h.split('/');
  return { name: name || 'home', id, id2 };
}
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#join=')) return handleJoinLink();
  render();
  window.scrollTo(0, 0);
});

// ------------------------------------------------------------ rendu
function render() {
  const st = store.getState();
  if (!st.group) {
    app.innerHTML = welcomePage();
    return;
  }
  const r = route();
  ui.bindQueue = [];
  let page;
  switch (r.name) {
    case 'person': page = personPage(r.id); break;
    case 'game': page = store.get(r.id)?.type === 'tarot' ? tarotGamePage(r.id) : gamePage(r.id); break;
    case 'players': page = ui.kind === 'tarot' ? tarotPlayersPage() : playersPage(); break;
    case 'player': {
      // #/player/<joueur>/<partie> : carrière ouverte depuis une partie
      const opts = r.id2 ? { fromGame: r.id2, back: `#/game/${r.id2}` } : {};
      if (r.id2 && store.get(r.id2)) setKind(store.get(r.id2).type === 'tarot' ? 'tarot' : 'contree');
      page = ui.kind === 'tarot' ? tarotPlayerPage(r.id, opts) : playerPage(r.id, opts);
      break;
    }
    case 'gplayer': page = gamePlayerPage(r.id, r.id2); break;
    case 'history': page = historyPage(); break;
    case 'charts': page = chartsPage(); break;
    case 'settings': page = settingsPage(); break;
    default: page = ui.kind === 'tarot' ? tarotHomePage() : homePage();
  }
  app.innerHTML = page;
  if (r.name === 'charts' && ui.chartModel) bindMultiLine(document.querySelector('.chart-card'), ui.chartModel);
  for (const [sel, model] of ui.bindQueue) {
    const el = document.querySelector(sel);
    if (el) bindMultiLine(el, model);
  }
  store.setPolling(r.name === 'game');
}

function syncBadge() {
  const st = store.getState();
  if (st.group?.local) return '<span class="sync off"><i></i>Local</span>';
  if (!store.cloudConfigured) return '<span class="sync off"><i></i>Local</span>';
  const pending = st.dirty.length;
  if (st.lastError) return `<button class="sync err" data-act="sync-now" title="${esc(st.lastError)}"><i></i>${navigator.onLine ? 'Erreur' : 'Hors ligne'}</button>`;
  if (pending) return `<button class="sync busy" data-act="sync-now"><i></i>${pending} à envoyer</button>`;
  return '<button class="sync" data-act="sync-now"><i></i>À jour</button>';
}

function shell(title, body, { back = null, fab = '', active = '', groupSwitch = false } = {}) {
  if (groupSwitch) {
    const n = store.listGroups().length;
    title = `<button class="gswitch" data-act="groups" aria-label="Changer de groupe">${title}<span class="chev">${n > 1 ? `▾ ${n}` : '▾'}</span></button>`;
  }
  const tab = (href, ic, label, key) =>
    `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}><span class="ic">${ic}</span>${label}</a>`;
  return `
    <header class="topbar felt">
      ${back ? `<a class="back" href="${back}" aria-label="Retour" style="text-decoration:none">‹</a>` : ''}
      <h1>${title}</h1>
      ${syncBadge()}
    </header>
    <main>${body}</main>
    ${fab ? `<div class="fab-wrap">${fab}</div>` : ''}
    <nav class="tabs five" aria-label="Navigation">
      ${tab('#/', '♠', 'Parties', 'home')}
      ${tab('#/players', '♥', 'Joueurs', 'players')}
      ${tab('#/charts', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19l6-7 4 4 8-10"/></svg>', 'Graphiques', 'charts')}
      ${tab('#/history', '♦', 'Historique', 'history')}
      ${tab('#/settings', '♣', 'Groupe', 'settings')}
    </nav>`;
}

// ============================================================ ACCUEIL (sans groupe)
function welcomePage() {
  const cloud = store.cloudConfigured;
  return `
  <div class="welcome">
    <div class="top felt">
      <p class="logo"><small>Les Fous de</small>la Contrée</p>
      <div class="suits-line">♠<span class="r">♥</span>♣<span class="r">♦</span></div>
    </div>
    <div class="body stack">
      ${cloud ? `
      <section class="panel">
        <h3>Rejoindre un groupe</h3>
        <p class="small muted">Entrez le code reçu d'un autre joueur pour retrouver les mêmes profils et scores.</p>
        <input class="input" id="join-code" placeholder="Code à 8 caractères" autocomplete="off" autocapitalize="characters"
               maxlength="12" value="${esc(ui.joinCode)}" style="text-transform:uppercase;letter-spacing:.12em;font-weight:700">
        <button class="btn block" style="margin-top:10px" data-act="join-group">Rejoindre</button>
      </section>
      <section class="panel">
        <h3>Créer un groupe</h3>
        <p class="small muted">Vous recevrez un code d'invitation à partager avec les autres joueurs.</p>
        <input class="input" id="group-name" placeholder="Nom du groupe (ex. Les jeudis de Marcel)" maxlength="60">
        <button class="btn gold block" style="margin-top:10px" data-act="create-group">Créer le groupe</button>
      </section>` : `
      <section class="panel">
        <h3>Mode local</h3>
        <p class="small">Le serveur n'est pas encore configuré (fichier <b>js/config.js</b>). L'application fonctionne,
        mais les données restent sur ce téléphone uniquement.</p>
        <input class="input" id="group-name" placeholder="Nom du groupe" maxlength="60" value="Les Fous de la Contrée">
        <button class="btn gold block" style="margin-top:10px" data-act="create-group">Commencer</button>
      </section>`}
      <button class="btn ghost block" data-act="demo">Essayer avec des données de démonstration</button>
    </div>
  </div>`;
}

// ============================================================ PARTIES (accueil)
function homePage() {
  const d = D();
  const running = d.evaluated.filter((e) => e.winner === null);
  const finished = d.evaluated.filter((e) => e.winner !== null).slice(0, 3);
  let body = d.players.length ? kindSwitch() : '';

  if (!d.players.length) {
    body += `
      <div class="empty panel">
        <div class="big">♠<span class="r">♥</span>♣<span class="r">♦</span></div>
        <h2 style="margin-top:14px">Créez les profils des joueurs</h2>
        <p class="muted">Il faut au moins 4 joueurs pour lancer une partie. Chaque profil garde ses statistiques sur la durée.</p>
        <button class="btn block" data-act="add-player">Ajouter un joueur</button>
      </div>`;
    return shell(esc(store.getState().group.name), body, { active: 'home', groupSwitch: true });
  }

  if (running.length) {
    body += '<h2>En cours</h2>';
    body += running.map((e) => gameCard(e)).join('');
  } else {
    body += `
      <div class="empty panel">
        <div class="big">♠<span class="r">♥</span>♣<span class="r">♦</span></div>
        <h2 style="margin-top:14px">Pas de partie en cours</h2>
        <p class="muted">${d.players.length < 4 ? `Ajoutez encore ${4 - d.players.length} joueur${d.players.length === 3 ? '' : 's'} pour pouvoir jouer.` : 'Choisissez les équipes et c\'est parti.'}</p>
      </div>`;
  }

  // Classement
  const ranked = rankPlayers().slice(0, 5);
  if (ranked.length) {
    body += '<h2>Classement</h2><ul class="list">';
    body += ranked.map(({ p, s }, i) => `
      <li><a class="item" href="#/player/${p.id}" style="text-decoration:none;color:inherit">
        <span class="rank ${i === 0 ? 'g1' : ''}">${i + 1}</span>${avatar(p)}
        <span class="main"><span class="t">${esc(p.name)}</span><br><span class="s">${s.wins} victoire${s.wins > 1 ? 's' : ''} sur ${s.games} · prises ${s.takesMade}/${s.takes}</span></span>
        <span class="r">${pct(s.winPct)}</span></a></li>`).join('');
    body += '</ul>';
  }
  if (finished.length) {
    body += '<h2>Dernières parties</h2>';
    body += finished.map((e) => gameCard(e)).join('');
  }

  const fab = d.players.length >= 4
    ? '<button class="btn gold block" data-act="new-game">Nouvelle partie</button>'
    : '<button class="btn block" data-act="add-player">Ajouter un joueur</button>';
  return shell(esc(store.getState().group.name), body, { fab, active: 'home', groupSwitch: true });
}

function rankPlayers() {
  const d = D();
  return d.players
    .map((p) => ({ p, s: d.stats.get(p.id) }))
    .filter((x) => x.s.games > 0)
    .sort((a, b) => b.s.winPct - a.s.winPct || b.s.games - a.s.games);
}

/** Titre d'une partie : celui donné par les joueurs, ou rien. */
const gameTitle = (g) => (g.title || '').trim();
const titleLine = (g) => (gameTitle(g) ? `<div class="gtitle">${esc(gameTitle(g))}</div>` : '');
const titleField = (dr) => `<div class="field"><label for="g-title">Titre de la partie <span class="hint">(facultatif)</span></label>
  <input class="input" id="g-title" data-draft="title" maxlength="50" placeholder="Ex. Revanche du jeudi, Finale de Noël…" value="${esc(dr.title || '')}" autocomplete="off"></div>`;

function gameCard(e) {
  const g = e.game;
  const lead = e.totals[0] === e.totals[1] ? -1 : e.totals[0] > e.totals[1] ? 0 : 1;
  const status = e.winner !== null
    ? `Victoire des ${TEAM_NAMES[e.winner]} · ${date(g.finishedAt || g.startedAt)}`
    : `${e.hands.length} donne${e.hands.length > 1 ? 's' : ''} · objectif ${g.rules.target}`;
  return `
    <a class="panel" href="#/game/${g.id}" style="display:block;text-decoration:none;color:inherit;margin-bottom:10px">
      ${titleLine(g)}
      <div class="row">
        <div class="av-pair">${g.teams[0].map((id) => avatar(P(id), 's')).join('')}</div>
        <div style="flex:1;min-width:0">
          <div class="small" style="font-weight:700;color:var(--blue)">${teamNames(g.teams[0])}</div>
          <div class="small" style="font-weight:700;color:var(--red)">${teamNames(g.teams[1])}</div>
        </div>
        <div style="text-align:right;font:900 22px/1.05 var(--display);font-variant-numeric:tabular-nums">
          <div style="color:var(--blue);${lead === 1 ? 'opacity:.55' : ''}">${e.totals[0]}</div>
          <div style="color:var(--red);${lead === 0 ? 'opacity:.55' : ''}">${e.totals[1]}</div>
        </div>
      </div>
      <div class="small muted" style="margin-top:8px">${status}</div>
    </a>`;
}

// ============================================================ PARTIE
function gamePage(id) {
  const d = D();
  const e = d.evaluated.find((x) => x.game.id === id);
  if (!e) return shell('Partie', '<p class="muted">Cette partie n\'existe plus.</p>', { back: '#/' });
  const g = e.game;
  const target = g.rules.target;
  const lead = e.totals[0] === e.totals[1] ? -1 : e.totals[0] > e.totals[1] ? 0 : 1;
  const last = e.rows[e.rows.length - 1];

  const teamCard = (ti) => `
    <div class="team-card t${ti} ${lead === ti ? 'lead' : ''}">
      <span class="pip">${TEAM_PIPS[ti]}</span>
      <div class="av-pair">${g.teams[ti].map((pid) => avatar(P(pid), 's')).join('')}</div>
      <div class="names">${teamNames(g.teams[ti])}</div>
      <div class="score">${e.totals[ti]}</div>
      <div class="delta">${last ? `dernière donne +${last.scores[ti]}` : '&nbsp;'}</div>
    </div>`;

  let body = `<div class="board">${teamCard(0)}${teamCard(1)}</div>
    <div class="track" aria-label="Progression vers ${target}">
      <div class="bar"><span class="b0" style="width:${Math.min(100, (100 * e.totals[0]) / target)}%"></span></div>
      <div class="bar"><span class="b1" style="width:${Math.min(100, (100 * e.totals[1]) / target)}%"></span></div>
      <div class="legend"><span>Objectif ${target}</span><span>${e.hands.length} donne${e.hands.length > 1 ? 's' : ''}</span></div>
    </div>`;

  if (e.winner !== null) {
    body += `<div class="panel" style="margin-top:14px;text-align:center">
      <h3 style="color:var(--${e.winner ? 'red' : 'blue'})">Victoire des ${TEAM_NAMES[e.winner]} : ${teamNames(g.teams[e.winner])}</h3>
      <button class="btn gold block" data-act="rematch" data-id="${g.id}">Revanche avec les mêmes équipes</button>
    </div>`;
  }

  // Statistiques des joueurs pendant la partie
  const gs = gameStats(g, e.hands);
  const all = [...g.teams[0], ...g.teams[1]];
  body += `<div class="row" style="margin:22px 0 10px"><h2 style="margin:0;flex:1">Joueurs</h2>
    <div class="seg" role="group">
      <button data-act="game-view" data-v="game" aria-pressed="${ui.gameView === 'game'}">Cette partie</button>
      <button data-act="game-view" data-v="career" aria-pressed="${ui.gameView === 'career'}">Carrière</button>
    </div></div><div class="mini-stats">`;
  body += all.map((pid) => {
    const p = P(pid);
    const ti = teamOf(g.teams, pid);
    let what;
    if (ui.gameView === 'game') {
      const s = gs[pid];
      what = `Prises ${s.made}/${s.takes}${s.shared ? ` (${s.shared} part.)` : ''}${s.made ? ` · ${num(s.points / s.made)} pts` : ''}<br>A pris ${s.takes} donne${s.takes > 1 ? 's' : ''} sur ${s.dealt}<br>Contres ${s.coinchesWon}/${s.coinches} · Belotes ${s.belotes}`;
    } else {
      const s = d.stats.get(pid);
      what = s ? `Victoires ${pct(s.winPct)} sur ${s.games}<br>Prises ${pct(s.takeMadePct)} · Contres ${pct(s.coinchePct)}<br>Prend ${pct(s.takeRate)} des donnes` : '';
    }
    return `<a class="mini t${ti}" href="#/gplayer/${g.id}/${pid}" style="text-decoration:none;color:inherit">
      <span class="who">${avatar(p, 's')}<span>${esc(p.name)}</span></span><span class="what">${what}</span></a>`;
  }).join('');
  body += '</div>';

  body += gameLiveChart(e, false);

  // Donnes
  body += '<h2>Donnes</h2>';
  if (!e.rows.length) {
    body += '<p class="muted">Aucune donne pour l\'instant. Touchez « Nouvelle donne » après chaque main.</p>';
  } else {
    body += '<ul class="hands panel" style="padding:0 12px">';
    body += [...e.rows].reverse().map((row, k) => handRow(row, e.rows.length - k, g.teams)).join('');
    body += '</ul>';
  }

  body += `<div style="margin-top:22px" class="row wrap">
      <span class="small muted" style="flex:1">Commencée le ${dateTime(g.startedAt)}</span>
      <button class="link" data-act="rename-game" data-id="${g.id}">${gameTitle(g) ? 'Renommer' : 'Donner un titre'}</button>
      <button class="link" style="color:var(--red)" data-act="delete-game" data-id="${g.id}">Supprimer la partie</button>
    </div>`;

  const fab = e.winner === null
    ? `<button class="btn gold block" data-act="new-hand" data-id="${g.id}">Nouvelle donne</button>` : '';
  return shell(esc(gameTitle(g) || (e.winner !== null ? 'Partie terminée' : 'Partie en cours')), body, { back: '#/', fab, active: 'home' });
}

function handRow(row, n, teams) {
  const h = row.hand;
  if (h.passed) {
    return `<li><button class="hand" data-act="edit-hand" data-id="${h.id}"><span class="n">${n}</span>
      <span class="what"><b>Donne passée</b><div class="sub">Personne n'a pris</div></span><span class="pts muted">0</span></button></li>`;
  }
  const taker = P(h.taker);
  const partnerId = h.shared ? teams[row.attack]?.find((x) => x !== h.taker) : null;
  const m = h.surcoincheBy ? '<span class="tag x2">surcontré ×4</span>' : h.coincheBy ? '<span class="tag x2">contré ×2</span>' : '';
  const res = row.made ? '<span class="tag ok">réussi</span>' : '<span class="tag ko">chuté</span>';
  const extra = [];
  if (h.coincheBy) extra.push(`contre de ${esc(P(h.coincheBy).name)}`);
  if (h.surcoincheBy) extra.push(`surcontre de ${esc(P(h.surcoincheBy).name)}`);
  if (h.beloteBy && h.suit !== 'SA') extra.push(`belote ${esc(P(h.beloteBy).name)}`);
  if (h.capot) extra.push('capot');
  else if (!['capot', 'generale'].includes(h.bid) || h.attackPoints != null) extra.push(`${h.attackPoints ?? 0} pts faits`);
  return `<li><button class="hand" data-act="edit-hand" data-id="${h.id}">
    <span class="n">${n}</span>
    <span class="what"><b>${esc(taker.name)}</b>${partnerId ? ` <span class="muted">avec ${esc(P(partnerId).name)}</span>` : ''} · ${bidLabel(h.bid)} ${suitHtml(h.suit)} ${res}${m}
      <div class="sub">${extra.join(' · ')}</div></span>
    <span class="pts"><span class="p0">+${row.scores[0]}</span><br><span class="p1">+${row.scores[1]}</span></span>
  </button></li>`;
}

// ============================================================ JOUEURS
function playersPage() {
  const d = D();
  let body = kindSwitch();
  if (!d.players.length) {
    body = '<p class="muted">Aucun joueur pour l\'instant.</p>';
  } else {
    body += '<ul class="list" style="margin-top:14px">';
    const order = [...d.players].sort((a, b) => {
      const sa = d.stats.get(a.id), sb = d.stats.get(b.id);
      return (sb.games > 0) - (sa.games > 0) || (sb.winPct ?? 0) - (sa.winPct ?? 0) || a.name.localeCompare(b.name, 'fr');
    });
    body += order.map((p) => {
      const s = d.stats.get(p.id);
      return `<li><a class="item" href="#/player/${p.id}" style="text-decoration:none;color:inherit">${avatar(p)}
        <span class="main"><span class="t">${esc(p.name)}</span><br>
        <span class="s">${s.games} partie${s.games > 1 ? 's' : ''} · prises ${s.takesMade}/${s.takes} · contres ${s.coinchesWon}/${s.coinches}</span></span>
        <span class="r">${pct(s.winPct)}<small>victoires</small></span></a></li>`;
    }).join('');
    body += '</ul>';

    const duos = computeDuos(d.games, d.hands)
      .filter((x) => x.games >= 1)
      .sort((a, b) => b.winPct - a.winPct || b.games - a.games)
      .slice(0, 6);
    if (duos.length) {
      body += '<h2>Meilleurs duos</h2><ul class="list">';
      body += duos.map((x) => `<li><div class="item">
          <div class="av-pair">${x.ids.map((id) => avatar(P(id), 's')).join('')}</div>
          <span class="main"><span class="t">${x.ids.map((id) => esc(P(id).name)).join(' & ')}</span><br>
          <span class="s">${x.wins} victoire${x.wins > 1 ? 's' : ''} sur ${x.games} partie${x.games > 1 ? 's' : ''}</span></span>
          <span class="r">${pct(x.winPct)}</span></div></li>`).join('');
      body += '</ul>';
    }
  }
  const fab = '<button class="btn block" data-act="add-player">Ajouter un joueur</button>';
  return shell('Joueurs', body, { fab, active: 'players' });
}

function playerPage(id, opts = {}) {
  const d = opts.ctx || D();
  const p = d.byId[id];
  if (!p) return shell('Joueur', '<p class="muted">Ce joueur n\'existe plus.</p>', { back: '#/players' });
  const s = d.stats.get(id);
  const fav = s.favSuit ? `${suitHtml(s.favSuit)} ${SUITS[s.favSuit].label}` : '–';
  const streak = s.streak > 0 ? `${s.streak} victoire${s.streak > 1 ? 's' : ''}` : s.streak < 0 ? `${-s.streak} défaite${s.streak < -1 ? 's' : ''}` : '–';

  let body = `
    <div class="hero felt">
      ${avatar(p, 'l')}
      <div style="min-width:0;flex:1"><h2>${esc(p.name)}</h2>
        <p>${opts.game ? `${esc(gameTitle(opts.game) || 'Cette partie')} · ${s.handsDealt} donne${s.handsDealt > 1 ? 's' : ''}` : `${s.games} partie${s.games > 1 ? 's' : ''} · ${s.handsPlayed} donnes jouées`}</p>
        ${profileActions(p, opts)}
      </div>
    </div>
    <div style="margin-top:14px">${scopeOrKindSwitch(id, opts)}</div>
    ${opts.game ? gameSummary(d, id, false) : `
    <h2>Parties</h2>
    <div class="kpis">
      <div class="kpi blue"><div class="v">${pct(s.winPct)}</div><div class="l">de victoires</div></div>
      <div class="kpi red"><div class="v">${pct(s.lossPct)}</div><div class="l">de défaites</div></div>
      <div class="kpi"><div class="v">${s.wins}/${s.games}</div><div class="l">parties gagnées</div></div>
    </div>
    <div class="panel" style="margin-top:10px"><dl class="dl">
      <dt>Série en cours</dt><dd>${streak}</dd>
      <dt>Meilleure série de victoires</dt><dd>${s.bestStreak || '–'}</dd>
    </dl></div>`}

    <h2>Prises</h2>
    <div class="kpis">
      <div class="kpi green"><div class="v">${s.takesMade}/${s.takes}</div><div class="l">prises réussies (solo + partagées)</div></div>
      <div class="kpi green"><div class="v">${pct(s.takeMadePct)}</div><div class="l">de réussite</div></div>
      <div class="kpi red"><div class="v">${pct(s.takeFailPct)}</div><div class="l">de chutes</div></div>
    </div>
    <div class="panel" style="margin-top:10px">
      ${s.takes ? `<div class="meter" aria-hidden="true"><span style="width:${s.takeMadePct}%"></span></div>` : ''}
      <dl class="dl">
        <dt>Prises sur les donnes jouées</dt><dd>${s.takes}/${s.handsDealt} (${pct(s.takeRate)})</dd>
        <dt>Prises solo réussies</dt><dd>${s.soloMade}/${s.soloTakes} (${pct(s.soloPct)})</dd>
        <dt>Prises partagées réussies</dt><dd>${s.sharedMade}/${s.sharedTakes} (${pct(s.sharedPct)})</dd>
        <dt>Points moyens par contrat réussi</dt><dd>${num(s.avgPointsMade)}</dd>
        <dt>Annonce moyenne</dt><dd>${num(s.avgBid)}</dd>
        <dt>Couleur préférée</dt><dd>${fav}</dd>
        <dt>Capots réalisés (annoncés)</dt><dd>${s.capots} (${s.capotsAnnounced})</dd>
        <dt>Générales réussies</dt><dd>${s.generales}</dd>
        <dt>Belotes</dt><dd>${s.belotes}</dd>
      </dl>
    </div>

    <h2>Contres et défense</h2>
    <div class="kpis">
      <div class="kpi gold"><div class="v">${s.coinchesWon}/${s.coinches}</div><div class="l">contres réussis</div></div>
      <div class="kpi gold"><div class="v">${s.surcoinchesWon}/${s.surcoinches}</div><div class="l">surcontres réussis</div></div>
      <div class="kpi blue"><div class="v">${pct(s.defensePct)}</div><div class="l">chutes infligées en défense</div></div>
    </div>`;

  if (opts.game) {
    body += playerGameChart(id, opts.game, d, false);
    return shell('Cette partie', body, { back: opts.back, active: 'home' });
  }

  // Duos
  const partnerRows = Object.entries(s.partners).sort((a, b) => b[1].games - a[1].games);
  body += '<h2>Partenaires et adversaires</h2><div class="panel"><dl class="dl">';
  body += `<dt>Meilleur partenaire</dt><dd>${s.bestPartner ? `${esc(P(s.bestPartner.id).name)} (${pct(s.bestPartner.winPct)})` : '–'}</dd>`;
  body += `<dt>Adversaire le plus redouté</dt><dd>${s.nemesis ? `${esc(P(s.nemesis.id).name)} (${pct(s.nemesis.winPct)})` : '–'}</dd>`;
  body += '</dl>';
  if (!s.bestPartner && s.games) body += '<p class="small muted" style="margin:8px 0 0">Il faut au moins 2 parties avec le même partenaire ou adversaire.</p>';
  body += '</div>';
  if (partnerRows.length) {
    body += '<ul class="list" style="margin-top:10px">';
    body += partnerRows.map(([pid, v]) => `<li><div class="item">${avatar(P(pid), 's')}
      <span class="main"><span class="t">avec ${esc(P(pid).name)}</span><br><span class="s">${v.wins} victoire${v.wins > 1 ? 's' : ''} sur ${v.games}</span></span>
      <span class="r">${pct((100 * v.wins) / v.games)}</span></div></li>`).join('');
    body += '</ul>';
  }

  // Évolution
  body += profileChart(id, d, false, opts);

  // Historique
  const mine = d.evaluated.filter((e) => e.winner !== null && (e.game.teams[0].includes(id) || e.game.teams[1].includes(id))).slice(0, 10);
  if (mine.length) {
    body += '<h2>Dernières parties</h2><ul class="list">';
    body += mine.map((e) => {
      const ti = teamOf(e.game.teams, id);
      const won = e.winner === ti;
      const partner = e.game.teams[ti].find((x) => x !== id);
      return `<li><a class="item" ${opts.cross ? '' : `href="#/game/${e.game.id}"`} style="text-decoration:none;color:inherit">
        <span class="tag ${won ? 'ok' : 'ko'}" style="margin:0">${won ? 'Gagnée' : 'Perdue'}</span>
        <span class="main"><span class="t">${gameTitle(e.game) ? `${esc(gameTitle(e.game))} · ` : ''}avec ${esc(P(partner).name)}</span><br><span class="s">contre ${teamNames(e.game.teams[1 - ti])} · ${date(e.game.finishedAt)}</span></span>
        <span class="r" style="font-size:17px">${e.totals[ti]}<small>à ${e.totals[1 - ti]}</small></span></a></li>`;
    }).join('');
    body += '</ul>';
  }
  return shell(opts.cross ? 'Tous groupes' : 'Profil', body, { back: opts.back || '#/players', active: 'players' });
}

// ============================================================ PROFILS RELIÉS (tous groupes)
/** Boutons sous le nom dans un profil. */
function profileActions(p, opts) {
  const btn = 'class="btn light" style="margin-top:10px;min-height:38px;padding:8px 14px"';
  if (opts.cross) {
    const groups = opts.groups || [];
    return `<p class="small" style="margin-top:6px">${groups.length} groupe${groups.length > 1 ? 's' : ''} : ${groups.map((g) => esc(g.name)).join(', ')}</p>`;
  }
  if (opts.game) return '';   // fiche d'une partie : on reste léger (Modifier/Relier sont dans la carrière)
  let html = `<button ${btn} data-act="edit-player" data-id="${p.id}">Modifier</button>`;
  const linked = linkedProfiles(p.personId);
  if (store.listGroups().length > 1) {
    html += ` <button ${btn} data-act="link-open" data-id="${p.id}">${linked.length > 1 ? 'Liens' : 'Relier à un autre groupe'}</button>`;
  }
  if (linked.length > 1) {
    html += `<button class="btn gold" style="margin-top:10px;min-height:38px;padding:8px 14px;width:100%" data-act="person" data-id="${p.personId}">Toutes ses stats · ${linked.length} groupes</button>`;
  }
  return `<div class="row wrap" style="gap:8px">${html}</div>`;
}

/** Graphique d'évolution d'un joueur, statistique au choix. */
function profileChart(id, d, tarot, opts = {}) {
  const STATS = tarot ? TAROT_TIMELINE_STATS : TIMELINE_STATS;
  const key = tarot ? ui.pchartT : ui.pchartC;
  const stat = STATS.find((x) => x.key === key) || STATS[0];
  const tl = tarot ? d.ttimeline : d.timeline;
  // Seulement les parties de ce joueur, dans l'ordre chronologique
  const idx = tl.points.map((pt, i) => (pt.players.includes(id) ? i : -1)).filter((i) => i >= 0);
  const pctStat = stat.unit === '%';
  const fmt = pctStat ? (v) => `${Math.round(v)} %` : stat.unit === 'rang' || stat.key === 'avgBouts' ? (v) => num(v, 1) : (v) => num(v);
  const model = {
    title: stat.label,
    series: [{ id, name: P(id).name, color: SERIES_COLORS[0], values: idx.map((i) => tl.series[id]?.[i]?.[stat.key] ?? null), played: idx.map(() => true) }],
    heads: idx.map((i, k) => (tl.points[i].live ? 'Partie en cours (provisoire)' : `Sa partie ${k + 1} · ${date(tl.points[i].t)}`)),
    ticks: idx.map((i, k) => (tl.points[i].live ? 'direct' : String(k + 1))),
    live: idx.map((i) => !!tl.points[i].live),
    pct: pctStat, zeroBase: stat.unit === '', invert: stat.key === 'avgRank', fmt,
  };
  const hasLive = model.live.some(Boolean);
  ui.bindQueue.push(['.pchart-card', model]);
  return `<h2>Évolution</h2><div class="panel pchart-card">
    <div class="field" style="margin-top:0"><label for="pchart-stat">Statistique</label>
      <select class="input" id="pchart-stat" data-pchart>
        ${STATS.map((x) => `<option value="${x.key}" ${x.key === stat.key ? 'selected' : ''}>${x.label}</option>`).join('')}
      </select></div>
    ${multiLineChart(model)}
    <p class="small muted" style="margin:6px 0 0">Valeur cumulée après chacune de ses parties${opts.cross ? ', tous groupes confondus' : ''}. Touchez la courbe pour lire les valeurs.</p>
    ${hasLive ? liveNote() : ''}
  </div>`;
}

/** Profil « tous groupes » d'une personne (fiches reliées). */
function personPage(personId) {
  const c = cross();
  const person = c.people[personId];
  if (!person) return shell('Toutes ses stats', '<p class="muted">Ce profil n\'est relié à aucun autre groupe.</p>', { back: '#/players' });
  pMap = c.byId;
  try {
    const here = person.groups.find((g) => g.id === store.getState().group?.id);
    const opts = { ctx: c, cross: true, groups: person.groups, back: here ? `#/player/${here.pid}` : '#/players' };
    return ui.kind === 'tarot' ? tarotPlayerPage(personId, opts) : playerPage(personId, opts);
  } finally {
    pMap = null;
  }
}

// ---------- Feuille : relier une fiche à d'autres groupes
function linkSheet() {
  const { pid } = ui.sheet.draft;
  const me = store.get(pid);
  const others = store.listGroups().filter((g) => g.id !== store.getState().group.id);
  let html = `${sheetHead(`Relier ${esc(me?.name || '')}`)}<div class="sheet-body">
    <p class="small muted" style="margin:0 0 6px">Touchez la fiche de ${esc(me?.name || '')} dans chacun de vos autres groupes.
    Ses statistiques seront additionnées dans « Toutes ses stats », et sa photo sera la même partout.</p>`;
  for (const g of others) {
    const players = store.listIn(g.id, 'player').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    html += `<div class="field"><span class="lab">${esc(g.name)}</span>`;
    if (!players.length) html += '<p class="small muted">Aucun joueur dans ce groupe.</p>';
    else {
      html += '<div class="pick">';
      html += players.map((q) => {
        const on = !!me?.personId && q.personId === me.personId;
        return `<button data-act="${on ? 'unlink' : 'link-to'}" data-g="${g.id}" data-v="${q.id}" aria-pressed="${on}">
          ${avatar(q, 's')}${esc(q.name)}${on ? ' ✓' : ''}</button>`;
      }).join('');
      html += '</div>';
    }
    html += '</div>';
  }
  html += `<p class="small muted" style="margin-top:16px">Touchez une fiche reliée (✓) pour retirer le lien.</p></div>
    <div class="sheet-foot"><button class="btn gold block" data-act="sheet-close">Terminé</button></div>`;
  return html;
}

/** Relie la fiche pid (groupe affiché) à la fiche otherPid du groupe gid. */
function linkProfiles(pid, gid, otherPid) {
  const me = store.get(pid);
  const other = store.listIn(gid, 'player').find((q) => q.id === otherPid);
  if (!me || !other) return;
  const personId = me.personId || other.personId || store.uuid();
  // Une seule fiche par groupe pour une même personne
  for (const q of store.listIn(gid, 'player')) {
    if (q.personId === personId && q.id !== otherPid) store.patchIn(gid, q.id, { personId: null });
  }
  // Si l'autre fiche était déjà reliée à d'autres, on fusionne les deux personnes
  if (other.personId && other.personId !== personId) {
    for (const g of store.listGroups()) {
      for (const q of store.listIn(g.id, 'player')) {
        if (q.personId === other.personId) {
          if (g.id === store.getState().group.id) store.patch(q.id, { personId });
          else store.patchIn(g.id, q.id, { personId });
        }
      }
    }
  }
  const photo = me.photo || other.photo || null;
  if (me.personId !== personId || (!me.photo && photo)) store.patch(pid, { personId, photo });
  store.patchIn(gid, otherPid, { personId, photo });
}

/** Recopie la photo d'une fiche dans toutes les fiches reliées des autres groupes. */
function propagatePhoto(pid) {
  const me = store.get(pid);
  if (!me?.personId) return;
  const here = store.getState().group.id;
  for (const g of store.listGroups()) {
    if (g.id === here) continue;
    for (const q of store.listIn(g.id, 'player')) {
      if (q.personId === me.personId && (q.photo || null) !== (me.photo || null)) store.patchIn(g.id, q.id, { photo: me.photo || null });
    }
  }
}

// ---------- Feuille : mes groupes
function groupsSheet() {
  const groups = store.listGroups();
  const active = store.getState().group?.id;
  const cloud = store.cloudConfigured;
  return `${sheetHead('Mes groupes')}<div class="sheet-body">
    <ul class="list" style="margin-top:4px">
      ${groups.map((g) => `<li><button class="item" data-act="switch-group" data-id="${g.id}">
        <span class="gdot ${g.id === active ? 'on' : ''}"></span>
        <span class="main"><span class="t">${esc(g.name)}</span><br><span class="s">${g.local ? 'Sur ce téléphone uniquement' : `Code ${esc(g.code)}`}</span></span>
        ${g.id === active ? '<span class="tag ok" style="margin:0">affiché</span>' : ''}</button></li>`).join('')}
    </ul>
    ${cloud ? `<div class="field"><label for="add-code">Rejoindre un autre groupe</label>
      <input class="input" id="add-code" placeholder="Code à 8 caractères" autocomplete="off" autocapitalize="characters" maxlength="12"
        style="text-transform:uppercase;letter-spacing:.12em;font-weight:700">
      <button class="btn block" style="margin-top:8px" data-act="add-join">Rejoindre</button></div>` : ''}
    <div class="field"><label for="add-name">Créer un nouveau groupe</label>
      <input class="input" id="add-name" placeholder="Nom du groupe" maxlength="60">
      <button class="btn gold block" style="margin-top:8px" data-act="add-create">Créer le groupe</button></div>
  </div>`;
}

/** Légende du point provisoire. */
function liveNote() {
  return `<p class="small muted live-note" style="margin:6px 0 0"><i></i>Pointillés : partie en cours, mis à jour à chaque donne.
    Les victoires et places ne comptent qu'à la fin de la partie.</p>`;
}

/** Graphique « Évolution des scores » dans l'écran d'une partie (donne par donne). */
// Statistiques proposées dans le graphique d'une partie.
// scope : 'both' = cette partie et carrière ; 'career' = carrière seulement.
const GAME_STATS_C = [
  { key: 'takeMadePct', label: '% de prises réussies', unit: '%' },
  { key: 'takeRate', label: '% de prises sur les donnes jouées', unit: '%' },
  { key: 'takesMade', label: 'Prises réussies', unit: '' },
  { key: 'takes', label: 'Prises tentées', unit: '' },
  { key: 'avgPointsMade', label: 'Points moyens par contrat réussi', unit: 'pts' },
  { key: 'avgBid', label: 'Annonce moyenne', unit: 'pts' },
  { key: 'coinchesWon', label: 'Contres réussis', unit: '' },
  { key: 'defensePct', label: '% de chutes infligées en défense', unit: '%' },
  { key: 'belotes', label: 'Belotes', unit: '' },
  { key: 'capots', label: 'Capots', unit: '' },
  { key: 'winPct', label: '% de victoires', unit: '%', scope: 'career' },
  { key: 'score', label: 'Score des équipes', unit: 'pts', scope: 'game' },
];
const GAME_STATS_T = [
  { key: 'takePct', label: '% de prises réussies', unit: '%' },
  { key: 'takeRate', label: '% de prises sur les donnes jouées', unit: '%' },
  { key: 'takesMade', label: 'Prises réussies', unit: '' },
  { key: 'takes', label: 'Prises tentées', unit: '' },
  { key: 'sharePetite', label: 'Part de Petites dans ses prises', unit: '%' },
  { key: 'shareGarde', label: 'Part de Gardes dans ses prises', unit: '%' },
  { key: 'shareGardeSans', label: 'Part de Gardes sans dans ses prises', unit: '%' },
  { key: 'shareGardeContre', label: 'Part de Gardes contre dans ses prises', unit: '%' },
  { key: 'avgGainMade', label: 'Gain moyen par prise réussie', unit: 'pts' },
  { key: 'avgBouts', label: 'Bouts moyens quand il prend', unit: 'dec' },
  { key: 'called', label: 'Fois appelé (à 5)', unit: '', five: true },
  { key: 'calledPct', label: '% de réussite comme appelé (à 5)', unit: '%', five: true },
  { key: 'defensePct', label: '% de contrats chutés en défense', unit: '%' },
  { key: 'pabMade', label: 'Petits au bout réussis', unit: '' },
  { key: 'poignees', label: 'Poignées', unit: '' },
  { key: 'winPct', label: '% de victoires', unit: '%', scope: 'career' },
  { key: 'avgRank', label: 'Place moyenne', unit: 'dec', scope: 'career' },
  { key: 'score', label: 'Score des joueurs', unit: 'pts', scope: 'game' },
];

/**
 * Graphique de la partie : statistique au choix, une courbe par joueur, donne après donne.
 * ui.gameView = 'game' : statistiques de cette partie seulement ;
 * 'career' : statistiques de carrière (toutes les parties du groupe), mises à jour à chaque donne.
 */
function gameLiveChart(e, tarot) {
  const rows = e.rows;
  if (!rows.length) return '';
  const g = e.game;
  const d = D();
  const career = ui.gameView === 'career';
  const pids = tarot ? g.players : [...g.teams[0], ...g.teams[1]];
  const avail = (tarot ? GAME_STATS_T : GAME_STATS_C).filter((x) =>
    (career ? x.scope !== 'game' : x.scope !== 'career') && (!x.five || pids.length === 5));
  let key = tarot ? ui.gstatT : ui.gstatC;
  if (!avail.some((x) => x.key === key)) key = avail[0].key;
  const stat = avail.find((x) => x.key === key);
  const heads = ['Début de la partie', ...rows.map((r, i) => `Donne ${i + 1}${r.hand.passed ? ' (passée)' : ''}`)];
  const ticks = ['0', ...rows.map((_, i) => String(i + 1))];
  const all = heads.map(() => true);
  let series;
  let ref = null;

  if (stat.key === 'score') {
    if (tarot) {
      series = g.players.map((pid, k) => ({
        id: pid, name: P(pid).name, color: SERIES_COLORS[k], values: [0, ...rows.map((r) => r.totals[pid])], played: all,
      }));
    } else {
      series = [0, 1].map((ti) => ({
        id: `t${ti}`, name: TEAM_NAMES[ti], color: ti ? '#d7263d' : '#3a50c2', values: [0, ...rows.map((r) => r.totals[ti])], played: all,
      }));
      ref = { value: g.rules.target, label: `Objectif ${g.rules.target}` };
    }
  } else {
    // Statistiques recalculées après chaque donne de la partie
    const thisHands = rows.map((r) => r.hand);
    const players = d.players.filter((p) => pids.includes(p.id));
    const otherHands = career ? (tarot ? d.thands : d.hands).filter((h) => h.gameId !== g.id) : [];
    const games = career ? (tarot ? d.tgames : d.games) : [g];
    const snaps = [];
    for (let k = 0; k <= thisHands.length; k++) {
      const hs = [...otherHands, ...thisHands.slice(0, k)];
      // La partie n'est terminée qu'au dernier point (sinon victoires et places bougeraient trop tôt)
      const gs = games.map((x) => (x.id === g.id && k < thisHands.length ? { ...x, finishedAt: null, winner: null } : x));
      snaps.push(tarot ? computeTarotStats(players, gs, hs) : computeStats(players, gs, hs));
    }
    series = pids.map((pid, k) => ({
      id: pid, name: P(pid).name, color: SERIES_COLORS[k], values: snaps.map((S) => S.get(pid)?.[stat.key] ?? null), played: all,
    }));
  }

  const pctStat = stat.unit === '%';
  const fmt = pctStat ? (v) => `${Math.round(v)} %` : stat.unit === 'dec' ? (v) => num(v, 1) : (v) => num(v);
  const model = {
    title: stat.label, series, heads, ticks, ref, fmt,
    pct: pctStat, zeroBase: stat.unit === '', invert: stat.key === 'avgRank',
    empty: 'Les courbes apparaîtront après la première donne.',
  };
  ui.bindQueue.push(['.gchart-card', model]);
  return `<div class="panel gchart-card" style="margin-top:12px">
    <div class="field" style="margin-top:0"><label for="gchart-stat">Graphique</label>
      <select class="input" id="gchart-stat" data-gchart>
        ${avail.map((x) => `<option value="${x.key}" ${x.key === stat.key ? 'selected' : ''}>${x.label}</option>`).join('')}
      </select></div>
    ${multiLineChart(model)}
    <p class="small muted" style="margin:6px 0 0">${stat.key === 'score'
      ? 'Scores après chaque donne.'
      : career
        ? 'Statistiques de carrière (toutes les parties du groupe), recalculées après chaque donne de cette partie.'
        : 'Statistiques de cette partie seulement, recalculées après chaque donne.'}
    Touchez la courbe pour lire les valeurs.</p>
  </div>`;
}

// ============================================================ STATS D'UN JOUEUR POUR UNE PARTIE
/** Fiche d'un joueur calculée uniquement sur une partie (même présentation que la carrière). */
function gamePlayerPage(gid, pid) {
  const g = store.get(gid);
  if (!g) return shell('Partie', '<p class="muted">Cette partie n\'existe plus.</p>', { back: '#/' });
  const tarot = g.type === 'tarot';
  setKind(tarot ? 'tarot' : 'contree');
  const d = D();
  const ctx = buildData(d.players, [g], d.byGame.get(gid) || []);
  const opts = { ctx, game: g, back: `#/game/${gid}` };
  return tarot ? tarotPlayerPage(pid, opts) : playerPage(pid, opts);
}

/** En haut d'une fiche : « Cette partie | Carrière » si on vient d'une partie, sinon Contrée | Tarot. */
function scopeOrKindSwitch(pid, opts) {
  const gid = opts.game?.id || opts.fromGame;
  if (!gid) return opts.cross ? kindSwitch() : kindSwitch();
  return `<div class="kind-switch" role="group" aria-label="Période">
    <a href="#/gplayer/${gid}/${pid}" role="button" aria-pressed="${!!opts.game}">Cette partie</a>
    <a href="#/player/${pid}/${gid}" role="button" aria-pressed="${!opts.game}">Carrière</a>
  </div>`;
}

/** Résumé de la partie pour ce joueur (remplace le bloc « Parties » de la carrière). */
function gameSummary(ctx, pid, tarot) {
  const e = tarot ? ctx.tevaluated[0] : ctx.evaluated[0];
  if (!e) return '';
  if (tarot) {
    const status = e.finished ? (e.rank[pid] === 1 ? 'Gagnée' : 'Terminée') : 'En cours';
    return `<h2>La partie</h2>
      <div class="kpis">
        <div class="kpi blue"><div class="v">${RANK_LABEL(e.rank[pid])}</div><div class="l">${e.finished ? 'place finale' : 'place actuelle'}</div></div>
        <div class="kpi ${e.totals[pid] < 0 ? 'red' : 'green'}"><div class="v">${signed(e.totals[pid])}</div><div class="l">points</div></div>
        <div class="kpi"><div class="v">${e.played}</div><div class="l">donnes jouées</div></div>
      </div>
      <div class="panel" style="margin-top:10px"><dl class="dl">
        <dt>Statut</dt><dd>${status}</dd>
        <dt>Tarot à</dt><dd>${e.game.players.length} joueurs</dd>
        <dt>Commencée le</dt><dd>${dateTime(e.game.startedAt)}</dd>
      </dl></div>`;
  }
  const ti = teamOf(e.game.teams, pid);
  const partner = e.game.teams[ti].find((x) => x !== pid);
  const status = e.winner === null ? 'En cours' : e.winner === ti ? 'Gagnée' : 'Perdue';
  return `<h2>La partie</h2>
    <div class="kpis">
      <div class="kpi ${ti ? 'red' : 'blue'}"><div class="v">${e.totals[ti]}</div><div class="l">points de son équipe</div></div>
      <div class="kpi"><div class="v">${e.totals[1 - ti]}</div><div class="l">points adverses</div></div>
      <div class="kpi ${status === 'Gagnée' ? 'green' : status === 'Perdue' ? 'red' : ''}"><div class="v" style="font-size:22px">${status}</div><div class="l">objectif ${e.game.rules.target}</div></div>
    </div>
    <div class="panel" style="margin-top:10px"><dl class="dl">
      <dt>Partenaire</dt><dd>${esc(P(partner).name)} (${TEAM_NAMES[ti]})</dd>
      <dt>Adversaires</dt><dd>${teamNames(e.game.teams[1 - ti])}</dd>
      <dt>Commencée le</dt><dd>${dateTime(e.game.startedAt)}</dd>
    </dl></div>`;
}

/** Évolution, donne après donne, d'une statistique de ce joueur dans la partie. */
function playerGameChart(pid, g, ctx, tarot) {
  const rows = (tarot ? ctx.tevaluated[0] : ctx.evaluated[0])?.rows || [];
  const avail = (tarot ? GAME_STATS_T : GAME_STATS_C).filter((x) => !x.scope && (!x.five || (g.players || []).length === 5));
  let key = tarot ? ui.gstatT : ui.gstatC;
  if (!avail.some((x) => x.key === key)) key = avail[0].key;
  const stat = avail.find((x) => x.key === key);
  const player = ctx.players.filter((p) => p.id === pid);
  const hands = rows.map((r) => r.hand);
  const values = [];
  for (let k = 0; k <= hands.length; k++) {
    const gg = k < hands.length ? { ...g, finishedAt: null, winner: null } : g;
    const S = tarot ? computeTarotStats(player, [gg], hands.slice(0, k)) : computeStats(player, [gg], hands.slice(0, k));
    values.push(S.get(pid)?.[stat.key] ?? null);
  }
  const heads = ['Début de la partie', ...rows.map((r, i) => `Donne ${i + 1}${r.hand.passed ? ' (passée)' : ''}`)];
  const pctStat = stat.unit === '%';
  const model = {
    title: stat.label,
    series: [{ id: pid, name: P(pid).name, color: SERIES_COLORS[0], values, played: heads.map(() => true) }],
    heads, ticks: ['0', ...rows.map((_, i) => String(i + 1))],
    pct: pctStat, zeroBase: stat.unit === '', invert: false,
    fmt: pctStat ? (v) => `${Math.round(v)} %` : stat.unit === 'dec' ? (v) => num(v, 1) : (v) => num(v),
    empty: 'La courbe apparaîtra après la première donne.',
  };
  ui.bindQueue.push(['.gchart-card', model]);
  return `<h2>Évolution dans la partie</h2><div class="panel gchart-card">
    <div class="field" style="margin-top:0"><label for="gchart-stat">Statistique</label>
      <select class="input" id="gchart-stat" data-gchart>
        ${avail.map((x) => `<option value="${x.key}" ${x.key === stat.key ? 'selected' : ''}>${x.label}</option>`).join('')}
      </select></div>
    ${rows.length ? multiLineChart(model) : '<p class="muted">La courbe apparaîtra après la première donne.</p>'}
    <p class="small muted" style="margin:6px 0 0">Valeur après chaque donne de cette partie. Touchez la courbe pour lire les valeurs.</p>
  </div>`;
}

// ============================================================ GRAPHIQUES
function chartsPage() {
  const d = D();
  const tarot = ui.kind === 'tarot';
  const tl = tarot ? d.ttimeline : d.timeline;
  const STATS = tarot ? TAROT_TIMELINE_STATS : TIMELINE_STATS;
  const allStats = (id) => (tarot ? d.tstats : d.stats).get(id);
  // Sélection par défaut : les 4 joueurs qui ont le plus joué
  if (!ui.chartSel) {
    ui.chartSel = [...d.players]
      .sort((a, b) => allStats(b.id).games - allStats(a.id).games)
      .slice(0, 4)
      .map((p, i) => ({ id: p.id, slot: i }));
  }
  ui.chartSel = ui.chartSel.filter((x) => d.byId[x.id]);
  const chosen = tarot ? ui.tchartStat : ui.chartStat;
  const stat = STATS.find((s) => s.key === chosen) || STATS[0];
  const pctStat = stat.unit === '%';
  const fmt = pctStat ? (v) => `${Math.round(v)} %` : stat.unit === 'rang' || stat.key === 'avgBouts' ? (v) => num(v, 1) : (v) => num(v);
  const lowerIsBetter = stat.key === 'avgRank';
  const sel = [...ui.chartSel].sort((a, b) => a.slot - b.slot);
  const series = sel.map(({ id, slot }) => ({
    id,
    name: P(id).name,
    color: SERIES_COLORS[slot],
    values: tl.series[id].map((snap) => (snap ? snap[stat.key] : null)),
    played: tl.points.map((pt) => pt.players.includes(id)),
  }));
  const shortDate = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
  ui.chartModel = {
    title: stat.label,
    series,
    heads: tl.points.map((pt, i) => (pt.live ? 'Partie en cours (provisoire)' : `Partie ${i + 1} du groupe · ${date(pt.t)}`)),
    ticks: tl.points.map((pt) => (pt.live ? 'direct' : shortDate(pt.t))),
    live: tl.points.map((pt) => !!pt.live),
    pct: pctStat,
    zeroBase: stat.unit === '',
    invert: lowerIsBetter,
    fmt,
  };

  let body = `${kindSwitch()}<div class="field" style="margin-top:14px"><label for="chart-stat">Statistique</label>
    <select class="input" id="chart-stat" data-chart-stat>
      ${STATS.map((s) => `<option value="${s.key}" ${s.key === stat.key ? 'selected' : ''}>${s.label}</option>`).join('')}
    </select></div>
  <h2>Joueurs <span class="small muted" style="font:400 14px var(--body)">${sel.length}/8</span></h2>
  <div class="chips" role="group" aria-label="Joueurs">
    ${d.players.map((p) => {
      const on = sel.find((x) => x.id === p.id);
      return `<button class="pchip" data-act="chart-player" data-v="${p.id}" aria-pressed="${!!on}" style="${on ? `--k:${SERIES_COLORS[on.slot]}` : ''}">
        ${avatar(p, 's')}${esc(p.name)}<span class="key"></span></button>`;
    }).join('')}
  </div>
  <div class="panel chart-card" style="margin-top:18px">
    <h3>${stat.label}</h3>
    <p class="small muted" style="margin:0">Valeur cumulée après chaque partie. Touchez la courbe pour lire les valeurs.</p>
    ${multiLineChart(ui.chartModel)}
    ${ui.chartModel.live.some(Boolean) ? liveNote() : ''}
  </div>`;

  // Tableau des valeurs actuelles (lecture sans graphique)
  if (series.length && tl.points.length) {
    const rows = series.map((s) => {
      const snap = tl.series[s.id][tl.points.length - 1];
      return { s, v: snap ? snap[stat.key] : null, games: snap ? snap.games : 0 };
    }).sort((a, b) => (lowerIsBetter ? (a.v ?? Infinity) - (b.v ?? Infinity) : (b.v ?? -Infinity) - (a.v ?? -Infinity)));
    body += `<h2>Aujourd'hui</h2><div class="panel"><table class="vtable">
      <thead><tr><th>Joueur</th><th class="n">${stat.label}</th><th class="n">Parties</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><span class="who"><i style="background:${r.s.color}"></i>${esc(r.s.name)}</span></td>
        <td class="n"><b>${r.v == null ? '–' : fmt(r.v)}</b></td><td class="n">${r.games}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  return shell('Graphiques', body, { active: 'charts' });
}

// ============================================================ HISTORIQUE
function historyPage() {
  const d = D();
  const tarot = ui.kind === 'tarot';
  const list = tarot ? d.tevaluated : d.evaluated;
  let body = kindSwitch();
  if (!list.length) body += '<p class="muted" style="margin-top:14px">Aucune partie jouée pour l\'instant.</p>';
  else {
    let month = '';
    for (const e of list) {
      const m = new Date(e.game.startedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (m !== month) { body += `<h2>${m.charAt(0).toUpperCase() + m.slice(1)}</h2>`; month = m; }
      body += tarot ? tarotGameCard(e) : gameCard(e);
    }
  }
  return shell('Historique', body, { active: 'history' });
}

// ============================================================ GROUPE / RÉGLAGES
function settingsPage() {
  const st = store.getState();
  const g = st.group;
  const d = D();
  const r = d.rules;
  const local = g.local || !store.cloudConfigured;
  let body = `<div class="gname-row"><h2>${esc(g.name)}</h2>
    <button class="link" data-act="rename-group" data-id="${g.id}">Renommer</button></div>`;
  if (local) {
    body += `<div class="notice">Mode local : les données sont enregistrées sur ce téléphone uniquement.
      Pour les partager entre plusieurs téléphones, configurez le serveur (voir le guide d'installation).</div>`;
  } else {
    body += `<div class="panel">
      <h3>Code d'invitation</h3>
      <div class="code">${esc(g.code)}</div>
      <p class="small muted" style="margin:10px 0">Les autres joueurs installent l'app puis choisissent « Rejoindre un groupe » avec ce code.
      Toute personne qui a le code peut lire et modifier les scores du groupe.</p>
      <div class="row"><button class="btn block" data-act="share-code">Inviter</button><button class="btn light block" data-act="copy-code">Copier</button></div>
    </div>
    <div class="panel" style="margin-top:12px"><dl class="dl">
      <dt>Dernière synchronisation</dt><dd>${st.lastSync ? dateTime(st.lastSync) : 'jamais'}</dd>
      <dt>Modifications à envoyer</dt><dd>${st.dirty.length}</dd>
      ${st.lastError ? `<dt>Problème</dt><dd style="color:var(--red)">${esc(st.lastError)}</dd>` : ''}
    </dl><button class="btn light block" style="margin-top:10px" data-act="sync-now">Synchroniser maintenant</button></div>`;
  }

  body += installBlock();

  const tg = (k, label, hint = '') => `<label class="toggle"><input type="checkbox" data-rule="${k}" ${r[k] ? 'checked' : ''}>
      <span>${label}${hint ? `<br><span class="small muted">${hint}</span>` : ''}</span></label>`;
  body += `<h2>Règles du groupe</h2>
    <div class="panel">
      <div class="field" style="margin-top:0"><label for="rule-target">Score à atteindre par défaut</label>
        <select class="input" id="rule-target" data-rule="target">
          ${[500, 1000, 1500, 2000, 2500, 3000].map((v) => `<option value="${v}" ${r.target === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select></div>
      <div style="margin-top:8px">
      ${tg('allowSA', 'Sans atout autorisé')}
      ${tg('allowTA', 'Tout atout autorisé')}
      ${tg('rounding', 'Arrondir à la dizaine', 'Le 5 profite à l\'attaque : 85 → 90, la défense prend 160 − 90 = 70.')}
      ${tg('beloteLostOnFail', 'Belote perdue si l\'attaque chute')}
      ${tg('capotUnannounced250', 'Capot non annoncé = 250 points', 'Sinon il vaut 160 comme une donne normale.')}
      </div>
      <div class="field"><label for="rule-fail">En cas de chute, la défense marque</label>
        <select class="input" id="rule-fail" data-rule="failBase">
          <option value="160" ${r.failBase === 160 ? 'selected' : ''}>160 + l'annonce</option>
          <option value="162" ${r.failBase === 162 ? 'selected' : ''}>162 + l'annonce</option>
          <option value="0" ${r.failBase === 0 ? 'selected' : ''}>l'annonce seule</option>
        </select></div>
      <p class="small muted" style="margin:12px 0 0">Ces règles s'appliquent aux nouvelles parties. Une partie déjà commencée garde les règles de son lancement.</p>
    </div>

    <h2>Comment les points sont comptés</h2>
    <div class="panel formula">
      <p><code>A</code> = annonce (80 à 160, capot = 250, générale = 500), <code>m</code> = 1, ou 2 si contré, ou 4 si surcontré,
      <code>p</code> = points de cartes faits par l'attaque (sur 162), <code>b</code> = 20 de belote.</p>
      <p>Le contrat est <b>réussi</b> si <code>p + b(attaque) ≥ A</code>.</p>
      <p>Réussi : attaque = <code>m × A + p arrondi + b</code>, défense = <code>160 − p arrondi + b</code>.</p>
      <p>Chuté : attaque = 0, défense = <code>${r.failBase ? `${r.failBase} + ` : ''}m × A + b</code>.</p>
      <p class="muted">Exemple : 100 ♥, l'attaque fait 96 avec la belote → 96 + 20 = 116 ≥ 100, réussi.
      Attaque : 100 + 100 + 20 = 220 ; défense : 60. Si c'était contré : 200 + 100 + 20 = 320.</p>
    </div>

    <h2>Règles du tarot</h2>
    <div class="panel">
      <div class="field" style="margin-top:0"><label for="trule-mode">Durée par défaut</label>
        <select class="input" id="trule-mode" data-trule="mode">
          <option value="hands" ${d.trules.mode === 'hands' ? 'selected' : ''}>Nombre de donnes fixé</option>
          <option value="free" ${d.trules.mode === 'free' ? 'selected' : ''}>Partie libre</option>
        </select></div>
      <div class="field"><label for="trule-n">Nombre de donnes par défaut</label>
        <select class="input" id="trule-n" data-trule="nHands">
          ${[5, 10, 12, 15, 20, 25, 30].map((v) => `<option value="${v}" ${d.trules.nHands === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select></div>
      <div style="margin-top:8px">
        <label class="toggle"><input type="checkbox" data-trule="pabTimesK" ${d.trules.pabTimesK ? 'checked' : ''}>
          <span>Petit au bout multiplié par le contrat<br><span class="small muted">Barème FFT. Sinon 10 points fixes.</span></span></label>
        <label class="toggle"><input type="checkbox" data-trule="miseres" ${d.trules.miseres ? 'checked' : ''}>
          <span>Annonces de misère</span></label>
      </div>
    </div>
    <div class="panel formula" style="margin-top:12px">
      <p><code>P</code> = points de l'attaque (sur 91), <code>O</code> = objectif selon les bouts (0 : 56, 1 : 51, 2 : 41, 3 : 36),
      <code>k</code> = Petite 1, Garde 2, Garde sans 4, Garde contre 6.</p>
      <p>Donne <code>D = ±(25 + |P − O|) × k</code> ± petit au bout (10 × k) ± poignée (20, 30, 40) + chelem.</p>
      <p>Chaque défenseur marque <code>−D</code> ; le preneur <code>+2D</code> à 3, <code>+3D</code> à 4 ; à 5, preneur <code>+2D</code> et appelé <code>+D</code> (ou <code>+4D</code> s'il est seul).</p>
      <p class="muted">Exemple : à 4, Garde, 2 bouts, 47 points → (25 + 6) × 2 = 62 ; preneur +186, défenseurs −62.</p>
    </div>

    ${EMBED ? '' : `<h2>Exporter</h2>
    <div class="row"><button class="btn light block" data-act="export-stats">Stats contrée</button>
      <button class="btn light block" data-act="export-hands">Donnes contrée</button></div>
    <div class="row" style="margin-top:8px"><button class="btn light block" data-act="export-tstats">Stats tarot</button>
      <button class="btn light block" data-act="export-thands">Donnes tarot</button></div>`}

    <h2>Ce téléphone</h2>
    <button class="btn light block" style="margin-bottom:10px" data-act="groups">Mes groupes (${store.listGroups().length}) · en ajouter un</button>
    <p class="small muted" style="margin:-4px 0 6px">Version de l'application : <b>${APP_VERSION}</b>
      ${ui.serverBuild ? `<br>Version en ligne : <b>${ui.serverBuild}</b>${ui.serverBuild > APP_BUILD ? ' — mise à jour disponible' : ''}` : ''}</p>
    ${EMBED ? '' : '<button class="btn light block" style="margin-bottom:10px" data-act="force-update">Forcer la mise à jour de l\'app</button>'}
    <button class="btn danger block" data-act="leave-group">${local ? 'Effacer ce groupe de ce téléphone' : 'Quitter ce groupe sur ce téléphone'}</button>
    <p class="small muted" style="margin-top:8px">${local ? 'Toutes les parties et profils de ce téléphone seront supprimés.' : 'Les données restent sur le serveur : vous pourrez revenir avec le code.'}</p>`;
  return shell('Groupe', body, { active: 'settings' });
}

function installBlock() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ui.installPrompt) {
    return `<div class="panel" style="margin-top:12px"><h3>Installer l'application</h3>
      <p class="small muted">Ajoute une icône sur l'écran d'accueil, comme une vraie app.</p>
      <button class="btn gold block" data-act="install">Installer</button></div>`;
  }
  return `<div class="panel" style="margin-top:12px"><h3>Installer l'application</h3>
    <p class="small muted" style="margin:0">${ios
      ? 'Dans Safari : bouton Partager, puis « Sur l\'écran d\'accueil ».'
      : 'Dans Chrome : menu ⋮, puis « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».'}</p></div>`;
}

// ============================================================ FEUILLES (saisie)
function openSheet(kind, draft = {}, extra = {}) {
  ui.sheet = { kind, draft, ...extra };
  document.getElementById('toast').innerHTML = '';
  renderSheet(true);
}
function closeSheet() {
  ui.sheet = null;
  sheetRoot.innerHTML = '';
  document.body.style.overflow = '';
}
function renderSheet(opening = false) {
  if (!ui.sheet) return closeSheet();
  const prevScroll = sheetRoot.querySelector('.sheet-body')?.scrollTop ?? 0;
  const { kind } = ui.sheet;
  const html = kind === 'hand' ? handSheet() : kind === 'newGame' ? newGameSheet() : kind === 'player' ? playerSheet()
    : kind === 'thand' ? tarotHandSheet() : kind === 'tnewGame' ? tarotNewGameSheet()
    : kind === 'link' ? linkSheet() : kind === 'groups' ? groupsSheet() : '';
  sheetRoot.innerHTML = `<div class="scrim ${opening ? 'in' : ''}" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  const body = sheetRoot.querySelector('.sheet-body');
  if (body) body.scrollTop = prevScroll;
}
const sheetHead = (title, right = '') => `<div class="sheet-head"><h2>${title}</h2>${right}<button class="x" data-act="sheet-close" aria-label="Fermer">✕</button></div>`;

// ---------- Saisie d'une donne
function handDraftFrom(h) {
  return {
    id: h?.id, taker: h?.taker ?? null, shared: !!h?.shared, bid: h?.bid ?? null, suit: h?.suit ?? null,
    coincheBy: h?.coincheBy ?? null, surcoincheBy: h?.surcoincheBy ?? null,
    beloteBy: h?.beloteBy ?? null, capot: !!h?.capot,
    mode: 'attack', points: h?.attackPoints != null && !h?.capot ? String(h.attackPoints) : '',
  };
}

function draftToHand(dr) {
  const pts = dr.points === '' ? null : Number(dr.points);
  const attackPoints = pts == null ? null : dr.mode === 'attack' ? pts : 162 - pts;
  return {
    taker: dr.taker, shared: !!dr.shared, bid: dr.bid, suit: dr.suit,
    coincheBy: dr.coincheBy, surcoincheBy: dr.coincheBy ? dr.surcoincheBy : null,
    beloteBy: dr.suit === 'SA' ? null : dr.beloteBy,
    capot: dr.capot, attackPoints: dr.capot ? 162 : attackPoints,
  };
}

function handValidity(dr) {
  if (!dr.taker) return 'Choisissez le preneur';
  if (!dr.bid) return 'Choisissez l\'annonce';
  if (!dr.suit) return 'Choisissez la couleur';
  const special = dr.bid === 'capot' || dr.bid === 'generale';
  if (!dr.capot && !special) {
    if (dr.points === '') return 'Indiquez les points faits';
    const n = Number(dr.points);
    if (!Number.isInteger(n) || n < 0 || n > 162) return 'Les points vont de 0 à 162';
  }
  return null;
}

function handSheet() {
  const { draft: dr, game } = ui.sheet;
  const teams = game.teams;
  const rules = game.rules;
  const players = [...teams[0], ...teams[1]];
  const att = teamOf(teams, dr.taker);
  const pbtn = (k, pid, extraCls = '') => {
    const ti = teamOf(teams, pid);
    return `<button class="choice t${ti} ${extraCls}" data-act="set" data-k="${k}" data-v="${pid}" aria-pressed="${dr[k] === pid}">
      ${avatar(P(pid), 's')}<span class="nm">${esc(P(pid).name)}</span></button>`;
  };

  let html = sheetHead(dr.id ? 'Modifier la donne' : 'Nouvelle donne',
    dr.id ? '' : '<button class="link" data-act="pass-hand" style="margin-right:6px">Tous passent</button>');
  html += '<div class="sheet-body">';

  // Preneur
  html += `<div class="field" style="margin-top:4px"><span class="lab">Preneur <span class="hint">(dernière annonce de l'équipe)</span></span><div class="choices c4">${players.map((pid) => pbtn('taker', pid)).join('')}</div>`;
  if (att >= 0) {
    const partner = teams[att].find((x) => x !== dr.taker);
    html += `<label class="toggle"><input type="checkbox" data-draft="shared" ${dr.shared ? 'checked' : ''}>
      <span>${esc(P(partner).name)} avait aussi annoncé<br><span class="small muted">Prise partagée : elle comptera pour les deux.</span></span></label>`;
  }
  html += '</div>';

  // Annonce
  html += `<div class="field"><span class="lab">Annonce</span><div class="choices c4">
    ${NUMERIC_BIDS.map((b) => `<button class="choice big" data-act="set" data-k="bid" data-v="${b}" aria-pressed="${dr.bid === b}">${b}</button>`).join('')}
    <button class="choice big special" data-act="set" data-k="bid" data-v="capot" aria-pressed="${dr.bid === 'capot'}" style="font-size:18px">Capot<small>250</small></button>
    <button class="choice big special" data-act="set" data-k="bid" data-v="generale" aria-pressed="${dr.bid === 'generale'}" style="font-size:16px">Générale<small>500</small></button>
  </div></div>`;

  // Couleur
  const suits = ['S', 'H', 'D', 'C', ...(rules.allowSA ? ['SA'] : []), ...(rules.allowTA ? ['TA'] : [])];
  html += `<div class="field"><span class="lab">Couleur</span><div class="choices ${suits.length > 4 ? 'c3' : 'c4'}">
    ${suits.map((s) => `<button class="choice big ${SUITS[s].red ? 'red' : ''}" data-act="set" data-k="suit" data-v="${s}" aria-pressed="${dr.suit === s}">
      ${SUITS[s].symbol}<small>${SUITS[s].label}</small></button>`).join('')}
  </div></div>`;

  // Contre / surcontre
  html += '<div class="field"><span class="lab">Contre</span>';
  if (att < 0) {
    html += '<p class="small muted">Choisissez d\'abord le preneur.</p>';
  } else {
    html += `<div class="choices c3">
      <button class="choice" data-act="set" data-k="coincheBy" data-v="" aria-pressed="${!dr.coincheBy}">Pas de contre</button>
      ${teams[1 - att].map((pid) => pbtn('coincheBy', pid)).join('')}
    </div>`;
    if (dr.coincheBy) {
      html += `<span class="lab" style="margin-top:12px">Surcontre</span><div class="choices c3">
        <button class="choice" data-act="set" data-k="surcoincheBy" data-v="" aria-pressed="${!dr.surcoincheBy}">Pas de surcontre</button>
        ${teams[att].map((pid) => pbtn('surcoincheBy', pid)).join('')}
      </div>`;
    }
  }
  html += '</div>';

  // Points
  const special = dr.bid === 'capot' || dr.bid === 'generale';
  html += `<div class="field"><span class="lab">Plis</span>
    <label class="toggle"><input type="checkbox" data-draft="capot" ${dr.capot ? 'checked' : ''}>
      <span>L'attaque a fait tous les plis (capot${dr.bid === 'generale' ? ' — générale réussie' : ''})</span></label>`;
  if (!dr.capot) {
    html += `<div class="row" style="margin:6px 0 8px"><span class="small" style="flex:1">Points comptés par ${special ? '<span class="muted">(facultatif)</span>' : ''}</span>
      <div class="seg"><button data-act="set" data-k="mode" data-v="attack" aria-pressed="${dr.mode === 'attack'}">l'attaque</button>
      <button data-act="set" data-k="mode" data-v="defense" aria-pressed="${dr.mode === 'defense'}">la défense</button></div></div>
      <div class="points">
        <button data-act="bump" data-v="-10" aria-label="Moins 10">−10</button>
        <input class="input" id="pts" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="0" value="${esc(dr.points)}" data-draft="points"
          aria-label="Points de cartes faits par ${dr.mode === 'attack' ? 'l\'attaque' : 'la défense'}">
        <button data-act="bump" data-v="10" aria-label="Plus 10">+10</button>
      </div>
      <p class="small muted" style="margin:6px 0 0">Points de cartes sur 162, dix de der compris, sans la belote.</p>`;
  }
  html += '</div>';

  // Belote
  if (dr.suit !== 'SA') {
    html += `<div class="field"><span class="lab">Belote-rebelote</span><div class="choices c5">
      <button class="choice" data-act="set" data-k="beloteBy" data-v="" aria-pressed="${!dr.beloteBy}">Personne</button>
      ${players.map((pid) => pbtn('beloteBy', pid)).join('')}</div></div>`;
  }

  if (dr.id) {
    html += `<button class="btn danger block" style="margin-top:22px" data-act="delete-hand">Supprimer cette donne</button>`;
  }
  html += '</div>';
  html += `<div class="sheet-foot"><div id="preview">${previewHtml()}</div>
    <button class="btn gold block" data-act="save-hand" ${handValidity(dr) ? 'disabled' : ''} id="save-hand">Enregistrer la donne</button></div>`;
  return html;
}

function previewHtml() {
  const { draft: dr, game } = ui.sheet;
  const why = handValidity(dr);
  if (why) return `<div class="preview">${why}</div>`;
  const res = scoreHand(draftToHand(dr), game.teams, game.rules);
  return `<div class="preview ${res.made ? 'ok' : 'ko'}">
    <div class="big">${res.made ? 'Contrat réussi' : 'Contrat chuté'} :
      <span class="p0">Bleus +${res.scores[0]}</span> · <span class="p1">Rouges +${res.scores[1]}</span></div>
    <div class="small">${explain(res)}</div></div>`;
}

function updateHandFooter() {
  const pv = document.getElementById('preview');
  if (pv) pv.innerHTML = previewHtml();
  const btn = document.getElementById('save-hand');
  if (btn) btn.disabled = !!handValidity(ui.sheet.draft);
}

function saveHand() {
  const { draft: dr, game } = ui.sheet;
  if (handValidity(dr)) return;
  const d = D();
  const hs = d.byGame.get(game.id) || [];
  const base = draftToHand(dr);
  if (dr.id) {
    const prev = store.get(dr.id);
    store.put('hand', { ...prev, ...base, passed: false }, dr.id);
    closeSheet();
    afterHandChange(game.id, 'Donne modifiée');
  } else {
    const idx = hs.reduce((m, h) => Math.max(m, h.idx ?? 0), -1) + 1;
    const id = store.put('hand', { ...base, gameId: game.id, idx, createdAt: Date.now() });
    closeSheet();
    afterHandChange(game.id, 'Donne enregistrée', id);
  }
}

function savePassedHand() {
  const { game } = ui.sheet;
  const hs = D().byGame.get(game.id) || [];
  const idx = hs.reduce((m, h) => Math.max(m, h.idx ?? 0), -1) + 1;
  const id = store.put('hand', { gameId: game.id, idx, passed: true, createdAt: Date.now() });
  closeSheet();
  afterHandChange(game.id, 'Donne passée', id);
}

/** Met à jour la fin de partie après ajout/modification/suppression d'une donne. */
function afterHandChange(gameId, message, undoId = null) {
  const g = store.get(gameId);
  if (!g) return;
  if (g.type === 'tarot') return afterTarotChange(g, message, undoId);
  const hs = (handsByGame(store.list('hand')).get(gameId)) || [];
  const res = gameTotals(hs, g.teams, g.rules);
  if (res.winner !== null && g.winner !== res.winner) {
    store.patch(gameId, { winner: res.winner, finishedAt: g.finishedAt || Date.now() });
    showWin(g, res);
  } else if (res.winner === null && g.winner != null) {
    store.patch(gameId, { winner: null, finishedAt: null });
  }
  toast(message, undoId ? { label: 'Annuler', act: 'undo-hand', id: undoId } : null);
}

// ---------- Nouvelle partie
function newGameSheet() {
  const dr = ui.sheet.draft;
  const d = D();
  const slot = (i) => {
    const pid = dr.slots[i];
    return `<button class="slot ${pid ? 'filled' : ''}" data-act="slot" data-v="${i}">
      ${pid ? `${avatar(P(pid), 's')}<span>${esc(P(pid).name)}</span>` : '<span class="muted">Choisir…</span>'}</button>`;
  };
  const full = dr.slots.every(Boolean);
  let html = sheetHead('Nouvelle partie');
  html += `<div class="sheet-body">
    ${titleField(dr)}
    <p class="small muted" style="margin:16px 0 10px">Touchez les joueurs dans l'ordre : les deux premiers forment les Bleus, les deux suivants les Rouges.</p>
    <div class="slots">
      <div class="slot-team t0"><h3>Bleus ♠</h3>${slot(0)}${slot(1)}</div>
      <div class="slot-team t1"><h3>Rouges ♥</h3>${slot(2)}${slot(3)}</div>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn light" data-act="shuffle" ${full ? '' : 'disabled'} style="flex:1">Tirer les équipes au sort</button></div>
    <div class="field"><span class="lab">Joueurs</span><div class="pick">
      ${d.players.map((p) => `<button data-act="pick" data-v="${p.id}" aria-pressed="${dr.slots.includes(p.id)}">${avatar(p, 's')}${esc(p.name)}</button>`).join('')}
      <button data-act="add-player-inline" style="padding:8px 14px">+ Nouveau joueur</button>
    </div></div>
    <div class="field"><span class="lab">Score à atteindre</span><div class="choices c4">
      ${[1000, 1500, 2000, 3000].map((v) => `<button class="choice" data-act="set" data-k="target" data-v="${v}" aria-pressed="${dr.target === v}">${v}</button>`).join('')}
    </div>
    <input class="input" style="margin-top:8px" inputmode="numeric" data-draft="target" placeholder="Autre score" value="${[1000, 1500, 2000, 3000].includes(dr.target) ? '' : dr.target}"></div>
    <div class="field"><span class="lab">Options</span>
      <label class="toggle"><input type="checkbox" data-draft="allowSA" ${dr.allowSA ? 'checked' : ''}><span>Sans atout autorisé</span></label>
      <label class="toggle"><input type="checkbox" data-draft="allowTA" ${dr.allowTA ? 'checked' : ''}><span>Tout atout autorisé</span></label>
      <p class="small muted" style="margin:4px 0 0">Les autres règles se règlent dans l'onglet Groupe.</p>
    </div>
  </div>
  <div class="sheet-foot"><button class="btn gold block" data-act="start-game" ${full && dr.target >= 100 ? '' : 'disabled'}>Lancer la partie</button></div>`;
  return html;
}

function startGame(teams, rules, title = '') {
  const id = store.put('game', { teams, rules, title: title.trim().slice(0, 50), startedAt: Date.now(), finishedAt: null, winner: null });
  closeSheet();
  go(`#/game/${id}`);
}

// ---------- Profil joueur (création / modification)
function playerSheet() {
  const dr = ui.sheet.draft;
  const d = D();
  const used = dr.id && (d.games.some((g) => g.teams.flat().includes(dr.id)) || d.tgames.some((g) => g.players.includes(dr.id)));
  return `${sheetHead(dr.id ? 'Modifier le profil' : 'Nouveau joueur')}
  <div class="sheet-body">
    <div class="row" style="margin-top:6px">
      ${avatar({ id: dr.id || dr.name, name: dr.name || '?', photo: dr.photo }, 'l')}
      <div style="flex:1">
        <label class="btn light" style="width:100%;margin-bottom:8px">${dr.photo ? 'Changer la photo' : 'Ajouter une photo'}
          <input type="file" accept="image/*" data-photo class="sr"></label>
        ${dr.photo ? '<button class="link" data-act="photo-remove">Retirer la photo</button>' : '<p class="small muted" style="margin:0">Facultatif</p>'}
      </div>
    </div>
    <div class="field"><label for="pname">Prénom ou surnom</label>
      <input class="input" id="pname" data-draft="name" maxlength="30" value="${esc(dr.name || '')}" autocomplete="off"></div>
    ${dr.id ? (used
      ? '<p class="small muted" style="margin-top:18px">Ce joueur a déjà joué des parties : il ne peut pas être supprimé (ses statistiques en dépendent).</p>'
      : '<button class="btn danger block" style="margin-top:22px" data-act="delete-player">Supprimer ce joueur</button>') : ''}
  </div>
  <div class="sheet-foot"><button class="btn gold block" data-act="save-player" ${(dr.name || '').trim() ? '' : 'disabled'} id="save-player">Enregistrer</button></div>`;
}

// ------------------------------------------------------------ boîte de dialogue
/** Remplace confirm()/prompt() (bloqués dans certains contextes, et plus lisibles). */
function ask({ title, message = '', ok = 'Confirmer', danger = false, input = null, value = '' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog');
    root.innerHTML = `<div class="scrim in dlg-scrim"><div class="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>${message ? `<p class="small muted">${esc(message)}</p>` : ''}
      ${input ? `<input class="input" id="dlg-input" placeholder="${esc(input)}" maxlength="50" value="${esc(value)}" autocomplete="off">` : ''}
      <div class="row" style="margin-top:14px"><button class="btn light block" data-dlg="0">Annuler</button>
      <button class="btn ${danger ? 'red' : 'gold'} block" data-dlg="1">${esc(ok)}</button></div></div></div>`;
    const inp = root.querySelector('#dlg-input');
    inp?.focus();
    const done = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelector('[data-dlg="0"]').onclick = () => done(input ? null : false);
    root.querySelector('[data-dlg="1"]').onclick = () => done(input ? inp.value.trim() : true);
    inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(inp.value.trim()); });
  });
}

// ============================================================ VICTOIRE / TOAST
function showWin(game, res) {
  const w = res.winner;
  const pieces = Array.from({ length: 28 }, (_, i) => {
    const s = ['♠', '♥', '♦', '♣'][i % 4];
    const red = s === '♥' || s === '♦';
    return `<i style="left:${Math.random() * 100}%;color:${red ? '#ef4a5e' : '#fff'};animation-duration:${2.4 + Math.random() * 2.5}s;animation-delay:${Math.random() * 1.2}s;--rot:${Math.random() * 720 - 360}deg">${s}</i>`;
  }).join('');
  overlayRoot.innerHTML = `<div class="win felt" style="${w ? 'background-color:var(--red)' : ''}" role="dialog" aria-modal="true">
    <div class="rain">${pieces}</div>
    <div class="box">
      <div class="av-pair" style="justify-content:center">${game.teams[w].map((pid) => avatar(P(pid), 'l')).join('')}</div>
      <p class="trophy">Victoire des ${TEAM_NAMES[w]} !</p>
      <p style="font-weight:700;font-size:18px">${teamNames(game.teams[w])}</p>
      <p class="final">${res.totals[w]} <span>à ${res.totals[1 - w]}</span></p>
      <button class="btn gold block" data-act="close-win">Voir la partie</button>
    </div></div>`;
}

let toastTimer;
function toast(message, action = null) {
  ui.toast = { message, action };
  clearTimeout(toastTimer);
  const el = document.getElementById('toast');
  el.innerHTML = `<div class="toast" role="status">${esc(message)}${action ? `<button data-act="${action.act}" data-id="${action.id}">${action.label}</button>` : ''}</div>`;
  toastTimer = setTimeout(() => { el.innerHTML = ''; }, action ? 5000 : 2500);
}

// =====================================================================
//  TAROT — écrans
// =====================================================================
// Niveau des prises : du plus faible au plus fort (rampe de bleus, du clair au foncé)
const CONTRACT_COLORS = { petite: '#86b6ef', garde: '#3987e5', gardeSans: '#1c5cab', gardeContre: '#0d366b' };
const CONTRACT_SHORT = { petite: 'P', garde: 'G', gardeSans: 'GS', gardeContre: 'GC' };

/** Barre de répartition des prises par contrat. */
function contractBar(s) {
  if (!s.takes) return '<p class="small muted" style="margin:0">Aucune prise pour l\'instant.</p>';
  const parts = CONTRACT_KEYS.map((c) => ({ c, n: s.byContract[c]?.takes || 0 })).filter((x) => x.n);
  return `<div class="cbar" role="img" aria-label="${parts.map((x) => `${CONTRACTS[x.c].label} ${Math.round((100 * x.n) / s.takes)} %`).join(', ')}">
    ${parts.map((x) => {
      const w = (100 * x.n) / s.takes;
      return `<span style="width:${w}%;background:${CONTRACT_COLORS[x.c]};color:${x.c === 'petite' ? 'var(--ink)' : '#fff'}">${w >= 14 ? `${Math.round(w)} %` : ''}</span>`;
    }).join('')}
  </div>
  <div class="legend">${CONTRACT_KEYS.map((c) => `<span class="lg"><i style="background:${CONTRACT_COLORS[c]};height:10px;width:10px;border-radius:3px"></i>${CONTRACTS[c].label}</span>`).join('')}</div>`;
}

const RANK_LABEL = (r) => (r === 1 ? '1ᵉʳ' : `${r}ᵉ`);
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

function tarotRankPlayers() {
  const d = D();
  return d.players
    .map((p) => ({ p, s: d.tstats.get(p.id) }))
    .filter((x) => x.s.games > 0)
    .sort((a, b) => b.s.winPct - a.s.winPct || a.s.avgRank - b.s.avgRank || b.s.games - a.s.games);
}

// ---------- Accueil tarot
function tarotHomePage() {
  const d = D();
  const running = d.tevaluated.filter((e) => !e.finished);
  const finished = d.tevaluated.filter((e) => e.finished).slice(0, 3);
  let body = kindSwitch();
  if (running.length) {
    body += '<h2>En cours</h2>' + running.map((e) => tarotGameCard(e)).join('');
  } else {
    body += `<div class="empty panel" style="margin-top:14px">
        <div class="big tarot-big">21</div>
        <h2 style="margin-top:14px">Pas de partie de tarot en cours</h2>
        <p class="muted">${d.players.length < 3 ? `Ajoutez encore ${3 - d.players.length} joueur${d.players.length === 2 ? '' : 's'} pour jouer (3 à 5 joueurs).` : 'De 3 à 5 joueurs, avec le barème de la Fédération.'}</p>
      </div>`;
  }
  const ranked = tarotRankPlayers().slice(0, 5);
  if (ranked.length) {
    body += '<h2>Classement</h2><ul class="list">';
    body += ranked.map(({ p, s }, i) => `
      <li><a class="item" href="#/player/${p.id}" style="text-decoration:none;color:inherit">
        <span class="rank ${i === 0 ? 'g1' : ''}">${i + 1}</span>${avatar(p)}
        <span class="main"><span class="t">${esc(p.name)}</span><br><span class="s">${s.wins} victoire${s.wins > 1 ? 's' : ''} sur ${s.games} · place moy. ${num(s.avgRank, 1)}</span></span>
        <span class="r">${pct(s.winPct)}</span></a></li>`).join('');
    body += '</ul>';
  }
  if (finished.length) body += '<h2>Dernières parties</h2>' + finished.map((e) => tarotGameCard(e)).join('');
  const fab = d.players.length >= 3
    ? '<button class="btn gold block" data-act="new-tgame">Nouvelle partie de tarot</button>'
    : '<button class="btn block" data-act="add-player">Ajouter un joueur</button>';
  return shell(esc(store.getState().group.name), body, { fab, active: 'home', groupSwitch: true });
}

function tarotProgress(e) {
  const r = e.rules;
  return r.mode === 'hands' ? `Donne ${Math.min(e.played, r.nHands)}/${r.nHands}` : `${e.played} donne${e.played > 1 ? 's' : ''} · partie libre`;
}

function tarotGameCard(e) {
  const g = e.game;
  const status = e.finished
    ? `Gagnée par ${e.order.filter((p) => e.rank[p] === 1).map((p) => esc(P(p).name)).join(' et ')} · ${date(g.finishedAt || g.startedAt)}`
    : tarotProgress(e);
  return `
    <a class="panel" href="#/game/${g.id}" style="display:block;text-decoration:none;color:inherit;margin-bottom:10px">
      ${titleLine(g)}
      <div class="tcard">
        ${e.order.map((pid) => `<div class="tcard-row">${avatar(P(pid), 's')}<span class="nm">${esc(P(pid).name)}</span>
          <b class="${e.totals[pid] < 0 ? 'neg' : ''}">${e.totals[pid]}</b></div>`).join('')}
      </div>
      <div class="small muted" style="margin-top:8px">Tarot à ${g.players.length} · ${status}</div>
    </a>`;
}

// ---------- Partie de tarot
function tarotGamePage(id) {
  const d = D();
  const e = d.tevaluated.find((x) => x.game.id === id);
  if (!e) return shell('Partie', '<p class="muted">Cette partie n\'existe plus.</p>', { back: '#/' });
  const g = e.game;
  const n = g.players.length;
  const last = e.rows[e.rows.length - 1];
  const dealer = g.players[e.rows.length % n];

  let body = `<div class="tboard panel">
    ${e.order.map((pid) => `<div class="tb-row ${e.rank[pid] === 1 ? 'lead' : ''}">
        <span class="tb-rank">${RANK_LABEL(e.rank[pid])}</span>${avatar(P(pid))}
        <span class="tb-name">${esc(P(pid).name)}${pid === dealer && !e.finished ? '<span class="dealer">donne</span>' : ''}</span>
        <span class="tb-last">${last ? signed(last.deltas[pid]) : ''}</span>
        <span class="tb-score ${e.totals[pid] < 0 ? 'neg' : ''}">${e.totals[pid]}</span>
      </div>`).join('')}
  </div>`;
  if (e.rules.mode === 'hands') {
    body += `<div class="track"><div class="bar"><span class="b0" style="width:${Math.min(100, (100 * e.played) / e.rules.nHands)}%"></span></div>
      <div class="legend"><span>${tarotProgress(e)}</span><span>Tarot à ${n}</span></div></div>`;
  } else {
    body += `<div class="track"><div class="legend"><span>${tarotProgress(e)}</span><span>Tarot à ${n}</span></div></div>`;
  }

  if (e.finished) {
    const winners = e.order.filter((p) => e.rank[p] === 1);
    body += `<div class="panel" style="margin-top:14px;text-align:center">
      <h3>Victoire de ${winners.map((p) => esc(P(p).name)).join(' et ')}</h3>
      <button class="btn gold block" data-act="trematch" data-id="${g.id}">Revanche avec les mêmes joueurs</button>
      ${g.endedManually ? `<button class="link" data-act="treopen" data-id="${g.id}" style="margin-top:6px">Reprendre la partie</button>` : ''}
    </div>`;
  }

  // Stats des joueurs
  const S = d.tstats;
  const local = {};
  for (const pid of g.players) local[pid] = { takes: 0, made: 0, called: 0, pab: 0, byC: {} };
  for (const row of e.rows) {
    const h = row.hand;
    if (h.passed) continue;
    if (local[h.taker]) {
      local[h.taker].takes++;
      if (row.made) local[h.taker].made++;
      local[h.taker].byC[h.contract] = (local[h.taker].byC[h.contract] || 0) + 1;
    }
    if (row.partner && local[row.partner]) local[row.partner].called++;
    if (h.pabBy && !h.pabLost && local[h.pabBy]) local[h.pabBy].pab++;
  }
  body += `<div class="row" style="margin:22px 0 10px"><h2 style="margin:0;flex:1">Joueurs</h2>
    <div class="seg" role="group">
      <button data-act="game-view" data-v="game" aria-pressed="${ui.gameView === 'game'}">Cette partie</button>
      <button data-act="game-view" data-v="career" aria-pressed="${ui.gameView === 'career'}">Carrière</button>
    </div></div><div class="mini-stats">`;
  body += g.players.map((pid) => {
    const p = P(pid);
    let what;
    if (ui.gameView === 'game') {
      const s = local[pid];
      const cs = CONTRACT_KEYS.filter((c) => s.byC[c]).map((c) => `${CONTRACT_SHORT[c]} ${s.byC[c]}`).join(' · ');
      what = `Prises ${s.made}/${s.takes}${n === 5 ? ` · appelé ${s.called}` : ''}<br>A pris ${s.takes} donne${s.takes > 1 ? 's' : ''} sur ${e.rows.length}${cs ? `<br>Contrats : ${cs}` : ''}<br>Petits au bout ${s.pab}`;
    } else {
      const s = S.get(pid);
      what = s ? `Victoires ${pct(s.winPct)} sur ${s.games}<br>Prises ${pct(s.takePct)} · place ${num(s.avgRank, 1)}<br>Prend ${pct(s.takeRate)} des donnes` : '';
    }
    return `<a class="mini" href="#/gplayer/${g.id}/${pid}" style="text-decoration:none;color:inherit">
      <span class="who">${avatar(p, 's')}<span>${esc(p.name)}</span></span><span class="what">${what}</span></a>`;
  }).join('');
  body += '</div>';

  body += gameLiveChart(e, true);

  body += '<h2>Donnes</h2>';
  if (!e.rows.length) body += '<p class="muted">Aucune donne pour l\'instant. Touchez « Nouvelle donne » après chaque main.</p>';
  else {
    body += '<ul class="hands panel" style="padding:0 12px">';
    body += [...e.rows].reverse().map((row, k) => tarotHandRow(row, e.rows.length - k)).join('');
    body += '</ul>';
  }
  body += `<div style="margin-top:22px" class="row wrap">
      <span class="small muted" style="flex:1">Commencée le ${dateTime(g.startedAt)}</span>
      <button class="link" data-act="rename-game" data-id="${g.id}">${gameTitle(g) ? 'Renommer' : 'Donner un titre'}</button>
      ${!e.finished && e.played ? `<button class="link" data-act="tfinish" data-id="${g.id}">Terminer la partie</button>` : ''}
      <button class="link" style="color:var(--red)" data-act="delete-game" data-id="${g.id}">Supprimer la partie</button>
    </div>`;
  const fab = e.finished ? '' : `<button class="btn gold block" data-act="new-hand" data-id="${g.id}">Nouvelle donne</button>`;
  return shell(esc(gameTitle(g) || 'Partie de tarot'), body, { back: '#/', fab, active: 'home' });
}

function tarotHandRow(row, n) {
  const h = row.hand;
  if (h.passed) {
    return `<li><button class="hand" data-act="edit-hand" data-id="${h.id}"><span class="n">${n}</span>
      <span class="what"><b>Donne passée</b><div class="sub">Personne n'a pris</div></span><span class="pts muted">0</span></button></li>`;
  }
  const c = CONTRACTS[h.contract];
  const extra = [`${h.bouts} bout${h.bouts > 1 ? 's' : ''}`, `${String(h.attackPoints).replace('.', ',')} pts`];
  if (h.pabBy) extra.push(`petit au bout ${esc(P(h.pabBy).name)}${h.pabLost ? ' (pris)' : ''}`);
  for (const pg of h.poignees || []) extra.push(`poignée ${POIGNEES[pg.type].label.toLowerCase()} ${esc(P(pg.by).name)}`);
  if (h.chelem && h.chelem !== 'none') extra.push(`chelem ${CHELEMS[h.chelem].label.toLowerCase()}`);
  for (const m of h.miseres || []) extra.push(`misère ${esc(P(m).name)}`);
  const res = row.made ? '<span class="tag ok">réussi</span>' : '<span class="tag ko">chuté</span>';
  const callTxt = row.partner ? ` <span class="muted">avec ${esc(P(row.partner).name)}</span>` : (h.called === h.taker ? ' <span class="muted">seul</span>' : '');
  const def = row.defenders.length ? row.deltas[row.defenders[0]] : 0;
  return `<li><button class="hand" data-act="edit-hand" data-id="${h.id}">
    <span class="n">${n}</span>
    <span class="what"><b>${esc(P(h.taker).name)}</b>${callTxt} · ${c.label} ${res}<div class="sub">${extra.join(' · ')}</div></span>
    <span class="pts"><span class="${row.deltas[h.taker] >= 0 ? 'p0' : 'p1'}">${signed(row.deltas[h.taker])}</span><br><span class="muted small">déf. ${signed(def)}</span></span>
  </button></li>`;
}

// ---------- Nouvelle partie de tarot
function tarotStartProblem(dr) {
  if (dr.players.length < 3) return 'Choisissez 3 à 5 joueurs';
  if (dr.mode === 'hands' && !(dr.nHands >= 1)) return 'Indiquez le nombre de donnes';
  return null;
}

function tarotNewGameSheet() {
  const dr = ui.sheet.draft;
  const d = D();
  const problem = tarotStartProblem(dr);
  return `${sheetHead('Nouvelle partie de tarot')}
  <div class="sheet-body">
    ${titleField(dr)}
    <p class="small muted" style="margin:16px 0 10px">Touchez 3 à 5 joueurs dans l'ordre où ils sont assis autour de la table : l'app indiquera qui donne.</p>
    <div class="seats">${[0, 1, 2, 3, 4].map((i) => {
      const pid = dr.players[i];
      return `<div class="seat ${pid ? 'filled' : ''}"><span class="seat-n">${i + 1}</span>${pid ? `${avatar(P(pid), 's')}<span>${esc(P(pid).name)}</span>` : `<span class="muted">${i < 3 ? 'Joueur' : 'Facultatif'}</span>`}</div>`;
    }).join('')}</div>
    <div class="field"><span class="lab">Joueurs</span><div class="pick">
      ${d.players.map((p) => `<button data-act="tpick" data-v="${p.id}" aria-pressed="${dr.players.includes(p.id)}">${avatar(p, 's')}${esc(p.name)}</button>`).join('')}
      <button data-act="add-player-inline" style="padding:8px 14px">+ Nouveau joueur</button>
    </div></div>
    <div class="field"><span class="lab">Durée de la partie</span>
      <div class="seg" role="group" style="margin-bottom:10px">
        <button data-act="set" data-k="mode" data-v="hands" aria-pressed="${dr.mode === 'hands'}">Nombre de donnes</button>
        <button data-act="set" data-k="mode" data-v="free" aria-pressed="${dr.mode === 'free'}">Partie libre</button>
      </div>
      ${dr.mode === 'hands' ? `<div class="choices c4">
        ${[5, 10, 15, 20].map((v) => `<button class="choice" data-act="set" data-k="nHands" data-v="${v}" aria-pressed="${dr.nHands === v}">${v}</button>`).join('')}
      </div>
      <input class="input" style="margin-top:8px" inputmode="numeric" data-draft="nHands" placeholder="Autre nombre de donnes" value="${[5, 10, 15, 20].includes(dr.nHands) ? '' : dr.nHands ?? ''}">`
      : '<p class="small muted" style="margin:0">Vous terminerez la partie avec le bouton « Terminer la partie ».</p>'}
    </div>
    <div class="field"><span class="lab">Options</span>
      <label class="toggle"><input type="checkbox" data-draft="pabTimesK" ${dr.pabTimesK ? 'checked' : ''}>
        <span>Petit au bout multiplié par le contrat<br><span class="small muted">Barème FFT : 10 × coefficient. Sinon 10 points fixes.</span></span></label>
      <label class="toggle"><input type="checkbox" data-draft="miseres" ${dr.miseres ? 'checked' : ''}>
        <span>Annonces de misère<br><span class="small muted">Le joueur reçoit 10 points de chacun des autres.</span></span></label>
    </div>
  </div>
  <div class="sheet-foot">${problem ? `<div class="preview">${problem}</div>` : ''}
    <button class="btn gold block" data-act="tstart" ${problem ? 'disabled' : ''}>Lancer la partie</button></div>`;
}

function startTarotGame(players, rules, title = '') {
  const id = store.put('game', { type: 'tarot', players, rules, title: title.trim().slice(0, 50), startedAt: Date.now(), finishedAt: null, endedManually: false });
  closeSheet();
  go(`#/game/${id}`);
}

// ---------- Saisie d'une donne de tarot
function tarotDraftFrom(h) {
  return {
    id: h?.id, taker: h?.taker ?? null, contract: h?.contract ?? null, called: h?.called ?? null,
    bouts: h?.bouts ?? null, mode: 'attack',
    points: h?.attackPoints != null ? String(h.attackPoints).replace('.', ',') : '',
    pabBy: h?.pabBy ?? null, pabLost: !!h?.pabLost,
    poignees: Object.fromEntries((h?.poignees || []).map((x) => [x.by, x.type])),
    chelem: h?.chelem ?? 'none', miseres: [...(h?.miseres || [])],
  };
}

function parsePoints(str) {
  if (str === '' || str == null) return null;
  const v = Number(String(str).replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

function tarotDraftToHand(dr) {
  const v = parsePoints(dr.points);
  return {
    taker: dr.taker, contract: dr.contract, called: dr.called, bouts: dr.bouts,
    attackPoints: v == null ? null : dr.mode === 'attack' ? v : 91 - v,
    pabBy: dr.pabBy, pabLost: dr.pabBy ? !!dr.pabLost : false,
    poignees: Object.entries(dr.poignees).filter(([, t]) => t).map(([by, type]) => ({ by, type })),
    chelem: dr.chelem || 'none', miseres: dr.miseres || [],
  };
}

function tarotValidity(dr, game) {
  if (!dr.taker) return 'Choisissez le preneur';
  if (!dr.contract) return 'Choisissez le contrat';
  if (game.players.length === 5 && !dr.called) return 'Indiquez le joueur appelé';
  if (dr.bouts == null) return 'Indiquez le nombre de bouts';
  const v = parsePoints(dr.points);
  if (v == null) return 'Indiquez les points faits';
  if (Number.isNaN(v) || v < 0 || v > 91 || Math.round(v * 2) !== v * 2) return 'Les points vont de 0 à 91, par demi-point';
  return null;
}

function fixTarotDraft(dr, game) {
  if (game.players.length !== 5) dr.called = null;
}

function tarotHandSheet() {
  const { draft: dr, game } = ui.sheet;
  const players = game.players;
  const n = players.length;
  const cols = n === 3 ? 'c3' : n === 4 ? 'c4' : 'c5';
  const pbtn = (k, pid, label = null) => `<button class="choice" data-act="set" data-k="${k}" data-v="${pid}" aria-pressed="${dr[k] === pid}">
      ${avatar(P(pid), 's')}<span class="nm">${label ?? esc(P(pid).name)}</span></button>`;
  const rules = { ...DEFAULT_TAROT_RULES, ...game.rules };

  let html = sheetHead(dr.id ? 'Modifier la donne' : 'Nouvelle donne',
    dr.id ? '' : '<button class="link" data-act="pass-hand" style="margin-right:6px">Tous passent</button>');
  html += '<div class="sheet-body">';
  html += `<div class="field" style="margin-top:4px"><span class="lab">Preneur</span><div class="choices ${cols}">${players.map((pid) => pbtn('taker', pid)).join('')}</div></div>`;
  html += `<div class="field"><span class="lab">Contrat</span><div class="choices c2">
    ${CONTRACT_KEYS.map((c) => `<button class="choice" data-act="set" data-k="contract" data-v="${c}" aria-pressed="${dr.contract === c}">
      ${CONTRACTS[c].label}<small class="muted">× ${CONTRACTS[c].k}</small></button>`).join('')}
  </div></div>`;
  if (n === 5) {
    html += `<div class="field"><span class="lab">Roi appelé chez <span class="hint">(partenaire du preneur)</span></span><div class="choices c5">
      ${players.map((pid) => pbtn('called', pid, pid === dr.taker ? 'lui-même' : null)).join('')}</div></div>`;
  }
  html += `<div class="field"><span class="lab">Bouts de l'attaque <span class="hint">(objectif)</span></span><div class="choices c4">
    ${[0, 1, 2, 3].map((b) => `<button class="choice big" data-act="set" data-k="bouts" data-v="${b}" aria-pressed="${dr.bouts === b}">${b}<small>${OBJECTIVES[b]} pts</small></button>`).join('')}
  </div></div>`;
  html += `<div class="field"><div class="row" style="margin:0 0 8px"><span class="lab" style="flex:1;margin:0">Points comptés par</span>
      <div class="seg"><button data-act="set" data-k="mode" data-v="attack" aria-pressed="${dr.mode === 'attack'}">l'attaque</button>
      <button data-act="set" data-k="mode" data-v="defense" aria-pressed="${dr.mode === 'defense'}">la défense</button></div></div>
    <div class="points">
      <button data-act="bump" data-v="-5" aria-label="Moins 5">−5</button>
      <input class="input" id="pts" inputmode="decimal" maxlength="4" placeholder="0" value="${esc(dr.points)}" data-draft="points"
        aria-label="Points faits par ${dr.mode === 'attack' ? 'l\'attaque' : 'la défense'}">
      <button data-act="bump" data-v="5" aria-label="Plus 5">+5</button>
    </div>
    <p class="small muted" style="margin:6px 0 0">Sur 91 points ; les demi-points s'écrivent 45,5.</p></div>`;

  // Petit au bout
  html += `<div class="field"><span class="lab">Petit au bout</span><div class="choices ${n === 3 ? 'c4' : n === 4 ? 'c5' : 'c3'}">
    <button class="choice" data-act="set" data-k="pabBy" data-v="" aria-pressed="${!dr.pabBy}">Personne</button>
    ${players.map((pid) => pbtn('pabBy', pid)).join('')}</div>
    ${dr.pabBy ? `<label class="toggle"><input type="checkbox" data-draft="pabLost" ${dr.pabLost ? 'checked' : ''}>
      <span>Le Petit a été pris au dernier pli<br><span class="small muted">La prime va alors à l'autre camp.</span></span></label>` : ''}
  </div>`;

  // Poignées
  const trumps = POIGNEE_TRUMPS[n];
  html += `<div class="field"><span class="lab">Poignées <span class="hint">(${trumps[0]}, ${trumps[1]} ou ${trumps[2]} atouts)</span></span><div class="prows">
    ${players.map((pid) => `<div class="prow">${avatar(P(pid), 's')}<span class="nm">${esc(P(pid).name)}</span>
      <div class="seg small-seg">${['', 'simple', 'double', 'triple'].map((t) => `<button data-act="tpoignee" data-id="${pid}" data-v="${t}"
        aria-pressed="${(dr.poignees[pid] || '') === t}">${t ? POIGNEES[t].label[0] : '–'}</button>`).join('')}</div></div>`).join('')}
  </div><p class="small muted" style="margin:6px 0 0">S = simple (20), D = double (30), T = triple (40), au camp qui gagne la donne.</p></div>`;

  // Chelem
  html += `<div class="field"><span class="lab">Chelem</span><div class="choices c2">
    ${Object.entries(CHELEMS).map(([k, c]) => `<button class="choice" data-act="set" data-k="chelem" data-v="${k}" aria-pressed="${dr.chelem === k}">
      ${c.label}${c.points ? `<small class="muted">${signed(c.points)}</small>` : ''}</button>`).join('')}
  </div></div>`;

  if (rules.miseres) {
    html += `<div class="field"><span class="lab">Misère annoncée par</span><div class="pick">
      ${players.map((pid) => `<button data-act="tmisere" data-v="${pid}" aria-pressed="${dr.miseres.includes(pid)}">${avatar(P(pid), 's')}${esc(P(pid).name)}</button>`).join('')}
    </div></div>`;
  }
  if (dr.id) html += '<button class="btn danger block" style="margin-top:22px" data-act="delete-hand">Supprimer cette donne</button>';
  html += '</div>';
  html += `<div class="sheet-foot"><div id="preview">${tarotPreviewHtml()}</div>
    <button class="btn gold block" data-act="save-hand" ${tarotValidity(dr, game) ? 'disabled' : ''} id="save-hand">Enregistrer la donne</button></div>`;
  return html;
}

function tarotPreviewHtml() {
  const { draft: dr, game } = ui.sheet;
  const why = tarotValidity(dr, game);
  if (why) return `<div class="preview">${why}</div>`;
  const res = tarotHand(tarotDraftToHand(dr), game.players, game.rules);
  const parts = game.players.map((pid) => `${esc(P(pid).name)} <b class="${res.deltas[pid] < 0 ? 'neg' : 'pos'}">${signed(res.deltas[pid])}</b>`).join(' · ');
  return `<div class="preview ${res.made ? 'ok' : 'ko'}">
    <div class="big">${res.made ? 'Contrat réussi' : 'Contrat chuté'}</div>
    <div class="small">${parts}</div>
    <div class="small muted" style="margin-top:2px">${explainTarot(res)}</div></div>`;
}

function updateTarotFooter() {
  const pv = document.getElementById('preview');
  if (pv) pv.innerHTML = tarotPreviewHtml();
  const btn = document.getElementById('save-hand');
  if (btn) btn.disabled = !!tarotValidity(ui.sheet.draft, ui.sheet.game);
}

function saveTarotHand() {
  const { draft: dr, game } = ui.sheet;
  if (tarotValidity(dr, game)) return;
  const base = tarotDraftToHand(dr);
  if (dr.id) {
    store.put('hand', { ...store.get(dr.id), ...base, passed: false }, dr.id);
    closeSheet();
    return afterHandChange(game.id, 'Donne modifiée');
  }
  const hs = D().byGame.get(game.id) || [];
  const idx = hs.reduce((m, h) => Math.max(m, h.idx ?? 0), -1) + 1;
  const id = store.put('hand', { ...base, gameId: game.id, idx, createdAt: Date.now() });
  closeSheet();
  return afterHandChange(game.id, 'Donne enregistrée', id);
}

/** Fin de partie automatique (nombre de donnes atteint) ou annulée si on supprime une donne. */
function afterTarotChange(g, message, undoId) {
  const hs = handsByGame(store.list('hand')).get(g.id) || [];
  const rules = { ...DEFAULT_TAROT_RULES, ...g.rules };
  const res = tarotTotals({ ...g, finishedAt: null }, hs);
  if (rules.mode === 'hands' && !g.endedManually) {
    if (res.finished && !g.finishedAt) {
      store.patch(g.id, { finishedAt: Date.now() });
      showTarotWin(g, res);
    } else if (!res.finished && g.finishedAt) {
      store.patch(g.id, { finishedAt: null });
    }
  }
  toast(message, undoId ? { label: 'Annuler', act: 'undo-hand', id: undoId } : null);
}

function showTarotWin(game, res) {
  const pod = res.order.slice(0, 3);
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const s = ['21', '♥', '♣', '1'][i % 4];
    return `<i style="left:${Math.random() * 100}%;color:${s === '♥' ? '#ef4a5e' : '#fff'};animation-duration:${2.4 + Math.random() * 2.5}s;animation-delay:${Math.random() * 1.2}s;--rot:${Math.random() * 720 - 360}deg">${s}</i>`;
  }).join('');
  const step = (pid, h) => `<div class="pod" style="--h:${h}px">${avatar(P(pid), 'l')}<b>${esc(P(pid).name)}</b><span>${res.totals[pid]}</span><div class="pod-step">${RANK_LABEL(res.rank[pid])}</div></div>`;
  const heights = [96, 64, 40];
  const layout = pod.length === 3 ? [pod[1], pod[0], pod[2]] : pod;
  overlayRoot.innerHTML = `<div class="win felt" role="dialog" aria-modal="true">
    <div class="rain">${pieces}</div>
    <div class="box">
      <p class="trophy">Partie terminée !</p>
      <div class="podium">${layout.map((pid) => step(pid, heights[res.order.indexOf(pid)])).join('')}</div>
      <button class="btn gold block" data-act="close-win" style="margin-top:22px">Voir la partie</button>
    </div></div>`;
}

// ---------- Joueurs (tarot)
function tarotPlayersPage() {
  const d = D();
  let body = kindSwitch();
  if (!d.players.length) body += '<p class="muted">Aucun joueur pour l\'instant.</p>';
  else {
    const order = [...d.players].sort((a, b) => {
      const sa = d.tstats.get(a.id), sb = d.tstats.get(b.id);
      return (sb.games > 0) - (sa.games > 0) || (sb.winPct ?? 0) - (sa.winPct ?? 0) || a.name.localeCompare(b.name, 'fr');
    });
    body += '<ul class="list" style="margin-top:14px">' + order.map((p) => {
      const s = d.tstats.get(p.id);
      return `<li><a class="item" href="#/player/${p.id}" style="text-decoration:none;color:inherit">${avatar(p)}
        <span class="main"><span class="t">${esc(p.name)}</span><br>
        <span class="s">${s.games} partie${s.games > 1 ? 's' : ''} · prises ${s.takesMade}/${s.takes} · place moy. ${num(s.avgRank, 1)}</span></span>
        <span class="r">${pct(s.winPct)}<small>victoires</small></span></a></li>`;
    }).join('') + '</ul>';

    // Duos à 5 : preneur + appelé
    const duos = new Map();
    for (const p of d.players) {
      for (const [q, v] of Object.entries(d.tstats.get(p.id).partners)) {
        const key = [p.id, q].sort().join('|');
        if (!duos.has(key)) duos.set(key, { ids: key.split('|'), ...v });
      }
    }
    const list = [...duos.values()].map((x) => ({ ...x, pct: (100 * x.made) / x.hands }))
      .sort((a, b) => b.pct - a.pct || b.hands - a.hands).slice(0, 6);
    if (list.length) {
      body += '<h2>Meilleurs duos à 5</h2><p class="small muted" style="margin-top:-4px">Contrats réussis quand l\'un appelle l\'autre.</p><ul class="list">';
      body += list.map((x) => `<li><div class="item">
          <div class="av-pair">${x.ids.map((id) => avatar(P(id), 's')).join('')}</div>
          <span class="main"><span class="t">${x.ids.map((id) => esc(P(id).name)).join(' & ')}</span><br>
          <span class="s">${x.made} réussi${x.made > 1 ? 's' : ''} sur ${x.hands} contrat${x.hands > 1 ? 's' : ''}</span></span>
          <span class="r">${pct(x.pct)}</span></div></li>`).join('');
      body += '</ul>';
    }
  }
  return shell('Joueurs', body, { fab: '<button class="btn block" data-act="add-player">Ajouter un joueur</button>', active: 'players' });
}

function tarotPlayerPage(id, opts = {}) {
  const d = opts.ctx || D();
  const p = d.byId[id];
  if (!p) return shell('Joueur', '<p class="muted">Ce joueur n\'existe plus.</p>', { back: '#/players' });
  const s = d.tstats.get(id);
  let body = `
    <div class="hero felt">
      ${avatar(p, 'l')}
      <div style="min-width:0;flex:1"><h2>${esc(p.name)}</h2>
        <p>${opts.game ? `${esc(gameTitle(opts.game) || 'Cette partie')} · ${s.handsDealt} donne${s.handsDealt > 1 ? 's' : ''}` : `${s.games} partie${s.games > 1 ? 's' : ''} de tarot · ${s.handsPlayed} donnes jouées`}</p>
        ${profileActions(p, opts)}
      </div>
    </div>
    <div style="margin-top:14px">${scopeOrKindSwitch(id, opts)}</div>
    ${opts.game ? gameSummary(d, id, true) : `
    <h2>Parties</h2>
    <div class="kpis">
      <div class="kpi blue"><div class="v">${pct(s.winPct)}</div><div class="l">de victoires (1ᵉʳ)</div></div>
      <div class="kpi gold"><div class="v">${pct(s.podiumPct)}</div><div class="l">de podiums</div></div>
      <div class="kpi"><div class="v">${num(s.avgRank, 1)}</div><div class="l">place moyenne</div></div>
    </div>
    <div class="panel" style="margin-top:10px"><dl class="dl">
      <dt>Victoires</dt><dd>${s.wins}/${s.games}</dd>
      <dt>Podiums</dt><dd>${s.podiums}</dd>
      <dt>Score final moyen</dt><dd>${num(s.avgFinal)}</dd>
      <dt>Meilleur score final</dt><dd>${num(s.best)}</dd>
    </dl></div>`}

    <h2>Prises</h2>
    <div class="kpis">
      <div class="kpi green"><div class="v">${s.takesMade}/${s.takes}</div><div class="l">prises réussies</div></div>
      <div class="kpi green"><div class="v">${pct(s.takePct)}</div><div class="l">de réussite</div></div>
      <div class="kpi red"><div class="v">${pct(s.takeFailPct)}</div><div class="l">de chutes</div></div>
    </div>
    <div class="panel" style="margin-top:10px">
      <h3 style="margin:0 0 8px">Niveau de ses prises</h3>
      ${contractBar(s)}
      <table class="vtable" style="margin-top:12px"><thead><tr><th>Contrat</th><th class="n">Part</th><th class="n">Réussies</th><th class="n">Réussite</th></tr></thead><tbody>
      ${CONTRACT_KEYS.map((c) => {
        const x = s.byContract[c] || { takes: 0, made: 0 };
        return `<tr><td><span class="who"><i style="background:${CONTRACT_COLORS[c]}"></i>${CONTRACTS[c].label}</span></td>
          <td class="n"><b>${pct(x.share)}</b> <span class="muted small">(${x.takes})</span></td><td class="n">${x.made}/${x.takes}</td><td class="n">${pct(x.pct)}</td></tr>`;
      }).join('')}
      </tbody></table>
      <dl class="dl" style="margin-top:6px">
        <dt>Prises sur les donnes jouées</dt><dd>${s.takes}/${s.handsDealt} (${pct(s.takeRate)})</dd>
        <dt>Gain moyen par prise réussie</dt><dd>${num(s.avgGainMade)}</dd>
        <dt>Bouts moyens quand il prend</dt><dd>${num(s.avgBouts, 1)}</dd>
      </dl>
    </div>

    ${opts.game && opts.game.players.length !== 5 ? '' : `<h2>À 5 joueurs</h2>
    <div class="kpis">
      <div class="kpi"><div class="v">${s.called}</div><div class="l">fois appelé</div></div>
      <div class="kpi green"><div class="v">${pct(s.calledPct)}</div><div class="l">de réussite comme appelé</div></div>
      <div class="kpi"><div class="v">${s.selfCalls}</div><div class="l">fois appelé lui-même</div></div>
    </div>
    <div class="panel" style="margin-top:10px"><dl class="dl">
      <dt>Meilleur partenaire</dt><dd>${s.bestPartner ? `${esc(P(s.bestPartner.id).name)} (${pct(s.bestPartner.pct)})` : '–'}</dd>
    </dl>${!s.bestPartner ? '<p class="small muted" style="margin:8px 0 0">À partir de 2 contrats joués ensemble (l\'un appelant l\'autre).</p>' : ''}</div>`}

    <h2>Défense et exploits</h2>
    <div class="kpis">
      <div class="kpi blue"><div class="v">${pct(s.defensePct)}</div><div class="l">de contrats chutés en défense</div></div>
      <div class="kpi gold"><div class="v">${s.pabMade}</div><div class="l">petits au bout réussis</div></div>
      <div class="kpi"><div class="v">${s.chelems}</div><div class="l">chelems réussis</div></div>
    </div>
    <div class="panel" style="margin-top:10px"><dl class="dl">
      <dt>Petits pris au dernier pli</dt><dd>${s.pabLost}</dd>
      <dt>Poignées montrées</dt><dd>${s.poignees}</dd>
      <dt>Misères annoncées</dt><dd>${s.miseres}</dd>
    </dl></div>`;

  if (opts.game) {
    body += playerGameChart(id, opts.game, d, true);
    return shell('Cette partie', body, { back: opts.back, active: 'home' });
  }
  body += profileChart(id, d, true, opts);

  const mine = d.tevaluated.filter((e) => e.finished && e.game.players.includes(id)).slice(0, 10);
  if (mine.length) {
    body += '<h2>Dernières parties</h2><ul class="list">';
    body += mine.map((e) => `<li><a class="item" ${opts.cross ? '' : `href="#/game/${e.game.id}"`} style="text-decoration:none;color:inherit">
        <span class="tag ${e.rank[id] === 1 ? 'ok' : e.rank[id] <= 3 ? 'x2' : 'ko'}" style="margin:0">${RANK_LABEL(e.rank[id])}</span>
        <span class="main"><span class="t">${esc(gameTitle(e.game) || `Tarot à ${e.game.players.length}`)}</span><br><span class="s">${date(e.game.finishedAt)}</span></span>
        <span class="r" style="font-size:17px">${e.totals[id]}</span></a></li>`).join('');
    body += '</ul>';
  }
  return shell(opts.cross ? 'Tous groupes' : 'Profil', body, { back: opts.back || '#/players', active: 'players' });
}

// ---------- Actions tarot
async function handleTarot(act, el, id) {
  const sh = ui.sheet;
  switch (act) {
    case 'new-tgame': {
      const r = D().trules;
      return openSheet('tnewGame', { players: [], mode: r.mode, nHands: r.nHands, pabTimesK: r.pabTimesK, miseres: r.miseres });
    }
    case 'tpick': {
      const pl = sh.draft.players;
      const pid = el.dataset.v;
      const at = pl.indexOf(pid);
      if (at >= 0) pl.splice(at, 1);
      else if (pl.length >= 5) return toast('5 joueurs au maximum');
      else pl.push(pid);
      return renderSheet();
    }
    case 'tstart': {
      const dr = sh.draft;
      if (tarotStartProblem(dr)) return;
      const rules = { ...D().trules, mode: dr.mode, nHands: dr.nHands, pabTimesK: !!dr.pabTimesK, miseres: !!dr.miseres };
      return startTarotGame([...dr.players], rules, dr.title || '');
    }
    case 'trematch': {
      const g = store.get(id);
      return startTarotGame([...g.players], { ...g.rules });
    }
    case 'tfinish': {
      if (!(await ask({ title: 'Terminer la partie ?', message: 'Le classement actuel devient le classement final.', ok: 'Terminer' }))) return;
      const g = store.get(id);
      store.patch(id, { finishedAt: Date.now(), endedManually: true });
      const hs = handsByGame(store.list('hand')).get(id) || [];
      return showTarotWin(g, tarotTotals({ ...g, finishedAt: Date.now() }, hs));
    }
    case 'treopen':
      store.patch(id, { finishedAt: null, endedManually: false });
      return toast('Partie reprise');
    case 'tpoignee': {
      sh.draft.poignees[id] = el.dataset.v || null;
      return renderSheet();
    }
    case 'tmisere': {
      const m = sh.draft.miseres;
      const pid = el.dataset.v;
      const at = m.indexOf(pid);
      if (at >= 0) m.splice(at, 1); else m.push(pid);
      return renderSheet();
    }
    default:
  }
}

// ============================================================ ÉVÉNEMENTS
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (act === 'scrim' && ev.target !== el) return; // clic à l'intérieur de la feuille
  try {
    await handle(act, el, id);
  } catch (e) {
    console.error(e);
    toast(e.message || 'Une erreur est survenue');
  }
});

async function handle(act, el, id) {
  const sh = ui.sheet;
  switch (act) {
    // ----- groupe
    case 'create-group': {
      const name = document.getElementById('group-name').value.trim();
      if (!name) return toast('Donnez un nom au groupe');
      el.disabled = true;
      await store.createGroup(name);
      go('#/');
      return render();
    }
    case 'join-group': {
      const code = document.getElementById('join-code').value.trim();
      if (code.length < 6) return toast('Le code fait 8 caractères');
      el.disabled = true;
      el.textContent = 'Connexion…';
      try {
        await store.joinGroup(code);
        go('#/');
        render();
        toast(`Bienvenue dans « ${store.getState().group.name} »`);
      } catch (e) {
        el.disabled = false;
        el.textContent = 'Rejoindre';
        toast(/inconnu/i.test(e.message) ? 'Code inconnu, vérifiez-le' : `Connexion impossible : ${e.message}`);
      }
      return;
    }
    case 'demo': {
      store.addGroups(buildDemoGroups(store.uuid));
      go('#/');
      return render();
    }
    case 'leave-group': {
      const local = store.getState().group?.local || !store.cloudConfigured;
      const gname = store.getState().group?.name;
      const msg = local
        ? `Effacer le groupe « ${gname} » de ce téléphone ? Cette action est définitive.`
        : `Quitter « ${gname} » sur ce téléphone ?${store.getState().dirty.length ? ' Attention : des modifications n\'ont pas encore été envoyées.' : ''}`;
      if (!(await ask({ title: msg, ok: local ? 'Effacer' : 'Quitter', danger: true }))) return;
      store.leaveGroup();
      go('');
      return render();
    }
    case 'sync-now': await store.sync(); return toast(store.getState().lastError || 'Synchronisé');
    case 'share-code': {
      const code = store.getState().group.code;
      const url = `${location.origin}${location.pathname}#join=${code}`;
      const text = `Rejoins « ${store.getState().group.name} » sur Les Fous de la Contrée : ${url} (code ${code})`;
      if (navigator.share) { try { await navigator.share({ title: 'Les Fous de la Contrée', text }); } catch { /* annulé */ } return; }
      await navigator.clipboard?.writeText(text);
      return toast('Lien d\'invitation copié');
    }
    case 'copy-code':
      await navigator.clipboard?.writeText(store.getState().group.code);
      return toast('Code copié');
    case 'install':
      if (ui.installPrompt) { ui.installPrompt.prompt(); ui.installPrompt = null; render(); }
      return;
    case 'export-stats': return exportStats();
    case 'export-hands': return exportHands();
    case 'export-tstats': return exportTarotStats();
    case 'export-thands': return exportTarotHands();

    // ----- feuilles
    case 'scrim':
    case 'sheet-close': return closeSheet();
    case 'set': {
      const k = el.dataset.k;
      let v = el.dataset.v;
      if (['bid', 'target', 'bouts', 'nHands'].includes(k)) v = /^\d+$/.test(v) ? Number(v) : v;
      if (v === '') v = null;
      sh.draft[k] = v;
      if (sh.kind === 'hand') fixHandDraft(sh.draft, sh.game.teams);
      if (sh.kind === 'thand') fixTarotDraft(sh.draft, sh.game);
      return renderSheet();
    }
    case 'bump': {
      const max = sh.kind === 'thand' ? 91 : 162;
      const n = Math.min(max, Math.max(0, (Number(String(sh.draft.points).replace(',', '.')) || 0) + Number(el.dataset.v)));
      sh.draft.points = sh.kind === 'thand' ? String(n).replace('.', ',') : String(n);
      document.getElementById('pts').value = sh.draft.points;
      return sh.kind === 'thand' ? updateTarotFooter() : updateHandFooter();
    }

    // ----- parties
    case 'new-game': {
      const r = D().rules;
      return openSheet('newGame', { slots: [null, null, null, null], target: r.target, allowSA: r.allowSA, allowTA: r.allowTA });
    }
    case 'pick': {
      const s = sh.draft.slots;
      const pid = el.dataset.v;
      const at = s.indexOf(pid);
      if (at >= 0) s[at] = null;
      else {
        const free = s.indexOf(null);
        if (free < 0) return toast('Les 4 places sont prises : touchez une place pour la libérer');
        s[free] = pid;
      }
      return renderSheet();
    }
    case 'slot': sh.draft.slots[Number(el.dataset.v)] = null; return renderSheet();
    case 'shuffle': {
      const s = [...sh.draft.slots];
      for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
      }
      sh.draft.slots = s;
      return renderSheet();
    }
    case 'add-player-inline': {
      const name = await ask({ title: 'Nouveau joueur', input: 'Prénom ou surnom', ok: 'Ajouter' });
      if (!name?.trim()) return;
      if (D().players.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) return toast('Un joueur porte déjà ce nom');
      const pid = store.put('player', { name: name.trim().slice(0, 30), createdAt: Date.now() });
      if (sh.kind === 'tnewGame') {
        if (sh.draft.players.length < 5) sh.draft.players.push(pid);
      } else {
        const free = sh.draft.slots.indexOf(null);
        if (free >= 0) sh.draft.slots[free] = pid;
      }
      return renderSheet();
    }
    case 'start-game': {
      const dr = sh.draft;
      const rules = { ...D().rules, target: dr.target, allowSA: dr.allowSA, allowTA: dr.allowTA };
      return startGame([[dr.slots[0], dr.slots[1]], [dr.slots[2], dr.slots[3]]], rules, dr.title || '');
    }
    case 'rematch': {
      const g = store.get(id);
      return startGame(g.teams.map((t) => [...t]), { ...g.rules });
    }
    case 'delete-game': {
      if (!(await ask({ title: 'Supprimer cette partie ?', message: 'Toutes ses donnes seront effacées et les statistiques recalculées.', ok: 'Supprimer', danger: true }))) return;
      for (const h of D().byGame.get(id) || []) store.remove(h.id);
      store.remove(id);
      go('#/');
      return toast('Partie supprimée');
    }
    case 'game-view': ui.gameView = el.dataset.v; return render();
    case 'kind': setKind(el.dataset.v); ui.chartSel = null; return render();
    case 'force-update': return forceUpdate();
    case 'rename-game': {
      const g = store.get(id);
      const t = await ask({ title: 'Titre de la partie', input: 'Ex. Revanche du jeudi', ok: 'Enregistrer', value: g?.title || '' });
      if (t == null) return;
      store.patch(id, { title: t.trim().slice(0, 50) });
      return toast(t.trim() ? 'Titre enregistré' : 'Titre retiré');
    }
    case 'rename-group': {
      const grp = store.listGroups().find((x) => x.id === id);
      if (!grp) return;
      const t = await ask({ title: 'Nom du groupe', input: 'Ex. Les Fous du jeudi', ok: 'Enregistrer', value: grp.name });
      if (t == null) return;
      if (!t.trim()) return toast('Le nom ne peut pas être vide');
      store.renameGroup(id, t);
      return toast('Groupe renommé');
    }
    case 'person': return go(`#/person/${id}`);
    case 'link-open': return openSheet('link', { pid: id });
    case 'link-to':
      linkProfiles(sh.draft.pid, el.dataset.g, el.dataset.v);
      toast('Profils reliés');
      return renderSheet();
    case 'unlink':
      store.patchIn(el.dataset.g, el.dataset.v, { personId: null });
      toast('Lien retiré');
      return renderSheet();
    case 'groups': return openSheet('groups', {});
    case 'switch-group':
      closeSheet();
      ui.chartSel = null;
      store.switchGroup(id);
      return go('#/');
    case 'add-join': {
      const code = document.getElementById('add-code').value.trim();
      if (code.length < 6) return toast('Le code fait 8 caractères');
      el.disabled = true;
      try {
        await store.joinGroup(code);
        closeSheet();
        ui.chartSel = null;
        go('#/');
        return toast(`Bienvenue dans « ${store.getState().group.name} »`);
      } catch (e) {
        el.disabled = false;
        return toast(/inconnu/i.test(e.message) ? 'Code inconnu, vérifiez-le' : `Connexion impossible : ${e.message}`);
      }
    }
    case 'add-create': {
      const name = document.getElementById('add-name').value.trim();
      if (!name) return toast('Donnez un nom au groupe');
      el.disabled = true;
      await store.createGroup(name);
      closeSheet();
      ui.chartSel = null;
      go('#/');
      return toast(`Groupe « ${name} » créé`);
    }
    case 'chart-stat': ui.chartStat = el.dataset.v; return render();
    case 'chart-player': {
      const pid = el.dataset.v;
      const at = ui.chartSel.findIndex((x) => x.id === pid);
      if (at >= 0) ui.chartSel.splice(at, 1);
      else {
        if (ui.chartSel.length >= 8) return toast('8 joueurs au maximum sur un graphique');
        const used = new Set(ui.chartSel.map((x) => x.slot));
        const slot = [0, 1, 2, 3, 4, 5, 6, 7].find((k) => !used.has(k));
        ui.chartSel.push({ id: pid, slot });
      }
      return render();
    }

    // ----- donnes
    case 'new-hand': {
      const g = store.get(id);
      if (g.type === 'tarot') return openSheet('thand', tarotDraftFrom(null), { game: g });
      return openSheet('hand', handDraftFrom(null), { game: g });
    }
    case 'edit-hand': {
      const h = store.get(id);
      const g = store.get(h.gameId);
      if (h.passed) {
        if (await ask({ title: 'Supprimer cette donne passée ?', ok: 'Supprimer', danger: true })) { store.remove(id); afterHandChange(g.id, 'Donne supprimée'); }
        return;
      }
      if (g.type === 'tarot') return openSheet('thand', tarotDraftFrom(h), { game: g });
      return openSheet('hand', handDraftFrom(h), { game: g });
    }
    case 'pass-hand': return savePassedHand();
    case 'save-hand': return sh.kind === 'thand' ? saveTarotHand() : saveHand();
    case 'delete-hand': {
      if (!(await ask({ title: 'Supprimer cette donne ?', ok: 'Supprimer', danger: true }))) return;
      const gid = sh.game.id;
      store.remove(sh.draft.id);
      closeSheet();
      return afterHandChange(gid, 'Donne supprimée');
    }
    case 'undo-hand': {
      const h = store.get(id);
      if (!h) return;
      store.remove(id);
      document.getElementById('toast').innerHTML = '';
      return afterHandChange(h.gameId, 'Donne annulée');
    }
    case 'close-win': overlayRoot.innerHTML = ''; return;

    // ----- joueurs
    case 'add-player': return openSheet('player', { name: '', photo: null });
    case 'edit-player': {
      const p = store.get(id);
      return openSheet('player', { id, name: p.name, photo: p.photo || null });
    }
    case 'photo-remove': sh.draft.photo = null; return renderSheet();
    case 'save-player': {
      const dr = sh.draft;
      const name = (dr.name || '').trim().slice(0, 30);
      if (!name) return;
      const exists = D().players.some((p) => p.id !== dr.id && p.name.toLowerCase() === name.toLowerCase());
      if (exists) return toast('Un joueur porte déjà ce nom');
      if (dr.id) {
        store.patch(dr.id, { name, photo: dr.photo || null });
        propagatePhoto(dr.id);
      } else store.put('player', { name, photo: dr.photo || null, createdAt: Date.now() });
      closeSheet();
      return toast(dr.id ? 'Profil mis à jour' : `${name} a rejoint le groupe`);
    }
    case 'delete-player': {
      if (!(await ask({ title: 'Supprimer ce joueur ?', ok: 'Supprimer', danger: true }))) return;
      store.remove(sh.draft.id);
      closeSheet();
      go('#/players');
      return toast('Joueur supprimé');
    }
    default:
      return handleTarot(act, el, id);
  }
}

/** Garde la saisie cohérente quand on change de preneur ou d'annonce. */
function fixHandDraft(dr, teams) {
  const att = teamOf(teams, dr.taker);
  if (dr.coincheBy && teamOf(teams, dr.coincheBy) === att) dr.coincheBy = null;
  if (!dr.coincheBy) dr.surcoincheBy = null;
  if (dr.surcoincheBy && teamOf(teams, dr.surcoincheBy) !== att) dr.surcoincheBy = null;
  if (dr.suit === 'SA') dr.beloteBy = null;
}

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.id === 'join-code') { ui.joinCode = el.value; return; }
  if (!ui.sheet || !el.dataset.draft) return;
  const k = el.dataset.draft;
  const dr = ui.sheet.draft;
  if (el.type === 'checkbox') return; // géré par 'change'
  if (k === 'points') {
    if (ui.sheet.kind === 'thand') {
      el.value = el.value.replace(/[^\d.,]/g, '').replace('.', ',').slice(0, 4);
      dr.points = el.value;
      return updateTarotFooter();
    }
    el.value = el.value.replace(/\D/g, '').slice(0, 3);
    dr.points = el.value;
    return updateHandFooter();
  }
  if (k === 'nHands') {
    const n = parseInt(el.value.replace(/\D/g, ''), 10);
    dr.nHands = n || null;
    sheetRoot.querySelectorAll('[data-k="nHands"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === dr.nHands)));
    const btn = sheetRoot.querySelector('[data-act="tstart"]');
    if (btn) btn.disabled = !!tarotStartProblem(dr);
    return;
  }
  if (k === 'target') {
    const n = parseInt(el.value.replace(/\D/g, ''), 10);
    if (n) dr.target = n;
    const btn = sheetRoot.querySelector('[data-act="start-game"]');
    if (btn) btn.disabled = !(dr.slots.every(Boolean) && dr.target >= 100);
    sheetRoot.querySelectorAll('[data-k="target"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === dr.target)));
    return;
  }
  if (k === 'title') { dr.title = el.value; return; }
  if (k === 'name') {
    dr.name = el.value;
    const btn = document.getElementById('save-player');
    if (btn) btn.disabled = !el.value.trim();
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.gchart !== undefined) {
    if (store.get(route().id)?.type === 'tarot') ui.gstatT = el.value; else ui.gstatC = el.value;
    return render();
  }
  if (el.dataset.pchart !== undefined) {
    if (ui.kind === 'tarot') ui.pchartT = el.value; else ui.pchartC = el.value;
    return render();
  }
  if (el.dataset.chartStat !== undefined) {
    if (ui.kind === 'tarot') ui.tchartStat = el.value; else ui.chartStat = el.value;
    return render();
  }
  if (el.dataset.trule) {
    const k = el.dataset.trule;
    const v = el.type === 'checkbox' ? el.checked : el.value === 'hands' || el.value === 'free' ? el.value : Number(el.value);
    const g = store.getState().group;
    const cur = store.get(g.id) || {};
    store.put('settings', { ...cur, id: undefined, tarot: { ...(cur.tarot || {}), [k]: v } }, g.id);
    return toast('Règle enregistrée');
  }
  // Règles du groupe
  if (el.dataset.rule) {
    const k = el.dataset.rule;
    const v = el.type === 'checkbox' ? el.checked : Number(el.value);
    const g = store.getState().group;
    const cur = store.get(g.id) || {};
    store.put('settings', { ...cur, id: undefined, rules: { ...(cur.rules || {}), [k]: v } }, g.id);
    return toast('Règle enregistrée');
  }
  // Photo de profil
  if (el.matches('input[type=file][data-photo]') && el.files?.[0] && ui.sheet) {
    try {
      ui.sheet.draft.photo = await fileToAvatar(el.files[0]);
      renderSheet();
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  // Cases à cocher des feuilles
  if (ui.sheet && el.dataset.draft && el.type === 'checkbox') {
    ui.sheet.draft[el.dataset.draft] = el.checked;
    renderSheet();
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && ui.sheet) closeSheet();
  if (ev.key === 'Enter' && ev.target.id === 'join-code') handle('join-group', document.querySelector('[data-act="join-group"]'));
});

// ============================================================ EXPORTS
function exportStats() {
  const d = D();
  const header = ['Joueur', 'Parties', 'Victoires', '% victoires', '% défaites', 'Donnes jouées', '% prises sur les donnes', 'Prises', 'Prises réussies', '% réussite', '% chute',
    'Prises solo', 'Prises solo réussies', 'Prises partagées', 'Prises partagées réussies',
    'Points moyens / contrat réussi', 'Annonce moyenne', 'Capots', 'Générales', 'Contres', 'Contres réussis', 'Surcontres', 'Surcontres réussis',
    'Belotes', '% chutes infligées en défense', 'Meilleur partenaire', 'Adversaire redouté'];
  const rows = d.players.map((p) => {
    const s = d.stats.get(p.id);
    return [p.name, s.games, s.wins, s.winPct, s.lossPct, s.handsDealt, s.takeRate, s.takes, s.takesMade, s.takeMadePct, s.takeFailPct,
      s.soloTakes, s.soloMade, s.sharedTakes, s.sharedMade,
      s.avgPointsMade, s.avgBid, s.capots, s.generales, s.coinches, s.coinchesWon, s.surcoinches, s.surcoinchesWon,
      s.belotes, s.defensePct, s.bestPartner ? P(s.bestPartner.id).name : '', s.nemesis ? P(s.nemesis.id).name : ''];
  });
  download('fous-contree-stats.csv', toCsv(header, rows));
}

function exportHands() {
  const d = D();
  const header = ['Partie', 'Titre', 'Date', 'Donne', 'Bleus', 'Rouges', 'Preneur', 'Prise partagée', 'Annonce', 'Couleur', 'Contre', 'Surcontre',
    'Points attaque', 'Capot', 'Belote', 'Résultat', 'Points Bleus', 'Points Rouges', 'Total Bleus', 'Total Rouges'];
  const rows = [];
  [...d.evaluated].reverse().forEach((e, gi) => {
    e.rows.forEach((r, i) => {
      const h = r.hand;
      rows.push([gi + 1, gameTitle(e.game), dateTime(e.game.startedAt), i + 1,
        e.game.teams[0].map((x) => P(x).name).join(' & '), e.game.teams[1].map((x) => P(x).name).join(' & '),
        h.passed ? '' : P(h.taker).name, h.shared ? 'oui' : '', h.passed ? 'passe' : bidLabel(h.bid), h.passed ? '' : SUITS[h.suit]?.label,
        h.coincheBy ? P(h.coincheBy).name : '', h.surcoincheBy ? P(h.surcoincheBy).name : '',
        h.attackPoints, h.capot ? 'oui' : '', h.beloteBy ? P(h.beloteBy).name : '',
        h.passed ? '' : r.made ? 'réussi' : 'chuté', r.scores[0], r.scores[1], r.totals[0], r.totals[1]]);
    });
  });
  download('fous-contree-donnes.csv', toCsv(header, rows));
}

function exportTarotStats() {
  const d = D();
  const header = ['Joueur', 'Parties', 'Victoires', '% victoires', 'Podiums', '% podiums', 'Place moyenne', 'Score final moyen',
    'Donnes jouées', '% prises sur les donnes', 'Prises', 'Prises réussies', '% réussite', ...CONTRACT_KEYS.flatMap((c) => [`${CONTRACTS[c].label} tentées`, `${CONTRACTS[c].label} réussies`]),
    'Gain moyen / prise réussie', 'Bouts moyens', 'Appelé', 'Réussites comme appelé', 'Appelé lui-même',
    '% chutes en défense', 'Petits au bout réussis', 'Petits pris', 'Poignées', 'Chelems', 'Misères', 'Meilleur partenaire (à 5)'];
  const rows = d.players.map((p) => {
    const s = d.tstats.get(p.id);
    return [p.name, s.games, s.wins, s.winPct, s.podiums, s.podiumPct, s.avgRank, s.avgFinal,
      s.handsDealt, s.takeRate, s.takes, s.takesMade, s.takePct, ...CONTRACT_KEYS.flatMap((c) => [s.byContract[c]?.takes ?? 0, s.byContract[c]?.made ?? 0]),
      s.avgGainMade, s.avgBouts, s.called, s.calledMade, s.selfCalls,
      s.defensePct, s.pabMade, s.pabLost, s.poignees, s.chelems, s.miseres, s.bestPartner ? P(s.bestPartner.id).name : ''];
  });
  download('fous-tarot-stats.csv', toCsv(header, rows));
}

function exportTarotHands() {
  const d = D();
  const header = ['Partie', 'Titre', 'Date', 'Donne', 'Joueurs', 'Preneur', 'Contrat', 'Appelé', 'Bouts', 'Points attaque', 'Résultat',
    'Petit au bout', 'Poignées', 'Chelem', 'Misères', 'Points (par joueur)', 'Totaux'];
  const rows = [];
  [...d.tevaluated].reverse().forEach((e, gi) => {
    e.rows.forEach((r, i) => {
      const h = r.hand;
      const names = (o) => e.game.players.map((pid) => `${P(pid).name} ${o[pid]}`).join(' | ');
      rows.push([gi + 1, gameTitle(e.game), dateTime(e.game.startedAt), i + 1, e.game.players.map((x) => P(x).name).join(', '),
        h.passed ? '' : P(h.taker).name, h.passed ? 'passe' : CONTRACTS[h.contract]?.label, r.partner ? P(r.partner).name : '',
        h.bouts, h.attackPoints, h.passed ? '' : r.made ? 'réussi' : 'chuté',
        h.pabBy ? `${P(h.pabBy).name}${h.pabLost ? ' (pris)' : ''}` : '',
        (h.poignees || []).map((x) => `${P(x.by).name} ${x.type}`).join(', '),
        h.chelem && h.chelem !== 'none' ? CHELEMS[h.chelem].label : '',
        (h.miseres || []).map((m) => P(m).name).join(', '), names(r.deltas), names(r.totals)]);
    });
  });
  download('fous-tarot-donnes.csv', toCsv(header, rows));
}

// ============================================================ MISES À JOUR
/**
 * Vide la mémoire de l'app (fichiers en cache + service worker) puis recharge :
 * le téléphone télécharge alors la dernière version mise en ligne.
 * Les données (parties, joueurs) ne sont pas touchées.
 */
async function forceUpdate() {
  if (store.getState().dirty.length) await store.sync(true);
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys?.()) || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (e) { console.warn(e); }
  location.reload();
}

/** Compare la version installée avec celle en ligne (numéro dans sw.js). */
async function checkServerVersion() {
  if (EMBED || (location.protocol !== 'https:' && location.hostname !== 'localhost')) return;
  try {
    const txt = await (await fetch(`sw.js?check=${Date.now()}`, { cache: 'no-store' })).text();
    const m = txt.match(/fdc-v(\d+)/);
    if (!m) return;
    ui.serverBuild = Number(m[1]);
    if (ui.serverBuild > APP_BUILD) showUpdateBanner();
  } catch { /* hors ligne */ }
}

function showUpdateBanner() {
  if (document.getElementById('upd')) return;
  const el = document.createElement('div');
  el.id = 'upd';
  el.className = 'upd-banner';
  el.innerHTML = `<span>Une nouvelle version de l'app est en ligne.</span><button data-act="force-update">Mettre à jour</button>`;
  document.body.appendChild(el);
}

// ============================================================ DÉMARRAGE
async function handleJoinLink() {
  const code = location.hash.slice('#join='.length).toUpperCase();
  history.replaceState(null, '', location.pathname);
  const known = store.listGroups().find((g) => g.code === code);
  if (known) { store.switchGroup(known.id); go('#/'); return; }
  if (store.getState().group) {
    // Déjà dans un groupe : on ajoute celui-ci à la liste
    if (!(await ask({ title: `Rejoindre le groupe ${code} ?`, message: 'Il s\'ajoutera à vos groupes ; vous pourrez passer de l\'un à l\'autre.', ok: 'Rejoindre' }))) { render(); return; }
    try {
      await store.joinGroup(code);
      go('#/');
      toast(`Bienvenue dans « ${store.getState().group.name} »`);
    } catch (e) {
      toast(/inconnu/i.test(e.message) ? 'Code inconnu, vérifiez-le' : `Connexion impossible : ${e.message}`);
      render();
    }
    return;
  }
  ui.joinCode = code;
  render();
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installPrompt = e;
  if (route().name === 'settings') render();
});

store.subscribe((_, dataChanged) => {
  if (dataChanged === false) {
    // Simple changement d'état de synchro : on ne met à jour que le badge
    const badge = document.querySelector('.topbar .sync');
    if (badge) badge.outerHTML = syncBadge();
    return;
  }
  version++;
  // Ne pas reconstruire la page pendant une saisie dans un champ du formulaire d'accueil
  if (!store.getState().group && document.activeElement?.tagName === 'INPUT') return;
  render();
});

store.load();
if (EMBED && !store.getState().group) store.addGroups(buildDemoGroups(store.uuid));
if (!EMBED && location.hash.startsWith('#join=')) handleJoinLink();
else render();
store.startPolling();
store.sync(true);
checkServerVersion();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkServerVersion(); });

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.CONTREE_NO_SW) {
  // updateViaCache 'none' : le téléphone vérifie toujours si sw.js a changé
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => reg.update())
    .catch(() => {});
  // Quand une nouvelle version prend le relais, on recharge une fois pour l'afficher
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !navigator.serviceWorker.controller) return;
    reloaded = true;
    location.reload();
  });
}
