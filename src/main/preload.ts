import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Desktop settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  toggleAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('toggle-auto-launch', enabled),
  
  // Server controls (IPC replacements for /api/host/*)
  getStatus: () => ipcRenderer.invoke('get-status'),
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  
  // Configuration
  updateTransferSettings: (settings: any) => ipcRenderer.invoke('update-transfer-settings', settings),
  setPin: (pin: string | undefined) => ipcRenderer.invoke('set-pin', pin),
  setDomain: (domain: string | undefined) => ipcRenderer.invoke('set-domain', domain),
  
  // Directory picking & Roots
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  applyDirectory: (path: string) => ipcRenderer.invoke('apply-directory', path),
  saveRoots: (roots: any[]) => ipcRenderer.invoke('save-roots', roots),
  changePort: (port: number) => ipcRenderer.invoke('change-port', port),
  getQr: () => ipcRenderer.invoke('get-qr'),
  getDiscoveryHealth: () => ipcRenderer.invoke('get-discovery-health'),
  
  // Utility
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners for real-time updates
  onStatusUpdate: (callback: (status: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('status-updated', subscription);
    return () => ipcRenderer.removeListener('status-updated', subscription);
  }
});
