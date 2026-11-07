// Error telemetry for the app.
//
// Optional by design: with no EXPO_PUBLIC_SENTRY_DSN every call is a no-op, so
// local dev, Jest and CI never need a Sentry account. The DSN is public by
// nature (it ships in the client), which is why Sentry uses it as a write-only
// ingest key rather than a secret.
import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT || (__DEV__ ? 'development' : 'production');

let enabled = false;

export function initTelemetry(): boolean {
  if (!DSN) return false;
  if (enabled) return true;
  try {
    Sentry.init({
      dsn: DSN,
      environment: ENVIRONMENT,
      // Errors only. Tracing would ship financial screen context off-device.
      tracesSampleRate: 0,
      sendDefaultPii: false,
      enableAutoSessionTracking: false,
      beforeSend(event) {
        // Never transmit anything that could identify a person or their money.
        if (event.request) {
          delete event.request.headers;
          delete event.request.data;
          delete event.request.query_string;
        }
        if (event.user) delete event.user;
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter((crumb) => {
            const text = `${crumb.message || ''} ${JSON.stringify(crumb.data || {})}`;
            return !/Rp\d|amount|balance|token|password/i.test(text);
          });
        }
        return event;
      },
    });
    enabled = true;
    return true;
  } catch {
    return false;
  }
}

export function captureError(error: unknown, context?: Record<string, string | number>) {
  if (!enabled) return;
  try {
    Sentry.withScope((scope) => {
      Object.entries(context || {}).forEach(([key, value]) => scope.setTag(key, String(value)));
      Sentry.captureException(error);
    });
  } catch {
    // Telemetry must never throw into the app.
  }
}

export function isTelemetryEnabled() {
  return enabled;
}
