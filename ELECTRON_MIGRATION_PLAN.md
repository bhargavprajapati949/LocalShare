# 🚀 Electron.js Migration Plan: LocalShare

This document outlines the step-by-step transition of LocalShare from a standalone Node.js server to a cross-platform Electron.js desktop application.

## 🎯 Objectives
- **Native UI**: The Admin Panel becomes the main application window.
- **Background Persistence**: The Express server runs as a background process within Electron to serve external LAN clients.
- **System Tray**: App lives in the tray for persistent sharing.
- **Native Experience**: Use native dialogs for folder selection and file system interactions.
- **Vanilla JS Compatibility**: Maintain the existing frontend logic during Phase 1.

---

## 🏗 Phase 1: Foundation & Project Setup

### 1.1 Install Dependencies
Add Electron and essential build tools.
```bash
npm install electron --save-dev
npm install electron-is-dev electron-store --save
```

### 1.2 Directory Reorganization
Restructure the project to separate Electron concerns:
```text
httpFileServerClone/
├── src/
│   ├── main/           # Electron Main Process (System, Tray, Lifecycle)
│   ├── renderer/       # Admin UI (Current Vanilla JS/CSS)
│   ├── server/         # Current Express Backend logic
│   └── domain/         # Shared Logic
├── package.json
└── electron-builder.yml # Packaging config
```

### 1.3 Update `package.json`
Add the `main` entry point and Electron scripts:
```json
{
  "main": "dist/main/index.js",
  "scripts": {
    "electron:dev": "npm run build && electron .",
    "electron:build": "npm run build && electron-builder"
  }
}
```

---

## 🔧 Phase 2: Main Process Development

### 2.1 Express Server Integration
Modify `server.ts` to be exportable as a class/module. The Main process will instantiate and start/stop the server.
- **Task**: Wrap Express startup in a `FileServer` class.
- **Rationale**: Allows Electron to restart the server if the port changes or sharing is toggled from the UI.

### 2.2 Window Management
Create a standard Electron `BrowserWindow` that loads the Admin UI.
- Disable the default menu bar.
- Enable `nodeIntegration: false` and `contextIsolation: true` for security.

### 2.3 System Tray Implementation
Implement a tray icon with the following context menu:
- **Status**: "Sharing Active" (with green dot) / "Stopped" (red dot).
- **Open Admin Panel**: Restore the window.
- **Toggle Sharing**: Quick start/stop.
- **Exit**: Full application shutdown.

---

## 🌉 Phase 3: The IPC Bridge (Native Features)

### 3.1 Folder Picker
Replace the manual path input with a native dialog.
- **Action**: Use `dialog.showOpenDialog({ properties: ['openDirectory'] })`.
- **Flow**: UI clicks "Add Root" → IPC call to Main → Native Dialog opens → Path returned to UI.

### 3.2 IPC Handlers
Create a `preload.js` script to securely expose native functions to the Vanilla JS Admin UI:
- `window.api.selectFolder()`
- `window.api.getServerStatus()`
- `window.api.toggleSharing()`

---

## 💾 Phase 4: Persistence Layer

### 4.1 From Env Vars to App Settings
Currently, settings are in `process.env`. We will migrate to `electron-store` or a local `config.json`.
- **Location**: `app.getPath('userData')/config.json`.
- **Logic**: On startup, Electron reads this file and passes the `roots` and `port` to the Express server.

---

## 📦 Phase 5: Packaging & Distribution

### 5.1 Electron Builder Configuration
Create `electron-builder.yml` to handle multi-platform builds:
- **macOS**: DMG and Zip (with Apple Silicon/Intel support).
- **Windows**: NSIS Installer and Portable EXE.
- **Linux**: AppImage and deb.

---

## 📝 Roadmap Summary

| Step | Complexity | Focus |
| :--- | :--- | :--- |
| **1. Setup** | Low | Tooling and Folder Structure |
| **2. Main Process** | Medium | Window & Express server lifecycle |
| **3. Tray & IPC** | Medium | Native UX (Tray, Folder Picker) |
| **4. Persistence** | Low | Saving settings to disk |
| **5. Packaging** | High | Code signing and binary generation |

---

## ❓ Implementation Details & FAQ

### 1. Port Conflict Management
- **Default Port**: `12345`.
- **Logic**: If `12345` is occupied, Electron will attempt `12346`, `12347`, etc., until a free port is found.
- **UI Feedback**: The active port will be displayed prominently in the Electron window and the System Tray.

### 2. Auto-Launch (Startup)
- **Feature**: Option to launch LocalShare automatically when the computer starts.
- **Default State**: **Disabled**.
- **Implementation**: Use the `electron-builder` auto-launch mechanism or the `auto-launch` npm package. Accessible via a "Settings" toggle in the Admin UI.
