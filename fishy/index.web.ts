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
 * The app is imported dynamically, and that is load-bearing rather than
 * stylistic: a static import evaluates the whole module graph immediately, and
 * Skia builds its API from the global CanvasKit at module-evaluation time. Any
 * import of the app above this line crashes before the first frame.
 */
// Resolved relative to the page, not the site root, so the build works served
// from a subdirectory (a GitHub Pages project site, say) as well as from `/`.
void LoadSkiaWeb({ locateFile: (file: string) => file })
  .then(async () => {
    const { default: App } = await import('./App');
    registerRootComponent(App);
  })
  .catch((error: unknown) => {
    console.error('Fishy could not start: CanvasKit failed to load.', error);
  });
