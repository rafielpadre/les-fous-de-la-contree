// =====================================================================
//  Statistiques du TAROT (individuelles, duos à 5, évolution)
// =====================================================================
import { tarotTotals, CONTRACT_KEYS } from './tarot.js';
import { handsByGame } from './stats.js';

// Clés « à plat » des parts de contrats (pour les graphiques)
export const SHARE_KEY = { petite: 'sharePetite', garde: 'shareGarde', gardeSans: 'shareGardeSans', gardeContre: 'shareGardeContre' };
const pct = (num, den) => (den > 0 ? (100 * num) / den : null);
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);

export function evaluateTarot(games, hands) {
  const byGame = handsByGame(hands);
  return games.map((g) => {
    const hs = byGame.get(g.id) || [];
    return { game: g, hands: hs, ...tarotTotals(g, hs) };
  });
}

function blank(id) {
  return {
    id,
    games: 0, wins: 0, winPct: null, podiums: 0, podiumPct: null, ranks: [], avgRank: null,
    finals: [], avgFinal: null, best: null,
    handsPlayed: 0, handsDealt: 0, takeRate: null,
    takes: 0, takesMade: 0, takePct: null, takeFailPct: null,
    byContract: Object.fromEntries(CONTRACT_KEYS.map((c) => [c, { takes: 0, made: 0 }])),
    gains: [], avgGainMade: null, bouts: [], avgBouts: null,
    called: 0, calledMade: 0, calledPct: null, selfCalls: 0,
    defenses: 0, defensesWon: 0, defensePct: null,
    pabMade: 0, pabLost: 0, poignees: 0, chelems: 0, miseres: 0,
    partners: {}, bestPartner: null,
    timeline: [],
  };
}

/** Ajoute l'effet d'une donne aux accumulateurs (partagé avec l'évolution). */
function addHand(get, row, players) {
  const h = row.hand;
  for (const m of h.miseres || []) if (get(m)) get(m).miseres++;
  // Donnes distribuées (y compris « tous passent ») : base du % de prises
  for (const p of players) if (get(p)) get(p).handsDealt++;
  if (h.passed) return;
  for (const p of players) if (get(p)) get(p).handsPlayed++;
  const tk = get(h.taker);
  if (tk) {
    tk.takes++;
    tk.byContract[h.contract] ??= { takes: 0, made: 0 };
    tk.byContract[h.contract].takes++;
    tk.bouts.push(Number(h.bouts) || 0);
    if (row.made) {
      tk.takesMade++;
      tk.byContract[h.contract].made++;
      tk.gains.push(row.deltas[h.taker]);
    }
    if (players.length === 5 && h.called === h.taker) tk.selfCalls++;
  }
  if (row.partner && get(row.partner)) {
    const c = get(row.partner);
    c.called++;
    if (row.made) c.calledMade++;
  }
  // Duo preneur + appelé (à 5)
  if (row.partner) {
    for (const [x, y] of [[h.taker, row.partner], [row.partner, h.taker]]) {
      const s = get(x);
      if (!s) continue;
      s.partners[y] ??= { hands: 0, made: 0 };
      s.partners[y].hands++;
      if (row.made) s.partners[y].made++;
    }
  }
  for (const d of row.defenders) {
    const s = get(d);
    if (!s) continue;
    s.defenses++;
    if (!row.made) s.defensesWon++;
  }
  if (h.pabBy && get(h.pabBy)) {
    if (h.pabLost) get(h.pabBy).pabLost++;
    else get(h.pabBy).pabMade++;
  }
  for (const pg of h.poignees || []) if (get(pg.by)) get(pg.by).poignees++;
  if (h.chelem && h.chelem.endsWith('Made') && tk) tk.chelems++;
}

function addGame(get, ev) {
  for (const p of ev.game.players) {
    const s = get(p);
    if (!s) continue;
    s.games++;
    const r = ev.rank[p];
    s.ranks.push(r);
    if (r === 1) s.wins++;
    if (r <= 3) s.podiums++;
    s.finals.push(ev.totals[p]);
  }
}

function finalize(s) {
  s.winPct = pct(s.wins, s.games);
  s.podiumPct = pct(s.podiums, s.games);
  s.avgRank = mean(s.ranks);
  s.avgFinal = mean(s.finals);
  s.best = s.finals.length ? Math.max(...s.finals) : null;
  s.takePct = pct(s.takesMade, s.takes);
  s.takeFailPct = pct(s.takes - s.takesMade, s.takes);
  s.takeRate = pct(s.takes, s.handsDealt);
  s.avgGainMade = mean(s.gains);
  s.avgBouts = mean(s.bouts);
  s.calledPct = pct(s.calledMade, s.called);
  s.defensePct = pct(s.defensesWon, s.defenses);
  for (const c of Object.values(s.byContract)) c.pct = pct(c.made, c.takes);
  // Niveau des prises : part de chaque contrat parmi les prises du joueur
  for (const c of CONTRACT_KEYS) {
    const x = s.byContract[c] || { takes: 0, made: 0 };
    x.share = pct(x.takes, s.takes);
    s[SHARE_KEY[c]] = x.share;
  }
  const duo = Object.entries(s.partners)
    .filter(([, v]) => v.hands >= 2)
    .map(([id, v]) => ({ id, ...v, pct: pct(v.made, v.hands) }))
    .sort((a, b) => b.pct - a.pct || b.hands - a.hands);
  s.bestPartner = duo[0] || null;
  return s;
}

/**
 * Statistiques tarot de chaque joueur.
 * Victoire = 1ʳᵉ place (ex aequo compris) ; podium = 3 premières places.
 * Donnes : toutes les parties ; classements : parties terminées seulement.
 */
export function computeTarotStats(players, games, hands) {
  const S = new Map(players.map((p) => [p.id, blank(p.id)]));
  const get = (id) => S.get(id);
  const evs = evaluateTarot(games, hands).sort((a, b) => (a.game.startedAt ?? 0) - (b.game.startedAt ?? 0));
  for (const ev of evs) {
    for (const row of ev.rows) addHand(get, row, ev.game.players);
    if (ev.finished) {
      addGame(get, ev);
      for (const p of ev.game.players) {
        const s = get(p);
        if (s) s.timeline.push({ t: ev.game.finishedAt ?? ev.game.startedAt, winPct: pct(s.wins, s.games), takePct: pct(s.takesMade, s.takes) });
      }
    }
  }
  for (const s of S.values()) finalize(s);
  return S;
}

// ---------------------------------------------------------------- évolution
export const TAROT_TIMELINE_STATS = [
  { key: 'winPct', label: '% de victoires (1ʳᵉ place)', unit: '%' },
  { key: 'podiumPct', label: '% de podiums', unit: '%' },
  { key: 'avgRank', label: 'Place moyenne', unit: 'rang' },
  { key: 'avgFinal', label: 'Score final moyen', unit: 'pts' },
  { key: 'takePct', label: '% de prises réussies', unit: '%' },
  { key: 'takeRate', label: '% de prises sur les donnes jouées', unit: '%' },
  { key: 'sharePetite', label: 'Part de Petites dans ses prises', unit: '%' },
  { key: 'shareGarde', label: 'Part de Gardes dans ses prises', unit: '%' },
  { key: 'shareGardeSans', label: 'Part de Gardes sans dans ses prises', unit: '%' },
  { key: 'shareGardeContre', label: 'Part de Gardes contre dans ses prises', unit: '%' },
  { key: 'calledPct', label: '% de réussite comme appelé (à 5)', unit: '%' },
  { key: 'defensePct', label: '% de contrats chutés en défense', unit: '%' },
  { key: 'avgGainMade', label: 'Gain moyen par prise réussie', unit: 'pts' },
  { key: 'avgBouts', label: 'Bouts moyens quand il prend', unit: 'pts' },
  { key: 'games', label: 'Parties jouées', unit: '' },
  { key: 'wins', label: 'Victoires', unit: '' },
  { key: 'podiums', label: 'Podiums', unit: '' },
  { key: 'takes', label: 'Prises tentées', unit: '' },
  { key: 'pabMade', label: 'Petits au bout réussis', unit: '' },
  { key: 'chelems', label: 'Chelems réussis', unit: '' },
];

/** Même structure que timeline() de la contrée : photo cumulée après chaque partie terminée. */
export function tarotTimeline(players, games, hands) {
  const acc = new Map(players.map((p) => [p.id, blank(p.id)]));
  const get = (id) => acc.get(id);
  // Parties terminées dans l'ordre, puis les parties en cours (point « en direct »)
  const all = evaluateTarot(games, hands);
  const evs = [
    ...all.filter((e) => e.finished)
      .sort((a, b) => (a.game.finishedAt ?? a.game.startedAt ?? 0) - (b.game.finishedAt ?? b.game.startedAt ?? 0)),
    ...all.filter((e) => !e.finished && e.played > 0)
      .sort((a, b) => (a.game.startedAt ?? 0) - (b.game.startedAt ?? 0)),
  ];
  const points = [];
  const series = Object.fromEntries(players.map((p) => [p.id, []]));
  const seen = new Set();
  for (const ev of evs) {
    for (const row of ev.rows) addHand(get, row, ev.game.players);
    if (ev.finished) addGame(get, ev);       // place et victoire : seulement en fin de partie
    for (const pid of ev.game.players) seen.add(pid);
    points.push({ gameId: ev.game.id, t: ev.game.finishedAt ?? ev.game.startedAt, players: [...ev.game.players], live: !ev.finished });
    for (const p of players) {
      const a = get(p.id);
      if (!seen.has(p.id)) { series[p.id].push(null); continue; }
      const snap = finalize({ ...a, byContract: structuredClone(a.byContract), partners: {} });
      series[p.id].push({
        games: snap.games, wins: snap.wins, podiums: snap.podiums, takes: snap.takes,
        pabMade: snap.pabMade, chelems: snap.chelems,
        winPct: snap.winPct, podiumPct: snap.podiumPct, avgRank: snap.avgRank, avgFinal: snap.avgFinal,
        sharePetite: snap.sharePetite, shareGarde: snap.shareGarde, shareGardeSans: snap.shareGardeSans, shareGardeContre: snap.shareGardeContre,
        takePct: snap.takePct, takeRate: snap.takeRate, calledPct: snap.calledPct, defensePct: snap.defensePct,
        avgGainMade: snap.avgGainMade, avgBouts: snap.avgBouts,
      });
    }
  }
  return { points, series };
}
