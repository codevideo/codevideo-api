import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://06811c81e57eae0621f15301cd253319@o4505623207149568.ingest.us.sentry.io/4506982569279488",
  tracesSampleRate: 0.5, //  Capture 50% of the transactions
});