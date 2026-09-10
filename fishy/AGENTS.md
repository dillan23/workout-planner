# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Verified against SDK 57 (do not re-derive)

- `expo-av` **does not exist** in SDK 57. Use `expo-audio`. The authoritative
  version map is `node_modules/expo/bundledNativeModules.json`.
- Do **not** create a `babel.config.js` for Reanimated. `babel-preset-expo`
  resolves and injects `react-native-worklets/plugin` on its own when
  `react-native-worklets` is installed.
- Reanimated 4 keeps worklets in a separate `react-native-worklets` package;
  the plugin path is `react-native-worklets/plugin`, not the old
  `react-native-reanimated/plugin`.
- Skia's `Canvas` prop `onLayout` is deprecated under the new architecture.
  Use `onSize`, which writes an `SkSize` straight into a shared value.
- Skia 2.x has no `useDrawCallback` / `onDraw`. Imperative drawing goes through
  `createPicture` inside a `useDerivedValue`.
- `npx expo install` needs Expo's API, which the sandbox proxy blocks. Install
  the versions from `bundledNativeModules.json` with plain `npm install`.
