import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Hand photos are private: never attach request bodies or screenshots.
  beforeSend(event) {
    if (event.request) delete event.request.data;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
