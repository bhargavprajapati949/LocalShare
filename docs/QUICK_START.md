# Quick Start

This guide helps you run LocalShare in minutes.

## Prerequisites

- Node.js 18+ for source-based run
- npm

## 1) Install

```bash
npm install
```

## 2) Start in development mode

```bash
npm run dev
```

## 3) Open in browser on host machine

- Client UI: http://localhost:8080/
- Host Admin UI: http://localhost:8080/admin

## 4) Connect from another device

- Use any LAN URL shown in the UI or logs
- Or scan the QR code shown in the client/admin panel

## Typical First-Time Host Setup

1. Open admin UI
2. Confirm shared directory path
3. Enable/disable permissions as needed
4. Optionally set a session PIN
5. Share the LAN URL with clients

## Optional Environment Variables

- PORT (default: 8080)
- HOST (default: 0.0.0.0)
- SHARE_ROOTS (comma-separated absolute paths)
- SESSION_PIN (optional)
- MDNS_ENABLED (set 0 to disable mDNS)

Example:

```bash
PORT=9090 SHARE_ROOTS="$HOME/Downloads,$HOME/Documents" SESSION_PIN=1234 npm run dev
```

## Build and Run from TypeScript Output

```bash
npm run build
npm start
```
