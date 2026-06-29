#!/usr/bin/env python3
"""
Refresh the teddy camera session cookie used by the homebridge camera-ffmpeg
plugin. The cookie expires periodically, so this script captures a fresh
one and rewrites the homebridge config + signals the homebridge to reload.

Why this exists: the homebridge-camera-ffmpeg plugin's source string gets
split on whitespace (split(/\\s+/)), so we can't use the Bearer header
which has a space ("Authorization: Bearer xxx"). The session cookie is
a single token with no spaces, so it works.
"""
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from http.cookiejar import CookieJar
from pathlib import Path

CONFIG_PATH = Path('/Users/teddyclaw/.homebridge/config.json')
TC_PORT = 18116


def fetch_cookie():
    """Hit the teddy camera's root to get a local-session cookie."""
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(f'http://127.0.0.1:{TC_PORT}/', headers={'User-Agent': 'teddycamera-cookie-refresh/1.0'})
    opener.open(req, timeout=5).read()
    for c in jar:
        if c.name == 'teddycam_session':
            return c.value
    return None


def patch_config(cookie):
    c = json.load(open(CONFIG_PATH))
    for plat in c['platforms']:
        if plat.get('platform') != 'Camera-ffmpeg':
            continue
        for cam in plat.get('cameras', []):
            vc = cam.get('videoConfig', {})
            vc['source'] = f'-headers "Cookie:teddycam_session={cookie}" -i http://127.0.0.1:{TC_PORT}/stream.mjpg'
            vc['stillImageSource'] = f'-headers "Cookie:teddycam_session={cookie}" -i http://127.0.0.1:{TC_PORT}/latest.jpg'
    with open(CONFIG_PATH, 'w') as f:
        json.dump(c, f, indent=4)


def reload_homebridge():
    """Find the homebridge main process and signal it to reload by sending
    SIGHUP. The hb-service supervisor will restart it."""
    import os
    import signal
    main = subprocess.run(['pgrep', '-f', '^homebridge '], capture_output=True, text=True).stdout.strip().split('\n')
    for pid in main:
        try:
            os.kill(int(pid), signal.SIGHUP)
            return int(pid)
        except (ProcessLookupError, PermissionError, ValueError):
            continue
    return None


def main():
    print('Fetching fresh session cookie from the teddy camera...')
    cookie = fetch_cookie()
    if not cookie:
        print('FATAL: could not get a session cookie. Is the teddy camera up?')
        sys.exit(1)
    print(f'Got cookie ({len(cookie)} chars)')

    print(f'Patching {CONFIG_PATH}...')
    patch_config(cookie)
    print('Config patched')

    print('Reloading homebridge (SIGHUP)...')
    pid = reload_homebridge()
    if pid:
        print(f'Sent SIGHUP to homebridge PID {pid}')
    else:
        print('WARNING: could not find homebridge process. Restart manually.')


if __name__ == '__main__':
    main()
