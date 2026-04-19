# LAN File Host (Implementation Starter)

This is the first implementation slice of your product idea: a cross-platform-compatible core that starts a local HTTP server, exposes selected file-system roots, and lets other devices browse/download files from a browser.

## What is implemented

- Local HTTP server (`Express`) binding to `0.0.0.0` by default
- Sharing session lifecycle controls (start/stop) with persistent active mode until explicitly stopped
- Multi-root sharing via env config
- Directory listing API with path traversal protection
- File download API
- Optional session PIN gate (`SESSION_PIN`)
- Built-in browser UI with host status, LAN IP visibility, and security warning
- LAN IP discovery output in logs and status API
- v0 automated tests for path safety and list-route lifecycle behavior

## Quick start

1. Install dependencies

```bash
npm install
```

2. Run in development

```bash
npm run dev
```

3. Open in browser on host

```text
http://localhost:8080
```

4. Open from another device on same LAN

Use one of the printed LAN URLs, for example:

```text
http://192.168.1.10:8080
```

## Configuration

Environment variables:

- `PORT` (default: `8080`)
- `HOST` (default: `0.0.0.0`)
- `SHARE_ROOTS` (comma-separated paths, default: current working directory)
- `SESSION_PIN` (optional; if set, required for API requests)

Example:

```bash
PORT=9090 SHARE_ROOTS="$HOME/Downloads,$HOME/Documents" SESSION_PIN=1234 npm run dev
```

## APIs (v0)

- `GET /api/status`
- `POST /api/host/start` (localhost only)
- `POST /api/host/stop` (localhost only)
- `GET /api/list?root=0&path=`
- `GET /api/download?root=0&path=relative/path/to/file`

If PIN is enabled, include `pin=1234` query parameter (or `x-session-pin` header).

## Current limitations

- Browser-side UI is basic
- No upload support yet
- No mDNS discovery yet
- No QR generation yet
- No native mobile/desktop shell yet (this is the core service layer)

## Next implementation milestones

1. Add mDNS/Bonjour host discovery
2. Add QR link in host UI
3. Add folder-as-zip bulk download
4. Add native shell wrappers (Capacitor for mobile + desktop shell)
5. Add per-session access modes and roadmap PIN flow UX
