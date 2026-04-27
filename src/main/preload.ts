import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  toggleAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('toggle-auto-launch', enabled),
  saveRoots: (roots: any[]) => ipcRenderer.invoke('save-roots', roots),
});
