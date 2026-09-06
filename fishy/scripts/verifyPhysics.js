/**
 * Headless verification of the movement model.
 *
 * The simulation is deliberately free of Skia, Reanimated and React: it is
 * plain arithmetic over Float32Arrays, so it can be run and measured on a
 * laptop without a device in the loop. That matters most for phase 5, where
 * tuning the difficulty curve means changing these constants repeatedly and
 * needing to know what actually changed.
 *
 * Run with: npm run verify:physics
 */
const C = require('../.verify/constants');
const S = require('../.verify/state');
const { stepPlayer } = require('../.verify/physics');
const G = require('../.verify/fishGeometry');

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

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
