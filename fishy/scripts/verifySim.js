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
const GR = require('../.verify/growth');
const COL = require('../.verify/collision');
const RUN = require('../.verify/run');

const PHONE = { w: 393, h: 852 };  // iPhone 15 logical portrait
const ARENA = { w: 40000, h: 40000 }; // unclamped, for measuring pure dynamics

/** Inverse of the growth curve, so a test can ask for a size and get a run
 * whose eaten count actually sustains it. Size is derived from fish eaten, so
 * setting it alone would just be eased back down to the starting size. */
function eatenForSize(size) {
  if (size <= C.PLAYER_START_SIZE) return 0;
  return C.APEX_EATEN * Math.pow(Math.log(size) / Math.log(C.APEX_SIZE), 1 / C.GROWTH_EXPONENT);
}

function newRun(size = C.PLAYER_START_SIZE, x = 0, y = 0) {
  const p = S.createPlayerState();
  S.resetPlayer(p, x, y, size);
  p[S.P_EATEN] = eatenForSize(size);
  p[S.P_SIZE] = size;
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

function newPond(seed = 1, eaten = 0) {
  const pool = S.createEnemyPool();
  const l = S.createLoopState();
  const p = S.createPlayerState();
  S.resetPlayer(p, PHONE.w / 2, PHONE.h / 2, GR.sizeForEaten(eaten));
  p[S.P_EATEN] = eaten;
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

// 20. Curve progress paces the three phases in fish eaten, not in size.
{
  const t0 = GR.curveProgress(0);
  const tMid = GR.curveProgress(C.APEX_EATEN / 2);
  const tApex = GR.curveProgress(C.APEX_EATEN);
  check('the three phases get equal thirds of a run',
    t0 === 0 && Math.abs(tMid - 0.5) < 1e-9 && Math.abs(tApex - 1) < 1e-9,
    `0 fish -> ${t0.toFixed(2)}, ${C.APEX_EATEN / 2} -> ${tMid.toFixed(2)}, ${C.APEX_EATEN} -> ${tApex.toFixed(2)}`);

  // Pinning the curve to size instead would race through the early phases.
  const sizeBased = Math.log(GR.sizeForEaten(10)) / Math.log(C.APEX_SIZE);
  check('pacing on fish eaten avoids the size-based front-load',
    GR.curveProgress(10) < 0.1 && sizeBased > 0.2,
    `after 10 fish: ${(GR.curveProgress(10) * 100).toFixed(0)}% by count vs ` +
    `${(sizeBased * 100).toFixed(0)}% had it been keyed on size`);
}

// 21. The pond stays equally busy at every point on the curve.
{
  const rows = [];
  let worst = 1;
  for (const eaten of [0, 30, C.APEX_EATEN / 2, 130, C.APEX_EATEN]) {
    const samples = [];
    for (const seed of [5, 17, 29]) {
      const pond = newPond(seed, eaten);
      E.seedPond(pond.pool, pond.l, pond.p, pond.rng, PHONE.w, PHONE.h);
      const pops = runPond(pond, 120);
      samples.push(...pops.slice(Math.floor(pops.length / 2)));
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const target = E.spawnTarget(eaten);
    worst = Math.min(worst, mean / target);
    rows.push(`${eaten}:${mean.toFixed(1)}/${target.toFixed(0)}`);
  }
  check('population holds its target from opening to apex', worst > 0.82,
    `eaten:actual/target  ${rows.join('  ')} (worst ${(worst * 100).toFixed(0)}% of target)`);
}

// ---------------------------------------------------------------------------
// Collision, eating, growth and death
// ---------------------------------------------------------------------------

const bodyOf = (x, y, len, facing) => ({
  cx: x + facing * G.BODY_OFFSET_X * len,
  cy: y,
  rx: G.BODY_RX * len,
  ry: G.BODY_RY * len,
});

// 22. Fins and tails are near misses, not hits.
{
  const len = 100;
  // Nose to tail, 85 px apart: the silhouettes overlap, the bodies do not.
  const tailGraze = COL.bodiesOverlap(0, 0, len, 1, 85, 0, len, 1);
  const silhouettesTouch = 85 < G.SILHOUETTE_HALF_W * len * 2;
  check('a clipped tail is not a hit', !tailGraze && silhouettesTouch,
    `85 px apart: bodies overlap=${tailGraze}, silhouettes overlap=${silhouettesTouch}`);

  // Stacked vertically so only the dorsal fins cross.
  const finGraze = COL.bodiesOverlap(0, 0, len, 1, 0, 50, len, 1);
  const finsTouch = 50 < G.SILHOUETTE_HALF_H * len * 2;
  check('a brushed dorsal fin is not a hit', !finGraze && finsTouch,
    `50 px apart: bodies overlap=${finGraze}, fins overlap=${finsTouch}`);

  check('a body-on-body hit still registers', COL.bodiesOverlap(0, 0, len, 1, 30, 0, len, 1),
    '30 px apart, squarely overlapping');
}

// 23. The summed-radii test really is exact, checked against brute force.
{
  const rng = RNG.createRng(1234);
  let disagreements = 0, tested = 0;
  for (let n = 0; n < 3000; n++) {
    const aLen = RNG.nextRange(rng, 20, 300), bLen = RNG.nextRange(rng, 20, 300);
    const ax = 0, ay = 0;
    const bx = RNG.nextRange(rng, -400, 400), by = RNG.nextRange(rng, -200, 200);
    const aFacing = RNG.nextFloat(rng) < 0.5 ? 1 : -1;
    const bFacing = RNG.nextFloat(rng) < 0.5 ? 1 : -1;
    const analytic = COL.bodiesOverlap(ax, ay, aLen, aFacing, bx, by, bLen, bFacing);

    // Brute force: does any point lie inside both ellipses?
    const A = bodyOf(ax, ay, aLen, aFacing), B = bodyOf(bx, by, bLen, bFacing);
    const inside = (E, x, y) => ((x - E.cx) / E.rx) ** 2 + ((y - E.cy) / E.ry) ** 2 <= 1;
    let brute = false;
    const steps = 260;
    for (let ix = 0; ix <= steps && !brute; ix++) {
      const x = A.cx - A.rx + (2 * A.rx * ix) / steps;
      for (let iy = 0; iy <= steps; iy++) {
        const y = A.cy - A.ry + (2 * A.ry * iy) / steps;
        if (inside(A, x, y) && inside(B, x, y)) { brute = true; break; }
      }
    }
    // Skip cases sitting on the boundary, where a finite grid cannot decide.
    const dx = (B.cx - A.cx) / (A.rx + B.rx), dy = (B.cy - A.cy) / (A.ry + B.ry);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(d - 1) < 0.02) continue;
    tested++;
    if (analytic !== brute) disagreements++;
  }
  check('summed-radii ellipse test matches brute force exactly', disagreements === 0,
    `${tested} random pairs, ${disagreements} disagreements`);
}

// 24. Eating removes the fish, counts it, scores it and grows the player.
{
  const pond = newPond(3);
  const p = pond.p;
  // One clearly edible fish placed right on the player.
  pond.pool[S.E_X] = p[S.P_X]; pond.pool[S.E_Y] = p[S.P_Y];
  pond.pool[S.E_SIZE] = p[S.P_SIZE] * 0.5; pond.pool[S.E_VX] = 10;
  pond.pool[S.E_TIER] = T.TIER_PREY_MEDIUM;
  pond.l[S.L_ENEMY_COUNT] = 1;

  const ate = COL.resolveCollisions(p, pond.pool, pond.l);
  check('eating removes the fish and counts it',
    ate === 1 && pond.l[S.L_ENEMY_COUNT] === 0 && p[S.P_EATEN] === 1 && p[S.P_SCORE] > 0,
    `ate=${ate}, pool=${pond.l[S.L_ENEMY_COUNT]}, eaten=${p[S.P_EATEN]}, score=${p[S.P_SCORE]}`);

  // Growth is eased in, not snapped on.
  const immediate = p[S.P_SIZE];
  const input = S.createInputState();
  for (let n = 0; n < Math.round(1 / C.SIM_DT); n++) stepPlayer(p, input, C.SIM_DT, PHONE.w, PHONE.h);
  check('growth eases in rather than popping',
    immediate === 1 && Math.abs(p[S.P_SIZE] - GR.sizeForEaten(1)) < 1e-3,
    `size ${immediate.toFixed(3)} at the instant of the bite, ` +
    `${p[S.P_SIZE].toFixed(3)} a second later, target ${GR.sizeForEaten(1).toFixed(3)}`);
}

// 25. Contact with anything bigger ends the run.
{
  const pond = newPond(4);
  const p = pond.p;
  pond.pool[S.E_X] = p[S.P_X]; pond.pool[S.E_Y] = p[S.P_Y];
  pond.pool[S.E_SIZE] = p[S.P_SIZE] * 1.4; pond.pool[S.E_VX] = -10;
  pond.pool[S.E_TIER] = T.TIER_PREDATOR_SMALL;
  pond.l[S.L_ENEMY_COUNT] = 1;
  COL.resolveCollisions(p, pond.pool, pond.l);
  check('a bigger fish kills on contact', p[S.P_ALIVE] === 0, `alive=${p[S.P_ALIVE]}`);
}

// 26. You cannot eat your way out of a predator you are already inside.
{
  const pond = newPond(5);
  const p = pond.p;
  pond.pool[S.E_X] = p[S.P_X]; pond.pool[S.E_Y] = p[S.P_Y];
  pond.pool[S.E_SIZE] = p[S.P_SIZE] * 0.4; pond.pool[S.E_VX] = 10;
  pond.pool[S.E_TIER] = T.TIER_PREY_SMALL;
  pond.pool[S.E_FIELDS + S.E_X] = p[S.P_X]; pond.pool[S.E_FIELDS + S.E_Y] = p[S.P_Y];
  pond.pool[S.E_FIELDS + S.E_SIZE] = p[S.P_SIZE] * 1.4; pond.pool[S.E_FIELDS + S.E_VX] = -10;
  pond.pool[S.E_FIELDS + S.E_TIER] = T.TIER_PREDATOR_SMALL;
  pond.l[S.L_ENEMY_COUNT] = 2;
  const ate = COL.resolveCollisions(p, pond.pool, pond.l);
  check('death beats eating in the same step',
    p[S.P_ALIVE] === 0 && ate === 0 && p[S.P_EATEN] === 0,
    `alive=${p[S.P_ALIVE]}, ate=${ate}`);
}

// 27. The growth curve hits both ends exactly and is concave throughout.
{
  const first = GR.sizeForEaten(1) / GR.sizeForEaten(0) - 1;
  const last = GR.sizeForEaten(C.APEX_EATEN) / GR.sizeForEaten(C.APEX_EATEN - 1) - 1;
  let concave = true;
  let prevGain = Infinity;
  for (let n = 1; n <= C.APEX_EATEN; n++) {
    const gain = GR.sizeForEaten(n) / GR.sizeForEaten(n - 1) - 1;
    if (gain > prevGain + 1e-12) concave = false;
    prevGain = gain;
  }
  check('growth curve starts at 1 and lands exactly on apex',
    GR.sizeForEaten(0) === C.PLAYER_START_SIZE && GR.sizeForEaten(C.APEX_EATEN) === C.APEX_SIZE,
    `${GR.sizeForEaten(0)} at 0 fish, ${GR.sizeForEaten(C.APEX_EATEN)} at ${C.APEX_EATEN}`);
  check('every bite is worth less than the one before it', concave,
    `first bite +${(first * 100).toFixed(1)}%, last bite +${(last * 100).toFixed(2)}%, ` +
    `a ${(first / last).toFixed(0)}x falloff`);
}

// 28. A bot that swims at the nearest edible fish finishes a run in the target
//     window. It is immortal and never dodges, so this is a floor on how long
//     skilled human play takes, not an estimate of it.
{
  const runToApex = (seed) => {
    const pond = newPond(seed);
    const input = S.createInputState();
    RUN.startRun(pond.p, pond.pool, pond.l, pond.rng, PHONE.w, PHONE.h);
    const p = pond.p;
    let steps = 0;
    const phaseMinutes = [0, 0, 0];
    const limit = Math.round((45 * 60) / C.SIM_DT);
    while (p[S.P_EATEN] < C.APEX_EATEN && steps < limit) {
      // Lead the target, the way a person does. Holding a finger on a fleeing
      // fish is a stern chase, and the arrival ramp means a stern chase settles
      // at a fixed distance and never closes: the bot has to aim where the fish
      // is going, and pick whichever fish it can intercept soonest.
      const vmax = C.BASE_MAX_SPEED * Math.pow(p[S.P_SIZE], C.SPEED_SIZE_EXPONENT);
      let bestT = Infinity, bx = p[S.P_X], by = p[S.P_Y];
      for (let i = 0; i < pond.l[S.L_ENEMY_COUNT]; i++) {
        const b = i * S.E_FIELDS;
        if (pond.pool[b + S.E_SIZE] >= p[S.P_SIZE]) continue;
        const ex = pond.pool[b + S.E_X], ey = pond.pool[b + S.E_Y], evx = pond.pool[b + S.E_VX];
        let t = Math.hypot(ex - p[S.P_X], ey - p[S.P_Y]) / vmax;
        for (let k = 0; k < 3; k++) {
          t = Math.hypot(ex + evx * t - p[S.P_X], ey - p[S.P_Y]) / vmax;
        }
        // Aim past the intercept so the arrival ramp does not stall the chase.
        const aimX = ex + evx * t * 1.6;
        if (aimX < -200 || aimX > PHONE.w + 200) continue;
        if (t < bestT) { bestT = t; bx = aimX; by = ey; }
      }
      input[S.I_TARGET_X] = bx; input[S.I_TARGET_Y] = by;
      input[S.I_ACTIVE] = bestT < Infinity ? 1 : 0;

      stepPlayer(p, input, C.SIM_DT, PHONE.w, PHONE.h);
      E.stepEnemies(pond.pool, pond.l, p[S.P_SIZE], C.SIM_DT, PHONE.w);
      E.stepSpawner(pond.pool, pond.l, p, pond.rng, C.SIM_DT, PHONE.w, PHONE.h);
      COL.resolveCollisions(p, pond.pool, pond.l);
      p[S.P_ALIVE] = 1; // immortal: this measures feeding rate, not dodging
      const t = GR.curveProgress(p[S.P_EATEN]);
      phaseMinutes[t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2] += C.SIM_DT / 60;
      steps++;
    }
    return {
      minutes: (steps * C.SIM_DT) / 60,
      eaten: p[S.P_EATEN],
      score: p[S.P_SCORE],
      phases: phaseMinutes,
    };
  };

  const runs = [7, 19, 33, 41, 55].map(runToApex);
  const times = runs.map((r) => r.minutes);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const spread = `${Math.min(...times).toFixed(1)} to ${Math.max(...times).toFixed(1)}`;
  const phases = [0, 1, 2].map(
    (i) => runs.reduce((a, r) => a + r.phases[i], 0) / runs.length,
  );
  const allFinished = runs.every((r) => r.eaten >= C.APEX_EATEN);

  check('a perfect feeder reaches apex, and not instantly', allFinished && mean > 3,
    `${runs.length} runs, ${spread} min, mean ${mean.toFixed(1)}, score ${Math.round(runs[0].score)}`);
  check('run length lands in the 8 to 12 minute target window',
    mean >= 8 && mean <= 12,
    `bot floor ${mean.toFixed(1)} min  (terror ${phases[0].toFixed(1)} / ` +
    `balance ${phases[1].toFixed(1)} / leviathan ${phases[2].toFixed(1)})`);
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
