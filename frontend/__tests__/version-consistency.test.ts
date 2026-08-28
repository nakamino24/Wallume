import fs from 'fs';
import path from 'path';

describe('frontend version metadata', () => {
  it('keeps package.json synchronized with app.json', () => {
    const root = path.join(__dirname, '..');
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
    expect(packageJson.version).toBe(appJson.expo.version);
    expect(appJson.expo.version).toBe('1.0.6c');
  });
});
