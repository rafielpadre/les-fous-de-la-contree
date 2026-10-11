// Données de démonstration (mode local) : 6 joueurs, une douzaine de parties.
import { gameTotals, DEFAULT_RULES } from './scoring.js';
import { tarotTotals, OBJECTIVES, DEFAULT_TAROT_RULES } from './tarot.js';

export function buildDemo(uuid, opts = {}) {
  const o = {
    names: ['Rafael', 'Camille', 'Hugo', 'Léa', 'Malik', 'Inès'],
    skill: [0.62, 0.55, 0.5, 0.58, 0.45, 0.52],
    seed: 7, seed2: 42, nContree: 13, nTarot: 11, groupName: 'Démo des Fous', persons: {},
    ...opts,
  };
  let seed = o.seed;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  const names = o.names;
  const skill = o.skill; // propension à réussir ses contrats
  const now = Date.now();
  const records = {};
  const add = (kind, data, id = uuid()) => {
    records[id] = { id, kind, data, deleted: false, ts: now };
    return id;
  };
  const pids = names.map((name) => add('player', { name, photo: null, personId: o.persons[name] || null, createdAt: now - 60 * 864e5 }));
  const sk = Object.fromEntries(pids.map((id, i) => [id, skill[i]]));

  const rules = { ...DEFAULT_RULES, target: 1000 };
  let t = now - 45 * 864e5;
  for (let gi = 0; gi < o.nContree; gi++) {
    const four = [...pids].sort(() => rnd() - 0.5).slice(0, 4);
    const teams = [[four[0], four[1]], [four[2], four[3]]];
    const gid = uuid();
    const hands = [];
    const running = gi === o.nContree - 1; // dernière partie en cours
    for (let hi = 0; hi < 40; hi++) {
      const all = teams.flat();
      const taker = pick(all);
      const bid = pick([80, 80, 90, 90, 100, 100, 110, 120, 130, 140, 160]);
      const suit = pick(['S', 'H', 'D', 'C', 'S', 'H', 'D', 'C', 'TA', 'SA']);
      const ti = teams[0].includes(taker) ? 0 : 1;
      const success = rnd() < sk[taker] + (bid <= 100 ? 0.2 : -0.05);
      const capot = success && rnd() < 0.05;
      let pts = success ? Math.min(162, bid + Math.floor(rnd() * 40) - 10) : Math.max(20, bid - 10 - Math.floor(rnd() * 50));
      if (!success) pts = Math.min(pts, bid - 21);
      const belote = suit !== 'SA' && rnd() < 0.35 ? pick(all) : null;
      const coinche = rnd() < 0.12 ? pick(teams[1 - ti]) : null;
      const h = {
        gameId: gid, idx: hi, taker, shared: bid >= 100 && rnd() < 0.3, bid, suit, attackPoints: Math.max(0, pts), capot,
        beloteBy: belote, coincheBy: coinche,
        surcoincheBy: coinche && rnd() < 0.2 ? pick(teams[ti]) : null,
        createdAt: t + hi * 4 * 60000,
      };
      hands.push(h);
      const res = gameTotals(hands, teams, rules);
      if (res.winner !== null || (running && hi >= 4)) break;
    }
    const res = gameTotals(hands, teams, rules);
    add('game', {
      teams, rules, startedAt: t,
      finishedAt: res.winner !== null ? t + hands.length * 4 * 60000 : null,
      winner: res.winner,
    }, gid);
    for (const h of hands) add('hand', h);
    t += 3 * 864e5 + Math.floor(rnd() * 864e5);
  }
  // ---- Tarot : une dizaine de parties à 4 et 5 joueurs (tirage indépendant)
  let seed2 = o.seed2;
  const r2 = () => ((seed2 = (seed2 * 48271) % 2147483647) / 2147483647);
  const pick2 = (arr) => arr[Math.floor(r2() * arr.length)];
  let t2 = now - 40 * 864e5;
  for (let gi = 0; gi < o.nTarot; gi++) {
    const n = Math.min(names.length, gi % 3 === 0 ? 5 : 4);
    const players = [...pids].sort(() => r2() - 0.5).slice(0, n);
    const running = gi === o.nTarot - 1;
    const rules = { ...DEFAULT_TAROT_RULES, mode: 'hands', nHands: 10 };
    const gid = uuid();
    const hands = [];
    let played = 0;
    for (let hi = 0; played < (running ? 4 : 10); hi++) {
      if (r2() < 0.06) { hands.push({ gameId: gid, idx: hi, passed: true, createdAt: t2 + hi * 5 * 60000 }); continue; }
      played++;
      const taker = pick2(players);
      const contract = pick2(['petite', 'petite', 'petite', 'garde', 'garde', 'garde', 'gardeSans', 'gardeContre']);
      const bouts = pick2([0, 1, 1, 1, 2, 2, 3]);
      const O = OBJECTIVES[bouts];
      const made = r2() < sk[taker] + 0.1;
      let pts = made ? O + Math.floor(r2() * 18) : O - 1 - Math.floor(r2() * 14);
      if (r2() < 0.3) pts += 0.5;
      pts = Math.max(0, Math.min(91, pts));
      const called = n === 5 ? (r2() < 0.12 ? taker : pick2(players.filter((x) => x !== taker))) : null;
      const h = { gameId: gid, idx: hi, taker, contract, called, bouts, attackPoints: pts, createdAt: t2 + hi * 5 * 60000 };
      if (r2() < 0.1) { h.pabBy = pick2(players); h.pabLost = r2() < 0.2; }
      if (r2() < 0.12) h.poignees = [{ by: pick2(players), type: pick2(['simple', 'simple', 'double']) }];
      hands.push(h);
    }
    const res = tarotTotals({ players, rules }, hands);
    add('game', { type: 'tarot', players, rules, startedAt: t2, finishedAt: res.finished ? t2 + hands.length * 5 * 60000 : null, endedManually: false }, gid);
    for (const h of hands) add('hand', h);
    t2 += 3 * 864e5 + Math.floor(r2() * 864e5);
  }

  const groupId = uuid();
  records[groupId] = { id: groupId, kind: 'settings', data: { rules: { target: 1000 } }, deleted: false, ts: now };
  return {
    group: { id: groupId, code: 'LOCAL', name: o.groupName, local: true },
    records,
    dirty: [],
  };
}

/** Démo à deux groupes : Rafael et Léa jouent dans les deux (fiches reliées). */
export function buildDemoGroups(uuid) {
  const persons = { Rafael: uuid(), 'Léa': uuid() };
  const main = buildDemo(uuid, { persons });
  const cousins = buildDemo(uuid, {
    names: ['Rafael', 'Léa', 'Tom', 'Jade', 'Nora'],
    skill: [0.6, 0.55, 0.5, 0.48, 0.57],
    seed: 1234, seed2: 777, nContree: 7, nTarot: 6, groupName: 'Les cousins', persons,
  });
  return [main, cousins];
}
