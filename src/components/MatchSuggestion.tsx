import { useState } from 'react';
import { rankSplitsForPlayers } from '../session/sessionScheduler';
import { SessionMatchHistory } from './SessionMatchHistory';
import type {
  MatchRecord,
  MatchSuggestion as MatchSuggestionData,
  PairingMatrix,
  TeamSplit,
} from '../session/sessionTypes';

interface MatchSuggestionProps {
  readonly suggestion: MatchSuggestionData;
  readonly pairingMatrix: PairingMatrix;
  readonly completedMatches?: readonly MatchRecord[];
  readonly onStartMatch: (split: TeamSplit) => void;
  readonly onEditPlayers: () => void;
  readonly onEndSession: () => void;
}

export function MatchSuggestion({
  suggestion,
  pairingMatrix,
  completedMatches = [],
  onStartMatch,
  onEditPlayers,
  onEndSession,
}: MatchSuggestionProps) {
  const [rankedSplits, setRankedSplits] = useState(suggestion.rankedSplits);
  const [onBreak, setOnBreak] = useState(suggestion.onBreak);
  const [splitIndex, setSplitIndex] = useState<0 | 1 | 2>(0);
  const [showBreakPicker, setShowBreakPicker] = useState(false);
  const [swapOut, setSwapOut] = useState('');
  const [swapIn, setSwapIn] = useState('');

  const currentSplit = rankedSplits[splitIndex];
  const playingNow: [
    typeof currentSplit.teamA[0],
    typeof currentSplit.teamA[1],
    typeof currentSplit.teamB[0],
    typeof currentSplit.teamB[1],
  ] = [currentSplit.teamA[0], currentSplit.teamA[1], currentSplit.teamB[0], currentSplit.teamB[1]];

  function handleSwap() {
    setSplitIndex(prev => ((prev + 1) % 3) as 0 | 1 | 2);
  }

  function handleConfirmBreakChange() {
    if (!swapOut || !swapIn) return;
    const swapInPlayer = onBreak.find(player => player.id === swapIn);
    if (!swapInPlayer) return;
    const newFour: typeof playingNow = [
      playingNow[0].id === swapOut ? swapInPlayer : playingNow[0],
      playingNow[1].id === swapOut ? swapInPlayer : playingNow[1],
      playingNow[2].id === swapOut ? swapInPlayer : playingNow[2],
      playingNow[3].id === swapOut ? swapInPlayer : playingNow[3],
    ];
    const newRanked = rankSplitsForPlayers(newFour, pairingMatrix);
    setRankedSplits(newRanked);
    const swapOutPlayer = playingNow.find(player => player.id === swapOut);
    setOnBreak([
      ...onBreak.filter(player => player.id !== swapIn),
      ...(swapOutPlayer ? [swapOutPlayer] : []),
    ]);
    setSplitIndex(0);
    setShowBreakPicker(false);
    setSwapOut('');
    setSwapIn('');
  }

  return (
    <section className="match-suggestion" aria-label="Next match">
      <div className="session-panel-header">
        <span>Up next</span>
        <h2>Next match</h2>
      </div>

      <div className="match-suggestion-teams">
        <fieldset role="group" aria-label="Team A">
          <legend>Team A</legend>
          <span>{currentSplit.teamA[0].displayName}</span>
          <span>{currentSplit.teamA[1].displayName}</span>
        </fieldset>
        <span className="match-suggestion-vs">vs</span>
        <fieldset role="group" aria-label="Team B">
          <legend>Team B</legend>
          <span>{currentSplit.teamB[0].displayName}</span>
          <span>{currentSplit.teamB[1].displayName}</span>
        </fieldset>
      </div>

      {onBreak.length > 0 && (
        <p className="match-suggestion-break">
          On break: {onBreak.map((player, i) => (
            <span key={player.id}>{i > 0 ? ', ' : ''}<span>{player.displayName}</span></span>
          ))}
        </p>
      )}

      <div className="match-suggestion-actions">
        <button className="session-secondary-button" onClick={handleSwap} aria-label="Swap teams">Swap teams</button>
        {onBreak.length > 0 && (
          <button className="session-secondary-button" onClick={() => setShowBreakPicker(v => !v)} aria-label="Change break">
            Change break
          </button>
        )}
        <button className="session-primary-button" onClick={() => onStartMatch(currentSplit)} aria-label="Start match">Start match</button>
      </div>

      {showBreakPicker && (
        <div className="match-suggestion-break-picker">
          <label htmlFor="swap-out">Who sits out</label>
          <select id="swap-out" value={swapOut} onChange={e => setSwapOut(e.target.value)} aria-label="Who sits out">
            <option value="">Select…</option>
            {playingNow.map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}
          </select>
          <label htmlFor="swap-in">Who comes on</label>
          <select id="swap-in" value={swapIn} onChange={e => setSwapIn(e.target.value)} aria-label="Who comes on">
            <option value="">Select…</option>
            {onBreak.map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}
          </select>
          <button className="session-secondary-button" onClick={handleConfirmBreakChange} disabled={!swapOut || !swapIn}>Confirm</button>
        </div>
      )}

      <div className="match-suggestion-secondary">
        <button className="session-secondary-button" onClick={onEditPlayers} aria-label="Edit players">Edit players</button>
        <button className="session-danger-button" onClick={onEndSession} aria-label="End session">End session</button>
      </div>

      <SessionMatchHistory matches={completedMatches} />
    </section>
  );
}
