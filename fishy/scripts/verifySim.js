/**
 * Headless verification of the movement model.
 *
 * The simulation is deliberately free of Skia, Reanimated and React: it is
 * plain arithmetic over Float32Arrays, so it can be run and measured on a
 * laptop without a device in the loop. That matters most for phase 5, where
 * tuning the difficulty curve means changing these constants repeatedly and
 * needing to know what actually changed.
 *
 * Run with: npm run verify
 */
const C = require('../.verify/constants');
const S = require('../.verify/state');
const { stepPlayer } = require('../.verify/physics');
const G = require('../.verify/fishGeometry');
const E = require('../.verify/enemies');
const T = require('../.verify/tiers');
const RNG = require('../.verify/rng');

const PHONE = { w: 393, h: 852 };  // iPhone 15 logical portrait
const ARENA = { w: 40000, h: 40000 }; // unclamped, for measuring pure dynamics

function newRun(size = C.PLAYER_START_SIZE, x = 0, y = 0) {
  const p = S.createPlayerState();
  S.resetPlayer(p, x, y, size);
  return { p, i: S.createInputState(), l: S.createLoopState() };
}

function advance(run, seconds, frameDt, world, onStep) {
  const frames = Math.round(seconds / frameDt);
  for (let f = 0; f < frames; f++) {
    let dt = Math.min(frameDt, C.MAX_FRAME_TIME);
    let acc = run.l[S.L_ACCUMULATOR] + dt;
    while (acc >= C.SIM_DT) {
      stepPlayer(run.p, run.i, C.SIM_DT, world.w, world.h);
      acc -= C.SIM_DT;
      if (onStep) onStep(run.p);
    }
    run.l[S.L_ACCUMULATOR] = acc;
    run.l[S.L_ALPHA] = acc / C.SIM_DT;
  }
}

const touch = (r, x, y) => { r.i[S.I_TARGET_X] = x; r.i[S.I_TARGET_Y] = y; r.i[S.I_ACTIVE] = 1; };
const release = (r) => { r.i[S.I_ACTIVE] = 0; };
const speed = (r) => Math.hypot(r.p[S.P_VX], r.p[S.P_VY]);

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

// 1. Top speed matches the tuning constant when the finger is held far away.
{
  const r = newRun(1, 0, 0);
  touch(r, 0, 1e6);
  let peak = 0;
  advance(r, 4, 1 / 60, ARENA, (p) => { peak = Math.max(peak, Math.abs(p[S.P_VY])); });
  check('top speed reaches BASE_MAX_SPEED', Math.abs(peak - C.BASE_MAX_SPEED) < 2,
    `${peak.toFixed(1)} px/s vs ${C.BASE_MAX_SPEED}`);
}

// 2 & 3. Coast on release, at start size and at apex size.
for (const size of [1, 12]) {
  const r = newRun(size, 0, 0);
  touch(r, 0, 1e6);
  advance(r, 8, 1 / 60, ARENA);
  const y0 = r.p[S.P_Y];
  release(r);
  advance(r, 20, 1 / 60, ARENA);
  const bl = (r.p[S.P_Y] - y0) / (C.PLAYER_BASE_LENGTH_PX * size);
  check(`coast distance at size ${size}`, Math.abs(bl - C.COAST_BODY_LENGTHS) < 0.02,
    `${bl.toFixed(3)} BL vs ${C.COAST_BODY_LENGTHS} (size invariant)`);
}

// 4. Approach overshoot stays small, and the fish settles on the finger.
{
  const r = newRun(1, 0, 0);
  const ty = 600;
  touch(r, 0, ty);
  let maxY = 0;
  advance(r, 12, 1 / 60, ARENA, (p) => { maxY = Math.max(maxY, p[S.P_Y]); });
  const overshootPct = ((maxY - ty) / ty) * 100;
  check('overshoot stays under 3% of the approach', overshootPct >= 0 && overshootPct < 3,
    `${overshootPct.toFixed(2)}% (${(maxY - ty).toFixed(1)} px past a ${ty} px move)`);
  check('settles on the finger', Math.abs(r.p[S.P_Y] - ty) < 0.5 && speed(r) < 0.5,
    `${Math.abs(r.p[S.P_Y] - ty).toFixed(3)} px away, ${speed(r).toFixed(3)} px/s`);
}

// 5. Heading follows travel and survives the settle without flipping.
{
  const r = newRun(1, PHONE.w / 2, PHONE.h / 2);
  touch(r, PHONE.w - 20, PHONE.h / 2);
  advance(r, 3, 1 / 60, PHONE);
  const right = r.p[S.P_FACING];
  check('faces right when swimming right, and stays facing right once settled',
    right === 1, `facing=${right}, v=${speed(r).toFixed(3)}`);

  touch(r, 20, PHONE.h / 2);
  advance(r, 3, 1 / 60, PHONE);
  const left = r.p[S.P_FACING];
  check('flips to face left when swimming left', left === -1,
    `facing=${left}`);

  release(r);
  advance(r, 5, 1 / 60, PHONE);
  check('holds its heading while drifting to a stop', r.p[S.P_FACING] === -1,
    `facing=${r.p[S.P_FACING]}, v=${speed(r).toFixed(3)}`);
}

// 6. Frame rate independence.
{
  const run = (frameDt) => {
    const r = newRun(1, PHONE.w / 2, PHONE.h / 2);
    touch(r, 40, 700);
    advance(r, 4, frameDt, PHONE);
    release(r);
    advance(r, 2, frameDt, PHONE);
    return r.p;
  };
  const a = run(1 / 60);
  for (const [label, dt, tol] of [['120Hz', 1 / 120, 0.01], ['37Hz', 1 / 37, 1.5], ['24Hz', 1 / 24, 3]]) {
    const b = run(dt);
    const drift = Math.hypot(a[S.P_X] - b[S.P_X], a[S.P_Y] - b[S.P_Y]);
    check(`60Hz and ${label} agree`, drift < tol, `${drift.toFixed(4)} px apart`);
  }
}

// 7. The silhouette stays inside the pond, and does not buzz against a wall.
{
  const r = newRun(1, PHONE.w / 2, PHONE.h / 2);
  touch(r, -500, -500);
  advance(r, 8, 1 / 60, PHONE);
  const len = C.PLAYER_BASE_LENGTH_PX * r.p[S.P_SIZE];
  const halfW = G.SILHOUETTE_HALF_W * len, halfH = G.SILHOUETTE_HALF_H * len;
  check('whole silhouette stays inside the pond',
    r.p[S.P_X] >= halfW - 1e-3 && r.p[S.P_Y] >= halfH - 1e-3,
    `x=${r.p[S.P_X].toFixed(2)} (min ${halfW.toFixed(2)}), y=${r.p[S.P_Y].toFixed(2)} (min ${halfH.toFixed(2)})`);
  check('no buzz while held past the wall',
    Math.abs(r.p[S.P_VX]) < 1 && Math.abs(r.p[S.P_VY]) < 1,
    `v=(${r.p[S.P_VX].toFixed(3)}, ${r.p[S.P_VY].toFixed(3)})`);
}

// 8. A hard wall hit bounces rather than sticking.
{
  const r = newRun(1, PHONE.w / 2, 40);
  touch(r, PHONE.w / 2, 1e6);       // drive into the floor at full speed
  let minVy = 0;
  advance(r, 6, 1 / 60, PHONE, (p) => { minVy = Math.min(minVy, p[S.P_VY]); });
  const impact = C.BASE_MAX_SPEED * C.EDGE_RESTITUTION;
  check('bounces off a wall hit at speed', minVy < -impact * 0.5,
    `rebound peak ${minVy.toFixed(1)} px/s (restitution predicts about -${impact.toFixed(0)})`);
}

// 9. Tail phase stays wrapped across a long run.
{
  const r = newRun(1, PHONE.w / 2, PHONE.h / 2);
  touch(r, PHONE.w / 2, PHONE.h);
  advance(r, 900, 1 / 60, PHONE);
  const ph = r.p[S.P_TAIL_PHASE];
  check('tail phase stays wrapped over 15 min', ph >= 0 && ph <= Math.PI * 2 + 1e-6,
    `phase=${ph.toFixed(4)} rad`);
}

// 10. A long stall is truncated, not replayed.
{
  const r = newRun(1, PHONE.w / 2, 20);
  touch(r, PHONE.w / 2, 1e6);
  const before = r.p[S.P_Y];
  advance(r, 5, 5, PHONE);
  const moved = r.p[S.P_Y] - before;
  const cap = C.BASE_MAX_SPEED * C.MAX_FRAME_TIME + 1;
  check('a 5 s stall advances at most MAX_FRAME_TIME of motion', moved <= cap,
    `moved ${moved.toFixed(1)} px, cap ${cap.toFixed(1)} px`);
}


// ---------------------------------------------------------------------------
// Enemy pool and spawner
// ---------------------------------------------------------------------------

function newPond(seed = 1, playerSize = 1) {
  const pool = S.createEnemyPool();
  const l = S.createLoopState();
  const p = S.createPlayerState();
  S.resetPlayer(p, PHONE.w / 2, PHONE.h / 2, playerSize);
  return { pool, l, p, rng: RNG.createRng(seed) };
}

function runPond(pond, seconds, { spawn = true } = {}) {
  const steps = Math.round(seconds / C.SIM_DT);
  const populations = [];
  for (let n = 0; n < steps; n++) {
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, PHONE.w);
    if (spawn) E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, PHONE.w, PHONE.h);
    populations.push(pond.l[S.L_ENEMY_COUNT]);
  }
  return populations;
}

const liveYs = (pond) => {
  const out = [];
  for (let i = 0; i < pond.l[S.L_ENEMY_COUNT]; i++) out.push(pond.pool[i * S.E_FIELDS + S.E_Y]);
  return out;
};

// 11. The pool cap is never exceeded, and the pond stays populated.
{
  const pond = newPond(7);
  E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
  const pops = runPond(pond, 180);
  const peak = Math.max(...pops);
  const settled = pops.slice(Math.floor(pops.length / 2));
  const mean = settled.reduce((a, b) => a + b, 0) / settled.length;
  const min = Math.min(...settled);
  check('never exceeds MAX_FISH', peak <= C.MAX_FISH, `peak ${peak} of ${C.MAX_FISH}`);
  check('pond stays populated and never empties', min >= 3,
    `steady mean ${mean.toFixed(1)}, low-water ${min}`);
  check('population is not pinned at the cap', mean < C.MAX_FISH - 2,
    `mean ${mean.toFixed(1)} vs cap ${C.MAX_FISH}`);
}

// 12. Every fish eventually leaves, and the pool drains cleanly.
{
  const pond = newPond(11);
  E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
  runPond(pond, 60, { spawn: false });
  check('all fish despawn once they cross the pond', pond.l[S.L_ENEMY_COUNT] === 0,
    `${pond.l[S.L_ENEMY_COUNT]} still live after 60 s with spawning off`);
}

// 13. Swap-remove neither loses nor duplicates a fish.
{
  const pond = newPond(23);
  E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
  const before = liveYs(pond);
  let ok = true, detail = 'set stayed consistent';
  for (let n = 0; n < 4000 && ok; n++) {
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, PHONE.w);
    const now = liveYs(pond);
    if (new Set(now).size !== now.length) { ok = false; detail = `duplicate slot at step ${n}`; }
    for (const y of now) if (!before.includes(y)) { ok = false; detail = `unknown fish at step ${n}`; }
  }
  check('swap-remove keeps the pool consistent', ok, detail);
}

// 14. Edge spawns are fully off screen, so they cannot land on the player.
{
  const pond = newPond(31);
  let worst = Infinity;
  for (let n = 0; n < 500; n++) {
    pond.l[S.L_ENEMY_COUNT] = 0;
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
    const half = G.SILHOUETTE_HALF_W * pond.pool[S.E_SIZE] * C.PLAYER_BASE_LENGTH_PX;
    const x = pond.pool[S.E_X];
    worst = Math.min(worst, Math.max(-(x + half), x - half - PHONE.w));
  }
  check('every edge spawn starts fully off screen', worst >= -1e-3,
    `closest spawn was ${worst.toFixed(2)} px outside the pond`);
}

// 15. A seeded predator never opens on top of the player.
{
  let violations = 0, checked = 0, closest = Infinity;
  for (let seed = 1; seed <= 300; seed++) {
    const pond = newPond(seed);
    E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
    const playerLength = pond.p[S.P_SIZE] * C.PLAYER_BASE_LENGTH_PX;
    for (let i = 0; i < pond.l[S.L_ENEMY_COUNT]; i++) {
      const b = i * S.E_FIELDS;
      if (pond.pool[b + S.E_TIER] < T.FIRST_PREDATOR_TIER) continue;
      checked++;
      const len = pond.pool[b + S.E_SIZE] * C.PLAYER_BASE_LENGTH_PX;
      const clearance = G.SILHOUETTE_HALF_W * len + G.SILHOUETTE_HALF_W * playerLength +
        C.SEED_PREDATOR_CLEARANCE * playerLength;
      const dx = Math.abs(pond.pool[b + S.E_X] - pond.p[S.P_X]);
      const dy = Math.abs(pond.pool[b + S.E_Y] - pond.p[S.P_Y]);
      const outside = dx >= clearance || dy >= clearance ||
        pond.pool[b + S.E_X] + G.SILHOUETTE_HALF_W * len <= 0 ||
        pond.pool[b + S.E_X] - G.SILHOUETTE_HALF_W * len >= PHONE.w;
      if (!outside) violations++;
      closest = Math.min(closest, Math.max(dx, dy) / clearance);
    }
  }
  check('no seeded predator opens inside the safe box', violations === 0,
    `${checked} predators over 300 seeded ponds, ${violations} too close ` +
    `(tightest was ${(closest * 100).toFixed(0)}% of the required clearance)`);
}

// 16. Every fish spawns with its whole silhouette in the vertical play area.
{
  const pond = newPond(41);
  let ok = true, detail = 'all within bounds';
  for (let n = 0; n < 800; n++) {
    pond.l[S.L_ENEMY_COUNT] = 0;
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
    const len = pond.pool[S.E_SIZE] * C.PLAYER_BASE_LENGTH_PX;
    const halfH = G.SILHOUETTE_HALF_H * len;
    const y = pond.pool[S.E_Y];
    if (halfH * 2 < PHONE.h && (y < halfH - 1e-3 || y > PHONE.h - halfH + 1e-3)) {
      ok = false; detail = `y=${y.toFixed(1)} with halfH=${halfH.toFixed(1)}`;
    }
  }
  check('spawn keeps the whole fish vertically on screen', ok, detail);
}

// 17. Small fish are fast, big fish are slow, and none outruns the player.
{
  const pond = newPond(53);
  const sum = new Array(T.TIER_COUNT).fill(0), n = new Array(T.TIER_COUNT).fill(0);
  for (let i = 0; i < 4000; i++) {
    pond.l[S.L_ENEMY_COUNT] = 0;
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
    const tier = pond.pool[S.E_TIER];
    sum[tier] += Math.abs(pond.pool[S.E_VX]); n[tier]++;
  }
  const mean = sum.map((s, i) => (n[i] ? s / n[i] : 0));
  let monotonic = true;
  for (let i = 1; i < T.TIER_COUNT; i++) if (mean[i] >= mean[i - 1]) monotonic = false;
  check('speed falls monotonically as tier size rises', monotonic,
    mean.map((m) => m.toFixed(0)).join(' > ') + ' px/s');
  const playerTop = C.BASE_MAX_SPEED;
  check('nothing can outrun the player', Math.max(...mean) < playerTop,
    `fastest tier ${Math.max(...mean).toFixed(0)} px/s vs player ${playerTop}`);
}

// 18. The mix really does shift across the three phases.
{
  const rng = RNG.createRng(67);
  const sample = (t) => {
    const counts = new Array(T.TIER_COUNT).fill(0);
    for (let i = 0; i < 40000; i++) counts[T.pickTier(rng, t)]++;
    return counts.map((c) => (c / 40000) * 100);
  };
  const terror = sample(0), balance = sample(0.5), leviathan = sample(1);
  const pred = (m) => m[T.TIER_PREDATOR_SMALL] + m[T.TIER_PREDATOR_LARGE];
  const prey = (m) => m[T.TIER_PREY_SMALL] + m[T.TIER_PREY_MEDIUM];

  check('terror is predator heavy', pred(terror) > 60,
    `${pred(terror).toFixed(1)}% predators at the start of a run`);
  check('threat falls monotonically as you grow',
    pred(terror) > pred(balance) && pred(balance) > pred(leviathan),
    `${pred(terror).toFixed(1)}% -> ${pred(balance).toFixed(1)}% -> ${pred(leviathan).toFixed(1)}%`);
  check('nothing can eat a leviathan', pred(leviathan) === 0,
    `${pred(leviathan).toFixed(1)}% predators at apex`);
  check('the pond is never all prey nor all predators mid-run',
    prey(terror) > 5 && pred(balance) > 10 && prey(balance) > 10,
    `terror ${prey(terror).toFixed(0)}% prey, balance ${pred(balance).toFixed(0)}% predator / ` +
    `${prey(balance).toFixed(0)}% prey`);
}

// 19. The spawner is reproducible from its seed.
{
  const run = () => {
    const pond = newPond(97);
    E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
    runPond(pond, 45);
    return Array.from(pond.pool);
  };
  const a = run(), b = run();
  check('same seed reproduces the same pond', a.every((v, i) => v === b[i]),
    'two 45 s runs matched slot for slot');
}

// 20. Curve progress lands the three phases where they are meant to.
{
  const t1 = E.curveProgress(1);
  const tMid = E.curveProgress(Math.sqrt(C.APEX_SIZE));
  const tApex = E.curveProgress(C.APEX_SIZE);
  check('curve progress spans 0 to 1 in log space',
    t1 === 0 && Math.abs(tMid - 0.5) < 1e-6 && Math.abs(tApex - 1) < 1e-6,
    `size 1 -> ${t1.toFixed(2)}, size ${Math.sqrt(C.APEX_SIZE).toFixed(2)} -> ${tMid.toFixed(2)}, size ${C.APEX_SIZE} -> ${tApex.toFixed(2)}`);
}

// 21. The pond stays equally busy at every point on the curve.
{
  const rows = [];
  let worst = 1;
  for (const size of [1, 2, Math.sqrt(C.APEX_SIZE), 6, C.APEX_SIZE]) {
    const samples = [];
    for (const seed of [5, 17, 29]) {
      const pond = newPond(seed, size);
      E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
      const pops = runPond(pond, 120);
      samples.push(...pops.slice(Math.floor(pops.length / 2)));
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const target = E.spawnTarget(size);
    worst = Math.min(worst, mean / target);
    rows.push(`${size.toFixed(1)}:${mean.toFixed(1)}/${target.toFixed(0)}`);
  }
  check('population holds its target from opening to apex', worst > 0.82,
    `size:actual/target  ${rows.join('  ')} (worst ${(worst * 100).toFixed(0)}% of target)`);
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
