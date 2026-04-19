# Design Principals

## Architecture
- **Layered**: Domain (pure logic) → Application (use cases) → Infrastructure (adapters) → Interface (HTTP/UI).
- **Dependency inward**: Domain has zero external deps; adapters serve it, never vice versa.
- **Port abstraction**: FileReader, PathValidator, HostSessionManager as injectable contracts.

## Resilience
- **Fail safely**: Path traversal always rejects invalid access, never allows.
- **Explicit state**: Share mode (active/inactive) tracked and enforced.
- **Graceful stop**: Stop sharing immediately cuts new access; pending downloads complete.
- **Error recovery**: No auto-retry on transient FS errors; let client retry.

## Security-first Mindset
- **Input validation**: All external input checked at boundary (query, body, headers).
- **Path bounds**: Validate all file paths against allowed roots; reject `../` patterns.
- **Auth gates**: Localhost-only for start/stop; PIN optional per session.
- **No secrets in code**: ENV vars for sensitive config; never hardcode.
- **No data leakage**: Never expose internal paths or system details in errors.

## User-focused API
- **Consistency**: All responses wrapped; error format matches success format.
- **Clarity**: Response fields match domain language (not DB schema).
- **Discoverability**: Status endpoint shows active mode, URLs, and next-action hints.
- **Pragmatism**: Accept root index as 0; start/stop without auth for LAN speed.

## Simplicity & Extensibility
- **Do one thing well**: Each module has single purpose; composition over inheritance.
- **Composition**: Combine small behavior-focused services, not large god-objects.
- **Factory pattern**: For complex object creation (e.g., FileService with roots config).
- **Strategy pattern**: Auth strategies (open, PIN, password) swappable.

## Data Immutability
- **Readonly types**: Domain models use readonly properties; inputs never mutate originals.
- **Pure functions**: Domain logic returns new objects, doesn't mutate inputs.
- **Request/response DTOs**: Separate from internal domain model.

## Testing Principles
- **Test pyramid**: 70% unit, 20% integration, 10% E2E.
- **Boundary focus**: Mock only ports; test real wiring inside layers.
- **Deterministic**: No sleeps; explicit waits; reproducible results.
- **Fast feedback**: Unit tests < 100ms; integration < 1s per test.
