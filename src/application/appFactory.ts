/**
 * Express Application Factory
 * 
 * Creates Express app with all routes and middleware.
 * All dependencies injected via parameters (Dependency Inversion Principle).
 */

import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { AppConfig } from '../infrastructure/config';
import { getLanIPv4Candidates } from '../infrastructure/config';
import { renderHomePage } from '../interface/html';
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
      version: '0.2.0',
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
   * GET / - Homepage with HTML UI
   */
  app.get('/', (_req, res) => {
    res.type('html').send(renderHomePage());
  });

  /**
   * GET /api/status - Server and session status
   */
  app.get('/api/status', (req, res) => {
    res.json(buildStatusDto(req));
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

    const { stream, mimeType, filename, target } = result.value;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

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
