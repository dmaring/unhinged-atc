<!--
  Sync Impact Report
  ====================
  Version change: 0.0.0 → 1.0.0

  Modified principles: N/A (initial version)

  Added sections:
    - I. Player Experience First
    - II. Simplicity & Maintainability
    - III. Test Coverage
    - IV. Real-time Reliability
    - Technology Constraints (Section 2)
    - Development Workflow (Section 3)
    - Governance

  Removed sections: N/A (initial version)

  Templates requiring updates:
    - .specify/templates/plan-template.md: ✅ verified (Constitution Check section exists)
    - .specify/templates/spec-template.md: ✅ verified (User Scenarios mandatory)
    - .specify/templates/tasks-template.md: ✅ verified (test-first pattern documented)

  Follow-up TODOs: None
-->

# Unhinged ATC Constitution

## Core Principles

### I. Player Experience First

Every decision prioritizes fun, chaotic gameplay. Features MUST enhance the multiplayer
experience—if a feature doesn't make the game more enjoyable or entertaining, it doesn't
ship. The game's identity is "crowdsourced chaos with a sense of humor."

**Non-negotiables**:
- Gameplay feedback MUST be immediate (visual, audio, notifications)
- Humor and personality MUST be preserved in all user-facing content
- New features MUST NOT degrade existing player experience
- Accessibility concerns SHOULD be addressed without sacrificing core gameplay feel

**Rationale**: This is an entertainment product. Technical excellence means nothing if
players aren't having fun. The game's unique value proposition is chaotic multiplayer
ATC—protect and enhance that identity.

### II. Simplicity & Maintainability

Start simple, stay simple. Apply YAGNI (You Aren't Gonna Need It) ruthlessly. Code MUST
be readable by future contributors without extensive documentation diving.

**Non-negotiables**:
- No abstractions until the third use case (Rule of Three)
- Prefer explicit code over clever code
- Delete unused code; do not comment it out "for later"
- New dependencies MUST justify their inclusion (bundle size, maintenance burden)
- Configuration SHOULD have sensible defaults; avoid configuration sprawl

**Rationale**: This is a vibecoding experiment and learning project. Complexity is the
enemy of iteration speed and contributor onboarding.

### III. Test Coverage

All new features MUST include tests. Critical game paths MUST have integration test
coverage. Test failures block merging.

**Non-negotiables**:
- New server-side game logic MUST have unit tests
- WebSocket event handlers MUST have integration tests for happy paths
- Client components with game state interactions SHOULD have tests
- Collision detection, scoring, and physics calculations MUST have test coverage
- Flaky tests MUST be fixed or removed within 48 hours of identification

**Rationale**: Real-time multiplayer games are notoriously difficult to debug in
production. Tests catch regressions before players do.

### IV. Real-time Reliability

The 60 FPS game loop is sacred. Nothing MUST block the main server tick. Network
failures MUST degrade gracefully without crashing games.

**Non-negotiables**:
- Game tick MUST complete in <16ms (60 FPS target)
- All I/O operations MUST be async and non-blocking
- Client MUST handle server disconnection gracefully (reconnection, state recovery)
- Server MUST handle client disconnection without affecting other players
- State broadcasts MUST be lightweight (deltas, not full snapshots where possible)

**Rationale**: A laggy or unstable game is not fun. Players will leave immediately if
the game feels unresponsive or crashes frequently.

## Technology Constraints

**Stack** (changes require constitution amendment):
- **Frontend**: React 18 + TypeScript + Vite + Zustand
- **Backend**: Node.js + Express + Socket.io
- **Rendering**: Canvas API (WebGL shaders for effects only)
- **Monorepo**: pnpm workspaces with shared package

**Performance targets**:
- Server tick rate: 60 FPS (16.67ms per tick)
- Client render: 60 FPS minimum on modern browsers
- WebSocket latency: <100ms round-trip under normal conditions
- Max concurrent players per room: 4 controllers + 8 queue

**Supported environments**:
- Node.js >= 20.0.0
- Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- Mobile browsers: best-effort support, not primary target

## Development Workflow

**Branching**:
- Feature branches from `main` for all non-trivial changes
- Branch naming: `feature/description` or `fix/description`
- Direct commits to `main` acceptable for typos, docs, and trivial fixes only

**Code review**:
- All feature PRs SHOULD be reviewed before merge
- Self-merge acceptable for urgent fixes with post-merge review
- Reviewers SHOULD focus on: player impact, simplicity, test coverage

**Commits**:
- One logical change per commit
- Commit messages SHOULD be descriptive (what changed and why)
- Conventional commits format encouraged but not required

**CI requirements**:
- Build MUST pass
- Tests MUST pass
- Lint MUST pass (no new warnings)

## Governance

This constitution governs all development decisions for Unhinged ATC. When in doubt,
refer to the principles in priority order (I through IV).

**Amendment process**:
1. Propose change with rationale in a PR modifying this file
2. Evaluate impact on dependent templates (plan, spec, tasks)
3. Update affected templates in the same PR
4. Version bump according to semantic versioning:
   - MAJOR: Principle removal or fundamental redefinition
   - MINOR: New principle or section added
   - PATCH: Clarification or wording improvement

**Compliance**:
- All PRs SHOULD be evaluated against applicable principles
- Constitution violations MUST be justified in PR description if intentional
- Periodic review: revisit constitution quarterly or after major releases

**Runtime guidance**: See `CLAUDE.md` for development commands and deployment procedures.

**Version**: 1.0.0 | **Ratified**: 2025-01-05 | **Last Amended**: 2025-01-05
