# Memory Bank

Persistent project context for decisions, standards, and execution. Single source of truth for product direction and engineering practices.

## File Organization

### Product & Planning
- **productContext.md**: Problem, value, target user, scope boundaries.
- **roadmap.md**: Feature phases (v0 → v3); current active phase.
- **decision-log.md**: Architecture/product decisions with rationale and impact.

### Engineering Standards
- **techContext.md**: Stack, architecture, APIs, env vars.
- **codingStandards.md**: TypeScript, naming, Express patterns, SOLID applied.
- **designPrincipals.md**: Layering, resilience, security-first, immutability.
- **testingStrategies.md**: Test pyramid, unit/integration/E2E scope, AI guardrails.
- **systemPatterns.md**: Error hierarchy, data flow, session lifecycle, auth model.
- **developmentGuide.md**: Quick start, workflow, common tasks, checklists.

## Usage Rules
1. **productContext.md**: Update only when core goals/scope change.
2. **decision-log.md**: Add entry for each architectural or significant product choice.
3. **roadmap.md**: Keep aligned with active sprint/phase.
4. **Standards files**: Reference during code review and PR; update when standard evolves.
5. **developmentGuide.md**: Link in onboarding; keep as quick reference.

## Key Principles
- **Conciseness**: No filler; every line earns its place.
- **No duplication**: One source of truth per topic.
- **Practical**: Actionable guidance, not theory.
- **Living docs**: Update as team learns; git history shows evolution.
