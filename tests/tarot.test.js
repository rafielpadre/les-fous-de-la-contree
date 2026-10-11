import test from 'node:test';
import assert from 'node:assert/strict';
import { tarotHand, tarotTotals, ranking } from '../js/tarot.js';

const P4 = ['a', 'b', 'c', 'd'];
const P5 = ['a', 'b', 'c', 'd', 'e'];
const P3 = ['a', 'b', 'c'];
const sum = (o) => Object.values(o).reduce((s, x) => s + x, 0);

test('exemple : garde à 4, 2 bouts, 47 points', () => {
  const r = tarotHand({ taker: 'a', contract: 'garde', bouts: 2, attackPoints: 47 }, P4);
  assert.equal(r.made, true);
  assert.equal(r.D, 62);                 // (25 + 6) × 2
  assert.deepEqual(r.deltas, { a: 186, b: -62, c: -62, d: -62 });
  assert.equal(sum(r.deltas), 0);
});

test('chute : petite à 3, 1 bout, 45 points', () => {
  const r = tarotHand({ taker: 'b', contract: 'petite', bouts: 1, attackPoints: 45 }, P3);
  assert.equal(r.made, false);
  assert.equal(r.D, -31);                // −(25 + 6) × 1
  assert.deepEqual(r.deltas, { a: 31, b: -62, c: 31 });
});

test('demi-point : écart arrondi au point supérieur', () => {
  const r = tarotHand({ taker: 'a', contract: 'petite', bouts: 2, attackPoints: 40.5 }, P4);
  assert.equal(r.made, false);           // 40,5 < 41
  assert.equal(r.D, -26);                // −(25 + 1)
});

test('5 joueurs : appelé et preneur seul', () => {
  let r = tarotHand({ taker: 'a', called: 'c', contract: 'garde', bouts: 2, attackPoints: 47 }, P5);
  assert.deepEqual(r.deltas, { a: 124, b: -62, c: 62, d: -62, e: -62 });
  r = tarotHand({ taker: 'a', called: 'a', contract: 'garde', bouts: 2, attackPoints: 47 }, P5);
  assert.deepEqual(r.deltas, { a: 248, b: -62, c: -62, d: -62, e: -62 });
  assert.equal(r.partner, null);
});

test('petit au bout : multiplié par le contrat, au bon camp', () => {
  // garde sans (×4), 1 bout, 55 points → +(25+4)×4 = 116 ; petit au bout attaque +40
  let r = tarotHand({ taker: 'a', contract: 'gardeSans', bouts: 1, attackPoints: 55, pabBy: 'a' }, P4);
  assert.equal(r.D, 156);
  // petit au bout de la défense : −40
  r = tarotHand({ taker: 'a', contract: 'gardeSans', bouts: 1, attackPoints: 55, pabBy: 'b' }, P4);
  assert.equal(r.D, 76);
  // petit du preneur pris au dernier pli : prime à la défense
  r = tarotHand({ taker: 'a', contract: 'gardeSans', bouts: 1, attackPoints: 55, pabBy: 'a', pabLost: true }, P4);
  assert.equal(r.D, 76);
  // option : prime fixe de 10
  r = tarotHand({ taker: 'a', contract: 'gardeSans', bouts: 1, attackPoints: 55, pabBy: 'a' }, P4, { pabTimesK: false });
  assert.equal(r.D, 126);
});

test('poignée au camp gagnant, chelem', () => {
  // le défenseur b montre une simple (20) mais l'attaque gagne : +20 pour l'attaque
  let r = tarotHand({ taker: 'a', contract: 'petite', bouts: 3, attackPoints: 40, poignees: [{ by: 'b', type: 'simple' }] }, P4);
  assert.equal(r.D, 25 + 4 + 20);
  // chute avec poignée double du preneur : −30 en plus
  r = tarotHand({ taker: 'a', contract: 'petite', bouts: 0, attackPoints: 50, poignees: [{ by: 'a', type: 'double' }] }, P4);
  assert.equal(r.D, -(25 + 6) - 30);
  // chelem annoncé réussi : garde, 3 bouts, 91 points → (25+55)×2 + 400
  r = tarotHand({ taker: 'a', contract: 'garde', bouts: 3, attackPoints: 91, chelem: 'announcedMade' }, P4);
  assert.equal(r.D, 560);
  r = tarotHand({ taker: 'a', contract: 'garde', bouts: 3, attackPoints: 80, chelem: 'announcedFailed' }, P4);
  assert.equal(r.D, (25 + 44) * 2 - 200);
});

test('misère : 10 points de chaque autre joueur', () => {
  const r = tarotHand({ taker: 'a', contract: 'petite', bouts: 1, attackPoints: 51, miseres: ['c'] }, P4, { miseres: true });
  assert.deepEqual(r.deltas, { a: 75 - 10, b: -25 - 10, c: -25 + 30, d: -25 - 10 });
  assert.equal(sum(r.deltas), 0);
});

test('totaux, fin au nombre de donnes, classement ex aequo', () => {
  const game = { players: P4, rules: { mode: 'hands', nHands: 2 } };
  const hands = [
    { taker: 'a', contract: 'petite', bouts: 1, attackPoints: 51 },   // a +75
    { passed: true },
    { taker: 'b', contract: 'petite', bouts: 1, attackPoints: 51 },   // b +75
  ];
  const t = tarotTotals(game, hands);
  assert.deepEqual(t.totals, { a: 50, b: 50, c: -50, d: -50 });
  assert.equal(t.played, 2);
  assert.equal(t.finished, true);
  assert.deepEqual(t.rank, { a: 1, b: 1, c: 3, d: 3 });
  assert.equal(tarotTotals({ ...game, rules: { mode: 'free' } }, hands).finished, false);
  assert.deepEqual(ranking({ x: 3, y: 5, z: 1 }, ['x', 'y', 'z']).order, ['y', 'x', 'z']);
});

test('statistiques tarot', async () => {
  const { computeTarotStats, tarotTimeline } = await import('../js/tarot-stats.js');
  const players = P5.map((id) => ({ id, name: id }));
  const g1 = { id: 'g1', type: 'tarot', players: P5, rules: { mode: 'hands', nHands: 3 }, startedAt: 1 };
  const hands = [
    // a garde, appelle c, réussi : a +124, c +62
    { gameId: 'g1', idx: 0, taker: 'a', called: 'c', contract: 'garde', bouts: 2, attackPoints: 47, pabBy: 'c' },
    // b petite, s'appelle lui-même, chute
    { gameId: 'g1', idx: 1, taker: 'b', called: 'b', contract: 'petite', bouts: 1, attackPoints: 40 },
    // a petite, appelle c, réussi
    { gameId: 'g1', idx: 2, taker: 'a', called: 'c', contract: 'petite', bouts: 1, attackPoints: 51, poignees: [{ by: 'd', type: 'simple' }] },
  ];
  const S = computeTarotStats(players, [g1], hands);
  const a = S.get('a'), b = S.get('b'), c = S.get('c'), d = S.get('d');
  assert.deepEqual([a.takes, a.takesMade, a.byContract.garde.made, a.byContract.petite.takes], [2, 2, 1, 1]);
  assert.equal(a.avgBouts, 1.5);
  assert.deepEqual([c.called, c.calledMade, c.calledPct], [2, 2, 100]);
  assert.equal(b.selfCalls, 1);
  assert.equal(c.pabMade, 1);
  assert.equal(d.poignees, 1);
  assert.equal(a.bestPartner.id, 'c');
  assert.equal(a.games, 1);
  assert.equal(a.wins, 1);                 // a est 1er
  assert.equal(a.avgRank, 1);
  assert.equal(d.defensePct, 100 / 3);     // 1 chute sur 3 défenses
  const tl = tarotTimeline(players, [g1], hands);
  assert.equal(tl.points.length, 1);
  assert.equal(tl.series.a[0].winPct, 100);
  assert.equal(tl.series.c[0].calledPct, 100);
});
