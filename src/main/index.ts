import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { FileServer } from '../server/server';
import { loadConfig, ShareRoot } from '../server/infrastructure/config';

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
  const iconPath = path.join(__dirname, '../../renderer/favicon.svg');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const updateTrayMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'LocalShare', enabled: false },
      { label: `Port: ${port}`, enabled: false },
      { type: 'separator' },
      { label: 'Open Admin Panel', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray?.setContextMenu(contextMenu);
    tray?.setToolTip(`LocalShare - Port ${port}`);
  };

  updateTrayMenu();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: 'LocalShare Admin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../renderer/favicon.svg')
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

app.whenReady().then(initApp);

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
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (result.filePaths[0]) {
    const absPath = result.filePaths[0];
    const newRoot: ShareRoot = {
      id: '0',
      name: path.basename(absPath) || absPath,
      absPath
    };
    store.set('roots', [newRoot]); // Currently supporting single root for simplicity
    return absPath;
  }
  return null;
});

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
  return true;
});

ipcMain.handle('get-server-info', () => {
  return {
    port: currentPort,
    isSharing: fileServer?.getSessionState().isSharingActive()
  };
});
