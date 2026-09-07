# Fishy

A faithful modernization of the 2003 Flash game by Jonas. Eat anything smaller
than you, die on contact with anything bigger, grow until nothing in the pond
can touch you.

React Native + Expo SDK 57, rendered entirely with Skia. No game engine.

## Status

Phase 6 of 7 complete: a whole game. Title, play, pause, game over and
settings, a live HUD, and a high score that survives a restart.

| # | Phase | State |
|---|-------|-------|
| 1 | Scaffold, Skia canvas, portrait lock | done |
| 2 | Fixed timestep loop, drag controls | done |
| 3 | Enemy spawner, pooling, swimming | done |
| 4 | Collision, eating, growth, death | done |
| 5 | Difficulty curve | done |
| 6 | Screens, HUD, persistence | done |
| 7 | Audio, haptics, performance pass | not started |

## Running it

Skia is not one of the native modules bundled into Expo Go, so **Expo Go cannot
run this app**. You need a development build. You only have to do this once;
after that, `npx expo start` behaves exactly as it would with Expo Go.

```bash
cd fishy
npm install
```

Then either build in the cloud:

```bash
npx eas build --profile development --platform android   # or ios
```

or build locally, if you have the Android SDK / Xcode installed:

```bash
npx expo run:android    # or: npx expo run:ios
```

Both install a dev client onto the device. From then on:

```bash
npx expo start
```

and open the app on the phone.

To check the movement model without a device:

```bash
npm run verify
npm run typecheck
```

## Architecture

```
src/
  game/     simulation: loop, physics, collision, spawner, entity pool
  render/   Skia draw functions, fish paths, background layers
  screens/  the canvas, and the screens layered over it
  state/    persistence, settings store
  ui/       buttons, switches, the live HUD counter
  audio/    sound manager
```

Three decisions shape everything else:

**One picture, one thread.** The whole frame is a single Skia picture rebuilt
inside a Reanimated derived value, which runs on the UI thread. No React state
participates in the frame loop, so no re-render can ever be triggered by
gameplay, and JS-thread work (storage writes, navigation, audio) cannot stall
the simulation.

**One silhouette, scaled.** Every fish in the game is the same set of unit-space
Skia paths (body, tail, dorsal fin, pectoral fin) spanning x = -0.5 (tail tip)
to x = +0.5 (nose). Size is a canvas scale, direction is a negative x-scale, and
the tail wag is a rotation about the body joint. Nothing is rebuilt per frame,
and a fish is as crisp at 40x as at 1x.

**Nothing unmounts.** There is no navigator: the Skia canvas is mounted once
and every screen is an overlay above it. The pond swims on behind the title, the
pause card and the game over screen alike, and starting a run is a handful of
buffer writes rather than a scene being built, so Retry is instant with nothing
to flash. React renders only when a person does something, or when the player
dies; never on a frame.

The HUD is the awkward case, since it has to show live run state without
rendering. Both counters are driven from shared values into an uneditable
`TextInput`, so they update on the same thread the simulation runs on, and only
on the frames where something was actually eaten.

**Chasing means leading.** The fish's target speed includes the finger's own
velocity, not just the distance to it. Without that term the closing speed falls
to zero as the gap shuts, so a fish fleeing faster than you close can never be
caught from behind: you settle at a fixed distance and trail it forever, which
is measurable and was real. Dragging along with a fleeing fish now runs it down.
With the finger held still the term is zero and the arrival is exactly the
damped one it always was.

**The simulation is plain arithmetic.** State lives in flat `Float32Array`s
handed to the UI thread once and mutated in place forever, so a frame allocates
nothing. Real time goes into an accumulator drained in whole 120Hz steps, and
the renderer interpolates between the last two steps, so the physics is
identical at 24, 60 or 120fps and still looks smooth. Because none of it touches
Skia, Reanimated or React, `npm run verify:physics` can measure the handling
headlessly.

**Fish are relative, not absolute.** A fish is never "big", it is bigger *than
you*: every tier is a multiple of the player's current size, and enemy speed is
a fraction of the player's top speed divided by that multiple. Small fish dart,
leviathans lumber, and nothing can ever run the player down, which is what keeps
a death felt as a mistake rather than an ambush. The pool is one flat buffer
whose live fish stay contiguous: despawning swaps the last fish into the vacated
slot, so there is no free list and iteration is a straight walk.

**The hitbox is the drawn body.** `src/game/fishGeometry.ts` describes the body
as an ellipse in that same unit space, and both the renderer and the collision
test read it. Fins and tail sit outside it deliberately: clipping a tail is a
near miss, not a death, and the two definitions cannot drift apart because there
is only one.

Drawing every fish from one silhouette also makes collision exact rather than
approximate. Summing two ellipses' radii is normally only an approximation, but
all body ellipses here share an aspect ratio, so scaling the plane turns both
into circles whose Minkowski sum is a circle, which maps back to precisely the
ellipse the test uses. Verified against brute force over 3000 random pairs.

## Tuning

Two curves shape a run, and they are deliberately driven by different things.

**Size** is a concave function of fish eaten: `APEX_SIZE ^ (progress ^
GROWTH_EXPONENT)`. The first bite is worth 21% of the player's size and the last
under 1%, a 29x falloff, so early bites are an event and late ones are barely
perceptible. Both ends are exact by construction rather than tuned to land.

**Difficulty** is keyed on fish eaten, not on size. Size grows fast early, so
pinning the difficulty curve to it would race the player through Terror and
Balance in the first ten bites and leave the rest of the run in Leviathan.
Counting fish gives the three phases roughly equal thirds.

Two things shift as a run progresses, and both are keyframed on the phase
boundaries so a phase starts when it says it does:

- **Spawn weights.** The lethal share of the pond runs 74% at the opening, 36%
  in mid-run, and exactly 0% once Leviathan begins.
- **Tier sizes.** Predator bands close toward the player as it grows. A tier is
  a multiple of the player, so fixed multiples turn a 4.5x predator into a
  700px wall on a 393px screen by mid-run. Measured, that took the lethal share
  of the water from 4% to 35% over a run: not a difficulty curve, just the
  screen filling up. The neutral band slides below 1.0 late in Balance, which
  is what makes "nothing can eat a Leviathan" literally true rather than true
  apart from a rounding error.

The lethal share of the *water* holds roughly level across a run even as the
lethal share of the *pond* falls, because the player is half of every collision
and keeps growing. Those two effects cancelling is the intended shape.

`npm run verify` measures run length with a bot that steers at an intercept. It
is immortal, never dodges, and gets none of the finger-velocity help a person
gets for free, so treat its time as a regression guard on feeding rate rather
than a prediction of how long a person takes.

## Notes on the stack

- `expo-av` was removed in SDK 57. Audio in phase 7 will use `expo-audio`.
- `babel-preset-expo` injects `react-native-worklets/plugin` automatically when
  the package is installed, so there is no `babel.config.js` to maintain.
- Skia's `Canvas` uses the `onSize` shared value rather than `onLayout`, which
  is deprecated under the new architecture.
- A typed array handed to a shared value is *copied* to the UI thread, not
  shared. Writing to `someBuffer.value[i]` from the JS thread changes only the
  JS-side copy and the simulation never sees it. Anything the JS thread needs to
  tell the loop goes through a scalar shared value.
