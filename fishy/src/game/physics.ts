import {
  ARRIVE_BODY_LENGTHS,
  BASE_MAX_SPEED,
  COAST_BODY_LENGTHS,
  EDGE_BOUNCE_MIN,
  EDGE_RESTITUTION,
  FINGER_VELOCITY_SMOOTHING,
  FLIP_DEADZONE,
  GROWTH_EASE_SECONDS,
  PLAYER_BASE_LENGTH_PX,
  SPEED_SIZE_EXPONENT,
  TAIL_IDLE_RATE,
  TAIL_WAG_HZ,
} from './constants';
import { SILHOUETTE_HALF_H, SILHOUETTE_HALF_W } from './fishGeometry';
import { sizeForEaten } from './growth';
import {
  I_ACTIVE,
  I_RAW_VX,
  I_RAW_VY,
  I_TARGET_X,
  I_TARGET_Y,
  I_VX,
  I_VY,
  P_EATEN,
  P_FACING,
  P_PREV_X,
  P_PREV_Y,
  P_SIZE,
  P_TAIL_PHASE,
  P_VX,
  P_VY,
  P_X,
  P_Y,
} from './state';

const TAU = Math.PI * 2;

/**
 * Advance the player by exactly one fixed simulation step.
 *
 * Movement is a seek-with-arrival: the fish works out the velocity it *wants*
 * (toward your finger, easing off as it arrives) and then approaches that
 * velocity exponentially rather than snapping to it. The same one line gives
 * both behaviours the original had, because when you lift your finger the
 * desired velocity is zero and the fish decays as e^(-drag*t), coasting exactly
 * `COAST_BODY_LENGTHS` before it stops.
 *
 * Every derived quantity scales off the fish's current size, so the handling
 * feels the same at 1x and at 20x even though the absolute numbers do not.
 */
export function stepPlayer(
  p: Float32Array,
  input: Float32Array,
  dt: number,
  worldW: number,
  worldH: number,
): void {
  'worklet';

  // Ease toward the size the run has earned rather than snapping to it. Uses
  // the same exponential approach as velocity, so growth is framerate
  // independent, and collision reads this eased value too: the hitbox is always
  // exactly the fish on screen.
  const targetSize = sizeForEaten(p[P_EATEN]);
  if (p[P_SIZE] !== targetSize) {
    const ease = 1 - Math.exp((-3 / GROWTH_EASE_SECONDS) * dt);
    p[P_SIZE] += (targetSize - p[P_SIZE]) * ease;
  }

  const size = p[P_SIZE];
  const length = PLAYER_BASE_LENGTH_PX * size;
  const maxSpeed = BASE_MAX_SPEED * Math.pow(size, SPEED_SIZE_EXPONENT);
  const drag = maxSpeed / (COAST_BODY_LENGTHS * length);

  // Smooth the reported finger velocity before acting on it.
  const smooth = 1 - Math.exp(-dt / FINGER_VELOCITY_SMOOTHING);
  input[I_VX] += (input[I_RAW_VX] - input[I_VX]) * smooth;
  input[I_VY] += (input[I_RAW_VY] - input[I_VY]) * smooth;

  // Velocity the fish would like to have this step: keep pace with the finger,
  // plus a closing term that eases off on arrival.
  //
  // The finger term is what makes a chase work. Without it, desired velocity
  // falls to zero as the gap closes, so a fish fleeing faster than the closing
  // speed can never be caught from behind: the player settles at a fixed
  // distance and trails it forever. Matching the drag means sweeping your
  // finger along with a fleeing fish runs it down, which is what a player
  // expects that gesture to do. With the finger held still the term is zero and
  // this is exactly the damped arrival it always was.
  let desiredVx = 0;
  let desiredVy = 0;
  if (input[I_ACTIVE] > 0.5) {
    desiredVx = input[I_VX];
    desiredVy = input[I_VY];

    const dx = input[I_TARGET_X] - p[P_X];
    const dy = input[I_TARGET_Y] - p[P_Y];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1e-4) {
      const arrive = ARRIVE_BODY_LENGTHS * length;
      const speed = maxSpeed * Math.min(1, dist / arrive);
      desiredVx += (dx / dist) * speed;
      desiredVy += (dy / dist) * speed;
    }

    // The fish is still bound by its top speed however fast the finger moves.
    const desired = Math.sqrt(desiredVx * desiredVx + desiredVy * desiredVy);
    if (desired > maxSpeed) {
      const scale = maxSpeed / desired;
      desiredVx *= scale;
      desiredVy *= scale;
    }
  }

  // Exact solution of dv/dt = drag * (desired - v) over the step, rather than
  // an Euler approximation of it. Integrating position analytically as well
  // costs one multiply and makes the coast come out at exactly
  // COAST_BODY_LENGTHS at every size; stepping velocity first and position
  // after would undershoot it by ~3% at size 1 and ~1% at apex, which would
  // quietly make the handling size dependent.
  const vx0 = p[P_VX];
  const vy0 = p[P_VY];
  const blend = 1 - Math.exp(-drag * dt);

  p[P_PREV_X] = p[P_X];
  p[P_PREV_Y] = p[P_Y];
  p[P_X] += desiredVx * dt + ((vx0 - desiredVx) * blend) / drag;
  p[P_Y] += desiredVy * dt + ((vy0 - desiredVy) * blend) / drag;
  p[P_VX] = vx0 + (desiredVx - vx0) * blend;
  p[P_VY] = vy0 + (desiredVy - vy0) * blend;

  // Keep the whole silhouette, fins included, inside the pond.
  const halfW = SILHOUETTE_HALF_W * length;
  const halfH = SILHOUETTE_HALF_H * length;
  const bounceFloor = EDGE_BOUNCE_MIN * maxSpeed;

  if (worldW <= halfW * 2) {
    p[P_X] = worldW * 0.5;
    p[P_VX] = 0;
  } else if (p[P_X] < halfW) {
    p[P_X] = halfW;
    p[P_VX] = p[P_VX] < -bounceFloor ? -p[P_VX] * EDGE_RESTITUTION : 0;
  } else if (p[P_X] > worldW - halfW) {
    p[P_X] = worldW - halfW;
    p[P_VX] = p[P_VX] > bounceFloor ? -p[P_VX] * EDGE_RESTITUTION : 0;
  }

  if (worldH <= halfH * 2) {
    p[P_Y] = worldH * 0.5;
    p[P_VY] = 0;
  } else if (p[P_Y] < halfH) {
    p[P_Y] = halfH;
    p[P_VY] = p[P_VY] < -bounceFloor ? -p[P_VY] * EDGE_RESTITUTION : 0;
  } else if (p[P_Y] > worldH - halfH) {
    p[P_Y] = worldH - halfH;
    p[P_VY] = p[P_VY] > bounceFloor ? -p[P_VY] * EDGE_RESTITUTION : 0;
  }

  // Heading follows travel, with a deadzone so a hovering fish holds still.
  const deadzone = FLIP_DEADZONE * maxSpeed;
  if (p[P_VX] > deadzone) {
    p[P_FACING] = 1;
  } else if (p[P_VX] < -deadzone) {
    p[P_FACING] = -1;
  }

  // The tail beats faster the harder the fish is swimming. Phase is
  // accumulated, not computed from a clock, so a change of rate never makes the
  // tail jump; wrapping keeps float precision stable over a long run.
  const speedFraction = Math.min(1, Math.sqrt(p[P_VX] * p[P_VX] + p[P_VY] * p[P_VY]) / maxSpeed);
  const beatRate = TAIL_WAG_HZ * (TAIL_IDLE_RATE + (1 - TAIL_IDLE_RATE) * speedFraction);
  let phase = p[P_TAIL_PHASE] + beatRate * TAU * dt;
  if (phase > TAU) {
    phase -= TAU;
  }
  p[P_TAIL_PHASE] = phase;
}
