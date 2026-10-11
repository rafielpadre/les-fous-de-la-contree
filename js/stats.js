// =====================================================================
//  Statistiques individuelles, par duo et sur la durée.
//  Module pur : prend les listes de joueurs / parties / donnes.
// =====================================================================
import { gameTotals, scoreHand, bidValue, teamOf } from './scoring.js';

const pct = (num, den) => (den > 0 ? (100 * num) / den : null);
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);

/** Regroupe les donnes par partie, triées dans l'ordre de jeu. */
export function handsByGame(hands) {
  const map = new Map();
  for (const h of hands) {
    if (!map.has(h.gameId)) map.set(h.gameId, []);
    map.get(h.gameId).push(h);
  }
  for (const list of map.values()) list.sort((x, y) => (x.idx ?? 0) - (y.idx ?? 0) || (x.createdAt ?? 0) - (y.createdAt ?? 0));
  return map;
}

/** Résultat calculé de chaque partie (totaux + gagnant). */
export function evaluateGames(games, hands) {
  const byGame = handsByGame(hands);
  return games.map((g) => {
    const hs = byGame.get(g.id) || [];
    const res = gameTotals(hs, g.teams, g.rules);
    return { game: g, hands: hs, ...res, finished: res.winner !== null };
  });
}

function emptyStats(id) {
  return {
    id,
    games: 0, wins: 0, losses: 0, winPct: null, lossPct: null,
    handsPlayed: 0,
    takes: 0, takesMade: 0, takesFailed: 0, takeMadePct: null, takeFailPct: null,
    avgPointsMade: null, avgBid: null,
    capots: 0, capotsAnnounced: 0, generales: 0,
    coinches: 0, coinchesWon: 0, coinchePct: null,
    surcoinches: 0, surcoinchesWon: 0, surcoinchePct: null,
    belotes: 0,
    defenses: 0, defensesWon: 0, defensePct: null,
    favSuit: null, suitCounts: {},
    streak: 0, bestStreak: 0,
    partners: {}, opponents: {},
    bestPartner: null, nemesis: null,
    timeline: [],      // [{t, winPct, takePct}] après chaque partie terminée
    _made: [], _bids: [],
  };
}

/**
 * Calcule toutes les statistiques.
 * @returns {Map<string, object>} id joueur → stats
 */
export function computeStats(players, games, hands, { minGamesForDuo = 2 } = {}) {
  const S = new Map(players.map((p) => [p.id, emptyStats(p.id)]));
  const get = (id) => S.get(id);

  const evaluated = evaluateGames(games, hands)
    .sort((a, b) => (a.game.startedAt ?? 0) - (b.game.startedAt ?? 0));

  for (const ev of evaluated) {
    const { game, hands: hs, rows } = ev;
    const teams = game.teams;
    const all = [...teams[0], ...teams[1]];

    // ---- Statistiques par donne (toutes parties, même en cours) ----
    rows.forEach((row) => {
      const h = row.hand;
      if (h.passed) return;
      for (const pid of all) if (get(pid)) get(pid).handsPlayed++;

      const att = row.attack;
      const taker = get(h.taker);
      if (taker) {
        taker.takes++;
        if (row.made) {
          taker.takesMade++;
          taker._made.push(row.scores[att]);
          if (h.capot) taker.capots++;
          if (h.bid === 'generale') taker.generales++;
        } else taker.takesFailed++;
        if (h.bid === 'capot') taker.capotsAnnounced++;
        if (typeof bidValue(h.bid) === 'number' && bidValue(h.bid) <= 160) taker._bids.push(bidValue(h.bid));
        taker.suitCounts[h.suit] = (taker.suitCounts[h.suit] || 0) + 1;
      }
      // Défenseurs : chute infligée ?
      for (const pid of teams[1 - att]) {
        const s = get(pid);
        if (!s) continue;
        s.defenses++;
        if (!row.made) s.defensesWon++;
      }
      // Contre réussi = le contrat adverse chute ; surcontre réussi = le contrat passe
      if (h.coincheBy && get(h.coincheBy)) {
        const s = get(h.coincheBy);
        s.coinches++;
        if (!row.made) s.coinchesWon++;
      }
      if (h.surcoincheBy && get(h.surcoincheBy)) {
        const s = get(h.surcoincheBy);
        s.surcoinches++;
        if (row.made) s.surcoinchesWon++;
      }
      if (h.beloteBy && get(h.beloteBy) && h.suit !== 'SA') get(h.beloteBy).belotes++;
    });

    // ---- Statistiques par partie (parties terminées uniquement) ----
    if (!ev.finished) continue;
    const t = game.finishedAt ?? game.startedAt ?? 0;
    for (let ti = 0; ti < 2; ti++) {
      const won = ev.winner === ti;
      for (const pid of teams[ti]) {
        const s = get(pid);
        if (!s) continue;
        s.games++;
        if (won) { s.wins++; s.streak = Math.max(1, s.streak + 1); }
        else { s.losses++; s.streak = Math.min(-1, s.streak - 1); }
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        const partner = teams[ti].find((x) => x !== pid);
        bump(s.partners, partner, won);
        for (const opp of teams[1 - ti]) bump(s.opponents, opp, won);
        s.timeline.push({
          t,
          gameId: game.id,
          won,
          winPct: pct(s.wins, s.games),
          takePct: pct(s.takesMade, s.takes),
        });
      }
    }
  }

  // ---- Finalisation ----
  for (const s of S.values()) {
    s.winPct = pct(s.wins, s.games);
    s.lossPct = pct(s.losses, s.games);
    s.takeMadePct = pct(s.takesMade, s.takes);
    s.takeFailPct = pct(s.takesFailed, s.takes);
    s.avgPointsMade = mean(s._made);
    s.avgBid = mean(s._bids);
    s.coinchePct = pct(s.coinchesWon, s.coinches);
    s.surcoinchePct = pct(s.surcoinchesWon, s.surcoinches);
    s.defensePct = pct(s.defensesWon, s.defenses);
    const suits = Object.entries(s.suitCounts).sort((a, b) => b[1] - a[1]);
    s.favSuit = suits.length ? suits[0][0] : null;
    s.bestPartner = pickDuo(s.partners, minGamesForDuo, 'max');
    s.nemesis = pickDuo(s.opponents, minGamesForDuo, 'min');
    delete s._made; delete s._bids;
  }
  return S;
}

function bump(obj, id, won) {
  if (!id) return;
  obj[id] ??= { games: 0, wins: 0 };
  obj[id].games++;
  if (won) obj[id].wins++;
}

/** Meilleur partenaire (taux max) ou bête noire (taux min), à partir de N parties. */
function pickDuo(obj, minGames, mode) {
  const list = Object.entries(obj)
    .filter(([, v]) => v.games >= minGames)
    .map(([id, v]) => ({ id, ...v, winPct: pct(v.wins, v.games) }));
  if (!list.length) return null;
  list.sort((a, b) => (mode === 'max' ? b.winPct - a.winPct : a.winPct - b.winPct) || b.games - a.games);
  return list[0];
}

/** Statistiques de tous les duos (paires de partenaires) du groupe. */
export function computeDuos(games, hands) {
  const duos = new Map();
  for (const ev of evaluateGames(games, hands)) {
    if (!ev.finished) continue;
    ev.game.teams.forEach((team, ti) => {
      const key = [...team].sort().join('|');
      const d = duos.get(key) ?? { ids: [...team].sort(), games: 0, wins: 0 };
      d.games++;
      if (ev.winner === ti) d.wins++;
      duos.set(key, d);
    });
  }
  return [...duos.values()].map((d) => ({ ...d, winPct: pct(d.wins, d.games) }));
}

/** Statistiques d'une partie en cours, joueur par joueur. */
export function gameStats(game, hands) {
  const out = {};
  for (const pid of [...game.teams[0], ...game.teams[1]]) {
    out[pid] = { takes: 0, made: 0, coinches: 0, coinchesWon: 0, belotes: 0, points: 0 };
  }
  for (const h of hands) {
    if (h.passed) continue;
    const r = scoreHand(h, game.teams, game.rules);
    const t = out[h.taker];
    if (t) {
      t.takes++;
      if (r.made) { t.made++; t.points += r.scores[r.attack]; }
    }
    if (h.coincheBy && out[h.coincheBy]) {
      out[h.coincheBy].coinches++;
      if (!r.made) out[h.coincheBy].coinchesWon++;
    }
    if (h.beloteBy && out[h.beloteBy] && h.suit !== 'SA') out[h.beloteBy].belotes++;
  }
  return out;
}

export { teamOf };

// =====================================================================
//  Évolution dans le temps (écran Graphiques)
//  Après chaque partie TERMINÉE (ordre chronologique), on prend une
//  « photo » des statistiques cumulées de chacun des 4 joueurs.
// =====================================================================
export const TIMELINE_STATS = [
  { key: 'winPct', label: '% de victoires', unit: '%' },
  { key: 'takePct', label: '% de prises réussies', unit: '%' },
  { key: 'coinchePct', label: '% de contres réussis', unit: '%' },
  { key: 'defensePct', label: '% de chutes infligées en défense', unit: '%' },
  { key: 'avgPoints', label: 'Points moyens par contrat réussi', unit: 'pts' },
  { key: 'avgBid', label: 'Annonce moyenne', unit: 'pts' },
  { key: 'games', label: 'Parties jouées', unit: '' },
  { key: 'wins', label: 'Parties gagnées', unit: '' },
  { key: 'takes', label: 'Prises tentées', unit: '' },
  { key: 'takesMade', label: 'Prises réussies', unit: '' },
  { key: 'coinchesWon', label: 'Contres réussis', unit: '' },
  { key: 'belotes', label: 'Belotes', unit: '' },
  { key: 'capots', label: 'Capots', unit: '' },
];

/**
 * @returns {{ points: {gameId, t, players: string[]}[], series: Object<string, (object|null)[]> }}
 *   series[pid][k] = statistiques cumulées du joueur après la k-ième partie terminée du groupe,
 *   ou null s'il n'avait encore joué aucune partie terminée.
 */
export function timeline(players, games, hands) {
  const acc = Object.fromEntries(players.map((p) => [p.id, {
    games: 0, wins: 0, takes: 0, takesMade: 0, made: [], bids: [],
    coinches: 0, coinchesWon: 0, defenses: 0, defensesWon: 0, belotes: 0, capots: 0,
  }]));
  const evaluated = evaluateGames(games, hands)
    .filter((e) => e.finished)
    .sort((a, b) => (a.game.finishedAt ?? a.game.startedAt ?? 0) - (b.game.finishedAt ?? b.game.startedAt ?? 0));
  const points = [];
  const series = Object.fromEntries(players.map((p) => [p.id, []]));

  for (const ev of evaluated) {
    const { game, rows } = ev;
    const teams = game.teams;
    for (const row of rows) {
      const h = row.hand;
      if (h.passed) continue;
      const tk = acc[h.taker];
      if (tk) {
        tk.takes++;
        if (row.made) { tk.takesMade++; tk.made.push(row.scores[row.attack]); if (h.capot) tk.capots++; }
        const bv = bidValue(h.bid);
        if (bv <= 160) tk.bids.push(bv);
      }
      for (const pid of teams[1 - row.attack]) {
        if (!acc[pid]) continue;
        acc[pid].defenses++;
        if (!row.made) acc[pid].defensesWon++;
      }
      if (h.coincheBy && acc[h.coincheBy]) {
        acc[h.coincheBy].coinches++;
        if (!row.made) acc[h.coincheBy].coinchesWon++;
      }
      if (h.beloteBy && acc[h.beloteBy] && h.suit !== 'SA') acc[h.beloteBy].belotes++;
    }
    teams.forEach((team, ti) => team.forEach((pid) => {
      if (!acc[pid]) return;
      acc[pid].games++;
      if (ev.winner === ti) acc[pid].wins++;
    }));
    points.push({ gameId: game.id, t: game.finishedAt ?? game.startedAt, players: teams.flat() });
    for (const p of players) {
      const a = acc[p.id];
      series[p.id].push(a.games === 0 ? null : {
        games: a.games, wins: a.wins, takes: a.takes, takesMade: a.takesMade,
        coinchesWon: a.coinchesWon, belotes: a.belotes, capots: a.capots,
        winPct: pct(a.wins, a.games),
        takePct: pct(a.takesMade, a.takes),
        coinchePct: pct(a.coinchesWon, a.coinches),
        defensePct: pct(a.defensesWon, a.defenses),
        avgPoints: mean(a.made),
        avgBid: mean(a.bids),
      });
    }
  }
  return { points, series };
}
