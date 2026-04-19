/**
 * Express Application Factory
 * 
 * Creates Express app with all routes and middleware.
 * All dependencies injected via parameters (Dependency Inversion Principle).
 */

import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { AppConfig } from '../infrastructure/config';
import { getLanIPv4Candidates } from '../infrastructure/config';
import { generateQrDataUrl } from '../infrastructure/qrService';
import { renderHomePage, renderClientUI, renderAdminUI } from '../interface/html';
import { isLoopbackAddress } from '../domain/models/hostSession';
import type { FileSystemPort, HostSessionPort } from '../domain/ports';
import type { ListFilesUseCase } from './useCases/listFiles';
import type { DownloadFileUseCase } from './useCases/downloadFile';
import { isDomainError } from '../domain/errors';

/**
 * HTTP status codes for error responses
 */
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const execFileAsync = promisify(execFile);

interface AppContext {
  readonly app: express.Express;
  readonly sessionState: HostSessionPort;
}

/**
 * Create Express application with injected dependencies
 * @param config - Application configuration
 * @param sessionState - Host session (injectable for testing)
 * @param listFilesUseCase - Use case for directory listing
 * @param downloadFileUseCase - Use case for file download
 * @returns App context with Express instance
 */
export function createApp(
  config: AppConfig,
  sessionState: HostSessionPort,
  listFilesUseCase: ListFilesUseCase,
  downloadFileUseCase: DownloadFileUseCase,
): AppContext {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // ============ Response DTO builders ============

  /**
   * Build status payload (DTO)
   */
  function buildStatusDto(req: Request) {
    const lanAddresses = getLanIPv4Candidates();
    const snapshot = sessionState.getSnapshot();

    return {
      appName: 'LAN File Host',
      version: '1.0.0',
      host: config.host,
      port: config.port,
      requiresPin: Boolean(config.sessionPin),
      securityMode: config.sessionPin ? 'pin-protected' : 'open-local-network',
      roots: config.roots,
      lanAddresses,
      lanUrls: lanAddresses.map((ip) => `http://${ip}:${config.port}`),
      canControlHost: isLoopbackAddress(req.socket.remoteAddress),
      controlHostApiLocalOnly: true,
      sharingActive: snapshot.sharingActive,
      lastStartedAt: snapshot.lastStartedAt,
      lastStoppedAt: snapshot.lastStoppedAt,
    };
  }

  // ============ Middleware ============

  /**
   * Middleware: Check PIN if configured
   */
  function requirePin(_req: Request, res: Response, next: NextFunction): void {
    if (!config.sessionPin) {
      next();
      return;
    }

    const suppliedPin = String(_req.headers['x-session-pin'] || _req.query.pin || '').trim();
    if (suppliedPin !== config.sessionPin) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'PIN required or invalid PIN' });
      return;
    }

    next();
  }

  /**
   * Middleware: Require localhost-only access
   */
  function requireLocalControl(req: Request, res: Response, next: NextFunction): void {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Host start/stop controls are only allowed from localhost',
      });
      return;
    }

    next();
  }

  // ============ Routes ============

  /**
   * GET / - Client UI (file browsing and downloads)
   */
  app.get('/', (_req, res) => {
    res.type('html').send(renderClientUI());
  });

  /**
   * GET /admin - Admin UI (host controls, localhost only)
   */
  app.get('/admin', (req, res) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Admin panel is only accessible from localhost',
      });
      return;
    }
    res.type('html').send(renderAdminUI());
  });

  /**
   * GET /api/status - Server and session status
   */
  app.get('/api/status', (req, res) => {
    res.json(buildStatusDto(req));
  });

  /**
   * GET /api/qr - QR code PNG (data URL) for the primary LAN URL
   * Generates QR for the server's own address; no client-supplied URL accepted.
   */
  app.get('/api/qr', async (_req, res) => {
    const candidates = getLanIPv4Candidates();
    const primaryIp = candidates[0] ?? '127.0.0.1';
    const url = `http://${primaryIp}:${config.port}`;

    try {
      const dataUrl = await generateQrDataUrl(url);
      res.json({ url, dataUrl });
    } catch {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate QR code',
        code: 'QR_GENERATION_FAILED',
      });
    }
  });

  /**
   * POST /api/host/start - Start file sharing (localhost only)
   */
  app.post('/api/host/start', requireLocalControl, (req, res) => {
    const snapshot = sessionState.startSharing();
    res.json({
      message: 'Sharing started',
      ...snapshot,
    });
  });

  /**
   * POST /api/host/stop - Stop file sharing (localhost only)
   */
  app.post('/api/host/stop', requireLocalControl, (req, res) => {
    const snapshot = sessionState.stopSharing();
    res.json({
      message: 'Sharing stopped',
      ...snapshot,
    });
  });

  /**
   * POST /api/host/share-root - Update shared root directory (localhost only)
   */
  app.post('/api/host/share-root', requireLocalControl, async (req, res) => {
    const candidate = String(req.body?.absPath || '').trim();
    if (!candidate) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'absPath is required',
        code: 'INVALID_SHARE_ROOT',
      });
      return;
    }

    const absPath = path.resolve(candidate);

    try {
      const stat = await fsp.stat(absPath);
      if (!stat.isDirectory()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'absPath must point to a directory',
          code: 'INVALID_SHARE_ROOT',
        });
        return;
      }
    } catch {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Directory does not exist or is inaccessible',
        code: 'INVALID_SHARE_ROOT',
      });
      return;
    }

    const updatedRoot = {
      id: '0',
      name: path.basename(absPath) || absPath,
      absPath,
    };

    // Keep the same array reference so infrastructure adapters using config.roots
    // observe updates without needing reinjection.
    config.roots.splice(0, config.roots.length, updatedRoot);

    res.json({
      message: 'Shared root updated',
      roots: config.roots,
    });
  });

  /**
   * POST /api/host/pick-share-root - Open native folder picker and update shared root
   * Currently supports macOS (osascript). Other platforms return not implemented.
   */
  app.post('/api/host/pick-share-root', requireLocalControl, async (_req, res) => {
    if (process.platform !== 'darwin') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Native directory picker is currently supported on macOS only',
        code: 'UNSUPPORTED_PLATFORM',
      });
      return;
    }

    try {
      const { stdout } = await execFileAsync('osascript', [
        '-e',
        'POSIX path of (choose folder with prompt "Select shared directory")',
      ]);

      const picked = stdout.trim();
      if (!picked) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'No directory selected',
          code: 'PICKER_CANCELED',
        });
        return;
      }

      const absPath = path.resolve(picked);
      const stat = await fsp.stat(absPath);
      if (!stat.isDirectory()) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Selected path is not a directory',
          code: 'INVALID_SHARE_ROOT',
        });
        return;
      }

      const updatedRoot = {
        id: '0',
        name: path.basename(absPath) || absPath,
        absPath,
      };

      config.roots.splice(0, config.roots.length, updatedRoot);

      res.json({
        message: 'Shared root updated from picker',
        roots: config.roots,
        absPath,
      });
    } catch {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Directory picker was canceled or failed',
        code: 'PICKER_CANCELED',
      });
    }
  });

  /**
   * GET /api/list - List directory contents
   */
  app.get('/api/list', requirePin, async (req, res) => {
    const rootId = String(req.query.root || '0');
    const relPath = String(req.query.path || '');

    const result = await listFilesUseCase.execute(rootId, relPath);

    if (!result.ok) {
      const error = result.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    const { target, entries } = result.value;
    res.json({
      root: { id: target.rootId, name: config.roots.find((r) => r.id === target.rootId)?.name },
      path: target.relPath,
      entries,
    });
  });

  /**
   * GET /api/download - Download a file
   */
  app.get('/api/download', requirePin, async (req, res) => {
    const rootId = String(req.query.root || '0');
    const relPath = String(req.query.path || '');

    const result = await downloadFileUseCase.execute(rootId, relPath);

    if (!result.ok) {
      const error = result.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    const { stream, mimeType, filename, target, size } = result.value;

    const rangeHeader = String(req.headers.range || '').trim();
    const rangeMatch = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);

    if (rangeHeader && !rangeMatch) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).json({
        error: 'Invalid Range header',
        code: 'INVALID_RANGE',
      });
      return;
    }

    if (rangeMatch) {
      const parsedStart = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
      const parsedEnd = rangeMatch[2] ? Number(rangeMatch[2]) : size - 1;

      const start = Number.isFinite(parsedStart) ? parsedStart : 0;
      const end = Number.isFinite(parsedEnd) ? parsedEnd : size - 1;

      if (start < 0 || end < 0 || start >= size || end >= size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`).json({
          error: 'Requested range not satisfiable',
          code: 'RANGE_NOT_SATISFIABLE',
        });
        return;
      }

      const chunkSize = end - start + 1;
      const partialStream = fs.createReadStream(target.absPath, { start, end });

      res.status(206);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

      partialStream.on('error', () => {
        if (!res.headersSent) {
          res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: 'Unable to read file segment',
            code: 'STREAM_ERROR',
          });
        }
      });

      partialStream.pipe(res);
      return;
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', size);

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Unable to read file',
          code: 'STREAM_ERROR',
        });
      }
    });

    stream.pipe(res);
  });

  return { app, sessionState };
}
