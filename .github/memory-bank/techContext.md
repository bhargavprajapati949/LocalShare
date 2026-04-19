# Tech Context

## Stack
- **Runtime**: Node.js (ES2022)
- **Language**: TypeScript 6.0.3 (strict mode, Node16 modules)
- **Backend**: Express 5.2.1 + CORS + mime-types
- **Testing**: Node test runner + Supertest + Playwright MCP
- **Dev tools**: tsx (watch/run), tsc (build), Prettier + ESLint
- **Build**: tsc → dist/server.js

## Architecture
- **Layer model**: domain → application → infrastructure → interface
- **Dependency direction**: Always inward; no circular deps
- **Server entry**: src/server.ts
- **Core modules**: fileService.ts, hostSession.ts, html.ts (UI template)

## Module outputs
- Production: `dist/server.js` (run via `node dist/server.js`)
- Dev: `tsx watch src/server.ts` (file watching)

## Key constraints
- Path traversal protection mandatory for file access
- No hardcoded IP/host; bind to 0.0.0.0 with env-driven config
- Multi-root support via SHARE_ROOTS env var
- Session PIN optional via SESSION_PIN env var
- LAN-only scope in v0/v1

## Environment variables
- `PORT` (default: 8080)
- `HOST` (default: 0.0.0.0)
- `SHARE_ROOTS` (comma-separated paths, default: cwd)
- `SESSION_PIN` (optional auth gate)

## APIs
- `GET /api/status` - Server and host status
- `POST /api/host/start` - Start sharing (localhost only)
- `POST /api/host/stop` - Stop sharing (localhost only)
- `GET /api/list` - Directory listing with root/path params
- `GET /api/download` - File download with streaming
