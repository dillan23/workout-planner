# Fishy

A faithful modernization of the 2003 Flash game by Jonas. Eat anything smaller
than you, die on contact with anything bigger, grow until nothing in the pond
can touch you.

React Native + Expo SDK 57, rendered entirely with Skia. No game engine.

## Status

Phase 4 of 7 complete: the game is playable end to end. Eat anything smaller,
grow on a logarithmic curve, die on contact with anything bigger.

| # | Phase | State |
|---|-------|-------|
| 1 | Scaffold, Skia canvas, portrait lock | done |
| 2 | Fixed timestep loop, drag controls | done |
| 3 | Enemy spawner, pooling, swimming | done |
| 4 | Collision, eating, growth, death | done |
| 5 | Difficulty curve | not started |
| 6 | Screens, HUD, persistence | not started |
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
  game/     simulation: constants, geometry, and (from phase 2) the loop
  render/   Skia draw functions, fish paths, background layers
  screens/  title, game, gameover, settings
  state/    persistence, settings store
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

`npm run verify` measures run length with a bot that swims at the nearest fish
it can intercept. The bot is immortal and never dodges, so its time is a floor
on skilled human play rather than an estimate of it.

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
