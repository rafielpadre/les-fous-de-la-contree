import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, computeDuos, gameStats } from '../js/stats.js';

const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));
const rules = { target: 300 };
const games = [
  { id: 'g1', teams: [['a', 'b'], ['c', 'd']], rules, startedAt: 1, finishedAt: 2 },
  { id: 'g2', teams: [['a', 'c'], ['b', 'd']], rules, startedAt: 3, finishedAt: 4 },
];
const hands = [
  // g1 : a prend 100, fait 104 → réussi 200|60 ; puis c prend 120 contré par a, chute → 280|0
  { gameId: 'g1', idx: 0, taker: 'a', bid: 100, suit: 'H', attackPoints: 104 },
  { gameId: 'g1', idx: 1, taker: 'c', bid: 120, suit: 'S', attackPoints: 80, coincheBy: 'a' },
  // → totaux g1 : 200+400=600 | 60 → a/b gagnent
  // g2 : b prend 80 cœur, belote b, fait 70 → 90 ≥ 80 réussi : 80+70+20=170 | 90
  { gameId: 'g2', idx: 0, taker: 'b', bid: 80, suit: 'H', attackPoints: 70, beloteBy: 'b' },
  { gameId: 'g2', idx: 1, taker: 'd', bid: 'capot', suit: 'C', capot: true },
  // d capot : 250+160 = 410 → b/d : 580 | a/c : 90 → b/d gagnent
];

test('stats individuelles', () => {
  const S = computeStats(players, games, hands, { minGamesForDuo: 1 });
  const a = S.get('a');
  assert.equal(a.games, 2);
  assert.equal(a.wins, 1);
  assert.equal(a.winPct, 50);
  assert.equal(a.takes, 1);
  assert.equal(a.takesMade, 1);
  assert.equal(a.avgPointsMade, 200);
  assert.equal(a.coinches, 1);
  assert.equal(a.coinchesWon, 1);
  const b = S.get('b');
  assert.equal(b.wins, 2);
  assert.equal(b.belotes, 1);
  assert.equal(b.avgPointsMade, 170);
  assert.equal(b.streak, 2);
  const d = S.get('d');
  assert.equal(d.capots, 1);
  assert.equal(d.capotsAnnounced, 1);
  assert.equal(d.avgBid, null);           // capot exclu de l'annonce moyenne
  const c = S.get('c');
  assert.equal(c.takesFailed, 1);
  assert.equal(c.takeFailPct, 100);
  assert.equal(b.bestPartner.id === 'a' || b.bestPartner.id === 'd', true);
});

test('duos', () => {
  const duos = computeDuos(games, hands);
  const ab = duos.find((d) => d.ids.join() === 'a,b');
  assert.equal(ab.wins, 1);
  assert.equal(duos.length, 4);
});

test('stats de partie', () => {
  const gs = gameStats(games[0], hands.filter((h) => h.gameId === 'g1'));
  assert.equal(gs.a.takes, 1);
  assert.equal(gs.a.coinchesWon, 1);
  assert.equal(gs.c.made, 0);
});

test('évolution : la dernière photo = stats des parties terminées', async () => {
  const { timeline } = await import('../js/stats.js');
  const tl = timeline(players, games, hands);
  assert.equal(tl.points.length, 2);
  assert.equal(tl.series.a[0].winPct, 100);      // a gagne g1
  assert.equal(tl.series.a[1].winPct, 50);       // puis perd g2
  assert.equal(tl.series.b[1].belotes, 1);
  assert.equal(tl.series.d[0].takes, 0);
  assert.equal(tl.series.d[1].capots, 1);
  const S = computeStats(players, games, hands);
  for (const id of ['a', 'b', 'c', 'd']) {
    assert.equal(tl.series[id][1].winPct, S.get(id).winPct);
    assert.equal(tl.series[id][1].takePct, S.get(id).takeMadePct);
  }
});
