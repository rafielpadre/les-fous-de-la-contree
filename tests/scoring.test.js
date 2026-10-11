// Tests du moteur de calcul : `node --test tests/`
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreHand, gameTotals, roundAttack, DEFAULT_RULES } from '../js/scoring.js';

// Équipe 0 = Alice (a) + Bruno (b) ; équipe 1 = Chloé (c) + David (d)
const T = [['a', 'b'], ['c', 'd']];
const H = (o) => ({ taker: 'a', bid: 80, suit: 'H', attackPoints: 0, ...o });

test('arrondi à la dizaine, 5 pour l\'attaque', () => {
  assert.equal(roundAttack(84), 80);
  assert.equal(roundAttack(85), 90);
  assert.equal(roundAttack(96), 100);
  assert.equal(roundAttack(162), 160);
  assert.equal(roundAttack(0), 0);
});

test('contrat simple réussi : annonce + points faits', () => {
  // 100 cœur, attaque fait 96 (pas de belote) : 96 < 100 → chute !
  let r = scoreHand(H({ bid: 100, attackPoints: 96 }), T);
  assert.equal(r.made, false);
  assert.deepEqual(r.scores, [0, 260]);           // 160 + 100
  // Même donne avec 104 : réussi. p~ = 100, d~ = 60
  r = scoreHand(H({ bid: 100, attackPoints: 104 }), T);
  assert.equal(r.made, true);
  assert.deepEqual(r.scores, [200, 60]);          // 100 + 100 | 60
});

test('la belote compte pour atteindre le contrat', () => {
  // 100 cœur, 96 points + belote attaque → 116 ≥ 100 : réussi
  const r = scoreHand(H({ bid: 100, attackPoints: 96, beloteBy: 'b' }), T);
  assert.equal(r.made, true);
  assert.deepEqual(r.scores, [220, 60]);          // 100 + 100 + 20 | 60
});

test('belote perdue par l\'attaque qui chute, gardée par la défense', () => {
  let r = scoreHand(H({ bid: 120, attackPoints: 90, beloteBy: 'a' }), T);
  assert.equal(r.made, false);                    // 90 + 20 = 110 < 120
  assert.deepEqual(r.scores, [0, 280]);           // 160 + 120
  r = scoreHand(H({ bid: 120, attackPoints: 90, beloteBy: 'c' }), T);
  assert.deepEqual(r.scores, [0, 300]);           // 160 + 120 + 20
});

test('défense avec belote quand le contrat passe', () => {
  const r = scoreHand(H({ bid: 80, attackPoints: 86, beloteBy: 'd' }), T);
  assert.equal(r.made, true);
  assert.deepEqual(r.scores, [170, 90]);          // 80 + 90 | 70 + 20
});

test('contre ×2 et surcontre ×4 sur l\'annonce seule', () => {
  let r = scoreHand(H({ bid: 100, attackPoints: 104, coincheBy: 'c' }), T);
  assert.deepEqual(r.scores, [300, 60]);          // 2×100 + 100 | 60
  r = scoreHand(H({ bid: 100, attackPoints: 104, coincheBy: 'c', surcoincheBy: 'b' }), T);
  assert.deepEqual(r.scores, [500, 60]);          // 4×100 + 100 | 60
  r = scoreHand(H({ bid: 100, attackPoints: 70, coincheBy: 'c' }), T);
  assert.deepEqual(r.scores, [0, 360]);           // 160 + 2×100
});

test('capot annoncé', () => {
  let r = scoreHand(H({ bid: 'capot', capot: true }), T);
  assert.equal(r.made, true);
  assert.deepEqual(r.scores, [410, 0]);           // 250 + 160
  r = scoreHand(H({ bid: 'capot', capot: false, attackPoints: 150 }), T);
  assert.equal(r.made, false);
  assert.deepEqual(r.scores, [0, 410]);           // 160 + 250
});

test('capot non annoncé vaut 250 (option)', () => {
  let r = scoreHand(H({ bid: 110, capot: true }), T);
  assert.deepEqual(r.scores, [360, 0]);           // 110 + 250
  r = scoreHand(H({ bid: 110, capot: true }), T, { capotUnannounced250: false });
  assert.deepEqual(r.scores, [270, 0]);           // 110 + 160
});

test('générale', () => {
  const r = scoreHand(H({ bid: 'generale', capot: true, beloteBy: 'a' }), T);
  assert.deepEqual(r.scores, [680, 0]);           // 500 + 160 + 20
});

test('sans atout : pas de belote', () => {
  const r = scoreHand(H({ suit: 'SA', bid: 100, attackPoints: 96, beloteBy: 'a' }), T);
  assert.equal(r.made, false);
});

test('preneur dans l\'équipe 1', () => {
  const r = scoreHand(H({ taker: 'd', bid: 90, attackPoints: 95 }), T);
  assert.deepEqual(r.scores, [60, 190]);          // 60 | 90 + 100
});

test('sans arrondi', () => {
  const r = scoreHand(H({ bid: 80, attackPoints: 87 }), T, { rounding: false });
  assert.deepEqual(r.scores, [167, 75]);
});

test('donne passée', () => {
  assert.deepEqual(scoreHand({ passed: true }, T).scores, [0, 0]);
});

test('fin de partie : la plus haute gagne si les deux dépassent', () => {
  const rules = { ...DEFAULT_RULES, target: 500 };
  const hands = [
    H({ bid: 160, attackPoints: 150, beloteBy: 'a' }), // 160+150~150→150+20 = 330 | 10
    H({ taker: 'c', bid: 160, attackPoints: 162, capot: true }), // 160+250 = 410 → éq.1
  ];
  const g = gameTotals(hands, T, rules);
  assert.deepEqual(g.totals, [330, 420]);
  assert.equal(g.winner, null);                   // personne à 500
  hands.push(H({ bid: 80, attackPoints: 82 }));  // 80+80=160 | 80
  const g2 = gameTotals(hands, T, rules);
  assert.deepEqual(g2.totals, [490, 500]);
  assert.equal(g2.winner, 1);
});
