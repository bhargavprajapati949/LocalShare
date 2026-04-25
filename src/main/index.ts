import { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { FileServer } from '../server/server';
import { loadConfig } from '../server/infrastructure/config';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let fileServer: FileServer | null = null;
let currentPort = 12345;

async function startServer(port: number): Promise<number> {
  const baseConfig = loadConfig();
  const config = { ...baseConfig, port };
  
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

  // Start server on default port 12345
  currentPort = await startServer(12345);
  createTray(currentPort);

  const adminUrl = `http://localhost:${currentPort}/admin`;
  mainWindow.loadURL(adminUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

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
  return result.filePaths[0];
});

ipcMain.handle('get-server-info', () => {
  return {
    port: currentPort,
    isSharing: fileServer?.getSessionState().isSharingActive()
  };
});
