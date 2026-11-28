/**
 * LobsterBoard Docker entrypoint.
 *
 * Starts as root only long enough to:
 *   - make sure /data is owned by PUID:PGID (default 1000:1000)
 *   - give the app access to /var/run/docker.sock if it's mounted (Docker widget)
 * then drops to PUID:PGID and starts the normal server (server.cjs).
 *
 * Only used by the Docker image; the regular npm install never runs this.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.cwd(); // /data (WORKDIR in the Dockerfile)
const DOCKER_SOCK = '/var/run/docker.sock';
const PUID = parseInt(process.env.PUID || '1000', 10);
const PGID = parseInt(process.env.PGID || '1000', 10);

function chownRecursive(p, uid, gid) {
  let st;
  try { st = fs.lstatSync(p); } catch (_) { return; }
  try { fs.lchownSync(p, uid, gid); } catch (e) { console.warn(`⚠️  Could not chown ${p}: ${e.message}`); }
  if (st.isDirectory()) {
    for (const entry of fs.readdirSync(p)) chownRecursive(path.join(p, entry), uid, gid);
  }
}

if (process.getuid && process.getuid() === 0 && PUID !== 0) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Only walk the folder when ownership is wrong, so restarts stay fast
  if (fs.statSync(DATA_DIR).uid !== PUID) {
    console.log(`🔧 Setting owner of ${DATA_DIR} to ${PUID}:${PGID}`);
    chownRecursive(DATA_DIR, PUID, PGID);
  }

  const groups = [PGID];
  try {
    const sock = fs.statSync(DOCKER_SOCK);
    if (sock.isSocket()) {
      if (sock.gid === 0) {
        console.warn('⚠️  docker.sock belongs to the root group; the Docker widget may not have access.');
      }
      groups.push(sock.gid);
    }
  } catch (_) { /* socket not mounted, that's fine */ }

  const home = '/home/node';
  try { fs.mkdirSync(home, { recursive: true }); fs.chownSync(home, PUID, PGID); } catch (_) {}
  process.env.HOME = home;

  process.setgroups([...new Set(groups)]);
  process.setgid(PGID);
  process.setuid(PUID);
}

require(path.join(process.env.LOBSTERBOARD_PKG_DIR || '/app', 'server.cjs'));
