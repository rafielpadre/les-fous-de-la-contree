// =====================================================================
//  Les Fous de la Contrée — calcul des points du TAROT (barème FFT)
//  Module pur, testable avec Node.
// =====================================================================
//
//  Notations
//  ---------
//  n  : nombre de joueurs (3, 4 ou 5)
//  P  : points faits par le camp du preneur, sur 91 (demi-points possibles)
//  B  : nombre de bouts du preneur (0 à 3)
//  O  : objectif selon B : 56, 51, 41, 36
//  k  : coefficient du contrat : Petite 1, Garde 2, Garde sans 4, Garde contre 6
//  s  : +1 si le contrat est réussi (P ≥ O), −1 sinon
//  e  : écart |P − O|, arrondi au point supérieur (0,5 → 1)
//
//  Valeur de la donne, vue du preneur (« par défenseur ») :
//    D = s·(25 + e)·k  ±  10·k (petit au bout)  +  s·poignées  +  chelem
//  Répartition (somme nulle) :
//    chaque défenseur : −D
//    n = 3 : preneur +2D        n = 4 : preneur +3D
//    n = 5 avec un appelé : preneur +2D, appelé +D
//    n = 5 si le preneur s'appelle lui-même : preneur +4D
// =====================================================================

export const CONTRACTS = {
  petite: { label: 'Petite', k: 1 },
  garde: { label: 'Garde', k: 2 },
  gardeSans: { label: 'Garde sans', k: 4 },
  gardeContre: { label: 'Garde contre', k: 6 },
};
export const CONTRACT_KEYS = Object.keys(CONTRACTS);
export const OBJECTIVES = [56, 51, 41, 36];
export const POIGNEES = {
  simple: { label: 'Simple', points: 20 },
  double: { label: 'Double', points: 30 },
  triple: { label: 'Triple', points: 40 },
};
/** Nombre d'atouts à montrer pour une poignée simple / double / triple. */
export const POIGNEE_TRUMPS = { 3: [13, 15, 18], 4: [10, 13, 15], 5: [8, 10, 13] };
export const CHELEMS = {
  none: { label: 'Pas de chelem', points: 0 },
  unannouncedMade: { label: 'Non annoncé, réussi', points: 200 },
  announcedMade: { label: 'Annoncé, réussi', points: 400 },
  announcedFailed: { label: 'Annoncé, raté', points: -200 },
};

export const DEFAULT_TAROT_RULES = Object.freeze({
  mode: 'hands',        // 'hands' : nombre de donnes fixé ; 'free' : on termine à la main
  nHands: 20,
  pabTimesK: true,      // petit au bout = 10 × coefficient du contrat (FFT)
  miseres: false,       // annonces de misère autorisées
  miserePoints: 10,     // la misère rapporte 10 points de chaque autre joueur
});

/** Camps d'une donne : [preneur, appelé éventuel] et défenseurs. */
export function camps(h, players) {
  const n = players.length;
  const partner = n === 5 && h.called && h.called !== h.taker ? h.called : null;
  const attackers = partner ? [h.taker, partner] : [h.taker];
  const defenders = players.filter((p) => !attackers.includes(p));
  return { attackers, defenders, partner };
}

/**
 * Calcule une donne de tarot.
 * @param h { taker, contract, called, bouts, attackPoints, pabBy, pabLost, poignees:[{by,type}],
 *            chelem, miseres:[pid], passed }
 * @param players  ids des joueurs de la partie (3 à 5)
 * @returns { made, D, deltas:{pid:n}, attackers, defenders, partner, detail }
 */
export function tarotHand(h, players, rules = DEFAULT_TAROT_RULES) {
  const r = { ...DEFAULT_TAROT_RULES, ...rules };
  const n = players.length;
  const deltas = Object.fromEntries(players.map((p) => [p, 0]));
  addMiseres(h, players, r, deltas);
  if (h.passed) {
    return { made: null, D: 0, deltas, attackers: [], defenders: [], partner: null, detail: { passed: true } };
  }
  if (!players.includes(h.taker)) throw new Error('Preneur absent de la partie');
  const { attackers, defenders, partner } = camps(h, players);

  const k = CONTRACTS[h.contract]?.k ?? 1;
  const B = Math.max(0, Math.min(3, Number(h.bouts) || 0));
  const O = OBJECTIVES[B];
  const P = Math.max(0, Math.min(91, Number(h.attackPoints) || 0));
  const made = P >= O;
  const s = made ? 1 : -1;
  const e = Math.ceil(Math.abs(P - O));

  const base = s * (25 + e) * k;
  // Petit au bout : au camp qui l'a mené au dernier pli, ou à l'autre camp s'il y est pris
  let pab = 0;
  if (h.pabBy && players.includes(h.pabBy)) {
    const byAttack = attackers.includes(h.pabBy);
    const toAttack = h.pabLost ? !byAttack : byAttack;
    pab = (toAttack ? 1 : -1) * 10 * (r.pabTimesK ? k : 1);
  }
  // Poignées : la prime va au camp qui gagne la donne, quel que soit celui qui l'a montrée
  const poigneeSum = (h.poignees || []).reduce((t, x) => t + (POIGNEES[x.type]?.points || 0), 0);
  const poignee = s * poigneeSum;
  const chelem = CHELEMS[h.chelem || 'none']?.points || 0;

  const D = base + pab + poignee + chelem;
  const nd = defenders.length;
  for (const d of defenders) deltas[d] -= D;
  if (partner) {
    deltas[h.taker] += (nd - 1) * D;
    deltas[partner] += D;
  } else {
    deltas[h.taker] += nd * D;
  }
  return {
    made, D, deltas, attackers, defenders, partner,
    detail: { n, k, B, O, P, e, s, base, pab, poignee, chelem },
  };
}

function addMiseres(h, players, r, deltas) {
  if (!r.miseres || !h.miseres?.length) return;
  for (const m of h.miseres) {
    if (!players.includes(m)) continue;
    for (const p of players) deltas[p] += p === m ? r.miserePoints * (players.length - 1) : -r.miserePoints;
  }
}

/** Classement avec ex aequo (1, 1, 3…). */
export function ranking(totals, players) {
  const order = [...players].sort((a, b) => totals[b] - totals[a]);
  const rank = {};
  order.forEach((p, i) => {
    rank[p] = i > 0 && totals[p] === totals[order[i - 1]] ? rank[order[i - 1]] : i + 1;
  });
  return { order, rank };
}

/** Totaux d'une partie de tarot, état de fin, classement. */
export function tarotTotals(game, hands) {
  const players = game.players;
  const rules = { ...DEFAULT_TAROT_RULES, ...(game.rules || {}) };
  const totals = Object.fromEntries(players.map((p) => [p, 0]));
  const rows = [];
  let played = 0;
  for (const h of hands) {
    const res = tarotHand(h, players, rules);
    for (const p of players) totals[p] += res.deltas[p];
    if (!h.passed) played++;
    rows.push({ hand: h, ...res, totals: { ...totals } });
  }
  const finished = !!game.finishedAt || (rules.mode === 'hands' && played >= rules.nHands);
  const { order, rank } = ranking(totals, players);
  return { totals, rows, played, finished, order, rank, rules };
}

/** Phrase d'explication pour l'aperçu de saisie. */
export function explainTarot(res) {
  if (res.detail.passed) return 'Donne passée : aucun point.';
  const { k, O, P, e, base, pab, poignee, chelem } = res.detail;
  const parts = [`${res.made ? '' : '−'}(25 + ${e}) × ${k} = ${base}`];
  if (pab) parts.push(`petit au bout ${pab > 0 ? '+' : ''}${pab}`);
  if (poignee) parts.push(`poignée ${poignee > 0 ? '+' : ''}${poignee}`);
  if (chelem) parts.push(`chelem ${chelem > 0 ? '+' : ''}${chelem}`);
  return `${String(P).replace('.', ',')} pts pour ${O} demandés (écart ${e}). Valeur : ${parts.join(', ')} → ${res.D} par défenseur.`;
}
