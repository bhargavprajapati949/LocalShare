# Technical Overview

## Stack

- Runtime: Node.js
- Language: TypeScript (strict mode)
- Server: Express 5
- Upload handling: Multer + resumable chunk endpoints
- Archive generation: Archiver
- Discovery: bonjour-service (mDNS)
- QR generation: qrcode
- Tests: Node test runner + Supertest

## Architecture

The codebase follows layered structure:

- Domain: models, errors, ports
- Application: app factory and use cases
- Infrastructure: adapters and config
- Interface: HTML UI and WebDAV router

## Major Interfaces

- Client UI:
  - /
- Admin UI:
  - /admin
- WebDAV:
  - /dav

## Key APIs

- Status and diagnostics:
  - /api/status
  - /api/discovery-health
  - /api/qr
- Host controls:
  - /api/host/start
  - /api/host/stop
  - /api/host/access
  - /api/host/access/pin
  - /api/host/transfer
  - /api/host/share-root
  - /api/host/pick-share-root
  - /api/host/domain-name
- File operations:
  - /api/list
  - /api/download
  - /api/download-directory
  - /api/fs/mkdir
  - /api/fs/entry
- Upload operations:
  - /api/upload
  - /api/upload/resumable/init
  - /api/upload/resumable/status
  - /api/upload/resumable/chunk
  - /api/upload/resumable/complete
  - /api/upload/resumable

## Security Model

- Optional PIN for client and WebDAV access
- Admin endpoints restricted to localhost
- Path traversal protections in filesystem resolution
- Runtime permission gates for read/upload/create/delete

## Development Commands

```bash
npm install
npm run dev
npm run build
npm start
npm run typecheck
npm test
```
