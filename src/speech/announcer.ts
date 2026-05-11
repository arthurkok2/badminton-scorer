import type { MatchState, PlayerId, TeamId } from '../domain/matchTypes';

export type SpeechStatus = 'available' | 'unsupported';

export function getSpeechStatus(): SpeechStatus {
  return typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance
    ? 'available'
    : 'unsupported';
}

export function buildAnnouncement(match: MatchState): string {
  if (match.winnerTeamId) {
    const winner = teamNameForSpeech(match.teams[match.winnerTeamId].name);
    return `Game. ${winner} wins, ${scoreForTeam(match, match.winnerTeamId)}-${scoreForTeam(match, otherTeam(match.winnerTeamId))}.`;
  }

  const server = findPlayerName(match, match.serverId);
  const servingTeam = teamNameForSpeech(match.teams[match.servingTeamId].name);
  const receivingTeamId = otherTeam(match.servingTeamId);

  return `${servingTeam} serving, ${server}, ${scoreForTeam(match, match.servingTeamId)}-${scoreForTeam(match, receivingTeamId)}.`;
}

function teamNameForSpeech(name: string): string {
  return name.replace(/ ([A-Z])$/, ', $1');
}

export function speakAnnouncement(match: MatchState): boolean {
  if (getSpeechStatus() === 'unsupported') {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(buildAnnouncement(match)));
    return true;
  } catch {
    return false;
  }
}

function findPlayerName(match: MatchState, playerId: PlayerId): string {
  return [...match.teams.teamA.players, ...match.teams.teamB.players].find((player) => player.id === playerId)?.name ?? playerId;
}

function scoreForTeam(match: MatchState, teamId: TeamId): number {
  return match.score[teamId];
}

function otherTeam(teamId: TeamId): TeamId {
  return teamId === 'teamA' ? 'teamB' : 'teamA';
}
