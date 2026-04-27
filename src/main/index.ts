import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';

// Aggressively set name for macOS branding
app.name = 'LocalShare';
if (app.setName) app.setName('LocalShare');

import { FileServer } from '../server/server';
import { loadConfig, ShareRoot, getDefaultMdnsDomainName, getLanIPv4Candidates } from '../server/infrastructure/config';

// Define settings schema
interface AppSettings {
  port: number;
  roots: ShareRoot[];
  autoLaunch: boolean;
}

let store: any = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let fileServer: FileServer | null = null;
let currentPort = 12345;

/**
 * Handle Auto-Launch state
 */
function updateAutoLaunch(enabled: boolean) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe'),
  });
  store.set('autoLaunch', enabled);
  broadcastStatus();
}

function buildStatusDto() {
  if (!fileServer) return null;
  const config = fileServer.getConfig();
  const sessionState = fileServer.getSessionState();
  const lanAddresses = getLanIPv4Candidates();
  const snapshot = sessionState.getSnapshot();
  const domainName = (sessionState.getDomainName() || config.customDomainName || getDefaultMdnsDomainName()).trim().toLowerCase();
  const effectivePin = sessionState.getSessionPin() ?? config.sessionPin;

  return {
    appName: 'LocalShare',
    version: '1.0.6',
    host: config.host,
    port: config.port,
    requiresPin: Boolean(effectivePin),
    securityMode: effectivePin ? 'pin-protected' : 'open-local-network',
    roots: config.roots,
    lanAddresses,
    lanUrls: lanAddresses.map((ip) => `http://${ip}:${config.port}`),
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
    webdavUrls: [
      ...lanAddresses.map((ip) => `http://${ip}:${config.port}/dav/0/`),
      `http://${domainName}:${config.port}/dav/0/`
    ],
  };
}

function broadcastStatus() {
  if (!mainWindow) return;
  const status = buildStatusDto();
  if (status) {
    mainWindow.webContents.send('status-updated', status);
  }
}

async function startServer(port: number): Promise<number> {
  const baseConfig = loadConfig();
  const storedRoots = store.get('roots');

  // Merge stored roots if available, otherwise use env/default
  const config = {
    ...baseConfig,
    port,
    roots: storedRoots.length > 0 ? storedRoots : baseConfig.roots
  };

  fileServer = new FileServer(config);

  try {
    await fileServer.start();
    console.log(`Server started on port ${port}`);
    return port;
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      return startServer(port + 1);
    }
    throw err;
  }
}

function createTray(port: number) {
  const isMac = process.platform === 'darwin';
  const iconPath = isMac
    ? path.join(__dirname, '../icons/png/32x32.png')
    : path.join(__dirname, '../icons/png/16x16.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'LocalShare', enabled: false },
    { type: 'separator' },
    { label: 'Open LocalShare', click: () => mainWindow?.show() },
    { label: `Port: ${port}`, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('LocalShare');
  tray.setContextMenu(contextMenu);
}

async function createWindow() {
  const isMac = process.platform === 'darwin';
  const iconPath = isMac
    ? path.join(__dirname, '../icons/mac/icon.icns')
    : path.join(__dirname, '../icons/png/512x512.png');

  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'LocalShare',
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Start server on current port
  currentPort = await startServer(currentPort);
  createTray(currentPort);

  const adminUrl = `http://localhost:${currentPort}/admin`;
  mainWindow.loadURL(adminUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initApp() {
  // Dynamically import electron-store (ESM)
  const Store = (await import('electron-store')).default;
  store = new Store<AppSettings>({
    defaults: {
      port: 12345,
      roots: [],
      autoLaunch: false,
    }
  });

  currentPort = store.get('port');
  await createWindow();
}

app.whenReady().then(async () => {
  // Set Dock icon IMMEDIATELY with native .icns to avoid flicker
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../icons/mac/icon.icns');
    const icon = nativeImage.createFromPath(iconPath);
    if (app.dock && icon) app.dock.setIcon(icon);
  }

  await initApp();
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    // app.quit(); 
    // Actually, we want to stay in tray!
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  if (fileServer) {
    await fileServer.stop();
  }
});

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return {
    port: currentPort,
    autoLaunch: store.get('autoLaunch'),
    roots: store.get('roots')
  };
});

ipcMain.handle('toggle-auto-launch', (_event, enabled: boolean) => {
  updateAutoLaunch(enabled);
  return store.get('autoLaunch');
});

ipcMain.handle('save-roots', (_event, roots: ShareRoot[]) => {
  store.set('roots', roots);
  if (fileServer) {
    const config = fileServer.getConfig();
    config.roots.splice(0, config.roots.length, ...roots);
    broadcastStatus();
  }
  return true;
});

// New Administrative Handlers
ipcMain.handle('get-status', () => {
  return buildStatusDto();
});

ipcMain.handle('start-server', async () => {
  if (fileServer) {
    fileServer.getSessionState().startSharing();
    broadcastStatus();
    return true;
  }
  return false;
});

ipcMain.handle('stop-server', async () => {
  if (fileServer) {
    fileServer.getSessionState().stopSharing();
    broadcastStatus();
    return true;
  }
  return false;
});

ipcMain.handle('update-transfer-settings', (_event, settings: any) => {
  if (!fileServer) return false;
  const session = fileServer.getSessionState();
  if (typeof settings.uploadEnabled === 'boolean') session.setUploadEnabled(settings.uploadEnabled);
  if (typeof settings.readEnabled === 'boolean') session.setReadEnabled(settings.readEnabled);
  if (typeof settings.uploadMaxSizeMb === 'number') session.setMaxUploadSizeMb(settings.uploadMaxSizeMb);
  if (typeof settings.createEnabled === 'boolean') session.setModifyEnabled(settings.createEnabled);
  if (typeof settings.deleteEnabled === 'boolean') session.setDeleteEnabled(settings.deleteEnabled);
  if (typeof settings.webdavEnabled === 'boolean') session.setWebdavEnabled(settings.webdavEnabled);
  broadcastStatus();
  return true;
});

ipcMain.handle('set-pin', (_event, pin: string | undefined) => {
  if (!fileServer) return false;
  fileServer.getSessionState().setSessionPin(pin);
  broadcastStatus();
  return true;
});

ipcMain.handle('set-domain', (_event, domain: string | undefined) => {
  if (!fileServer) return false;
  fileServer.getSessionState().setDomainName(domain);
  broadcastStatus();
  return true;
});

ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.filePaths[0]) {
    const absPath = result.filePaths[0];
    const fs = await import('node:fs');
    if (!fs.existsSync(absPath)) return null;

    const newRoot: ShareRoot = {
      id: '0',
      name: path.basename(absPath) || absPath,
      absPath
    };
    store.set('roots', [newRoot]);
    if (fileServer) {
      fileServer.getConfig().roots.splice(0, fileServer.getConfig().roots.length, newRoot);
      broadcastStatus();
    }
    return absPath;
  }
  return null;
});

ipcMain.handle('apply-directory', async (_event, absPath: string) => {
  if (!fileServer) return false;
  const fs = await import('node:fs');
  if (!fs.existsSync(absPath)) return false;

  const newRoot: ShareRoot = {
    id: '0',
    name: path.basename(absPath) || absPath,
    absPath
  };
  store.set('roots', [newRoot]);
  fileServer.getConfig().roots.splice(0, fileServer.getConfig().roots.length, newRoot);
  broadcastStatus();
  return true;
});

ipcMain.handle('change-port', async (_event, newPort: number) => {
  if (!fileServer) return false;
  if (newPort < 1024 || newPort > 65535) return false;

  try {
    await fileServer.stop();
    currentPort = newPort;
    store.set('port', newPort);

    // Restart on new port
    currentPort = await startServer(newPort);

    // Update tray menu with new port
    createTray(currentPort);

    // Update main window URL if it was on localhost
    if (mainWindow) {
      mainWindow.loadURL(`http://localhost:${currentPort}/admin`);
    }

    broadcastStatus();
    return true;
  } catch (err) {
    console.error('Failed to change port:', err);
    return false;
  }
});

ipcMain.handle('get-qr', async () => {
  if (!fileServer) return { dataUrl: '' };
  const status = buildStatusDto();
  if (!status || !status.lanUrls.length) return { dataUrl: '' };

  const QRCode = await import('qrcode');
  const dataUrl = await QRCode.toDataURL(status.lanUrls[0]);
  return { dataUrl };
});

ipcMain.handle('get-discovery-health', async () => {
  if (!fileServer) return { warnings: [] };
  const results = await fileServer.getDiscoveryHealth();
  return { warnings: results.warnings || [] };
});

ipcMain.handle('open-external', async (_event, url: string) => {
  await shell.openExternal(url);
  return true;
});
