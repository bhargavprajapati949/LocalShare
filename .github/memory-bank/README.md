# Memory Bank

Persistent project context for decisions, standards, and execution. Single source of truth for product direction and engineering practices.

## File Organization

### Product & Planning
- **product-context.md**: Problem, value, target user, scope boundaries.
- **roadmap.md**: Feature and bug tracker with status labels.

### Engineering Standards
- **techContext.md**: Stack, architecture, APIs, env vars.
- **codingStandards.md**: TypeScript, naming, Express patterns, SOLID applied.
- **designPrincipals.md**: Layering, resilience, security-first, immutability.
- **testingStrategies.md**: Test pyramid, unit/integration/E2E scope, AI guardrails.
- **systemPatterns.md**: Error hierarchy, data flow, session lifecycle, auth model.
- **developmentGuide.md**: Quick start, workflow, common tasks, checklists.

## Usage Rules
1. **product-context.md**: Update only when core goals/scope change.
2. **roadmap.md**: Keep statuses current (`todo`, `inprogress`, `working`).
3. **Standards files**: Reference during code review and PR; update when standard evolves.
4. **developmentGuide.md**: Link in onboarding; keep as quick reference.

## Tool Compatibility
- **Copilot** reads repository instructions from `.github/copilot-instructions.md`.
- Keep assistant instructions aligned with this memory bank to avoid drift.

## Key Principles
- **Conciseness**: No filler; every line earns its place.
- **No duplication**: One source of truth per topic.
- **Practical**: Actionable guidance, not theory.
- **Living docs**: Update as team learns; git history shows evolution.
