import fs from 'fs';
import path from 'path';

// Guards against config that only fails inside an EAS build, where a failure
// costs ~15 minutes and the error is buried in native logs.
describe('eas build configuration', () => {
  const root = path.join(__dirname, '..');
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

  const profiles = ['development', 'preview', 'production'];

  // Reads the profile exactly as eas-cli does, following `extends`.
  const resolveProfile = (name: string): Record<string, any> => {
    const profile = eas.build[name];
    if (profile?.extends) {
      const { extends: base, ...rest } = profile;
      return { ...eas.build[base], ...rest, env: { ...eas.build[base]?.env, ...rest.env } };
    }
    return profile ?? {};
  };

  it.each(profiles)('%s profile exists and resolves', (name) => {
    expect(eas.build[name]).toBeDefined();
    expect(typeof resolveProfile(name)).toBe('object');
  });

  it.each(profiles)('%s profile sets EXPO_PUBLIC_BACKEND_URL', (name) => {
    // Without this the app falls back to a hardcoded staging URL and every
    // request goes to the wrong backend.
    expect(resolveProfile(name).env?.EXPO_PUBLIC_BACKEND_URL).toMatch(/^https:\/\//);
  });

  it.each(profiles)('%s profile disables Sentry sourcemap upload', (name) => {
    // @sentry/react-native applies sentry.gradle to the release build and its
    // upload task is an Exec gated only by SENTRY_DISABLE_AUTO_UPLOAD. With no
    // org/project/auth token, sentry-cli exits non-zero and fails the build.
    // Error reporting at runtime is opt-in via EXPO_PUBLIC_SENTRY_DSN, so
    // upload is not needed to ship.
    const env = resolveProfile(name).env ?? {};
    expect(env.SENTRY_DISABLE_AUTO_UPLOAD).toBe('true');
    expect(env.SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD).toBe('true');
  });

  it('preview builds an APK, not an AAB', () => {
    // An internal preview needs something sideloadable.
    expect(resolveProfile('preview').android?.buildType).toBe('apk');
  });

  it('reference every config plugin that needs a native build', () => {
    // A plugin listed here but missing from app.json silently does nothing.
    const plugins = appJson.expo.plugins as (string | [string, any])[];
    const names = plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    for (const required of ['expo-router', 'expo-notifications', 'expo-image-picker', 'expo-local-authentication']) {
      expect(names).toContain(required);
    }
  });

  it('keeps appVersionSource remote so EAS owns build numbers', () => {
    expect(eas.cli?.appVersionSource).toBe('remote');
  });
});
