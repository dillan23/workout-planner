# Fishy

A faithful modernization of the 2003 Flash game by Jonas. Eat anything smaller
than you, die on contact with anything bigger, grow until nothing in the pond
can touch you.

React Native + Expo SDK 57, rendered entirely with Skia. No game engine.

## Status

Phase 2 of 7 complete: the player fish swims. Fixed timestep simulation,
drag-to-swim controls, interpolated rendering.

| # | Phase | State |
|---|-------|-------|
| 1 | Scaffold, Skia canvas, portrait lock | done |
| 2 | Fixed timestep loop, drag controls | done |
| 3 | Enemy spawner, pooling, swimming | not started |
| 4 | Collision, eating, growth, death | not started |
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
npm run verify:physics
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

**The hitbox is the drawn body.** `src/game/fishGeometry.ts` describes the body
as an ellipse in that same unit space, and both the renderer and (from phase 4)
the collision test read it. Fins and tail sit outside it deliberately: clipping
a tail is a near miss, not a death, and the two definitions cannot drift apart
because there is only one.

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
