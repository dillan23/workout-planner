/**
 * Expo config.
 *
 * Everything static lives in app.json; this exists only to make the web base
 * URL settable at build time. A GitHub Pages project site is served from
 * `/<repo>/`, and the exporter bakes asset URLs into the bundle at build time,
 * so it has to be told. Left unset, the build targets a domain root, which is
 * what local serving and most static hosts want.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.FISHY_BASE_URL;
  if (!baseUrl) {
    return config;
  }
  return {
    ...config,
    experiments: { ...config.experiments, baseUrl },
  };
};
