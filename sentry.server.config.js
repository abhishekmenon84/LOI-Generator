import * as Sentry from "@sentry/nextjs";

// Fully inert until SENTRY_DSN is set in the environment -- Sentry.init
// with no dsn is a documented no-op, so this file is safe to ship before
// a Sentry project/DSN exists.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
