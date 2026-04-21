/**
 * Express Application Factory
 * 
 * Creates Express app with all routes and middleware.
 * All dependencies injected via parameters (Dependency Inversion Principle).
 */

import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import type { AppConfig } from '../infrastructure/config';
import { getDefaultMdnsDomainName, getLanIPv4Candidates } from '../infrastructure/config';
import { generateQrDataUrl } from '../infrastructure/qrService';
import { renderHomePage, renderClientUI, renderAdminUI } from '../interface/html';
import { isLoopbackAddress } from '../domain/models/hostSession';
import type { FileSystemPort, HostSessionPort } from '../domain/ports';
import type { ListFilesUseCase } from './useCases/listFiles';
import type { DownloadFileUseCase } from './useCases/downloadFile';
import type { DownloadDirectoryUseCase } from './useCases/downloadDirectory';
import type { UploadFileUseCase } from './useCases/uploadFile';
import type { CreateDirectoryUseCase } from './useCases/createDirectory';
import type { DeleteEntryUseCase } from './useCases/deleteEntry';
import { isDomainError } from '../domain/errors';
import { createDavRouter } from '../interface/webdavRouter';

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

type ResumableUploadSession = {
  readonly uploadId: string;
  readonly filename: string;
  readonly rootId: string;
  readonly relPath: string;
  readonly totalSize: number;
  readonly tempFilePath: string;
  receivedBytes: number;
  createdAt: number;
};

interface AppContext {
  readonly app: express.Express;
  readonly sessionState: HostSessionPort;
}

/**
 * Create Express application with injected dependencies
 * @param config - Application configuration
 * @param sessionState - Host session (injectable for testing)
 * @param fileSystem - File system port implementation
 * @param listFilesUseCase - Use case for directory listing
 * @param downloadFileUseCase - Use case for file download
 * @param downloadDirectoryUseCase - Use case for directory download as ZIP
 * @param uploadFileUseCase - Use case for file upload
 * @returns App context with Express instance
 */
export function createApp(
  config: AppConfig,
  sessionState: HostSessionPort,
  fileSystem: FileSystemPort,
  listFilesUseCase: ListFilesUseCase,
  downloadFileUseCase: DownloadFileUseCase,
  downloadDirectoryUseCase: DownloadDirectoryUseCase,
  uploadFileUseCase: UploadFileUseCase,
  createDirectoryUseCase: CreateDirectoryUseCase,
  deleteEntryUseCase: DeleteEntryUseCase,
  onDomainNameChanged?: (domainName: string | undefined) => void,
): AppContext {
  const app = express();
  const resumableUploads = new Map<string, ResumableUploadSession>();
  const uploadTmpDir = path.join(os.tmpdir(), 'lan-file-host-uploads');
  const CHUNK_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

  // Mount WebDAV before CORS so DAV methods/options are handled by DAV semantics.
  app.use('/dav', createDavRouter(fileSystem, sessionState, config, '/dav'));

  app.use(cors());
  app.use(express.json());

  // ============ Response DTO builders ============

  /**
   * Build status payload (DTO)
   */
  function buildStatusDto(req: Request) {
    const lanAddresses = getLanIPv4Candidates();
    const snapshot = sessionState.getSnapshot();
    const domainName = (sessionState.getDomainName() || config.customDomainName || getDefaultMdnsDomainName()).trim().toLowerCase();
    const effectivePin = sessionState.getSessionPin() ?? config.sessionPin;

    return {
      appName: 'LAN File Host',
      version: '1.0.0',
      host: config.host,
      port: config.port,
      requiresPin: Boolean(effectivePin),
      securityMode: effectivePin ? 'pin-protected' : 'open-local-network',
      roots: config.roots,
      lanAddresses,
      lanUrls: lanAddresses.map((ip) => `http://${ip}:${config.port}`),
      canControlHost: isLoopbackAddress(req.socket.remoteAddress),
      controlHostApiLocalOnly: true,
      sharingActive: snapshot.sharingActive,
      lastStartedAt: snapshot.lastStartedAt,
      lastStoppedAt: snapshot.lastStoppedAt,
      domainName,
      mdnsEnabled: config.mdnsEnabled,
      uploadEnabled: sessionState.isUploadEnabled(),
      uploadMaxSizeMb: sessionState.getMaxUploadSizeMb(),
      readEnabled: sessionState.isReadEnabled(),
      createEnabled: sessionState.isModifyEnabled(),
      modifyEnabled: sessionState.isModifyEnabled(),
      deleteEnabled: sessionState.isDeleteEnabled(),
      webdavEnabled: sessionState.isWebdavEnabled(),
      webdavUrls: lanAddresses.map((ip) => `http://${ip}:${config.port}/dav/0/`),
    };
  }

  function buildDiscoveryHealthDto(req: Request) {
    const lanAddresses = getLanIPv4Candidates();
    const configuredDomainName = (sessionState.getDomainName() || config.customDomainName || '').trim().toLowerCase();
    const domainName = configuredDomainName || getDefaultMdnsDomainName();
    const lanUrls = lanAddresses.map((ip) => `http://${ip}:${config.port}`);
    const domainUrl = domainName ? `http://${domainName}:${config.port}` : undefined;
    const warnings: string[] = [];

    if (!(config.host === '0.0.0.0' || config.host === '::')) {
      warnings.push(`Server bind host is ${config.host}. Use HOST=0.0.0.0 for LAN access.`);
    }
    if (!lanAddresses.length) {
      warnings.push('No LAN IPv4 interface detected. Connect to Wi-Fi/hotspot and retry.');
    }
    if (!sessionState.isSharingActive()) {
      warnings.push('Sharing is currently stopped. Start sharing before testing from other devices.');
    }
    if (!config.mdnsEnabled) {
      warnings.push('mDNS is disabled (MDNS_ENABLED=0). Domain-based access will not work.');
    }
    if (domainName && ['test.local', 'host.local', 'server.local', 'my-files.local'].includes(domainName)) {
      warnings.push('Domain name is generic and may collide on LAN. Use a unique name like yourname-files.local.');
    }

    warnings.push('Many mobile browsers, especially on Android, do not reliably resolve .local mDNS hostnames. Use the LAN IP URL or QR code on phones if the domain URL fails.');
    warnings.push('If IP URL works but domain URL does not, the network likely blocks multicast DNS or the client OS/browser does not support .local resolution.');
    warnings.push('If nothing works from other devices, check host OS firewall and hotspot/client-isolation settings.');

    return {
      host: config.host,
      port: config.port,
      sharingActive: sessionState.isSharingActive(),
      mdnsEnabled: config.mdnsEnabled,
      configuredDomainName: configuredDomainName || undefined,
      domainName,
      domainUrl,
      lanAddresses,
      lanUrls,
      recommendedClientUrls: domainUrl ? [...lanUrls, domainUrl] : lanUrls,
      requestFromLoopback: isLoopbackAddress(req.socket.remoteAddress),
      warnings,
    };
  }

  // ============ Middleware ============

  /**
   * Middleware: Check PIN if configured
   */
  function requirePin(_req: Request, res: Response, next: NextFunction): void {
    const effectivePin = sessionState.getSessionPin() ?? config.sessionPin;
    if (!effectivePin) {
      next();
      return;
    }

    const suppliedPin = String(_req.headers['x-session-pin'] || _req.query.pin || '').trim();
    if (suppliedPin !== effectivePin) {
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

  /**
   * Multer middleware for file uploads
   * Uses a high limit and checks sessionState for actual limit
   */
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 51200 * 1024 * 1024 }, // 51200 MB (50 GB, we check sessionState limit at route)
  });

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
   * GET /api/discovery-health - Diagnostics for cross-device reachability
   */
  app.get('/api/discovery-health', (req, res) => {
    res.json(buildDiscoveryHealthDto(req));
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
  app.post('/api/host/start', requireLocalControl, async (req, res) => {
    const snapshot = sessionState.startSharing();

    res.json({
      message: 'Sharing started',
      ...snapshot,
    });
  });

  /**
   * POST /api/host/stop - Stop file sharing (localhost only)
   */
  app.post('/api/host/stop', requireLocalControl, async (req, res) => {
    const snapshot = sessionState.stopSharing();

    res.json({
      message: 'Sharing stopped',
      ...snapshot,
    });
  });

  /**
   * GET /api/host/access - Access control state (localhost only)
   */
  app.get('/api/host/access', requireLocalControl, (_req, res) => {
    const runtimePin = sessionState.getSessionPin();
    const envPin = config.sessionPin;
    const effectivePin = runtimePin ?? envPin;
    res.json({
      requiresPin: Boolean(effectivePin),
      pinSource: runtimePin ? 'runtime' : envPin ? 'env' : 'none',
    });
  });

  /**
   * POST /api/host/access/pin - Set or clear runtime PIN (localhost only)
   */
  app.post('/api/host/access/pin', requireLocalControl, (req, res) => {
    const rawPin = String(req.body?.pin || '').trim();
    if (rawPin && !/^\d{4,16}$/.test(rawPin)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'PIN must be 4-16 digits',
        code: 'INVALID_PIN',
      });
      return;
    }

    sessionState.setSessionPin(rawPin || undefined);
    const effectivePin = sessionState.getSessionPin() ?? config.sessionPin;
    res.json({
      message: rawPin ? 'Runtime PIN set' : 'Runtime PIN cleared',
      requiresPin: Boolean(effectivePin),
      pinSource: sessionState.getSessionPin() ? 'runtime' : config.sessionPin ? 'env' : 'none',
    });
  });

  /**
   * GET /api/host/transfer - Transfer control state (localhost only)
   */
  app.get('/api/host/transfer', requireLocalControl, (_req, res) => {
    res.json({
      uploadEnabled: sessionState.isUploadEnabled(),
      uploadMaxSizeMb: sessionState.getMaxUploadSizeMb(),
      readEnabled: sessionState.isReadEnabled(),
      createEnabled: sessionState.isModifyEnabled(),
      modifyEnabled: sessionState.isModifyEnabled(),
      deleteEnabled: sessionState.isDeleteEnabled(),
      webdavEnabled: sessionState.isWebdavEnabled(),
    });
  });

  /**
   * POST /api/host/transfer - Update transfer controls (localhost only)
   */
  app.post('/api/host/transfer', requireLocalControl, (req, res) => {
    const body = req.body || {};
    let updated = false;

    if (typeof body.uploadEnabled === 'boolean') {
      sessionState.setUploadEnabled(body.uploadEnabled);
      updated = true;
    }

    if (typeof body.readEnabled === 'boolean') {
      sessionState.setReadEnabled(body.readEnabled);
      updated = true;
    }

    if (typeof body.uploadMaxSizeMb === 'number') {
      sessionState.setMaxUploadSizeMb(body.uploadMaxSizeMb);
      updated = true;
    }

    if (typeof body.createEnabled === 'boolean') {
      sessionState.setModifyEnabled(body.createEnabled);
      updated = true;
    }

    if (typeof body.modifyEnabled === 'boolean') {
      sessionState.setModifyEnabled(body.modifyEnabled);
      updated = true;
    }

    if (typeof body.deleteEnabled === 'boolean') {
      sessionState.setDeleteEnabled(body.deleteEnabled);
      updated = true;
    }

    if (typeof body.webdavEnabled === 'boolean') {
      sessionState.setWebdavEnabled(body.webdavEnabled);
      updated = true;
    }

    if (!updated) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'uploadEnabled(boolean), uploadMaxSizeMb(number), readEnabled(boolean), createEnabled(boolean), modifyEnabled(boolean), deleteEnabled(boolean), or webdavEnabled(boolean) is required',
        code: 'INVALID_TRANSFER_CONFIG',
      });
      return;
    }

    res.json({
      message: 'Transfer settings updated',
      uploadEnabled: sessionState.isUploadEnabled(),
      uploadMaxSizeMb: sessionState.getMaxUploadSizeMb(),
      readEnabled: sessionState.isReadEnabled(),
      createEnabled: sessionState.isModifyEnabled(),
      modifyEnabled: sessionState.isModifyEnabled(),
      deleteEnabled: sessionState.isDeleteEnabled(),
      webdavEnabled: sessionState.isWebdavEnabled(),
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
   * Supported platforms:
   *   - macOS  : osascript (built-in)
   *   - Linux  : zenity (GTK dialog, must be installed)
   *   - Windows: PowerShell FolderBrowserDialog (built-in since Win Vista)
   */
  app.post('/api/host/pick-share-root', requireLocalControl, async (_req, res) => {
    const platform = process.platform;

    if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Native directory picker is not supported on this platform',
        code: 'UNSUPPORTED_PLATFORM',
      });
      return;
    }

    try {
      let picked = '';

      if (platform === 'darwin') {
        const { stdout } = await execFileAsync('osascript', [
          '-e',
          'POSIX path of (choose folder with prompt "Select shared directory")',
        ]);
        picked = stdout.trim();
      } else if (platform === 'linux') {
        // zenity is available on most GNOME/GTK desktop environments.
        // On KDE the user can install zenity or kdialog; we try zenity first.
        let stdout = '';
        try {
          ({ stdout } = await execFileAsync('zenity', [
            '--file-selection',
            '--directory',
            '--title=Select shared directory',
          ]));
        } catch (zenityErr: any) {
          // If zenity is not found, try kdialog (KDE)
          if ((zenityErr as NodeJS.ErrnoException).code === 'ENOENT') {
            try {
              ({ stdout } = await execFileAsync('kdialog', [
                '--getexistingdirectory',
                os.homedir(),
                '--title',
                'Select shared directory',
              ]));
            } catch {
              res.status(HTTP_STATUS.BAD_REQUEST).json({
                error:
                  'No supported directory picker found. Install zenity (GNOME/GTK) or kdialog (KDE) and retry.',
                code: 'PICKER_NOT_AVAILABLE',
              });
              return;
            }
          } else {
            // zenity was found but exited non-zero (user canceled)
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              error: 'Directory picker was canceled',
              code: 'PICKER_CANCELED',
            });
            return;
          }
        }
        picked = stdout.trim();
      } else {
        // Windows: launch PowerShell with a hidden window to show FolderBrowserDialog
        const psScript = [
          'Add-Type -AssemblyName System.Windows.Forms',
          '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
          '$dialog.Description = "Select shared directory"',
          '$dialog.ShowNewFolderButton = $true',
          '$result = $dialog.ShowDialog()',
          'if ($result -eq "OK") { $dialog.SelectedPath } else { exit 1 }',
        ].join('; ');

        const { stdout } = await execFileAsync('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-WindowStyle',
          'Hidden',
          '-Command',
          psScript,
        ]);
        picked = stdout.trim();
      }

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
   * GET /api/host/domain-name - Get current domain name
   */
  app.get('/api/host/domain-name', (req, res) => {
    const baseHost = os.hostname().toLowerCase().replace(/\.local$/, '');
    const suggestedHost = baseHost.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'lan-file-host';
    const domainName = sessionState.getDomainName() || config.customDomainName;
    res.json({
      domainName,
      suggested: `${suggestedHost}.local`,
    });
  });

  /**
   * POST /api/host/domain-name - Set custom domain name
   */
  app.post('/api/host/domain-name', requireLocalControl, (req, res) => {
    const baseHost = os.hostname().toLowerCase().replace(/\.local$/, '');
    const suggestedHost = baseHost.replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'lan-file-host';
    const { domainName } = req.body || {};
    const sanitized = String(domainName || '').trim().toLowerCase();

    if (sanitized && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.local$/.test(sanitized)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid domain name format. Must be valid mDNS name (e.g., my-files.local)',
        code: 'INVALID_DOMAIN',
      });
      return;
    }

    sessionState.setDomainName(sanitized || undefined);
    onDomainNameChanged?.(sessionState.getDomainName());

    res.json({
      message: 'Domain name updated',
      domainName: sessionState.getDomainName(),
      suggested: `${suggestedHost}.local`,
      note: 'mDNS was re-advertised with the updated domain name.',
    });
  });



  /**
   * GET /api/list - List directory contents
   */
  app.get('/api/list', requirePin, async (req, res) => {
    if (!sessionState.isReadEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Read operations are disabled by host',
        code: 'READ_DISABLED',
      });
      return;
    }

    const rootId = String(req.query.root || '0');
    const relPath = String(req.query.path || '');
    const sortByRaw = String(req.query.sortBy || 'name').toLowerCase();
    const sortDirRaw = String(req.query.sortDir || 'asc').toLowerCase();
    const sortBy = sortByRaw === 'size' || sortByRaw === 'date' ? sortByRaw : 'name';
    const sortDir = sortDirRaw === 'desc' ? 'desc' : 'asc';

    const result = await listFilesUseCase.execute(rootId, relPath, sortBy, sortDir);

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
      sortBy,
      sortDir,
      entries,
    });
  });

  /**
   * POST /api/fs/mkdir - Create directory in current path
   */
  app.post('/api/fs/mkdir', requirePin, async (req, res) => {
    if (!sessionState.isModifyEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Create actions are disabled by host',
        code: 'CREATE_DISABLED',
      });
      return;
    }

    const rootId = String(req.body?.root || req.query.root || '0');
    const relPath = String(req.body?.path || req.query.path || '');
    const name = String(req.body?.name || '').trim();

    if (!name) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'name is required',
        code: 'INVALID_DIRECTORY_NAME',
      });
      return;
    }

    const result = await createDirectoryUseCase.execute(rootId, relPath, name);
    if (!result.ok) {
      const error = result.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(200).json({
      success: true,
      relPath: result.value.relPath,
    });
  });

  /**
   * DELETE /api/fs/entry - Delete file or directory
   */
  app.delete('/api/fs/entry', requirePin, async (req, res) => {
    if (!sessionState.isDeleteEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Delete actions are disabled by host',
        code: 'DELETE_DISABLED',
      });
      return;
    }

    const rootId = String(req.body?.root || req.query.root || '0');
    const relPath = String(req.body?.path || req.query.path || '').trim();

    if (!relPath) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'path is required',
        code: 'INVALID_PATH',
      });
      return;
    }

    const result = await deleteEntryUseCase.execute(rootId, relPath);
    if (!result.ok) {
      const error = result.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    res.status(200).json({
      success: true,
      deletedPath: relPath,
    });
  });

  /**
   * GET /api/download - Download a file
   */
  app.get('/api/download', requirePin, async (req, res) => {
    if (!sessionState.isReadEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Read operations are disabled by host',
        code: 'READ_DISABLED',
      });
      return;
    }

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

  /**
   * GET /api/download-directory - Download a directory as ZIP
   */
  app.get('/api/download-directory', requirePin, async (req, res) => {
    if (!sessionState.isReadEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Read operations are disabled by host',
        code: 'READ_DISABLED',
      });
      return;
    }

    const rootId = String(req.query.root || '0');
    const relPath = String(req.query.path || '');

    const result = await downloadDirectoryUseCase.execute(rootId, relPath);

    if (!result.ok) {
      const error = result.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    const { stream, filename, totalSize } = result.value;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Directory-Total-Size', String(totalSize));
    res.setHeader('Access-Control-Expose-Headers', 'X-Directory-Total-Size');

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Unable to create archive',
          code: 'ARCHIVE_ERROR',
        });
      }
    });

    stream.pipe(res);
  });

  /**
   * POST /api/upload - Upload a file to a directory
   */
  app.post('/api/upload', requirePin, upload.single('file'), async (req, res) => {
    if (!sessionState.isUploadEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Uploads are disabled by host',
        code: 'UPLOAD_DISABLED',
      });
      return;
    }

    const file = (req as any).file;
    if (!file) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'No file provided',
        code: 'NO_FILE',
      });
      return;
    }

    const maxSizeMb = sessionState.getMaxUploadSizeMb();
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `File exceeds maximum size of ${maxSizeMb} MB`,
        code: 'FILE_TOO_LARGE',
        maxSizeMb,
        fileSizeMb: Math.round(file.size / 1024 / 1024),
      });
      return;
    }

    const rootId = String(req.query.root || '0');
    const relPath = String(req.query.path || '');

    const result = await uploadFileUseCase.execute(rootId, relPath, file.originalname, file.buffer);

    if (!result.ok) {
      const error = result.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    const { relPath: savedRelPath, size } = result.value;

    res.status(200).json({
      success: true,
      file: {
        relPath: savedRelPath,
        size,
        uploadedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * POST /api/upload/resumable/init - Initialize resumable upload session
   */
  app.post('/api/upload/resumable/init', requirePin, async (req, res) => {
    if (!sessionState.isUploadEnabled()) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Uploads are disabled by host',
        code: 'UPLOAD_DISABLED',
      });
      return;
    }

    const filename = path.basename(String(req.body?.filename || '').trim());
    const totalSize = Number(req.body?.size);
    const rootId = String(req.body?.root || req.query.root || '0');
    const relPath = String(req.body?.path || req.query.path || '');

    if (!filename) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'filename is required', code: 'INVALID_FILENAME' });
      return;
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'size must be a positive number', code: 'INVALID_SIZE' });
      return;
    }

    const maxSizeBytes = sessionState.getMaxUploadSizeMb() * 1024 * 1024;
    if (totalSize > maxSizeBytes) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `File exceeds maximum size of ${sessionState.getMaxUploadSizeMb()} MB`,
        code: 'FILE_TOO_LARGE',
      });
      return;
    }

    await fsp.mkdir(uploadTmpDir, { recursive: true });
    const uploadId = randomUUID();
    const tempFilePath = path.join(uploadTmpDir, `${uploadId}.part`);
    await fsp.writeFile(tempFilePath, Buffer.alloc(0));

    resumableUploads.set(uploadId, {
      uploadId,
      filename,
      rootId,
      relPath,
      totalSize,
      tempFilePath,
      receivedBytes: 0,
      createdAt: Date.now(),
    });

    res.status(200).json({ uploadId, receivedBytes: 0, totalSize });
  });

  /**
   * GET /api/upload/resumable/status - Get resumable upload progress
   */
  app.get('/api/upload/resumable/status', requirePin, (req, res) => {
    const uploadId = String(req.query.uploadId || '');
    const session = resumableUploads.get(uploadId);
    if (!session) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Upload session not found', code: 'UPLOAD_SESSION_NOT_FOUND' });
      return;
    }

    res.status(200).json({
      uploadId: session.uploadId,
      receivedBytes: session.receivedBytes,
      totalSize: session.totalSize,
      done: session.receivedBytes >= session.totalSize,
    });
  });

  /**
   * POST /api/upload/resumable/chunk - Append a binary chunk
   */
  app.post('/api/upload/resumable/chunk', requirePin, express.raw({ type: 'application/octet-stream', limit: CHUNK_UPLOAD_LIMIT_BYTES }), async (req, res) => {
    const uploadId = String(req.query.uploadId || '');
    const offset = Number(req.query.offset);
    const session = resumableUploads.get(uploadId);
    if (!session) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Upload session not found', code: 'UPLOAD_SESSION_NOT_FOUND' });
      return;
    }

    if (!Number.isFinite(offset) || offset < 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'offset must be a non-negative number', code: 'INVALID_OFFSET' });
      return;
    }

    if (offset !== session.receivedBytes) {
      res.status(409).json({
        error: 'Offset mismatch',
        code: 'OFFSET_MISMATCH',
        expectedOffset: session.receivedBytes,
      });
      return;
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Chunk body is required', code: 'EMPTY_CHUNK' });
      return;
    }

    if (session.receivedBytes + body.length > session.totalSize) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Chunk exceeds declared file size', code: 'CHUNK_OVERFLOW' });
      return;
    }

    await fsp.appendFile(session.tempFilePath, body);
    session.receivedBytes += body.length;

    res.status(200).json({
      uploadId: session.uploadId,
      receivedBytes: session.receivedBytes,
      totalSize: session.totalSize,
      done: session.receivedBytes >= session.totalSize,
    });
  });

  /**
   * POST /api/upload/resumable/complete - Finalize resumable upload
   */
  app.post('/api/upload/resumable/complete', requirePin, async (req, res) => {
    const uploadId = String(req.query.uploadId || req.body?.uploadId || '');
    const session = resumableUploads.get(uploadId);
    if (!session) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Upload session not found', code: 'UPLOAD_SESSION_NOT_FOUND' });
      return;
    }

    if (session.receivedBytes !== session.totalSize) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Upload is incomplete',
        code: 'UPLOAD_INCOMPLETE',
        receivedBytes: session.receivedBytes,
        totalSize: session.totalSize,
      });
      return;
    }

    const dataBuffer = await fsp.readFile(session.tempFilePath);
    const saveResult = await uploadFileUseCase.execute(session.rootId, session.relPath, session.filename, dataBuffer);
    if (!saveResult.ok) {
      const error = saveResult.error;
      const statusCode = isDomainError(error) ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json({ error: error.message, code: error.code });
      return;
    }

    try {
      await fsp.unlink(session.tempFilePath);
    } catch {
      // best effort cleanup
    }
    resumableUploads.delete(uploadId);

    res.status(200).json({
      success: true,
      file: {
        relPath: saveResult.value.relPath,
        size: session.totalSize,
        uploadedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * DELETE /api/upload/resumable - Cancel and cleanup resumable upload session
   */
  app.delete('/api/upload/resumable', requirePin, async (req, res) => {
    const uploadId = String(req.query.uploadId || req.body?.uploadId || '');
    const session = resumableUploads.get(uploadId);
    if (!session) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Upload session not found', code: 'UPLOAD_SESSION_NOT_FOUND' });
      return;
    }

    resumableUploads.delete(uploadId);
    try {
      await fsp.unlink(session.tempFilePath);
    } catch {
      // best effort cleanup
    }

    res.status(200).json({ success: true });
  });

  return { app, sessionState };
}
