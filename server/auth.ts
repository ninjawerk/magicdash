/**
 * Admin authentication.
 *  - One admin password (scrypt-hashed) in data/auth.json. Set on first visit to /admin, via MAGICDASH_ADMIN_PASSWORD,
 *    or `npm run set-password <pw>` over SSH.
 *  - Browser sessions: signed, HttpOnly cookie (30 days).
 *  - API tokens (for the MCP server / automations): `Authorization: Bearer <token>`; stored hashed, shown once.
 *  - The kiosk view stays public; everything that changes state needs a session or token.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { DATA_DIR } from './storage';

interface AuthFile {
  passwordHash?: string; // scrypt$<salt hex>$<hash hex>
  sessionSecret: string;
  tokens: Array<{ id: string; name: string; hash: string; createdAt: string; lastUsedAt?: string }>;
}

const FILE = path.join(DATA_DIR, 'auth.json');
const SESSION_MS = 30 * 24 * 3600_000;
const COOKIE = 'md_session';
let auth: AuthFile = { sessionSecret: randomBytes(32).toString('hex'), tokens: [] };

async function save() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

export async function loadAuth() {
  try {
    const loaded = JSON.parse(await fs.readFile(FILE, 'utf8')) as Partial<AuthFile>;
    auth = { sessionSecret: loaded.sessionSecret ?? auth.sessionSecret, passwordHash: loaded.passwordHash, tokens: loaded.tokens ?? [] };
  } catch {
    await save();
  }
  const env = process.env.MAGICDASH_ADMIN_PASSWORD;
  if (env && !auth.passwordHash) {
    await setPassword(env);
    console.log('[auth] admin password set from MAGICDASH_ADMIN_PASSWORD');
  }
}

export function isConfigured() {
  return !!auth.passwordHash;
}

function hashPassword(pw: string, salt = randomBytes(16)) {
  const hash = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(pw: string) {
  if (!auth.passwordHash) return false;
  const [, saltHex, hashHex] = auth.passwordHash.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const got = scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, got);
}

export async function setPassword(pw: string) {
  if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
  auth.passwordHash = hashPassword(pw);
  auth.sessionSecret = randomBytes(32).toString('hex'); // invalidates existing sessions
  await save();
}

// --- sessions ------------------------------------------------------------------------
function sign(payload: string) {
  return createHmac('sha256', auth.sessionSecret).update(payload).digest('base64url');
}
function issueSession(): string {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
}
function verifySession(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const [exp, sig] = cookie.split('.');
  if (!exp || !sig) return false;
  const good = sign(exp);
  if (good.length !== sig.length || !timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return false;
  return Number(exp) > Date.now();
}
function readCookie(req: Request): string | undefined {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
function setCookie(res: Response, value: string, maxAgeSec: number) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`);
}

// --- tokens ----------------------------------------------------------------------------
const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');
function verifyToken(bearer: string | undefined): boolean {
  if (!bearer) return false;
  const h = tokenHash(bearer);
  const t = auth.tokens.find((x) => x.hash === h);
  if (!t) return false;
  t.lastUsedAt = new Date().toISOString();
  return true;
}

/** Is this request authenticated (session cookie or bearer token)? */
export function isAuthenticated(req: Request): boolean {
  if (!isConfigured()) return false;
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return verifySession(readCookie(req)) || verifyToken(bearer);
}

// --- rate limiting for login ---------------------------------------------------------------------
const attempts = new Map<string, { count: number; until: number }>();
function throttled(ip: string): number {
  const a = attempts.get(ip);
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
function recordFailure(ip: string) {
  const a = attempts.get(ip) ?? { count: 0, until: 0 };
  a.count++;
  if (a.count >= 5) a.until = Date.now() + Math.min(300_000, 2 ** (a.count - 5) * 15_000);
  attempts.set(ip, a);
}

// --- public route allowlist --------------------------------------------------------------------------
const PUBLIC: Array<[string, RegExp]> = [
  ['GET', /^\/api\/health$/],
  ['GET', /^\/api\/layout$/],
  ['GET', /^\/api\/plugins$/],
  ['GET', /^\/api\/plugins\/installed$/],
  ['GET', /^\/api\/plugins\/upload-enabled$/],
  ['GET', /^\/api\/settings\/[^/]+$/],
  ['GET', /^\/api\/events$/],
  ['GET', /^\/api\/catalog(\/sources)?$/],
  ['*', /^\/api\/auth\//],
  ['*', /^\/api\/plugins\/[a-z0-9-]+\/.+/], // plugin backends (widgets need them; HA toggles etc.)
  ['POST', /^\/api\/screens\/show$/],
  ['POST', /^\/api\/attention$/],
  ['POST', /^\/api\/notify$/],
  ['GET', /^\/api\/display$/],
  ['GET', /^\/api\/geocode$/],
  ['GET', /^\/api\/wallpapers(\/.+)?$/],
  ['POST', /^\/api\/devices\/heartbeat$/],
];
export function isPublic(req: Request): boolean {
  return PUBLIC.some(([m, re]) => (m === '*' || m === req.method) && re.test(req.path));
}

/** Express middleware: block state-changing / sensitive API routes without auth. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/') || isPublic(req)) return next();
  if (!isConfigured()) {
    res.status(401).json({ error: 'Admin password not set yet. Open /admin to set one.', code: 'setup-required' });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Sign in required.', code: 'unauthorized' });
    return;
  }
  next();
}

// --- routes ------------------------------------------------------------------------------------------------
export function registerAuthRoutes(app: Express) {
  app.get('/api/auth/status', (req, res) => {
    res.json({ configured: isConfigured(), authenticated: isAuthenticated(req) });
  });

  /** First-time setup: only while no password exists. */
  app.post('/api/auth/setup', async (req, res) => {
    if (isConfigured()) {
      res.status(409).json({ error: 'A password is already set. Sign in, then change it under Settings.' });
      return;
    }
    try {
      await setPassword(String((req.body ?? {}).password ?? ''));
      setCookie(res, issueSession(), SESSION_MS / 1000);
      console.log('[auth] admin password set');
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip ?? 'unknown';
    const wait = throttled(ip);
    if (wait) {
      res.status(429).json({ error: `Too many attempts. Try again in ${wait}s.` });
      return;
    }
    if (!isConfigured()) {
      res.status(400).json({ error: 'No password set yet.', code: 'setup-required' });
      return;
    }
    if (!verifyPassword(String((req.body ?? {}).password ?? ''))) {
      recordFailure(ip);
      console.warn(`[auth] failed login from ${ip}`);
      res.status(401).json({ error: 'Wrong password.' });
      return;
    }
    attempts.delete(ip);
    setCookie(res, issueSession(), SESSION_MS / 1000);
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', (_req, res) => {
    setCookie(res, '', 0);
    res.json({ ok: true });
  });

  app.post('/api/auth/password', async (req, res) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Sign in required.' });
      return;
    }
    const { current, password } = (req.body ?? {}) as { current?: string; password?: string };
    if (!verifyPassword(String(current ?? ''))) {
      res.status(401).json({ error: 'Current password is wrong.' });
      return;
    }
    try {
      await setPassword(String(password ?? ''));
      setCookie(res, issueSession(), SESSION_MS / 1000); // keep this browser signed in
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.get('/api/auth/tokens', (req, res) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Sign in required.' });
      return;
    }
    res.json(auth.tokens.map(({ hash: _h, ...t }) => t));
  });
  app.post('/api/auth/tokens', async (req, res) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Sign in required.' });
      return;
    }
    const name = String((req.body ?? {}).name ?? 'token').slice(0, 60);
    const token = `md_${randomBytes(24).toString('base64url')}`;
    auth.tokens.push({ id: randomBytes(6).toString('hex'), name, hash: tokenHash(token), createdAt: new Date().toISOString() });
    await save();
    res.json({ ok: true, token, name, note: 'Shown once — copy it now.' });
  });
  app.delete('/api/auth/tokens/:id', async (req, res) => {
    if (!isAuthenticated(req)) {
      res.status(401).json({ error: 'Sign in required.' });
      return;
    }
    auth.tokens = auth.tokens.filter((t) => t.id !== req.params.id);
    await save();
    res.json({ ok: true });
  });
}
