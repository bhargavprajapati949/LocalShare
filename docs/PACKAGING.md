# Packaging Guide

This project can be packaged into standalone executables so end users do not need Node.js.

## Build Commands

### Build for current machine

```bash
npm run package:host
```

### Build per platform

```bash
npm run package:linux-x64
npm run package:macos-arm64
npm run package:macos-x64
npm run package:windows-x64
```

### Build all targets

```bash
npm run package:all
```

### Clean release output

```bash
npm run package:clean
```

## Output Location

Artifacts are generated in the release folder.

Typical outputs:

- release/localshare-linux-x64
- release/localshare-macos-arm64
- release/localshare-macos-x64-intel
- release/localshare-win-x64.exe

## Consumer Run Instructions

### macOS / Linux

```bash
chmod +x localshare-macos-arm64
./localshare-macos-arm64
```

### Windows

- Double-click localshare-win-x64.exe
- Or run from PowerShell:

```powershell
.\localshare-win-x64.exe
```

Then open http://localhost:8080.

## Runtime Configuration for Executables

Packaged binaries support the same env vars:

- PORT
- HOST
- SHARE_ROOTS
- SESSION_PIN
- MDNS_ENABLED

Example (macOS/Linux):

```bash
SHARE_ROOTS="$HOME/Downloads,$HOME/Documents" SESSION_PIN=1234 ./localshare-macos-arm64
```

Example (Windows PowerShell):

```powershell
$env:SHARE_ROOTS="C:\Users\me\Downloads,C:\Users\me\Documents"
$env:SESSION_PIN="1234"
.\localshare-win-x64.exe
```
