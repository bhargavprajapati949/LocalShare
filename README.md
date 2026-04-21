# LocalShare

LocalShare is a local-network file sharing app for fast transfer between devices on the same Wi-Fi or hotspot, without cloud upload, account signup, or external dependencies.

It provides a browser client UI, a localhost-only admin UI, and WebDAV support for Finder/Files/Cyberduck style clients.

## Why this project

- No account setup
- No internet dependency
- Works across desktop and mobile browsers on the same LAN
- Simple host controls for sharing and access policies

## Feature Snapshot

- Browse and download files/folders from browser
- ZIP download for directories
- Managed downloads with progress and pause/resume/cancel
- Parallel chunk downloads for faster transfer
- File and directory upload with resumable chunked uploads
- Create/delete file operations from UI
- Optional PIN protection
- Read/upload/create/delete runtime permission toggles
- WebDAV mode with host-side enable/disable
- QR share and mDNS local domain support
- Discovery diagnostics for LAN troubleshooting
- Cross-platform packaging into standalone executables

For full feature breakdown, see [docs/FEATURES.md](docs/FEATURES.md).

## Documentation Map

- Project features: [docs/FEATURES.md](docs/FEATURES.md)
- Quick start and daily usage: [docs/QUICK_START.md](docs/QUICK_START.md)
- Packaging and distribution: [docs/PACKAGING.md](docs/PACKAGING.md)
- Technical architecture and APIs: [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md)

## Quick Start

```bash
npm install
npm run dev
```

Open:

- Client UI: http://localhost:8080/
- Admin UI: http://localhost:8080/admin

For complete setup and environment options, see [docs/QUICK_START.md](docs/QUICK_START.md).

## Packaging for Public Distribution

Build binaries for consumer machines:

```bash
npm run package:host
npm run package:all
```

Artifacts are produced in the `release` directory.

Detailed distribution instructions are in [docs/PACKAGING.md](docs/PACKAGING.md).

## Core Scripts

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm test
```

## License

ISC
