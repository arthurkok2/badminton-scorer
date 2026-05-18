import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('firestore.rules', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

  it('rejects anonymous Firebase users for Firestore-backed remote features', () => {
    expect(rules).toContain("request.auth.token.firebase.sign_in_provider != 'anonymous'");
    expect(rules).not.toContain('including anonymous');
  });
});
