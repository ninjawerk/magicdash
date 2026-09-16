/** Self-update: compare with the git remote and the latest GitHub release; pull, install, build, restart. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import type { Express } from 'express';
import { broadcast } from './events';
import { HOST_VERSION } from './version';

const run = promisify(execFile);
const IS_PROD = process.env.NODE_ENV === 'production';
const REPO = process.env.MAGICDASH_REPO ?? 'ninjawerk/magicdash';
let running = false;
let releaseCache: { at: number; data: unknown } | undefined;

async function git(...args: string[]) {
  const { stdout } = await run('git', args, { cwd: process.cwd(), timeout: 30_000 });
  return stdout.trim();
}

export async function updateStatus() {
  const isGit = existsSync('.git');
  const info: Record<string, unknown> = { version: HOST_VERSION, git: { available: isGit } };
  if (isGit) {
    try {
      const [branch, commit, dirty] = await Promise.all([git('rev-parse', '--abbrev-ref', 'HEAD'), git('rev-parse', '--short', 'HEAD'), git('status', '--porcelain', '--untracked-files=no')]);
      let behind = 0;
      let remoteCommit: string | undefined;
      let fetchError: string | undefined;
      try {
        await git('fetch', '--quiet', 'origin');
        behind = Number(await git('rev-list', '--count', 'HEAD..@{u}')) || 0;
        remoteCommit = await git('rev-parse', '--short', '@{u}');
      } catch (e) {
        const m = (e as Error).message;
        fetchError = /@\{u\}|upstream/.test(m) ? 'this branch has no upstream to compare with' : m.split('\n')[0];
      }
      info.git = { available: true, branch, commit, dirty: dirty.length > 0, behind, remoteCommit, fetchError };
    } catch (e) {
      info.git = { available: true, error: (e as Error).message };
    }
  }
  try {
    if (!releaseCache || Date.now() - releaseCache.at > 30 * 60_000) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'user-agent': `MagicDash/${HOST_VERSION}`, accept: 'application/vnd.github+json' } });
      if (r.ok) {
        const rel = (await r.json()) as { tag_name: string; name: string; published_at: string; html_url: string; body?: string };
        releaseCache = { at: Date.now(), data: { tag: rel.tag_name, name: rel.name, publishedAt: rel.published_at, url: rel.html_url, notes: rel.body?.slice(0, 2000) } };
      } else if (r.status === 404) releaseCache = { at: Date.now(), data: null };
    }
    info.latestRelease = releaseCache?.data ?? null;
  } catch (e) {
    info.releaseError = (e as Error).message;
  }
  const g = info.git as { behind?: number };
  info.updateAvailable = (g.behind ?? 0) > 0;
  info.running = running;
  info.prod = IS_PROD;
  return info;
}

/** git pull → npm ci → npm run build, streaming lines as $host/update; restarts in production. */
export async function runUpdate(): Promise<void> {
  if (running) throw new Error('An update is already running.');
  if (!existsSync('.git')) throw new Error('This install is not a git checkout; update it the way it was installed.');
  running = true;
  const say = (line: string) => broadcast({ plugin: '$host', event: 'update', payload: { line } });
  const step = (cmd: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      say(`$ ${cmd} ${args.join(' ')}`);
      const child = execFile(cmd, args, { cwd: process.cwd(), env: { ...process.env, FORCE_COLOR: '0', NODE_ENV: 'production' }, maxBuffer: 50 * 1024 * 1024 });
      child.stdout?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach(say));
      child.stderr?.on('data', (d) => String(d).split('\n').filter(Boolean).forEach(say));
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
    });
  try {
    await step('git', ['pull', '--ff-only']);
    await step('npm', ['ci', '--no-audit', '--no-fund']);
    await step('npm', ['run', 'build']);
    say('✔ Update complete.');
    if (IS_PROD) {
      say('Restarting server…');
      broadcast({ plugin: '$host', event: 'restarting', payload: { prod: true } });
      setTimeout(() => process.exit(0), 700);
    } else say('Dev mode: restart `npm run dev` to load server changes.');
  } finally {
    running = false;
  }
}

async function cpuTemp(): Promise<number | undefined> {
  try {
    return Number(await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000;
  } catch {
    return undefined;
  }
}

export function registerUpdateRoutes(app: Express) {
  app.get('/api/update/status', async (_req, res) => res.json(await updateStatus()));
  app.post('/api/update/run', async (_req, res) => {
    try {
      res.json({ ok: true, started: true });
      await runUpdate();
    } catch (e) {
      broadcast({ plugin: '$host', event: 'update', payload: { line: `✖ ${(e as Error).message}`, error: true } });
    }
  });
  app.post('/api/system/restart', (_req, res) => {
    res.json({ ok: true, prod: IS_PROD });
    if (IS_PROD) {
      broadcast({ plugin: '$host', event: 'restarting', payload: { prod: true } });
      setTimeout(() => process.exit(0), 500);
    }
  });
  app.get('/api/system/info', async (_req, res) => {
    res.json({
      version: HOST_VERSION,
      node: process.version,
      platform: `${os.type()} ${os.release()} ${os.arch()}`,
      hostname: os.hostname(),
      uptimeSec: Math.round(process.uptime()),
      systemUptimeSec: Math.round(os.uptime()),
      memory: { total: os.totalmem(), free: os.freemem(), rss: process.memoryUsage().rss },
      load: os.loadavg(),
      cpuTemp: await cpuTemp(),
      prod: IS_PROD,
      cwd: process.cwd(),
    });
  });
}
