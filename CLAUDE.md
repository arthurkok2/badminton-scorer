# Badminton Scorer — AI Assistant Guide

## Project Overview

Phone-first badminton scorekeeper PWA. React 19 + TypeScript + Vite + Firebase/Firestore. Doubles-first rally scoring engine, BLE remote support, Wear OS / browser controller remotes, speech announcements, match persistence.

## Tech Stack

- **Framework:** React 19, react-router-dom v7
- **Language:** TypeScript 5.8
- **Build:** Vite 7
- **Tests:** Vitest 3 + Testing Library
- **Backend:** Firebase Firestore (remote rooms), Firestore emulator for dev
- **Styling:** Plain CSS (`src/styles.css`)
- **Icons:** lucide-react

## Node Version

Always run `source ~/.nvm/nvm.sh && nvm use 22` before any `npm` or Vite commands in this project.

## Verification Commands

Run all three before claiming work is done:

```bash
npm test
npm run lint
npm run build
node --check public/sw.js
```

## Spec generation (`.specs/`)

Specs are detailed design documents for significant changes. They provide a single source of truth for the problem, solution, and rationale, enabling asynchronous review and historical context.

### Output location

```
.specs/{YYYY}/{MM}/{DATE}-{short-descriptor}.md
```

Example: `.specs/2026/05/2026-05-12-multi-point-undo-design.md`

Descriptor: 3-5 words, kebab-case, summarizes the change.

### Required frontmatter

```yaml
---
title: Short descriptive title
author: firstname.lastname
date: YYYY-MM-DD
status: implemented        # draft | in-progress | implemented | superseded
tags: [tag1, tag2]
domain: scoring            # scoring | ui | input | remote | infra | feature
---
```

### Required body sections

| Section | Required | When |
|---------|----------|------|
| **Problem** | Always | What's broken/missing |
| **Goal** | Always | Success criteria |
| **Constraints** | Always | Hard boundaries |
| **Non-Goals** | If scope ambiguous | Explicit exclusions |
| **Acceptance Criteria** | Always | Testable conditions |
| **Alternatives Considered** | If complexity >= 3 | What else evaluated, why rejected |
| **Approach** | Always | How it's built |
| **What Changes** | Always | Files, components, modifications |
| **What Stays the Same** | If blast radius unclear | Reviewer reassurance |
| **Architecture Impact** | Always | Which `.docs/` files need updating and what changed |
| **Testing Strategy** | Always | What's tested, how |
| **Verification** | Always | How correctness confirmed |
| **Performance Impact** | If touches hot path | Before/after, scale |
| **Security Considerations** | If touches auth/data/input | Attack surface, validation |
| **Risk Analysis** | If risk >= medium | Table: risk / likelihood / mitigation |
| **Rollback & Deployment** | If non-standard | How it deploys, how to undo |
| **Observability** | If prod-facing | Signals for working/broken |
| **Affected Components** | Always | Endpoints, services, tables |
| **Dependencies** | If sequenced | Blocks / blocked-by |
| **Reviewer Context** | If domain-specific | What reviewer needs to know |

### Index updates

When adding a spec, add an entry to `.specs/SPEC-INDEX.md`.

Format:
```markdown
| YYYY-MM-DD | [TICKET](path/to/TICKET.md) | Title | module | domain | risk | complexity |
```

### Lifecycle

- Specs are immutable after merge
- New spec can `supersedes: TICKET` to replace an old one
- Never delete specs — they're the evidence trail

---

## Architecture doc updates (`.docs/`)

### Documenting changes

Rule: update architecture docs for every change that affects design, behavior, or the system’s surface area. This includes feature work, bug fixes that change behavior or assumptions, implementation-detail changes that affect other teams, refactors that alter runtime behavior, config/build/infra changes, public APIs, data models, and deployment/runtime concerns.

Exceptions (no arch-doc required)
- Pure test additions that do not change code or behavior.
- Minor bug fixes that only correct typos or UI copy and do not alter architecture, data shape, contracts, or operational behavior.

If uncertain whether a change needs docs, err on the side of documentation — small, targeted updates are better than missing context for reviewers and future maintainers.

Match area of code changed to its doc domain:

| Code area | Doc domain |
|-----------|-----------|
| `src/domain/` — scoring engine, game types, rules | `.docs/game-engine/scoring-engine.md` |
| `src/components/`, `src/pages/`, `src/hooks/` — UI, routing | `.docs/ui/ui-architecture.md` |
| `src/styles.css`, `src/preferences.ts` — theming, settings | `.docs/ui/ui-architecture.md` |
| `src/input/` — BLE, keyboard, gamepad, gesture | `.docs/input/input-remotes.md` |
| `src/remote/` — Firestore remote control | `.docs/input/input-remotes.md` |
| `src/auth/`, `src/session/`, `src/firebase.ts` — Firebase, sync | `.docs/data/firebase-services.md` |
| `src/speech/`, `src/animations/` — announcements, effects | `.docs/media/speech-animations.md` |
| `public/sw.js` — service worker, offline | `.docs/platform/build-deploy.md` |
| `vite.config.ts`, `tsconfig.json`, `firebase.json`, CI config | `.docs/platform/build-deploy.md` |

For document format, frontmatter, cross-references, and content principles, see **`.docs/rules.md`**.

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add speech announcement toggle
fix: correct service rotation after deuce
refactor: extract scoring logic into gameLogic.ts
test: cover undo across multiple points
chore: bump vite to v7
```

Common types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`.

## Key Source Locations

| Area | Path |
|------|------|
| Scoring engine | `src/gameLogic.ts` |
| App root | `src/App.tsx` |
| Match state / persistence | `src/matchState.ts` |
| Firestore remote service | `src/remote/` |
| Controller page | `src/pages/ControllerPage.tsx` |
| Hooks | `src/hooks/` |
| Styles | `src/styles.css` |
| Service worker | `public/sw.js` |
| Specs | `.specs/` |

## Routes

- `/` — live scorer (`<App>`)
- `/controller` — browser-based Wear OS remote simulator (`<ControllerPage>`)

## Testing Notes

- Tests use Vitest with jsdom and Testing Library.
- Firestore tests use the emulator (`VITE_USE_FIRESTORE_EMULATOR=true`) or mocked Firestore — do not mock the scoring engine itself.
- Run `npm test` (not `vitest` directly) so the project's Vite config is used.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.