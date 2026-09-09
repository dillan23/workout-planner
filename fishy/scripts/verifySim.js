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
 *
 * Paths mirror src/ because the compile sets an explicit rootDir. It used to
 * infer one, which silently changed the output layout the moment a file outside
 * src/game joined the list, and the stale flat copies left behind kept
 * resolving for days. The script now wipes its output directory first.
 */
const C = require('../.verify/game/constants');
const S = require('../.verify/game/state');
const { stepPlayer } = require('../.verify/game/physics');
const G = require('../.verify/game/fishGeometry');
const E = require('../.verify/game/enemies');
const T = require('../.verify/game/tiers');
const RNG = require('../.verify/game/rng');
const GR = require('../.verify/game/growth');
const COL = require('../.verify/game/collision');
const RUN = require('../.verify/game/run');
const W = require('../.verify/game/world');

const PHONE = { w: 393, h: 852 };  // iPhone 15 logical portrait
const ARENA = { w: 40000, h: 40000 }; // unclamped, for measuring pure dynamics

/**
 * The world is wider and taller than the screen, so most enemy functions now
 * take a viewport rather than a screen size. A camera centred on a player who
 * happens to be sitting at exactly half the screen's width and height clamps
 * to (0, 0): half the screen minus half the screen is zero, and zero needs no
 * clamping since the world is bigger in every direction. So for every test
 * below that never moves its player away from `newPond`'s default position
 * (PHONE.w/2, PHONE.h/2), the viewport is exactly the old screen rectangle,
 * and VIEW is that fixed identity rather than something recomputed per test.
 */
const VIEW = { l: 0, r: PHONE.w, t: 0, b: PHONE.h };

/** For the tests where the player actually moves: the same computation
 * production runs, writing into the same kind of loop buffer, so a test's
 * viewport can never drift from what the real camera would show. */
function viewportFor(loop, px, py, screenW = PHONE.w, screenH = PHONE.h) {
  W.computeWorldSize(loop, screenW, screenH);
  W.computeCamera(loop, px, py, screenW, screenH);
  const camX = loop[S.L_CAMERA_X], camY = loop[S.L_CAMERA_Y];
  return { l: camX, r: camX + screenW, t: camY, b: camY + screenH };
}

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
for (const size of [1, C.APEX_SIZE]) {
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
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, VIEW.l, VIEW.r);
    if (spawn) E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
    populations.push(pond.l[S.L_ENEMY_COUNT]);
  }
  return populations;
}

// Each fish's identity for the swap-remove test below. E_Y no longer works for
// this: a jellyfish's Y bobs every step, so it is not a stable fingerprint the
// way it was when every fish swam at a fixed depth. E_BASE_Y is written once
// at spawn for every kind and never mutated afterward, so it still is.
const liveIdentities = (pond) => {
  const out = [];
  for (let i = 0; i < pond.l[S.L_ENEMY_COUNT]; i++) out.push(pond.pool[i * S.E_FIELDS + S.E_BASE_Y]);
  return out;
};

// 11. The pool cap is never exceeded, and the pond stays populated.
{
  const pond = newPond(7);
  E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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
  E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
  runPond(pond, 60, { spawn: false });
  check('all fish despawn once they cross the pond', pond.l[S.L_ENEMY_COUNT] === 0,
    `${pond.l[S.L_ENEMY_COUNT]} still live after 60 s with spawning off`);
}

// 13. Swap-remove neither loses nor duplicates a fish.
{
  const pond = newPond(23);
  E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
  const before = liveIdentities(pond);
  let ok = true, detail = 'set stayed consistent';
  for (let n = 0; n < 4000 && ok; n++) {
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, VIEW.l, VIEW.r);
    const now = liveIdentities(pond);
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
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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
    E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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

// 18. The pond the player actually swims in delivers the three phases.
//     Measured from live ponds rather than from the weight table, because what
//     matters is how many fish on screen can eat you, not what the odds said.
{
  const composition = (progress) => {
    const eaten = Math.round(progress * C.APEX_EATEN);
    let lethal = 0, close = 0, total = 0, snaps = 0, lethalSeen = 0;
    for (const seed of [3, 9, 15]) {
      const pond = newPond(seed, eaten);
      const size = pond.p[S.P_SIZE];
      E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
      const steps = Math.round(60 / C.SIM_DT);
      for (let n = 0; n < steps; n++) {
        E.stepEnemies(pond.pool, pond.l, size, C.SIM_DT, VIEW.l, VIEW.r);
        E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
        if (n % Math.round(0.5 / C.SIM_DT)) continue;
        snaps++;
        for (let i = 0; i < pond.l[S.L_ENEMY_COUNT]; i++) {
          const rel = pond.pool[i * S.E_FIELDS + S.E_SIZE] / size;
          total++;
          if (rel >= 1) { lethal++; lethalSeen++; }
          if (rel >= 0.7 && rel <= 1.4) close++;
        }
      }
    }
    return {
      lethalShare: (lethal / total) * 100,
      closeShare: (close / total) * 100,
      lethalOnScreen: lethalSeen / snaps,
      onScreen: total / snaps,
    };
  };

  const terror = composition(0.02);
  const balance = composition(0.5);
  const leviathan = composition(0.85);

  check('terror: almost everything in the pond can eat you',
    terror.lethalShare > 60,
    `${terror.lethalShare.toFixed(0)}% of the pond is lethal ` +
    `(${terror.lethalOnScreen.toFixed(1)} of ${terror.onScreen.toFixed(1)} fish on screen)`);

  check('balance: genuine risk, and most fish near your own size',
    balance.lethalShare > 20 && balance.lethalShare < 55 && balance.closeShare > 50,
    `${balance.lethalShare.toFixed(0)}% lethal, ${balance.closeShare.toFixed(0)}% within 0.7x to 1.4x`);

  check('leviathan: nothing in the pond can eat you',
    leviathan.lethalShare === 0,
    `${leviathan.lethalOnScreen.toFixed(2)} lethal fish on screen across 3 minutes of pond`);

  check('threat falls away monotonically across the run',
    terror.lethalShare > balance.lethalShare && balance.lethalShare > leviathan.lethalShare,
    `${terror.lethalShare.toFixed(0)}% -> ${balance.lethalShare.toFixed(0)}% -> ` +
    `${leviathan.lethalShare.toFixed(0)}%`);
}

// 19. The spawner is reproducible from its seed.
{
  const run = () => {
    const pond = newPond(97);
    E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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
      E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
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
      // The viewport as of the end of the last step (or the seed viewport, on
      // the first). One step of lag against what production would compute
      // after this step's own move is immaterial at 120 Hz, and simpler than
      // computing it twice.
      const vp = viewportFor(pond.l, p[S.P_X], p[S.P_Y]);

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
        if (aimX < vp.l - 200 || aimX > vp.r + 200) continue;
        if (t < bestT) { bestT = t; bx = aimX; by = ey; }
      }
      input[S.I_TARGET_X] = bx; input[S.I_TARGET_Y] = by;
      input[S.I_ACTIVE] = bestT < Infinity ? 1 : 0;

      stepPlayer(p, input, C.SIM_DT, pond.l[S.L_WORLD_WIDTH], pond.l[S.L_FLOOR_TOP_Y]);
      E.stepEnemies(pond.pool, pond.l, p[S.P_SIZE], C.SIM_DT, vp.l, vp.r);
      E.stepSpawner(pond.pool, pond.l, p, pond.rng, C.SIM_DT, vp.l, vp.r, vp.t, vp.b);
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
  // This bot steers at an intercept but never drags along with a fleeing fish,
  // so it gets none of the finger-velocity feed-forward a person gets for free,
  // and it never spends a second dodging. Treat it as a regression guard on
  // feeding rate, not as a prediction of how long a person takes.
  //
  // The band dropped from 5-9 to 3-6 when the controls were retuned for reach
  // (ARRIVE_BODY_LENGTHS 4.0 -> 3.0, FINGER_VELOCITY_SMOOTHING 0.08 -> 0.05):
  // an intercepting bot benefits from exactly the same improvement a person
  // does, and unlike a person it has no dodge tax to spend the saved time on,
  // so its floor drops further than a human's real run time would. That is
  // expected, not a regression; only a further, larger swing is worth chasing.
  check('feeding rate stays in the band a faster-reaching fish now gives it',
    mean >= 3 && mean <= 6,
    `bot floor ${mean.toFixed(1)} min  (terror ${phases[0].toFixed(1)} / ` +
    `balance ${phases[1].toFixed(1)} / leviathan ${phases[2].toFixed(1)})`);
}

// ---------------------------------------------------------------------------
// The shape of the difficulty curve
// ---------------------------------------------------------------------------

// 29. How much of the pond is fatal to stand in, across the run.
//     Bot-independent: it measures the water, not anyone's skill at swimming.
{
  const lethalArea = (progress) => {
    const eaten = Math.round(progress * C.APEX_EATEN);
    let lethalCells = 0, cells = 0;
    for (const seed of [3, 9]) {
      const pond = newPond(seed, eaten);
      const size = pond.p[S.P_SIZE];
      const len = size * C.PLAYER_BASE_LENGTH_PX;
      E.seedPond(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
      const steps = Math.round(45 / C.SIM_DT);
      for (let n = 0; n < steps; n++) {
        E.stepEnemies(pond.pool, pond.l, size, C.SIM_DT, VIEW.l, VIEW.r);
        E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
        if (n % Math.round(0.75 / C.SIM_DT)) continue;
        for (let gx = 0; gx < 24; gx++) {
          for (let gy = 0; gy < 48; gy++) {
            const x = ((gx + 0.5) / 24) * PHONE.w, y = ((gy + 0.5) / 48) * PHONE.h;
            cells++;
            for (let i = 0; i < pond.l[S.L_ENEMY_COUNT]; i++) {
              const b = i * S.E_FIELDS;
              if (pond.pool[b + S.E_SIZE] < size) continue;
              const el = pond.pool[b + S.E_SIZE] * C.PLAYER_BASE_LENGTH_PX;
              if (COL.bodiesOverlap(x, y, len, 1, pond.pool[b + S.E_X], pond.pool[b + S.E_Y],
                    el, pond.pool[b + S.E_VX] > 0 ? 1 : -1)) { lethalCells++; break; }
            }
          }
        }
      }
    }
    return (lethalCells / cells) * 100;
  };

  const curve = [0.02, 0.2, 0.32, 0.5, 0.62, 0.8].map(lethalArea);
  const peak = Math.max(...curve);
  const shown = curve.map((v) => v.toFixed(1) + '%').join(' -> ');

  // The lethal share of the *pond* falls steadily (see the composition check
  // above), but the player is half of every collision and grows all run, so the
  // lethal share of the *water* holds roughly level instead of falling with it.
  // Those two effects cancelling is the intended shape: the threat thins out
  // exactly as fast as the player becomes a bigger thing to hit. What must not
  // happen is danger escalating late, and it does not.
  check('danger holds level rather than escalating, then vanishes',
    curve[3] <= curve[1] * 1.2 && curve[4] < peak * 0.4 && curve[5] === 0,
    shown);
  check('the pond never becomes more wall than water', peak < 20,
    `worst point of a run is ${peak.toFixed(1)}% of the water fatal to stand in`);
}

// 30. Predator bands close toward the player, so no fish becomes a wall.
{
  const pond = newPond(61);
  let worst = 0, worstAt = 0;
  for (const progress of [0, 0.2, 0.4, 0.6]) {
    const eaten = Math.round(progress * C.APEX_EATEN);
    pond.p[S.P_EATEN] = eaten;
    pond.p[S.P_SIZE] = GR.sizeForEaten(eaten);
    for (let n = 0; n < 3000; n++) {
      pond.l[S.L_ENEMY_COUNT] = 0;
      E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
      const len = pond.pool[S.E_SIZE] * C.PLAYER_BASE_LENGTH_PX;
      if (len > worst) { worst = len; worstAt = progress; }
    }
  }
  check('no fish ever spans more than the screen is wide', worst < PHONE.w,
    `largest fish seen is ${worst.toFixed(0)} px at progress ${worstAt.toFixed(1)}, ` +
    `screen is ${PHONE.w} px`);
}

// 31. Dragging along with a fleeing fish runs it down.
{
  // Prey the player's own speed would otherwise never close on from behind.
  const chase = (matchFingerVelocity) => {
    const r = newRun(1, 40, 400);
    const preyVx = C.BASE_MAX_SPEED * 0.55;
    let preyX = 140;
    const preyLen = C.PLAYER_BASE_LENGTH_PX * 0.4;
    const playerLen = C.PLAYER_BASE_LENGTH_PX;
    for (let n = 0; n < Math.round(20 / C.SIM_DT); n++) {
      preyX += preyVx * C.SIM_DT;
      if (preyX > PHONE.w - 40) { preyX = 140; r.p[S.P_X] = 40; r.p[S.P_VX] = 0; }
      r.i[S.I_TARGET_X] = preyX;
      r.i[S.I_TARGET_Y] = 400;
      r.i[S.I_RAW_VX] = matchFingerVelocity ? preyVx : 0;
      r.i[S.I_RAW_VY] = 0;
      r.i[S.I_ACTIVE] = 1;
      stepPlayer(r.p, r.i, C.SIM_DT, PHONE.w, PHONE.h);
      if (COL.bodiesOverlap(r.p[S.P_X], r.p[S.P_Y], playerLen, r.p[S.P_FACING],
            preyX, 400, preyLen, 1)) {
        return { caught: true, gap: 0 };
      }
    }
    return { caught: false, gap: preyX - r.p[S.P_X] };
  };

  const without = chase(false);
  const withMatch = chase(true);
  check('a finger held on a fleeing fish never catches it', !without.caught,
    `trails it by ${without.gap.toFixed(0)} px indefinitely, which is why the ` +
    `finger term exists`);
  check('dragging along with it does catch it', withMatch.caught,
    'caught within 20 s of chasing');
}

// ---------------------------------------------------------------------------
// Runs, retries and what the game remembers
// ---------------------------------------------------------------------------

// 32. Retry wipes every trace of the last run, without allocating a thing.
{
  const pond = newPond(77);
  RUN.startRun(pond.p, pond.pool, pond.l, pond.rng, PHONE.w, PHONE.h);
  // The player starts at the centre of the (now much larger) world, not the
  // screen, and never gets an active touch in this test, so it never moves:
  // one viewport computed here holds for the whole loop below.
  const vp = viewportFor(pond.l, pond.p[S.P_X], pond.p[S.P_Y]);

  // Play a bit: eat some fish, then die.
  const input = S.createInputState();
  for (let n = 0; n < 4000; n++) {
    stepPlayer(pond.p, input, C.SIM_DT, pond.l[S.L_WORLD_WIDTH], pond.l[S.L_FLOOR_TOP_Y]);
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, vp.l, vp.r);
    E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, vp.l, vp.r, vp.t, vp.b);
    COL.resolveCollisions(pond.p, pond.pool, pond.l);
  }
  pond.p[S.P_EATEN] = 42;
  pond.p[S.P_SCORE] = 1234;
  pond.p[S.P_ALIVE] = 0;
  pond.p[S.P_SIZE] = 5;

  const poolBefore = pond.pool;
  RUN.startRun(pond.p, pond.pool, pond.l, pond.rng, PHONE.w, PHONE.h);

  check('retry clears the run completely',
    pond.p[S.P_EATEN] === 0 && pond.p[S.P_SCORE] === 0 && pond.p[S.P_ALIVE] === 1 &&
    pond.p[S.P_SIZE] === C.PLAYER_START_SIZE && pond.p[S.P_VX] === 0 && pond.p[S.P_VY] === 0 &&
    pond.l[S.L_ACCUMULATOR] === 0,
    `eaten=${pond.p[S.P_EATEN]}, score=${pond.p[S.P_SCORE]}, size=${pond.p[S.P_SIZE]}, ` +
    `alive=${pond.p[S.P_ALIVE]}`);
  check('retry reuses the same pool rather than building a new one',
    pond.pool === poolBefore && pond.l[S.L_ENEMY_COUNT] > 0,
    `same buffer=${pond.pool === poolBefore}, restocked with ${pond.l[S.L_ENEMY_COUNT]} fish`);
  check('retry puts the player back at the centre of the swimmable world',
    pond.p[S.P_X] === pond.l[S.L_WORLD_WIDTH] * 0.5 &&
    pond.p[S.P_Y] === pond.l[S.L_FLOOR_TOP_Y] * 0.5,
    `at (${pond.p[S.P_X]}, ${pond.p[S.P_Y]}), world centre is ` +
    `(${(pond.l[S.L_WORLD_WIDTH] * 0.5).toFixed(1)}, ${(pond.l[S.L_FLOOR_TOP_Y] * 0.5).toFixed(1)})`);
}

// 33. The joystick maps deflection to speed, and is immune to the stern chase.
{
  const run = newRun();
  const vmax = C.BASE_MAX_SPEED;

  const drive = (vx, vy, seconds) => {
    run.i[S.I_MODE] = S.CONTROL_JOYSTICK;
    run.i[S.I_ACTIVE] = 1;
    run.i[S.I_VEC_X] = vx;
    run.i[S.I_VEC_Y] = vy;
    for (let n = 0; n < Math.round(seconds / C.SIM_DT); n++) {
      stepPlayer(run.p, run.i, C.SIM_DT, 40000, 40000);
    }
    return Math.hypot(run.p[S.P_VX], run.p[S.P_VY]);
  };

  const full = drive(1, 0, 3);
  check('full deflection is full speed', Math.abs(full - vmax) < 2,
    `${full.toFixed(1)} px/s vs ${vmax}`);

  const half = drive(0.5, 0, 3);
  check('half deflection is half speed', Math.abs(half - vmax * 0.5) < 3,
    `${half.toFixed(1)} px/s vs ${(vmax * 0.5).toFixed(0)}`);

  const released = (() => {
    run.i[S.I_ACTIVE] = 0;
    for (let n = 0; n < Math.round(4 / C.SIM_DT); n++) {
      stepPlayer(run.p, run.i, C.SIM_DT, 40000, 40000);
    }
    return Math.hypot(run.p[S.P_VX], run.p[S.P_VY]);
  })();
  check('letting go of the stick still coasts to a stop', released < 1,
    `${released.toFixed(3)} px/s after 4 s`);

  // The arrival ramp is what made a stern chase unwinnable on drag. A stick
  // states its speed outright, so the same chase closes.
  const chaser = newRun(1, 40, 400);
  chaser.i[S.I_MODE] = S.CONTROL_JOYSTICK;
  chaser.i[S.I_ACTIVE] = 1;
  chaser.i[S.I_VEC_X] = 1;
  chaser.i[S.I_VEC_Y] = 0;
  let preyX = 140;
  const preyVx = C.BASE_MAX_SPEED * 0.55;
  let caught = false;
  for (let n = 0; n < Math.round(12 / C.SIM_DT) && !caught; n++) {
    preyX += preyVx * C.SIM_DT;
    if (preyX > PHONE.w - 40) { preyX = 140; chaser.p[S.P_X] = 40; chaser.p[S.P_VX] = 0; }
    stepPlayer(chaser.p, chaser.i, C.SIM_DT, PHONE.w, PHONE.h);
    caught = COL.bodiesOverlap(chaser.p[S.P_X], chaser.p[S.P_Y], C.PLAYER_BASE_LENGTH_PX,
      chaser.p[S.P_FACING], preyX, 400, C.PLAYER_BASE_LENGTH_PX * 0.4, 1);
  }
  check('a joystick chase closes too', caught, 'caught the same fleeing fish');
}

// 34. Saved data survives whatever is actually on disk.
{
  const ST = require('../.verify/state/persistedData');
  const cases = [
    ['nothing stored', null, ST.NO_HIGH_SCORE],
    ['empty string', '', ST.NO_HIGH_SCORE],
    ['not json', '{oh no', ST.NO_HIGH_SCORE],
    ['json but not an object', '42', ST.NO_HIGH_SCORE],
    ['null', 'null', ST.NO_HIGH_SCORE],
    ['wrong field types', '{"score":"lots","eaten":null}', { score: 0, eaten: 0 }],
    ['negative', '{"score":-5,"eaten":-1}', { score: 0, eaten: 0 }],
    ['NaN encoded', '{"score":null,"eaten":3}', { score: 0, eaten: 3 }],
    ['a real save', '{"score":8200,"eaten":143}', { score: 8200, eaten: 143 }],
  ];
  let bad = null;
  for (const [name, raw, want] of cases) {
    const got = ST.parseHighScore(raw);
    if (got.score !== want.score || got.eaten !== want.eaten) {
      bad = `${name}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`;
      break;
    }
  }
  check('a corrupt high score reads as no high score, never a crash', bad === null,
    bad ?? `${cases.length} stored shapes handled, including junk and partial writes`);

  const settingsCases = [
    ['nothing stored', null, ST.DEFAULT_SETTINGS],
    ['garbage', 'not json at all', ST.DEFAULT_SETTINGS],
    ['one bad field keeps the others',
      '{"joystick":true,"sound":"yes","haptics":false}',
      { joystick: true, sound: ST.DEFAULT_SETTINGS.sound, haptics: false }],
    ['a key from an older build', '{"tilt":true}', ST.DEFAULT_SETTINGS],
  ];
  let badSetting = null;
  for (const [name, raw, want] of settingsCases) {
    const got = ST.parseSettings(raw);
    if (got.joystick !== want.joystick || got.sound !== want.sound || got.haptics !== want.haptics) {
      badSetting = `${name}: got ${JSON.stringify(got)}`;
      break;
    }
  }
  check('bad settings fall back per key, not wholesale', badSetting === null,
    badSetting ?? 'one unreadable field never discards the rest');
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

// 35. The simulation allocates nothing, checked by watching for collections.
//     Retained heap proves little, because a collection reclaims garbage before
//     it can be measured. Garbage collections happening at all is the signal.
{
  const { PerformanceObserver } = require('node:perf_hooks');
  const pond = newPond(101);
  const input = S.createInputState();
  RUN.startRun(pond.p, pond.pool, pond.l, pond.rng, PHONE.w, PHONE.h);
  input[S.I_ACTIVE] = 1;
  input[S.I_TARGET_X] = PHONE.w * 0.5;
  input[S.I_TARGET_Y] = PHONE.h * 0.8;

  // Warm up, so the run below measures steady state rather than the optimiser.
  // The camera is recomputed every step here too, exactly as production does,
  // since the player is still swimming toward its settle point during warmup.
  for (let n = 0; n < 20000; n++) {
    stepPlayer(pond.p, input, C.SIM_DT, pond.l[S.L_WORLD_WIDTH], pond.l[S.L_FLOOR_TOP_Y]);
    W.computeCamera(pond.l, pond.p[S.P_X], pond.p[S.P_Y], PHONE.w, PHONE.h);
    const wx = pond.l[S.L_CAMERA_X], wy = pond.l[S.L_CAMERA_Y];
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, wx, wx + PHONE.w);
    E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, wx, wx + PHONE.w, wy, wy + PHONE.h);
    COL.resolveCollisions(pond.p, pond.pool, pond.l);
    pond.p[S.P_ALIVE] = 1;
  }

  let collections = 0;
  const observer = new PerformanceObserver((list) => { collections += list.getEntries().length; });
  observer.observe({ entryTypes: ['gc'] });
  global.gc();
  collections = 0;

  // Every function called in this loop, world and camera included, has to be
  // genuinely allocation free: this section is exactly what production calls
  // once (world) or every simulation step (the rest), and a single {x, y}
  // object literal here would land squarely on the observer below and be
  // indistinguishable from a real regression.
  const STEPS = 400000;
  const started = process.hrtime.bigint();
  for (let n = 0; n < STEPS; n++) {
    stepPlayer(pond.p, input, C.SIM_DT, pond.l[S.L_WORLD_WIDTH], pond.l[S.L_FLOOR_TOP_Y]);
    W.computeCamera(pond.l, pond.p[S.P_X], pond.p[S.P_Y], PHONE.w, PHONE.h);
    const camX = pond.l[S.L_CAMERA_X], camY = pond.l[S.L_CAMERA_Y];
    E.stepEnemies(pond.pool, pond.l, pond.p[S.P_SIZE], C.SIM_DT, camX, camX + PHONE.w);
    E.stepSpawner(pond.pool, pond.l, pond.p, pond.rng, C.SIM_DT, camX, camX + PHONE.w, camY, camY + PHONE.h);
    COL.resolveCollisions(pond.p, pond.pool, pond.l);
    pond.p[S.P_ALIVE] = 1;
  }
  const elapsedNs = Number(process.hrtime.bigint() - started);
  observer.disconnect();

  const perStepUs = elapsedNs / STEPS / 1000;
  check('the simulation runs without triggering a single collection',
    collections === 0,
    `${collections} collections across ${(STEPS / 1000).toFixed(0)}k steps ` +
    `with a full pond`);

  // Two simulation steps fall inside one 60fps frame at SIM_HZ = 120.
  const perFrameMs = (perStepUs * (C.SIM_HZ / 60)) / 1000;
  check('two simulation steps fit inside a 60fps frame many times over',
    perFrameMs < 1,
    `${perStepUs.toFixed(2)} us per step, ${perFrameMs.toFixed(3)} ms per 60fps frame ` +
    `of a 16.67 ms budget (desktop node; a phone will be slower)`);
}

// 36. What one frame actually asks Skia to draw.
{
  const { drawFish } = require('../.verify/render/drawFish');

  let ops = 0;
  const canvas = {
    save: () => { ops++; }, restore: () => { ops++; },
    translate: () => { ops++; }, scale: () => { ops++; }, rotate: () => { ops++; },
    drawPath: () => { ops++; }, drawCircle: () => { ops++; }, drawPaint: () => { ops++; },
  };
  const paints = { fill: { setColor: () => {} }, eye: {} };
  // drawFish holds no runtime Skia dependency of its own, so a counting stub
  // stands in for the canvas and the path contents do not matter.
  const paths = { body: 1, tail: 2, dorsal: 3, pectoral: 4 };
  const skin = { body: 1, fin: 2 };

  drawFish(canvas, paths, paints, skin, 100, 100, 40, 1, 5);
  const perFish = ops;

  ops = 0;
  const fishOnScreen = C.MAX_FISH + 1; // a full pond plus the player
  for (let i = 0; i < fishOnScreen; i++) {
    drawFish(canvas, paths, paints, skin, 100, 100, 40, 1, 5);
  }
  const fishOps = ops;

  check('a fish costs a fixed, small number of draw calls', perFish === 12,
    `${perFish} calls per fish: 4 paths and an eye, plus the two save/restore ` +
    `pairs and three transforms that place them`);
  check('a worst-case frame stays well inside a sane draw budget',
    fishOps + 30 < 300,
    `${fishOps} calls for ${fishOnScreen} fish at the pool cap, plus about 30 for ` +
    `the ocean, light shafts and bubbles`);
}

// ---------------------------------------------------------------------------
// A pond bigger than the screen: world size, camera, and viewport-relative
// spawning
// ---------------------------------------------------------------------------

// 37. The world really is bigger than the screen, by the documented ratio.
{
  const l = S.createLoopState();
  W.computeWorldSize(l, PHONE.w, PHONE.h);
  const width = l[S.L_WORLD_WIDTH], height = l[S.L_WORLD_HEIGHT], floorTopY = l[S.L_FLOOR_TOP_Y];
  check('the world is wider and taller than the screen',
    width > PHONE.w && height > PHONE.h,
    `world ${width.toFixed(0)}x${height.toFixed(0)} vs screen ${PHONE.w}x${PHONE.h}`);
  // The loop buffer is a Float32Array, so this compares against the precision
  // it actually holds (roughly 7 significant figures at these magnitudes), not
  // full double precision, which would fail on rounding alone.
  check('world size matches the documented multipliers',
    Math.abs(width - PHONE.w * C.WORLD_WIDTH_SCREENS) < 0.01 &&
    Math.abs(height - PHONE.h * C.WORLD_HEIGHT_SCREENS) < 0.01,
    `${C.WORLD_WIDTH_SCREENS}x width, ${C.WORLD_HEIGHT_SCREENS}x height`);
  check('the floor band sits inside the world, not past its edge',
    floorTopY > 0 && floorTopY < height,
    `floor starts at ${floorTopY.toFixed(0)} of ${height.toFixed(0)}`);
}

// 38. The camera centres on the player and clamps at the world's edges.
{
  const l = S.createLoopState();
  W.computeWorldSize(l, PHONE.w, PHONE.h);
  const width = l[S.L_WORLD_WIDTH], height = l[S.L_WORLD_HEIGHT];

  W.computeCamera(l, width / 2, height / 2, PHONE.w, PHONE.h);
  check('camera centres on the player away from any edge',
    Math.abs(l[S.L_CAMERA_X] - (width / 2 - PHONE.w / 2)) < 1e-6 &&
    Math.abs(l[S.L_CAMERA_Y] - (height / 2 - PHONE.h / 2)) < 1e-6,
    `camera at (${l[S.L_CAMERA_X].toFixed(1)}, ${l[S.L_CAMERA_Y].toFixed(1)})`);

  W.computeCamera(l, -500, -500, PHONE.w, PHONE.h);
  check("camera clamps at the world's top-left corner, even past it",
    l[S.L_CAMERA_X] === 0 && l[S.L_CAMERA_Y] === 0,
    `camera at (${l[S.L_CAMERA_X]}, ${l[S.L_CAMERA_Y]})`);

  W.computeCamera(l, width + 500, height + 500, PHONE.w, PHONE.h);
  check("camera clamps at the world's bottom-right corner, even past it",
    Math.abs(l[S.L_CAMERA_X] - (width - PHONE.w)) < 1e-6 &&
    Math.abs(l[S.L_CAMERA_Y] - (height - PHONE.h)) < 1e-6,
    `camera at (${l[S.L_CAMERA_X].toFixed(1)}, ${l[S.L_CAMERA_Y].toFixed(1)}), ` +
    `world's bottom-right is (${(width - PHONE.w).toFixed(1)}, ${(height - PHONE.h).toFixed(1)})`);
}

// 39. The player stops at the top of the floor band, not the world's edge,
//     and never overlaps the seabed it is drawn on top of.
{
  const l = S.createLoopState();
  W.computeWorldSize(l, PHONE.w, PHONE.h);
  const r = newRun(1, l[S.L_WORLD_WIDTH] / 2, 40);
  touch(r, l[S.L_WORLD_WIDTH] / 2, 1e6); // drive straight down, hard
  advance(r, 10, 1 / 60, { w: l[S.L_WORLD_WIDTH], h: l[S.L_FLOOR_TOP_Y] });
  const halfH = G.SILHOUETTE_HALF_H * C.PLAYER_BASE_LENGTH_PX * r.p[S.P_SIZE];
  check("the player is clamped at the floor's top edge, short of the world's edge",
    Math.abs(r.p[S.P_Y] - (l[S.L_FLOOR_TOP_Y] - halfH)) < 1 && r.p[S.P_Y] < l[S.L_WORLD_HEIGHT],
    `settled at y=${r.p[S.P_Y].toFixed(1)}, floor starts at ${l[S.L_FLOOR_TOP_Y].toFixed(1)}, ` +
    `world height is ${l[S.L_WORLD_HEIGHT].toFixed(1)}`);
}

// 40. The pond stocks around wherever the player actually is, not just near
//     the world's origin: the direct test of "swim off and you are not stuck
//     in an empty part of the world."
{
  const pond = newPond(67);
  const l = pond.l;
  W.computeWorldSize(l, PHONE.w, PHONE.h);
  const fractionAcross = 0.85;
  pond.p[S.P_X] = l[S.L_WORLD_WIDTH] * fractionAcross;
  pond.p[S.P_Y] = l[S.L_FLOOR_TOP_Y] * 0.5;
  const vp = viewportFor(l, pond.p[S.P_X], pond.p[S.P_Y]);
  E.seedPond(pond.pool, l, pond.p, pond.rng, vp.l, vp.r, vp.t, vp.b);

  let nearPlayer = 0;
  let allWithinMargin = true;
  const margin = C.PLAYER_BASE_LENGTH_PX * 5;
  for (let i = 0; i < l[S.L_ENEMY_COUNT]; i++) {
    const b = i * S.E_FIELDS;
    if (Math.abs(pond.pool[b + S.E_X] - pond.p[S.P_X]) < PHONE.w) nearPlayer++;
    if (pond.pool[b + S.E_X] < vp.l - margin || pond.pool[b + S.E_X] > vp.r + margin) {
      allWithinMargin = false;
    }
  }
  check('the pond stocks around the player, wherever in the world that is',
    nearPlayer > 0 && allWithinMargin,
    `${l[S.L_ENEMY_COUNT]} fish seeded near x=${pond.p[S.P_X].toFixed(0)}, ` +
    `${(fractionAcross * 100).toFixed(0)}% of the way across a world ` +
    `${l[S.L_WORLD_WIDTH].toFixed(0)} px wide`);
}

// 41. As the camera pans, fish keep spawning near wherever it currently is,
//     not stuck at the run's original viewport.
{
  const pond = newPond(71);
  const l = pond.l;
  E.seedPond(pond.pool, l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
  const farX = C.WORLD_WIDTH_SCREENS * PHONE.w * 0.6; // well past the seed viewport
  const steps = Math.round(120 / C.SIM_DT);
  let sawFarSpawn = false;
  for (let n = 0; n < steps; n++) {
    pond.p[S.P_X] = (farX * n) / steps; // walk the camera steadily rightward
    const vp = viewportFor(l, pond.p[S.P_X], pond.p[S.P_Y]);
    E.stepEnemies(pond.pool, l, pond.p[S.P_SIZE], C.SIM_DT, vp.l, vp.r);
    E.stepSpawner(pond.pool, l, pond.p, pond.rng, C.SIM_DT, vp.l, vp.r, vp.t, vp.b);
    for (let i = 0; i < l[S.L_ENEMY_COUNT]; i++) {
      if (pond.pool[i * S.E_FIELDS + S.E_X] > farX - PHONE.w) {
        sawFarSpawn = true;
      }
    }
  }
  check('fish keep spawning near the camera as it moves through the world',
    sawFarSpawn,
    `saw a spawn near x=${farX.toFixed(0)} after walking the camera there`);
}

// ---------------------------------------------------------------------------
// Jellyfish
// ---------------------------------------------------------------------------

// 42. A jellyfish bobs, within its documented amplitude; a swimmer does not.
{
  const pond = newPond(83);
  pond.pool[S.E_KIND] = S.KIND_JELLYFISH;
  pond.pool[S.E_BASE_Y] = 400;
  pond.pool[S.E_Y] = 400;
  pond.pool[S.E_SIZE] = 1;
  pond.pool[S.E_VX] = 40;
  pond.pool[S.E_TAIL_PHASE] = 0;
  pond.l[S.L_ENEMY_COUNT] = 1;
  let minY = Infinity, maxY = -Infinity;
  for (let n = 0; n < Math.round(20 / C.SIM_DT); n++) {
    E.stepEnemies(pond.pool, pond.l, 1, C.SIM_DT, -1e6, 1e6);
    minY = Math.min(minY, pond.pool[S.E_Y]);
    maxY = Math.max(maxY, pond.pool[S.E_Y]);
  }
  const expectedAmplitude = C.JELLYFISH_BOB_AMPLITUDE * C.PLAYER_BASE_LENGTH_PX;
  check("a jellyfish bobs within its documented amplitude",
    (maxY - minY) > 1 && Math.abs((maxY - minY) / 2 - expectedAmplitude) < expectedAmplitude * 0.05,
    `range ${(maxY - minY).toFixed(1)} px, expected amplitude ${expectedAmplitude.toFixed(1)} px each way`);

  const swimmer = newPond(84);
  swimmer.pool[S.E_KIND] = S.KIND_SWIMMER;
  swimmer.pool[S.E_BASE_Y] = 400;
  swimmer.pool[S.E_Y] = 400;
  swimmer.pool[S.E_SIZE] = 1;
  swimmer.pool[S.E_VX] = 40;
  swimmer.l[S.L_ENEMY_COUNT] = 1;
  for (let n = 0; n < Math.round(20 / C.SIM_DT); n++) {
    E.stepEnemies(swimmer.pool, swimmer.l, 1, C.SIM_DT, -1e6, 1e6);
  }
  check('a swimmer holds its depth; only a jellyfish bobs',
    swimmer.pool[S.E_Y] === 400,
    `swimmer stayed at y=${swimmer.pool[S.E_Y]}`);
}

// 43. A jellyfish is exactly as dangerous as a swimmer of the same size: kind
//     changes how it moves and looks, never the eat-or-die rule.
{
  const pond = newPond(85);
  const p = pond.p;
  pond.pool[S.E_X] = p[S.P_X]; pond.pool[S.E_Y] = p[S.P_Y]; pond.pool[S.E_BASE_Y] = p[S.P_Y];
  pond.pool[S.E_SIZE] = p[S.P_SIZE] * 0.5; pond.pool[S.E_VX] = 10;
  pond.pool[S.E_TIER] = T.TIER_PREY_MEDIUM; pond.pool[S.E_KIND] = S.KIND_JELLYFISH;
  pond.l[S.L_ENEMY_COUNT] = 1;
  const ate = COL.resolveCollisions(p, pond.pool, pond.l);
  check('a smaller jellyfish is eaten exactly like a fish of the same size',
    ate === 1 && pond.l[S.L_ENEMY_COUNT] === 0, `ate=${ate}`);

  const bigger = newPond(86);
  const p2 = bigger.p;
  bigger.pool[S.E_X] = p2[S.P_X]; bigger.pool[S.E_Y] = p2[S.P_Y]; bigger.pool[S.E_BASE_Y] = p2[S.P_Y];
  bigger.pool[S.E_SIZE] = p2[S.P_SIZE] * 1.4; bigger.pool[S.E_VX] = -10;
  bigger.pool[S.E_TIER] = T.TIER_PREDATOR_SMALL; bigger.pool[S.E_KIND] = S.KIND_JELLYFISH;
  bigger.l[S.L_ENEMY_COUNT] = 1;
  COL.resolveCollisions(p2, bigger.pool, bigger.l);
  check('a bigger jellyfish kills on contact exactly like a fish of the same size',
    p2[S.P_ALIVE] === 0, `alive=${p2[S.P_ALIVE]}`);
}

// 44. Roughly JELLYFISH_CHANCE of spawns are actually jellyfish.
{
  const pond = newPond(91);
  const total = 4000;
  let jelly = 0;
  for (let i = 0; i < total; i++) {
    pond.l[S.L_ENEMY_COUNT] = 0;
    E.spawnAtEdge(pond.pool, pond.l, pond.p, pond.rng, VIEW.l, VIEW.r, VIEW.t, VIEW.b);
    if (pond.pool[S.E_KIND] === S.KIND_JELLYFISH) jelly++;
  }
  const rate = jelly / total;
  check('roughly JELLYFISH_CHANCE of spawns are jellyfish',
    Math.abs(rate - C.JELLYFISH_CHANCE) < 0.03,
    `${(rate * 100).toFixed(1)}% over ${total} spawns vs a target of ` +
    `${(C.JELLYFISH_CHANCE * 100).toFixed(0)}%`);
}

// ---------------------------------------------------------------------------
// Controls: the fix for "hard to navigate"
// ---------------------------------------------------------------------------

// stepPlayer's wall is a hard, absolute one at x=0, not a wall relative to
// wherever an approach happens to start: a player placed at a negative x is
// already outside it and clamps back to the wall on the very first step,
// before any approach dynamics run at all. So both functions below start at
// x=0 (just inside the wall) and approach a distant *positive* target, never
// negative, matching how the earlier standalone sweep that first measured
// this bug avoided the question entirely by never calling the real clamp.
const FAR_TARGET_X = 3000;

/** Speed reached by the time an approach from far away first comes within
 * `holdDist` of a stationary target: the realistic "your finger is roughly
 * this far from where you want to go" scenario the original complaint was
 * about, run through the real stepPlayer rather than a re-derived formula. */
function reachApproaching(size, holdDist) {
  const r = newRun(size, 0, 0);
  touch(r, FAR_TARGET_X, 0);
  for (let n = 0; n < 3000; n++) {
    stepPlayer(r.p, r.i, C.SIM_DT, ARENA.w, ARENA.h);
    if (Math.abs(FAR_TARGET_X - r.p[S.P_X]) <= holdDist) {
      return Math.hypot(r.p[S.P_VX], r.p[S.P_VY]);
    }
  }
  return Math.hypot(r.p[S.P_VX], r.p[S.P_VY]);
}

/** How far past a held, stationary target the same approach overshoots. */
function overshootApproaching(size) {
  const r = newRun(size, 0, 0);
  touch(r, FAR_TARGET_X, 0);
  let maxX = -Infinity;
  for (let n = 0; n < 4000; n++) {
    stepPlayer(r.p, r.i, C.SIM_DT, ARENA.w, ARENA.h);
    maxX = Math.max(maxX, r.p[S.P_X]);
  }
  return maxX - FAR_TARGET_X;
}

// 45. A realistic drag reaches a real fraction of top speed at every size,
//     and overshoot stays a modest, bounded fraction of the fish's own
//     length. This is the permanent regression guard for the fix: measured
//     under the original tuning (ARRIVE_BODY_LENGTHS = 4.0), a fish at apex
//     size reached only 46% of top speed under this exact test, which is what
//     "hard to navigate" actually was.
{
  const holdDist = 200;
  const rows = [];
  let worstReach = 1, worstOvershootFrac = 0;
  for (const size of [1, 5, C.APEX_SIZE]) {
    const maxSpeed = C.BASE_MAX_SPEED * Math.pow(size, C.SPEED_SIZE_EXPONENT);
    const reachPct = reachApproaching(size, holdDist) / maxSpeed;
    worstReach = Math.min(worstReach, reachPct);

    const length = C.PLAYER_BASE_LENGTH_PX * size;
    const overshootFrac = overshootApproaching(size) / length;
    worstOvershootFrac = Math.max(worstOvershootFrac, overshootFrac);

    rows.push(`size ${size}: ${(reachPct * 100).toFixed(0)}% reach, ${(overshootFrac * 100).toFixed(0)}% overshoot`);
  }
  check(`a realistic ${holdDist}px drag reaches a real fraction of top speed at every size`,
    worstReach > 0.55,
    rows.join('; '));
  check("overshoot stays a modest, bounded fraction of the fish's own length",
    worstOvershootFrac < 0.3,
    rows.join('; '));
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
