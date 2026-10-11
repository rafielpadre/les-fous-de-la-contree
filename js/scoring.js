// =====================================================================
//  Les Fous de la Contrée — moteur de calcul des points
//  Module pur (aucune dépendance au DOM) : testable avec Node.
// =====================================================================
//
//  Notations (utilisées dans les commentaires ci-dessous)
//  ------------------------------------------------------
//  A    : valeur de l'annonce (80 … 160, capot = 250, générale = 500)
//  m    : multiplicateur de contre : 1 (normal), 2 (contré), 4 (surcontré)
//  p    : points de cartes faits par l'attaque, SANS la belote (0 … 162)
//  b_a  : belote de l'attaque (0 ou 20) ; b_d : belote de la défense
//  p~   : p arrondi à la dizaine, le 5 profitant à l'attaque
//  d~   : points de la défense arrondis = 160 − p~
//
//  Contrat réussi  ⇔  p + b_a ≥ A          (capot/générale : tous les plis)
//  Réussi : S_att = m·A + p~ + b_a          S_def = d~ + b_d
//  Chuté  : S_att = 0                       S_def = 160 + m·A + b_d
// =====================================================================

export const SUITS = {
  S: { label: 'Pique', symbol: '♠', red: false },
  H: { label: 'Cœur', symbol: '♥', red: true },
  D: { label: 'Carreau', symbol: '♦', red: true },
  C: { label: 'Trèfle', symbol: '♣', red: false },
  SA: { label: 'Sans atout', symbol: 'SA', red: false },
  TA: { label: 'Tout atout', symbol: 'TA', red: false },
};

export const NUMERIC_BIDS = [80, 90, 100, 110, 120, 130, 140, 150, 160];
export const SPECIAL_BIDS = { capot: 250, generale: 500 };

export const DEFAULT_RULES = Object.freeze({
  target: 2000,               // score à atteindre (modifiable à chaque partie)
  rounding: true,             // arrondi à la dizaine, 5 pour l'attaque
  failBase: 160,              // chute : la défense marque failBase + m·A
  beloteLostOnFail: true,     // l'attaque chutée perd sa belote
  capotUnannounced250: true,  // capot non annoncé : 250 points de cartes au lieu de 160
  allowSA: true,              // sans atout autorisé
  allowTA: true,              // tout atout autorisé
});

export function bidValue(bid) {
  if (typeof bid === 'number') return bid;
  if (bid in SPECIAL_BIDS) return SPECIAL_BIDS[bid];
  const n = Number(bid);
  if (!Number.isFinite(n)) throw new Error(`Annonce inconnue : ${bid}`);
  return n;
}

export function bidLabel(bid) {
  if (bid === 'capot') return 'Capot';
  if (bid === 'generale') return 'Générale';
  return String(bid);
}

/** Arrondi à la dizaine, 5 pour l'attaque : 84 → 80, 85 → 90. */
export function roundAttack(p) {
  return Math.floor((p + 5) / 10) * 10;
}

export function multiplier(hand) {
  if (hand.surcoincheBy) return 4;
  if (hand.coincheBy) return 2;
  return 1;
}

/** Index de l'équipe (0 ou 1) d'un joueur, ou -1. */
export function teamOf(teams, playerId) {
  if (!playerId) return -1;
  if (teams[0].includes(playerId)) return 0;
  if (teams[1].includes(playerId)) return 1;
  return -1;
}

/**
 * Calcule le score d'une donne.
 * @param {object} hand  { taker, bid, suit, coincheBy, surcoincheBy,
 *                         attackPoints, capot, beloteBy, passed }
 * @param {string[][]} teams  [[j1, j2], [j3, j4]]
 * @param {object} rules  voir DEFAULT_RULES
 * @returns {{scores:number[], made:boolean, attack:number, detail:object}}
 */
export function scoreHand(hand, teams, rules = DEFAULT_RULES) {
  const r = { ...DEFAULT_RULES, ...rules };

  // Donne où tout le monde passe : aucun point.
  if (hand.passed) {
    return { scores: [0, 0], made: null, attack: -1, detail: { passed: true } };
  }

  const attack = teamOf(teams, hand.taker);
  if (attack < 0) throw new Error('Preneur absent des équipes');
  const defense = 1 - attack;

  const A = bidValue(hand.bid);
  const m = multiplier(hand);
  const announcedCapot = hand.bid === 'capot' || hand.bid === 'generale';

  // Belote : 20 points pour l'équipe qui a roi + dame d'atout (pas en sans atout).
  const beloteTeam = hand.suit === 'SA' ? -1 : teamOf(teams, hand.beloteBy);
  const b_a = beloteTeam === attack ? 20 : 0;
  const b_d = beloteTeam === defense ? 20 : 0;

  const capot = !!hand.capot;
  const p = capot ? 162 : clampInt(hand.attackPoints, 0, 162);

  const made = announcedCapot ? capot : p + b_a >= A;

  const scores = [0, 0];
  let pAtt = 0;
  let pDef = 0;

  if (made) {
    if (capot && !announcedCapot && r.capotUnannounced250) {
      pAtt = 250;                       // capot non annoncé : il vaut 250
      pDef = 0;
    } else if (r.rounding) {
      pAtt = roundAttack(p);            // p~
      pDef = Math.max(0, 160 - pAtt);   // d~ = 160 − p~
    } else {
      pAtt = p;
      pDef = 162 - p;
    }
    scores[attack] = m * A + pAtt + b_a;
    scores[defense] = pDef + b_d;
  } else {
    scores[attack] = r.beloteLostOnFail ? 0 : b_a;
    scores[defense] = r.failBase + m * A + b_d;
  }

  return {
    scores,
    made,
    attack,
    detail: { A, m, p, b_a, b_d, pAtt, pDef, capot, announcedCapot, failBase: r.failBase },
  };
}

/** Totaux cumulés d'une partie + gagnant éventuel. */
export function gameTotals(hands, teams, rules = DEFAULT_RULES) {
  const r = { ...DEFAULT_RULES, ...rules };
  const totals = [0, 0];
  const rows = [];
  let winner = null;
  for (const h of hands) {
    const res = scoreHand(h, teams, r);
    totals[0] += res.scores[0];
    totals[1] += res.scores[1];
    rows.push({ hand: h, ...res, totals: [...totals] });
  }
  // Fin : une équipe atteint la cible ; si les deux la dépassent, la plus haute gagne.
  // Égalité parfaite au-dessus de la cible : on continue à jouer.
  if (Math.max(...totals) >= r.target && totals[0] !== totals[1]) {
    winner = totals[0] > totals[1] ? 0 : 1;
  }
  return { totals, rows, winner };
}

/** Description textuelle courte d'un résultat (pour l'aperçu de saisie). */
export function explain(res) {
  if (res.detail.passed) return 'Donne passée : aucun point.';
  const { A, m, pAtt, b_a, pDef, b_d } = res.detail;
  const mTxt = m > 1 ? `${m}×${A}` : `${A}`;
  if (res.made) {
    const att = [mTxt, pAtt && `${pAtt}`, b_a && `${b_a} belote`].filter(Boolean).join(' + ');
    const def = [pDef && `${pDef}`, b_d && `${b_d} belote`].filter(Boolean).join(' + ') || '0';
    return `Réussi — attaque : ${att} ; défense : ${def}`;
  }
  const def = [`${res.detail.failBase}`, mTxt, b_d && `${b_d} belote`].filter(Boolean).join(' + ');
  return `Chuté — défense : ${def} ; attaque : 0`;
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v) || 0);
  return Math.min(hi, Math.max(lo, n));
}
