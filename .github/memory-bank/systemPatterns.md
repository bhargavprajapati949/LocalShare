# System Patterns

## Error Hierarchy
```
Error (base)
├── DomainError (business logic failures)
│   ├── PathTraversalError (invalid path access)
│   ├── ShareSessionError (session not active)
│   ├── FileNotFoundError (requested file missing)
│   └── InvalidConfigError (bad env or startup config)
├── ValidationError (input contract violation)
│   ├── InvalidPathError (malformed path)
│   ├── InvalidParamsError (missing/wrong query params)
│   └── MissingAuthError (PIN required but missing)
└── InfrastructureError (FS, network, system-level)
    ├── FileAccessError (permission denied, etc)
    ├── DirectoryAccessError (permission denied on dir)
    └── StreamError (I/O failure during download)
```

## Result Pattern
```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };
```
Used in domain layer for operations that may fail safely (path validation, session checks).

## Dependency Injection
- Constructor injection for use cases and adapters.
- No service locator; explicit wiring in server.ts.
- Example:
  ```typescript
  new ListFilesUseCase(fileService, pathValidator)
  ```

## Session Lifecycle
```
Inactive → (start) → Active → (stop) → Inactive
```
- State enforced by HostSession; transitions guarded.
- Stop is idempotent; multiple calls safe.
- Pending downloads continue after stop.

## File Access Model
```
1. Validate path is within allowed roots (fileService)
2. Resolve symlinks and check bounds (pathValidator)
3. Check file exists and readable (fileService)
4. Open stream and send to client (expressHandler)
```
Never trust client-supplied paths; always validate at step 1.

## Multi-root Handling
- Root index (0, 1, 2...) maps to SHARE_ROOTS array.
- File paths always relative to root; never absolute.
- Cross-root access impossible; different indices = different filesystems.

## Request Flow Example: GET /api/list
```
HTTP request
  → Express route handler (parse query params)
    → ListFilesUseCase (business logic)
      → pathValidator.validatePath (is valid within root?)
        → fileService.listDirectory (read FS)
          → result mapped to response (DTO)
            → HTTP 200 + JSON
```

## Authentication Pattern
- **Open mode** (default): No auth; anyone on LAN can access.
- **PIN mode**: Optional `PIN` env var; clients include `pin=<value>` in query or header.
- **Middleware check**: If PIN configured, all API routes check before execution.
- **Localhost-only routes**: `/api/host/start` and `/api/host/stop` only accept connections from 127.0.0.1.

## File Streaming Pattern
- **Large files**: Stream directly; never buffer entire file in memory.
- **Content-Type**: Use mime-types library; default to application/octet-stream.
- **Content-Disposition**: Attach filename for download; safe for display.
- **Error handling**: If stream fails mid-transfer, connection closes; client retries.

## Configuration Pattern
- Environment variables at startup.
- Validate config in server.ts before creating services.
- Immutable config object passed to services.
- No runtime config changes; stop and restart server.

## Logging Pattern
```typescript
{
  timestamp: ISO8601,
  level: 'info' | 'warn' | 'error',
  operation: 'startHost' | 'listFiles' | 'downloadFile',
  requestId: UUID,
  userId: string (if applicable),
  message: string,
  statusCode?: number,
  error?: { message, stack, code }
}
```
- Never log file paths or user paths; use sanitized references.
- Include request ID for tracing across service calls.
- Error stack only in error level; not in info.
