---
title: Match Cloud Sync Design
author: arthur.kok
date: 2026-05-18
status: implemented
tags: [data, sync]
domain: data
---

# Match Cloud Sync Design

## Overview

When a session match ends and the user is signed in (non-anonymous), the completed `MatchRecord` is synced to Firestore via `completeCloudSessionMatch`. This updates global player and pair Elo ratings atomically in a Firestore transaction.

## Behavior

- After `handleMatchEnded` applies the local match result and transitions to the suggestion phase, it asynchronously calls `completeCloudSessionMatch({ uid, matchRecord })`.
- If the cloud write fails, a sync error banner appears in the session playing view with a Retry button.
- The pending match record is tracked in state so the retry handler can re-attempt the same write.
- Anonymous users and unauthenticated users skip cloud sync entirely.

## Error Recovery

- `sessionSyncError` state holds the error message string when a sync fails.
- `pendingRetryMatch` state holds the `MatchRecord` to retry.
- `handleRetrySessionSync` clears the error and re-calls `completeCloudSessionMatch`.
- On success (both initial and retry), the `.then()` handler clears both `sessionSyncError` and `pendingRetryMatch` so the banner disappears without a page reload.
- On failure, `sessionSyncError` is set to the retry prompt and `pendingRetryMatch` remains set.
- Errors are non-blocking: local session state is always committed first.

## UI

- Sync error banner rendered as `<div className="session-sync-warning" role="status">` in the session playing view only.
- Banner contains the error text and a Retry button.

