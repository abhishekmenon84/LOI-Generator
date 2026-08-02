import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
    // pdfjs-dist/legacy/build/pdf.mjs dynamically imports its own
    // pdf.worker.mjs by a runtime string path (not a static import Next's
    // file tracer can see), so Vercel's deploy bundle silently omits it --
    // "Cannot find module '.../pdf.worker.mjs'" in production even though
    // the exact same code works locally, since the file is present in a
    // full local node_modules but never gets traced/copied into the
    // serverless function's bundle. Forcing it into the trace here is the
    // standard fix (see Next.js's outputFileTracingIncludes docs) for a
    // package whose worker/asset file is referenced dynamically deep
    // inside a dependency rather than imported directly by app code.
    // Must live under `experimental` (not top-level) on Next 14.2.x --
    // collect-build-traces.js reads it from `config.experimental` only.
    outputFileTracingIncludes: {
      "/api/templates/normalize": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
      "/api/orgs/[id]/templates": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    },
  },
};

// Fully inert (no-op wrapper) until SENTRY_AUTH_TOKEN/org/project are set --
// safe to ship ahead of a real Sentry project existing.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
