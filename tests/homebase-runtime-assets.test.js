import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

describe('Homebase runtime assets', () => {
  it('keeps the LaunchAgent template secret-free and Hermes-scoped', () => {
    const template = readFileSync(join(root, 'ops', 'com.teddy.house-lobsterboard.plist.template'), 'utf8');
    expect(template).not.toMatch(/<key>DASHBOARD_PASSWORD<\/key>/);
    expect(template).toContain('run-homebase-service.zsh');
    expect(template).toContain('teddy-homebase-dashboard-password');
    expect(template).toContain('TEDDY_HOMEBASE_HERMES_BIN');
    expect(template).toContain('TEDDY_HOMEBASE_ASK_TOKEN_BUDGET');
  });

  it('normalizes the known broken Android URL to the approved Funnel route', () => {
    const script = join(root, 'scripts', 'homebase-android-open.zsh');
    const source = readFileSync(script, 'utf8');
    expect(source).toContain('https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/');
    expect(source).toContain('https://openclaw-mac-mini.tail02a3b6.ts.net/pages/teddy-house/');
    if (process.platform !== 'darwin') return;
    const canonical = execFileSync(script, ['--print-url'], { encoding: 'utf8' }).trim();
    const normalized = execFileSync(script, ['--print-url'], {
      encoding: 'utf8',
      env: { ...process.env, HOMEBASE_ANDROID_URL: 'https://openclaw-mac-mini.tail02a3b6.ts.net/pages/teddy-house/' }
    }).trim();
    expect(canonical).toBe('https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/');
    expect(normalized).toBe(canonical);
  });
});
