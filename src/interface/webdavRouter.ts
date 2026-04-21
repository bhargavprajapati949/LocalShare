/**
 * WebDAV Router
 *
 * Implements RFC 4918 WebDAV over the existing FileSystemPort.
 * Mounted at /dav so clients connect to http://host:port/dav/:rootId/
 *
 * Supported methods:
 *   OPTIONS, PROPFIND, GET, HEAD, PUT, MKCOL, DELETE, COPY, MOVE, LOCK, UNLOCK
 *
 * Authentication:
 *   If a session PIN is set, clients must provide it via:
 *     - HTTP Basic Auth (any username, password = PIN)
 *     - x-session-pin header
 *     - ?pin query param
 *
 * Notes:
 *   - PROPFIND Depth: infinity is treated as 1 (prevent DoS on large trees)
 *   - LOCK is in-memory only; tokens are lost on restart
 *   - COPY/MOVE across roots is not supported (WebDAV clients rarely need it)
 */

import path from 'node:path';
import fsp from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { FileSystemPort, HostSessionPort, ResolvedTarget } from '../domain/ports';
import type { AppConfig } from '../infrastructure/config';
import { FileNotFoundError, PathTraversalError } from '../domain/errors';

// ── Types ────────────────────────────────────────────────────────────────────

interface LockEntry {
  readonly token: string;
  readonly path: string;
  readonly owner: string;
  readonly depth: string;
  readonly scope: string;
  readonly type: string;
  expiresAt: number;
}

interface PropEntry {
  href: string;
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: Date;
  contentType: string;
}

// ── Lock store ───────────────────────────────────────────────────────────────

const lockStore = new Map<string, LockEntry>();
const LOCK_DEFAULT_TIMEOUT_SECONDS = 300;

function cleanExpiredLocks(): void {
  const now = Date.now();
  for (const [token, entry] of lockStore) {
    if (entry.expiresAt < now) lockStore.delete(token);
  }
}

function findLockByPath(davPath: string): LockEntry | undefined {
  cleanExpiredLocks();
  for (const entry of lockStore.values()) {
    if (entry.path === davPath) return entry;
  }
  return undefined;
}

function findLockByToken(token: string): LockEntry | undefined {
  cleanExpiredLocks();
  return lockStore.get(token);
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function buildMultistatusXml(entries: PropEntry[]): string {
  const responses = entries
    .map((e) => {
      const resourceType = e.isDirectory ? '<D:resourcetype><D:collection/></D:resourcetype>' : '<D:resourcetype/>';
      return `  <D:response>
    <D:href>${xmlEscape(e.href)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${xmlEscape(e.name)}</D:displayname>
        ${resourceType}
        <D:getcontentlength>${e.isDirectory ? '0' : String(e.size)}</D:getcontentlength>
        <D:getcontenttype>${e.isDirectory ? 'httpd/unix-directory' : xmlEscape(e.contentType)}</D:getcontenttype>
        <D:getlastmodified>${e.mtime.toUTCString()}</D:getlastmodified>
        <D:creationdate>${e.mtime.toISOString()}</D:creationdate>
        <D:getetag>"${e.mtime.getTime().toString(16)}-${e.size.toString(16)}"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">\n${responses}\n</D:multistatus>`;
}

function buildLockResponseXml(lock: LockEntry, timeoutSeconds: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:${lock.scope}/></D:lockscope>
      <D:depth>${lock.depth}</D:depth>
      <D:owner><D:href>${xmlEscape(lock.owner)}</D:href></D:owner>
      <D:timeout>Second-${timeoutSeconds}</D:timeout>
      <D:locktoken><D:href>urn:uuid:${xmlEscape(lock.token)}</D:href></D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;
}

// ── Path helpers ─────────────────────────────────────────────────────────────

function parseDavPath(reqPath: string): { rootId: string; relPath: string } | null {
  const trimmed = reqPath.replace(/^\//, '');
  if (!trimmed) return null;
  const slashIdx = trimmed.indexOf('/');
  if (slashIdx === -1) return { rootId: trimmed, relPath: '' };
  return { rootId: trimmed.slice(0, slashIdx), relPath: trimmed.slice(slashIdx + 1).replace(/\/$/, '') };
}

function buildHref(davBase: string, rootId: string, relPath: string): string {
  return `${davBase}/${rootId}${relPath ? `/${relPath}` : ''}`;
}

function parseDestinationHeader(dest: string, davBase: string): { rootId: string; relPath: string } | null {
  try {
    const url = new URL(dest);
    const pathPart = decodeURIComponent(url.pathname);
    const prefix = davBase.startsWith('/') ? davBase : `/${davBase}`;
    if (!pathPart.startsWith(prefix)) return null;
    return parseDavPath(pathPart.slice(prefix.length));
  } catch {
    return null;
  }
}

function parseTimeoutHeader(header: string | undefined): number {
  if (!header) return LOCK_DEFAULT_TIMEOUT_SECONDS;
  const match = header.match(/Second-(\d+)/i);
  if (!match) return LOCK_DEFAULT_TIMEOUT_SECONDS;
  const seconds = parseInt(match[1], 10);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : LOCK_DEFAULT_TIMEOUT_SECONDS;
}

// ── Router factory ───────────────────────────────────────────────────────────

export function createDavRouter(
  fileSystem: FileSystemPort,
  sessionState: HostSessionPort,
  config: AppConfig,
  davBase: string = '/dav',
): express.Router {
  const router = express.Router();

  // Auth + sharing guard
  router.use((_req: Request, res: Response, next: NextFunction): void => {
    const effectivePin = sessionState.getSessionPin() ?? config.sessionPin;

    if (effectivePin) {
      const headerPin = String(_req.headers['x-session-pin'] || _req.query.pin || '').trim();
      if (headerPin === effectivePin) {
        // PIN supplied via header/query - fall through
      } else {
        const authHeader = _req.headers.authorization || '';
        if (authHeader.startsWith('Basic ')) {
          const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
          const colonIdx = decoded.indexOf(':');
          const password = colonIdx !== -1 ? decoded.slice(colonIdx + 1) : decoded;
          if (password === effectivePin) {
            // Basic auth OK - fall through
          } else {
            res.setHeader('WWW-Authenticate', 'Basic realm="LAN File Host WebDAV"');
            res.status(401).end('Unauthorized');
            return;
          }
        } else {
          res.setHeader('WWW-Authenticate', 'Basic realm="LAN File Host WebDAV"');
          res.status(401).end('Unauthorized');
          return;
        }
      }
    }

    if (!sessionState.isSharingActive()) {
      res.status(503).end('Sharing is currently stopped');
      return;
    }

    if (!sessionState.isWebdavEnabled()) {
      res.status(503).end('WebDAV mode is disabled by host');
      return;
    }

    next();
  });

  // Collect raw body for PUT and LOCK
  router.use(express.raw({ type: '*/*', limit: '51200mb' }));

  // Resolve target helper
  function resolveOrFail(rootId: string, relPath: string, res: Response): ResolvedTarget | null {
    const result = fileSystem.resolveTarget(rootId, relPath);
    if (!result.ok) {
      res.status(result.error instanceof PathTraversalError ? 403 : 400).end(result.error.message);
      return null;
    }
    return result.value;
  }

  // Main DAV dispatch handler
  router.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const method = req.method.toUpperCase();

    if ((method === 'PROPFIND' || method === 'GET' || method === 'HEAD') && !sessionState.isReadEnabled()) {
      res.status(403).end('Read operations are disabled by host');
      return;
    }

    if (method === 'OPTIONS') {
      res.setHeader('DAV', '1, 2');
      res.setHeader('Allow', 'OPTIONS, PROPFIND, GET, HEAD, PUT, MKCOL, DELETE, COPY, MOVE, LOCK, UNLOCK');
      res.setHeader('MS-Author-Via', 'DAV');
      res.status(200).end();
      return;
    }

    if (method === 'PROPFIND') {
      const parsed = parseDavPath(req.path);
      if (!parsed) {
        const entries: PropEntry[] = [
          { href: `${davBase}/`, name: 'LAN File Host', isDirectory: true, size: 0, mtime: new Date(), contentType: 'httpd/unix-directory' },
          ...config.roots.map((root) => ({
            href: `${davBase}/${root.id}/`, name: root.name, isDirectory: true, size: 0, mtime: new Date(), contentType: 'httpd/unix-directory',
          })),
        ];
        res.status(207).type('application/xml; charset=utf-8').send(buildMultistatusXml(entries));
        return;
      }

      const { rootId, relPath } = parsed;
      const target = resolveOrFail(rootId, relPath, res);
      if (!target) return;

      const depth = String(req.headers['depth'] || '1') === '0' ? 0 : 1;
      const statResult = await fileSystem.statTarget(target);
      if (!statResult.ok) {
        res.status(statResult.error instanceof FileNotFoundError ? 404 : 500).end(statResult.error.message);
        return;
      }
      const stat = statResult.value;

      let mtime = new Date();
      try { mtime = (await fsp.stat(target.absPath)).mtime; } catch { /* best effort */ }

      const displayName = relPath ? path.basename(relPath) : (config.roots.find((r) => r.id === rootId)?.name ?? rootId);
      const hrefSelf = buildHref(davBase, rootId, relPath) + (stat.isDirectory ? '/' : '');

      const entries: PropEntry[] = [{
        href: hrefSelf, name: displayName, isDirectory: stat.isDirectory,
        size: stat.size, mtime, contentType: stat.isDirectory ? 'httpd/unix-directory' : fileSystem.getContentType(path.basename(target.absPath)),
      }];

      if (depth >= 1 && stat.isDirectory) {
        const listResult = await fileSystem.listDirectory(target);
        if (listResult.ok) {
          for (const child of listResult.value) {
            let childMtime = new Date();
            try { childMtime = (await fsp.stat(path.join(target.absPath, child.name))).mtime; } catch { /* best effort */ }
            entries.push({
              href: buildHref(davBase, rootId, child.relPath) + (child.isDirectory ? '/' : ''),
              name: child.name, isDirectory: child.isDirectory, size: child.size, mtime: childMtime,
              contentType: child.isDirectory ? 'httpd/unix-directory' : fileSystem.getContentType(child.name),
            });
          }
        }
      }

      res.status(207).type('application/xml; charset=utf-8').send(buildMultistatusXml(entries));
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      const parsed = parseDavPath(req.path);
      if (!parsed) { res.status(400).end('Bad Request'); return; }

      const target = resolveOrFail(parsed.rootId, parsed.relPath, res);
      if (!target) return;

      const statResult = await fileSystem.statTarget(target);
      if (!statResult.ok) {
        res.status(statResult.error instanceof FileNotFoundError ? 404 : 500).end(statResult.error.message);
        return;
      }

      if (statResult.value.isDirectory) {
        res.status(301).setHeader('Location', `${davBase}/${parsed.rootId}/${parsed.relPath}/`).end();
        return;
      }

      res.setHeader('Content-Type', fileSystem.getContentType(path.basename(target.absPath)));
      res.setHeader('Content-Length', String(statResult.value.size));
      if (method === 'HEAD') { res.status(200).end(); return; }

      const stream = fileSystem.createDownloadStream(target.absPath);
      stream.on('error', () => res.destroy());
      (stream as NodeJS.ReadableStream).pipe(res);
      return;
    }

    if (method === 'PUT') {
      if (!sessionState.isModifyEnabled() && !sessionState.isUploadEnabled()) {
        res.status(403).end('Upload is disabled'); return;
      }
      const parsed = parseDavPath(req.path);
      if (!parsed || !parsed.relPath) { res.status(400).end('Bad Request'); return; }

      const parentRelPath = path.dirname(parsed.relPath) === '.' ? '' : path.dirname(parsed.relPath);
      const parentTarget = resolveOrFail(parsed.rootId, parentRelPath, res);
      if (!parentTarget) return;

      const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const saveResult = await fileSystem.saveUploadedFile(parentTarget, path.basename(parsed.relPath), data);
      if (!saveResult.ok) { res.status(500).end(saveResult.error.message); return; }

      res.status(201).end();
      return;
    }

    if (method === 'MKCOL') {
      if (!sessionState.isModifyEnabled()) { res.status(403).end('Directory creation is disabled'); return; }
      const parsed = parseDavPath(req.path);
      if (!parsed || !parsed.relPath) { res.status(405).end('Cannot MKCOL at root'); return; }

      const parentRelPath = path.dirname(parsed.relPath) === '.' ? '' : path.dirname(parsed.relPath);
      const parentTarget = resolveOrFail(parsed.rootId, parentRelPath, res);
      if (!parentTarget) return;

      const result = await fileSystem.createDirectory(parentTarget, path.basename(parsed.relPath));
      if (!result.ok) {
        res.status(result.error.message.includes('already exists') ? 405 : 409).end(result.error.message);
        return;
      }
      res.status(201).end();
      return;
    }

    if (method === 'DELETE') {
      if (!sessionState.isDeleteEnabled()) { res.status(403).end('Delete is disabled'); return; }
      const parsed = parseDavPath(req.path);
      if (!parsed || !parsed.relPath) { res.status(403).end('Cannot delete root'); return; }

      const target = resolveOrFail(parsed.rootId, parsed.relPath, res);
      if (!target) return;

      const result = await fileSystem.deleteEntry(target);
      if (!result.ok) {
        res.status(result.error instanceof FileNotFoundError ? 404 : 500).end(result.error.message);
        return;
      }

      for (const [token, lock] of lockStore) {
        if (lock.path.startsWith(buildHref(davBase, parsed.rootId, parsed.relPath))) lockStore.delete(token);
      }
      res.status(204).end();
      return;
    }

    if (method === 'COPY' || method === 'MOVE') {
      if (!sessionState.isModifyEnabled()) { res.status(403).end(`${method} is disabled`); return; }
      const parsed = parseDavPath(req.path);
      if (!parsed || !parsed.relPath) { res.status(403).end(`Cannot ${method} root`); return; }

      const destHeader = String(req.headers['destination'] || '');
      if (!destHeader) { res.status(400).end('Destination header required'); return; }

      const destParsed = parseDestinationHeader(destHeader, davBase);
      if (!destParsed) { res.status(400).end('Invalid Destination header'); return; }
      if (destParsed.rootId !== parsed.rootId) { res.status(502).end(`Cross-root ${method} is not supported`); return; }

      const overwrite = String(req.headers['overwrite'] || 'T').toUpperCase() !== 'F';
      const source = resolveOrFail(parsed.rootId, parsed.relPath, res);
      if (!source) return;
      const dest = resolveOrFail(destParsed.rootId, destParsed.relPath, res);
      if (!dest) return;

      const result = method === 'COPY'
        ? await fileSystem.copyEntry(source, dest.absPath, overwrite)
        : await fileSystem.moveEntry(source, dest.absPath, overwrite);

      if (!result.ok) {
        if (result.error.message.includes('already exists')) res.status(412).end('Destination exists');
        else if (result.error instanceof FileNotFoundError) res.status(404).end(result.error.message);
        else res.status(500).end(result.error.message);
        return;
      }

      if (method === 'MOVE') {
        for (const [token, lock] of lockStore) {
          if (lock.path === buildHref(davBase, parsed.rootId, parsed.relPath)) lockStore.delete(token);
        }
      }
      res.status(204).end();
      return;
    }

    if (method === 'LOCK') {
      const parsed = parseDavPath(req.path);
      if (!parsed) { res.status(400).end('Bad Request'); return; }

      const lockPath = buildHref(davBase, parsed.rootId, parsed.relPath);
      const ifHeader = String(req.headers['if'] || '');
      const refreshMatch = ifHeader.match(/urn:uuid:([0-9a-f-]+)/i);
      if (refreshMatch) {
        const existing = findLockByToken(refreshMatch[1]);
        if (existing && existing.path === lockPath) {
          const timeoutSeconds = parseTimeoutHeader(req.headers['timeout'] as string | undefined);
          existing.expiresAt = Date.now() + timeoutSeconds * 1000;
          res.setHeader('Lock-Token', `<urn:uuid:${refreshMatch[1]}>`);
          res.status(200).type('application/xml; charset=utf-8').send(buildLockResponseXml(existing, timeoutSeconds));
          return;
        }
      }

      if (findLockByPath(lockPath)) { res.status(423).end('Locked'); return; }

      const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : String(req.body || '');
      const scope = bodyStr.includes('<D:shared>') || bodyStr.includes('<shared/>') ? 'shared' : 'exclusive';
      const ownerMatch = bodyStr.match(/<D:href>(.*?)<\/D:href>/);
      const timeoutSeconds = parseTimeoutHeader(req.headers['timeout'] as string | undefined);
      const lock: LockEntry = {
        token: randomUUID(),
        path: lockPath,
        owner: ownerMatch ? ownerMatch[1] : 'unknown',
        depth: String(req.headers['depth'] || '0'),
        scope,
        type: 'write',
        expiresAt: Date.now() + timeoutSeconds * 1000,
      };
      lockStore.set(lock.token, lock);
      res.setHeader('Lock-Token', `<urn:uuid:${lock.token}>`);
      res.status(200).type('application/xml; charset=utf-8').send(buildLockResponseXml(lock, timeoutSeconds));
      return;
    }

    if (method === 'UNLOCK') {
      const lockTokenHeader = String(req.headers['lock-token'] || '');
      const tokenMatch = lockTokenHeader.match(/urn:uuid:([0-9a-f-]+)/i);
      if (!tokenMatch) { res.status(400).end('Missing Lock-Token header'); return; }
      lockStore.delete(tokenMatch[1]);
      res.status(204).end();
      return;
    }

    next();
  });

  return router;
}
