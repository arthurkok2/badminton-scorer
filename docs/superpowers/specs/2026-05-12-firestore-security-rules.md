# Firestore Security Rules

**Date:** 2026-05-12

## Problem

The original rules were `allow read, write: if true` — a development placeholder that exposes all data to the internet with no restrictions.

## Data Model

Two collections:

**`matches/{code}`** — room document created by the host scorekeeper.

| Field | Type | Notes |
|---|---|---|
| `code` | string | 4-char room code, immutable |
| `active` | bool | false = room closed |
| `hostId` | string | client-generated UUID, immutable after create |
| `createdAt` | timestamp | server time, immutable |
| `updatedAt` | timestamp | server time, mutable |
| `hostHeartbeatAt` | timestamp | server time, mutable |
| `matchMode` | string | `singles` or `doubles` |
| `matchState` | map | full serialised MatchState |
| `winnerTeamId` | string? | `teamA` or `teamB` |
| `lastAppliedCommandId` | string? | ID of last applied command |

**`matches/{code}/commands/{commandId}`** — commands sent by controllers.

| Field | Type | Notes |
|---|---|---|
| `type` | string | `POINT_TEAM`, `UNDO`, or `ANNOUNCE` |
| `teamId` | string? | `teamA`/`teamB`, required iff type=POINT_TEAM |
| `sourceId` | string | client UUID of the controller |
| `sourceKind` | string | `wear` or `web` |
| `createdAt` | timestamp | server time, immutable |
| `appliedAt` | timestamp? | set by host on accept |
| `rejectedAt` | timestamp? | set by host on reject |
| `rejectionReason` | string? | max 256 chars |

## Access Patterns

- **Anyone** with the room code may read rooms and commands (score watching).
- **Controllers** create commands; no other writes.
- **Host** creates rooms; updates room state, heartbeat, active flag; marks commands applied/rejected.
- **No deletes** — rooms deactivate via `active=false`.

## Rule Design

### What the rules enforce

1. **Room code format** — must match `/^[A-HJ-NP-Z2-9]{4}$/` (no 0/1/I/O).
2. **Immutable fields on update** — `code`, `createdAt`, `hostId` must equal existing values.
3. **Server timestamps** — `createdAt`/`updatedAt`/`hostHeartbeatAt` must equal `request.time`.
4. **Enum validation** — `matchMode`, `teamId`, `sourceKind`, `type` all checked against allowlists.
5. **`hasOnly` on every write** — no arbitrary field injection.
6. **String length caps** — `hostId`/`sourceId` ≤128 chars, `rejectionReason` ≤256 chars.
7. **Command create restrictions** — no outcome fields (`appliedAt`, `rejectedAt`) on create.
8. **Command update restrictions** — identity fields immutable; only outcome fields may be added.
9. **Explicit deny-all fallback** — all paths not matched are denied.

### Known limitation

The app has no Firebase Authentication. `hostId` is a client-generated UUID stored in the document, not a Firebase UID. Rules can enforce that `hostId` doesn't change after creation, but cannot cryptographically prove that only the original host is performing updates.

**Future improvement:** add Firebase Anonymous Auth and change the host create/update rules to require `request.auth.uid == resource.data.hostId`.
