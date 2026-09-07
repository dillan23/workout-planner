import { registerRootComponent } from 'expo';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - the web entry point ships no type declarations
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

/**
 * Web entry point.
 *
 * On a device Skia is a native module and is simply there. In a browser it is
 * CanvasKit, a WebAssembly build that has to be fetched and instantiated before
 * anything can touch the Skia API.
 *
 * The app is pulled in with `require` inside the callback, and both halves of
 * that matter. Deferring it is load-bearing: Skia builds its API from the
 * global CanvasKit at module-evaluation time, so any import of the app above
 * this line crashes before the first frame. Using `require` rather than a
 * dynamic `import` is what keeps it in one bundle: `import()` makes Metro emit
 * a separate chunk whose URL is absolute and fixed at build time, which 404s
 * the moment the site is served from a subdirectory. `require` is lazy at call
 * time, which is all the deferral this needs.
 */
void LoadSkiaWeb({
  locateFile: (file: string) =>
    typeof document === 'undefined' ? file : new URL(file, document.baseURI).href,
})
  .then(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const App = (require('./App') as { default: React.ComponentType }).default;
    registerRootComponent(App);
  })
  .catch((error: unknown) => {
    console.error('Fishy could not start: CanvasKit failed to load.', error);
  });
