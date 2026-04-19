# Development Guide - Quick Reference

## Getting Started
```bash
npm install
npm run dev          # Start with file watch
npm run build        # Compile to dist/
npm run typecheck    # Type check without emit
npm test             # Run unit + integration tests
```

## Development Workflow
1. Create feature branch: `git checkout -b feature/brief-name`
2. Write failing test first (red-green-refactor).
3. Implement feature in domain/application layer.
4. Add integration test if crossing layer boundaries.
5. Run `npm test` and `npm run typecheck` locally.
6. Commit with clear message; push.
7. Open PR; CI gates must pass (typecheck, lint, tests).

## Before Committing
```bash
npm run typecheck    # Must pass
npm test             # Must pass
npm run lint         # Must pass (when configured)
```

## File Structure
```
src/
├── app.ts              # Express app factory
├── server.ts           # Server entry point
├── config.ts           # Env & config loading
├── hostSession.ts      # Session lifecycle (domain)
├── fileService.ts      # File system operations (infrastructure)
├── html.ts             # UI template (interface)
├── *.test.ts           # Unit/integration tests
```

## Common Tasks

### Add a new API endpoint
1. Write test in app.test.ts (integration).
2. Add handler in app.ts (Express route).
3. Implement use case in domain layer (e.g., new file in src/useCases/).
4. Add domain error types if needed.
5. Validate input at route boundary; call use case; map response.

### Add a new feature to fileService
1. Write unit test in fileService.test.ts.
2. Implement function in fileService.ts.
3. Always validate paths against SHARE_ROOTS; never trust client input.
4. Test with temporary directory fixture; clean up.

### Change environment variable handling
1. Update config.ts validation and defaults.
2. Update .github/memory-bank/techContext.md env vars section.
3. Test with multiple env values in unit test.

### Debug failing test
1. Run single test: `node --test src/path.test.ts`
2. Add console.log or use debugger.
3. Check error message and stack trace.
4. If flaky: add explicit wait or fixture cleanup.

## Key Constraints (Never Break)
- **Path safety**: Always validate paths against SHARE_ROOTS; reject `../`.
- **Localhost-only**: /api/host/start and /api/host/stop only from 127.0.0.1.
- **No hardcoded paths**: Use env vars for SHARE_ROOTS.
- **Streaming**: Never buffer entire file in memory.
- **No data mutation**: Domain models immutable; use DTOs for mapping.
- **Explicit errors**: No silent catches; all errors logged with context.

## Testing Checklist
- [ ] Unit test for domain logic (edge cases included)
- [ ] Integration test if crossing layers (happy + error path)
- [ ] Path validation tested for `../` and symlink cases
- [ ] Auth guard tested (PIN or localhost-only)
- [ ] Temporary resources cleaned up in test

## Code Review Checklist
- [ ] Typecheck passes
- [ ] Linting passes
- [ ] Tests added and passing
- [ ] No implicit any types
- [ ] Path safety validated
- [ ] Error handling explicit (no silent catches)
- [ ] No PII in logs
- [ ] Commit message clear and links issue

## Useful Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with watch |
| `npm run build` | Compile TypeScript |
| `npm test` | Run all tests |
| `npm run typecheck` | Type check without emit |
| `node --test src/app.test.ts` | Run single test file |
| `NODE_DEBUG=* npm run dev` | Debug with Node trace |

## Git & Collaboration Workflow
**Principle**: AI suggests git actions; human reviews and decides to commit/push.

### AI-Suggested Workflow
1. AI implements code changes, tests, and builds locally.
2. AI reports: "✓ Typecheck passing, ✓ Tests passing, ✓ Ready to commit."
3. AI suggests: "Recommended commit: `git add . && git commit -m '...message...'`"
4. **Human action**: Review changes in diff; decide to commit or reject.
5. AI suggests push: "Ready to push to branch: `git push origin feature/...`"
6. **Human action**: Verify branch, CI readiness; decide to push or iterate.
7. AI suggests PR: "Open PR with title: 'Feature: ...' and description: ..."
8. **Human action**: Review PR template; merge when ready.

### Never Automatic
- ❌ AI does NOT commit without asking.
- ❌ AI does NOT push without explicit human approval.
- ❌ AI does NOT merge branches without review.
- ✅ AI ALWAYS suggests next action in terminal-ready format.
- ✅ AI ALWAYS shows `git diff` or changed files before suggesting commit.
- ✅ AI ALWAYS includes rationale for change suggestions.

### Suggested Commit Message Format
```
<type>(<scope>): <subject>

<body (optional)>

Fixes: #<issue> (if applicable)
```
Types: feat, fix, refactor, test, docs, style, chore

## Next Implementation Focus
- Refactor existing code into layer structure (domain → app → infra → interface).
- Add ESLint + Prettier configuration.
- Add Husky pre-commit hooks.
- Set up Playwright MCP for smoke tests.
- Increase test coverage to 85%+.
