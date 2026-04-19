# Testing Strategies

## Test Pyramid
- **Unit (70%)**: Domain logic, path validation, session lifecycle.
- **Integration (20%)**: Route → use case → file service wiring; auth checks.
- **E2E Smoke (10%)**: High-risk user journeys via Playwright MCP.

## Unit Tests (Node test runner)
- **Scope**: Pure domain functions and use case orchestration.
- **Fixtures**: Table-driven for path validation edge cases.
- **Mocks**: Only inject ports (FileReader stub, not file I/O).
- **Files**: `*.test.ts` co-located with source.

Example critical paths:
- Path traversal: valid paths allowed, `../` rejected, symlinks blocked.
- Session state: start transitions to active, stop becomes inactive.
- Multi-root: file from root 0 not accessible via root 1.

## Integration Tests (Supertest + Node test)
- **Scope**: HTTP route + use case + real filesystem coordination.
- **Fixtures**: Temporary directory with test files.
- **Approach**: Use real FS for file ops; mock external services (e.g., hostname lookup).
- **Cleanup**: Remove temp dirs after test.

Example paths:
- Start host session → list root directory → receive file list.
- Download file → stream response → client receives correct bytes.
- PIN enabled → no PIN in query → 403 forbidden.
- Invalid path in list request → 400 bad request.

## E2E Smoke (Playwright MCP)
- **Scope**: High-risk user journeys only; not feature coverage.
- **Browser automation**: Real Chrome instance; full HTTP stack.
- **Selectors**: Explicit test IDs in HTML; avoid brittle selectors.
- **Waits**: Deterministic; no sleep; wait for element.

Critical journeys:
1. Start server → open browser → see "Sharing active" message.
2. Navigate directory → click file → download starts.
3. Stop server → try list request → 503 or connection refused.

## Playwright MCP Workflow
- **Red-green-refactor**: AI writes failing test → minimal pass → refactor with green.
- **Flaky detection**: Retry 3x; if still failing, reject; log pattern.
- **Tracing**: Capture trace and screenshot on failure for debugging.
- **CI**: Smoke suite on every PR; full E2E nightly.

## Coverage Thresholds (CI gates)
- **Lines**: 85% (domain/app layers prioritized)
- **Branches**: 80%
- **Functions**: 85%
- **Uncovered critical paths**: Error handlers, path validation, auth gates.

## AI-Driven Development Guardrails
1. AI cannot merge without: typecheck + lint + unit + integration + smoke E2E passing.
2. AI test code must: avoid flaky waits, use explicit selectors, clean up resources.
3. AI-generated code review checklist:
   - Boundary validation present (inputs, outputs)
   - Error paths tested (happy + sad)
   - No unsafe typing (no any unless justified)
   - No silent catch blocks
   - No env assumptions in tests (use fixtures)
4. Human review required for: auth logic, path safety, security-critical changes.

## Running Tests
- Unit: `npm test`
- Integration: `npm test` (same runner)
- E2E: `npx playwright test` (to be configured)
- Type check: `npm run typecheck`
- Lint: `npm run lint` (to be configured)
