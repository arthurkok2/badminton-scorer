import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('firestore.rules', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

  it('rejects anonymous Firebase users for Firestore-backed remote features', () => {
    expect(rules).toContain("request.auth.token.firebase.sign_in_provider != 'anonymous'");
    expect(rules).not.toContain('including anonymous');
  });

  it('defines global player, pair, global match, and user-owned paths', () => {
    expect(rules).toContain('match /players/{playerId}');
    expect(rules).toContain('match /pairs/{pairId}');
    expect(rules).toContain('match /globalMatches/{matchId}');
    expect(rules).toContain('match /users/{userId}');
  });

  it('requires ownership for user-owned history and stats', () => {
    expect(rules).toContain('request.auth.uid == userId');
    expect(rules).toContain('match /sessions/{sessionId}');
    expect(rules).toContain('match /stats/{statsId}');
  });

  it('allows signed-in global lookup but rejects anonymous users', () => {
    expect(rules).toContain('allow read: if isNamedSignedIn()');
    expect(rules).toContain("request.auth.token.firebase.sign_in_provider != 'anonymous'");
  });

  it('pins immutable player fields on update', () => {
    expect(rules).toContain('request.resource.data.displayName == resource.data.displayName');
    expect(rules).toContain('request.resource.data.searchName == resource.data.searchName');
    expect(rules).toContain('request.resource.data.createdBy == resource.data.createdBy');
  });
});
