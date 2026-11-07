import fs from 'fs';
import path from 'path';

// Version drift is a real problem here: app.json and package.json had silently
// diverged before, and the backend reported a different version again. The
// invariant is that the two frontend files agree and the version is
// well-formed — NOT that it equals a specific literal, which would just need
// editing on every release without catching anything.
describe('frontend version metadata', () => {
  const root = path.join(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

  it('keeps package.json synchronized with app.json', () => {
    expect(packageJson.version).toBe(appJson.expo.version);
  });

  it('uses a well-formed version string', () => {
    expect(appJson.expo.version).toMatch(/^\d+\.\d+\.\d+[a-z]?$/);
  });

  it('declares an Android versionCode source that cannot collide across builds', () => {
    // EAS manages this remotely (appVersionSource: remote in eas.json);
    // pinning it locally would silently override that.
    const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
    expect(eas.cli.appVersionSource).toBe('remote');
  });
});
