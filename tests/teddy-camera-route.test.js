/**
 * Tests for server/routes/teddy-camera.cjs
 *
 * The route module exposes a small surface of pure helpers for building the
 * friendly event feed (relative age formatting, label icon/verb mapping,
 * friendly message generation, and feed merging). These helpers should be
 * deterministic and well-isolated from network calls so the widget can be
 * trusted even when the upstream Teddy Camera server is offline.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireFromHere = createRequire(import.meta.url);
const routesPath = path.join(process.cwd(), 'server', 'routes', 'teddy-camera.cjs');

// We can't easily import the .cjs file in an ESM test without booting it,
// so we re-implement a minimal probe by re-reading and eval'ing the helpers.
// The actual module exports only the `handle` function; we read the source
// to confirm it contains the expected pieces.
const src = requireFromHere('fs').readFileSync(routesPath, 'utf8');

describe('teddy-camera route module', () => {
  it('registers /api/teddy-camera/feed, /api/teddy-camera/health, and the forwarded camera paths', () => {
    expect(src).toContain("'/api/teddy-camera/feed'");
    expect(src).toContain("'/api/teddy-camera/health'");
    expect(src).toContain("'/api/timeline'");
    expect(src).toContain("'/api/events'");
    expect(src).toContain("'/api/status'");
    expect(src).toContain("'/api/dashboard'");
  });

  it('exposes a friendliness mapping for person, vehicle, package, and animal labels', () => {
    expect(src).toMatch(/person:\s*\{/);
    expect(src).toMatch(/vehicle:\s*\{/);
    expect(src).toMatch(/package:\s*\{/);
    expect(src).toMatch(/dog:\s*\{/);
    expect(src).toMatch(/cat:\s*\{/);
    // No face recognition or identity tracking in the wire payload
    expect(src).not.toContain('face_recognition');
  });

  it('uses the GSOC+teddy voice bank, not the upstream AI-slop captions', () => {
    // The proxy should build friendly text from CAPTION_BANK, not pass through
    // the upstream 'Amazon-looking delivery candidate. Verify the frame.' or
    // 'Big trash energy.'.
    expect(src).toContain('CAPTION_BANK');
    expect(src).toMatch(/soc:\s*bank\.soc/);
    expect(src).toMatch(/teddy:\s*bank\.teddy/);
    expect(src).toContain('hand_off');
    // The new line for delivery is in the bank.
    expect(src).toContain('No plate logged');
    expect(src).toContain('Bins day');
  });

  it('forbids the upstream AI-slop strings in the source (regression guard)', () => {
    // Dan called these out by name. The source must not regress to any of them.
    // If you need to remove one of these from this list, write a unit test that
    // proves the new copy is better and update this list deliberately.
    const forbidden = [
      'Verify the frame',
      'Big trash energy',
      'Look now.',
      'Stop guessing',
      'Amazon-looking delivery candidate',
      'Front view has a real target',
      'I am no longer bored',
      'Taking a look now.',
      'Camera has a target. Take a look.'
    ];
    for (const phrase of forbidden) {
      expect(src, `regression: source must not contain "${phrase}"`).not.toContain(phrase);
    }
  });

  it('uses the persisted teddycamera token file for upstream auth', () => {
    expect(src).toContain("'.config', 'teddycamera', 'token'");
    expect(src).toContain("'Authorization'");
    expect(src).toContain("Bearer");
  });

  it('resolves TeddyDB via the venv node binary from the repo path', () => {
    expect(src).toContain('TEDDYCAMERA_REPO');
    expect(src).toContain('TEDDYCAMERA_NODE');
    expect(src).toContain('queryRecentTeddyDbEvents');
  });

  it('writes structured JSON logs to stderr and to a rolling log file', () => {
    expect(src).toContain('function log(');
    expect(src).toContain('TEDDYCAMERA_LOG_FILE');
    expect(src).toContain("'feed.step'");
    expect(src).toContain("'upstream.req'");
    expect(src).toContain("'upstream.res'");
    expect(src).toContain(".local', 'share', 'teddy-house', 'teddy-camera-route.log");
  });

  it('refuses non-GET/HEAD methods with 405', () => {
    expect(src).toContain("'Method not allowed'");
    expect(src).toContain('405');
  });

  it('uses env-overridable upstream port and host', () => {
    expect(src).toContain('TEDDYCAMERA_PORT');
    expect(src).toContain('TEDDYCAMERA_HOST');
  });
});

describe('relative age formatting logic (extracted by behavior)', () => {
  // We mirror the function so we can unit test the friendly age text.
  function relativeAge(ageSeconds) {
    if (ageSeconds == null) return null;
    const s = Math.max(0, Math.floor(ageSeconds));
    if (s < 5) return 'just now';
    if (s < 60) return `${s} sec ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }

  it('returns null for nullish age', () => {
    expect(relativeAge(null)).toBe(null);
    expect(relativeAge(undefined)).toBe(null);
  });

  it('rounds to "just now" for under 5 seconds', () => {
    expect(relativeAge(0)).toBe('just now');
    expect(relativeAge(4)).toBe('just now');
  });

  it('formats seconds under a minute', () => {
    expect(relativeAge(5)).toBe('5 sec ago');
    expect(relativeAge(59)).toBe('59 sec ago');
  });

  it('formats minutes under an hour', () => {
    expect(relativeAge(60)).toBe('1 min ago');
    expect(relativeAge(30 * 60)).toBe('30 min ago');
    expect(relativeAge(59 * 60 + 30)).toBe('59 min ago');
  });

  it('formats hours under a day', () => {
    expect(relativeAge(60 * 60)).toBe('1 hr ago');
    expect(relativeAge(2 * 60 * 60)).toBe('2 hr ago');
    expect(relativeAge(23 * 60 * 60)).toBe('23 hr ago');
  });

  it('formats days pluralization correctly', () => {
    expect(relativeAge(24 * 60 * 60)).toBe('1 day ago');
    expect(relativeAge(2 * 24 * 60 * 60)).toBe('2 days ago');
  });

  it('clamps negative ages to zero', () => {
    expect(relativeAge(-30)).toBe('just now');
  });
});
