/**
 * Replace the live otrace.co server block with deploy/nginx-theme-routes.conf.
 *
 * The live file is a single-file bind mount. `sed -i` and `mv` replace the
 * inode and the container keeps reading the old file. This writes the new
 * bytes into the existing inode, checks the inode did not change, then asks
 * nginx to test and reload.
 *
 *   node deploy/apply-nginx-routes.mjs --dest /opt/scalaro/nginx.conf
 *   node deploy/apply-nginx-routes.mjs --dest ./fixture.conf --skip-reload
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, 'nginx-theme-routes.conf');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const destPath = arg('--dest', process.env.NGINX_CONF || '/opt/scalaro/nginx.conf');
const skipReload = process.argv.includes('--skip-reload') || process.env.SKIP_RELOAD === '1';
const dryRun = process.argv.includes('--dry-run');

export function serverBlock(text) {
  const start = text.search(/^server \{/m);
  if (start < 0) throw new Error('nginx-theme-routes.conf has no server block');
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('server block in nginx-theme-routes.conf is not closed');
}

/** Replace the server block that names otrace.co. Other servers stay put. */
export function replaceOtraceServer(live, block) {
  if (!/server_name\s+otrace\.co\s*;/.test(block)) {
    throw new Error('the repo server block does not name otrace.co');
  }
  const re = /server\s*\{/g;
  let match;
  while ((match = re.exec(live))) {
    let depth = 0;
    for (let i = match.index; i < live.length; i += 1) {
      if (live[i] === '{') depth += 1;
      else if (live[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          const current = live.slice(match.index, i + 1);
          if (/server_name\s+otrace\.co\s*;/.test(current)) {
            return live.slice(0, match.index) + block + live.slice(i + 1);
          }
          break;
        }
      }
    }
  }
  throw new Error(`no server { server_name otrace.co; } block in ${destPath}`);
}

function inode(file) {
  return fs.statSync(file).ino;
}

function reload(file) {
  const test = spawnSync('docker', ['exec', 'scalaro-nginx-1', 'nginx', '-t'], { encoding: 'utf8' });
  if (test.status !== 0) {
    throw new Error(`nginx -t failed:\n${test.stderr || test.stdout}`);
  }
  const reloadCmd = spawnSync('docker', ['exec', 'scalaro-nginx-1', 'nginx', '-s', 'reload'], { encoding: 'utf8' });
  if (reloadCmd.status !== 0) {
    throw new Error(`nginx reload failed:\n${reloadCmd.stderr || reloadCmd.stdout}`);
  }
  return file;
}

function main() {
  const block = serverBlock(fs.readFileSync(sourcePath, 'utf8'));
  if (!fs.existsSync(destPath)) {
    throw new Error(`${destPath} does not exist. Pass --dest. This script does not create the live mount.`);
  }
  const before = fs.readFileSync(destPath, 'utf8');
  const next = replaceOtraceServer(before, block);
  if (dryRun) {
    console.log(`dry-run: would update ${destPath} (${before.length} -> ${next.length} bytes)`);
    return;
  }
  const beforeIno = inode(destPath);
  const backup = `${destPath}.otrace-bak`;
  fs.writeFileSync(backup, before);
  fs.writeFileSync(destPath, next);
  const afterIno = inode(destPath);
  if (beforeIno !== afterIno) {
    throw new Error(`inode changed on ${destPath} (${beforeIno} -> ${afterIno}). The bind mount may have detached. Restore from ${backup}.`);
  }
  if (!skipReload) {
    try {
      reload(destPath);
    } catch (err) {
      fs.writeFileSync(destPath, before);
      throw err;
    }
  }
  console.log(`updated ${destPath} in place (inode ${afterIno}). backup ${backup}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    main();
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
