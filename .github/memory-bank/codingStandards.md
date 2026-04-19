# Coding Standards

## TypeScript & Type Safety
- **Strict mode**: Always enabled; no implicit any.
- **Exports**: Explicit return types required.
- **Domain types**: Use discriminated unions and readonly for immutable data.
- **Error types**: Create distinct domain error, validation error, infrastructure error classes.
- **Type narrowing**: Prefer const assertions and type predicates over broad optionals.

## Code Organization
- **Separation**: Domain logic never imports infrastructure; infrastructure adapts via dependency injection.
- **Naming**: Use clear, domain-driven names (e.g., `validatePathTraversal`, not `checkPath`).
- **Module size**: Keep modules under 300 lines; split when layering becomes unclear.
- **Exports**: Only export what external consumers need; keep helpers private.

## Express & API Layer
- **Handlers**: Thin; parse input → call use case → map error/response.
- **Validation**: Validate all external input (query, body, headers) at boundary.
- **Error responses**: Consistent envelope with code, message, and optional detail.
- **Status codes**: Use 400 (input), 403 (auth), 404 (not found), 500 (server).

## Error Handling
- **No silent catches**: Every catch block has explicit action or re-throw.
- **Logging**: Capture error context (request ID, operation, stack).
- **User messages**: Never expose system paths or internal details to API client.
- **Async/await**: No floating promises; handle all rejections.

## SOLID Applied
- **Single Responsibility**: One reason to change per module/function.
- **Open/Closed**: Extend via composition/strategy; avoid large if/switch trees.
- **Liskov**: No subclass surprises; contracts honored consistently.
- **Interface Segregation**: Small focused interfaces (e.g., FileReader, PathValidator).
- **Dependency Inversion**: Inject ports; never hardcode filesystem or process calls.

## Testing & Mocks
- **Unit tests**: Test pure domain logic; mock only ports (FS, network).
- **Behavior over implementation**: Test contract, not internal structure.
- **Temporary fixtures**: For file ops, use temp dirs not deep mocks.
- **No test pollution**: Each test independent; clean up resources.

## Linting & Formatting
- **ESLint**: Enforce no-floating-promises, no-misused-promises, no-unsafe-assignment, consistent-type-imports.
- **Prettier**: Format on save; no manual style.
- **Pre-commit**: Run lint and typecheck before commit.
- **CI**: Lint and typecheck must pass; fail fast on build.

## Comments & Docs
- **Why not what**: Explain design decision if non-obvious.
- **Public functions**: JSDoc for parameters and return type.
- **Complex logic**: Inline comment before the block.
- **No commented code**: Delete; use git history.

## Performance & Observability
- **Logging**: Structured logs with operation context and request ID.
- **Error bounds**: Catch and log; don't swallow silently.
- **No PII in logs**: Sanitize paths and user data.
- **Streaming**: Use for large files; don't buffer entire file in memory.
