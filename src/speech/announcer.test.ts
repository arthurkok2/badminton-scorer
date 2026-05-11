import { buildAnnouncement, getSpeechStatus, speakAnnouncement } from './announcer';
import { awardPointToServingTeam, createMatch } from '../domain/matchEngine';

describe('announcer', () => {
  const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
  let originalSpeechSynthesis: unknown;
  let originalSpeechSynthesisUtterance: unknown;

  beforeEach(() => {
    originalSpeechSynthesis = window.speechSynthesis;
    originalSpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
  });

  afterEach(() => {
    setWindowValue('speechSynthesis', originalSpeechSynthesis);
    setWindowValue('SpeechSynthesisUtterance', originalSpeechSynthesisUtterance);
  });

  it('announces serving team, serving player, and server score first', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );

    expect(buildAnnouncement(match)).toBe('Team Ay, Player 1 serving, 1-0.');
  });

  it('announces game point after a winner exists', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const winner = {
      ...match,
      score: { teamA: 21, teamB: 10 },
      winnerTeamId: 'teamA' as const,
    };

    expect(buildAnnouncement(winner)).toBe('Game. Team Ay wins, 21-10.');
  });

  it('reports speech as unsupported when speech APIs do not exist', () => {
    setWindowValue('speechSynthesis', undefined);
    setWindowValue('SpeechSynthesisUtterance', undefined);

    expect(getSpeechStatus()).toBe('unsupported');
  });

  it('returns false when speaking is unsupported', () => {
    setWindowValue('speechSynthesis', undefined);
    setWindowValue('SpeechSynthesisUtterance', undefined);

    expect(speakAnnouncement(match)).toBe(false);
  });

  it('returns true and speaks when speech APIs exist', () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    const SpeechSynthesisUtterance = vi.fn((text: string) => ({ text }));
    setWindowValue('speechSynthesis', { cancel, speak });
    setWindowValue('SpeechSynthesisUtterance', SpeechSynthesisUtterance);

    expect(speakAnnouncement(match)).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(SpeechSynthesisUtterance).toHaveBeenCalledWith('Team Ay, Player 1 serving, 0-0.');
    expect(speak).toHaveBeenCalledWith({ text: 'Team Ay, Player 1 serving, 0-0.' });
  });

  it('returns false if speech APIs throw', () => {
    setWindowValue('speechSynthesis', {
      cancel: vi.fn(() => {
        throw new Error('speech unavailable');
      }),
      speak: vi.fn(),
    });
    setWindowValue('SpeechSynthesisUtterance', vi.fn((text: string) => ({ text })));

    expect(speakAnnouncement(match)).toBe(false);
  });
});

function setWindowValue(key: 'speechSynthesis' | 'SpeechSynthesisUtterance', value: unknown): void {
  Object.defineProperty(window, key, {
    configurable: true,
    value,
    writable: true,
  });
}
