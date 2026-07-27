/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next's client-side Router Cache otherwise keeps a dynamic page's RSC
  // payload for 30s on <Link>/back-forward navigation -- structural changes
  // made elsewhere (unnesting a folder, archiving, etc.) wouldn't show up
  // until that window expired or a hard reload. Forces every navigation to
  // a dynamic route to re-fetch from the server.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
    // lib/pdfNormalize.js's raster fallback dynamically imports
    // @napi-rs/canvas (a native Node addon, .node binary) and
    // pdfjs-dist/legacy server-side. Webpack cannot parse the native
    // binary as a JS module -- externalizing these tells Next's server
    // bundler to require() them at runtime instead of bundling them,
    // which is the standard fix for native-addon dependencies used from
    // a Route Handler (this is the first route to actually import
    // lib/pdfNormalize.js -- Task 5's own tests only exercised it via
    // `node --test`, never through `next build`).
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  },
};

export default nextConfig;
