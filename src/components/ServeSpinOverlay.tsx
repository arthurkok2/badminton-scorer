import { useEffect, useRef, useState } from 'react';
import type { MatchMode, PlayerId, TeamId } from '../domain/matchTypes';

interface Props {
  readonly mode: MatchMode;
  readonly onComplete: (teamId: TeamId, playerId: PlayerId) => void;
}

function rollResult(mode: MatchMode): { teamId: TeamId; playerId: PlayerId } {
  const choices: Array<{ teamId: TeamId; playerId: PlayerId }> =
    mode === 'singles'
      ? [
          { teamId: 'teamA', playerId: 'A1' },
          { teamId: 'teamB', playerId: 'B1' },
        ]
      : [
          { teamId: 'teamA', playerId: 'A1' },
          { teamId: 'teamA', playerId: 'A2' },
          { teamId: 'teamB', playerId: 'B1' },
          { teamId: 'teamB', playerId: 'B2' },
        ];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function ServeSpinOverlay({ mode, onComplete }: Props) {
  const resultRef = useRef(rollResult(mode));
  const [landed, setLanded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    function onAnimEnd() {
      if (doneRef.current) return;
      doneRef.current = true;
      setLanded(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowResult(true);
        });
      });

      setTimeout(() => {
        onComplete(resultRef.current.teamId, resultRef.current.playerId);
      }, 1400);
    }

    const el = document.querySelector('.serve-spin-shuttle--spinning');
    el?.addEventListener('animationend', onAnimEnd);
    return () => el?.removeEventListener('animationend', onAnimEnd);
  }, [onComplete]);

  const finalDeg =
    resultRef.current.teamId === 'teamA'
      ? 5760 - 90
      : 5760 + 90;

  return (
    <div className="serve-spin-overlay" role="img" aria-label="Spinning shuttle to determine first server">
      <svg
        className={`serve-spin-shuttle ${landed ? 'serve-spin-shuttle--landed' : 'serve-spin-shuttle--spinning'}`}
        style={landed ? { transform: `rotate(${finalDeg}deg)` } : undefined}
        viewBox="0 0 60 80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M30 2 L58 45 L48 50 L30 22 L12 50 L2 45 Z"
          fill="#f0f0f0"
          stroke="#ccc"
          strokeWidth="1"
        />
        <line x1="30" y1="6" x2="46" y2="47" stroke="#ddd" strokeWidth="1" />
        <line x1="30" y1="6" x2="30" y2="49" stroke="#ddd" strokeWidth="1" />
        <line x1="30" y1="6" x2="14" y2="47" stroke="#ddd" strokeWidth="1" />
        <rect x="27" y="45" width="6" height="12" rx="2" fill="#888" />
        <ellipse cx="30" cy="63" rx="10" ry="7" fill="#faf3e0" stroke="#c4b896" strokeWidth="1" />
      </svg>
      <p className={`serve-spin-result ${showResult ? 'serve-spin-result--visible' : ''}`}>
        {resultRef.current.teamId === 'teamA' ? 'Team A' : 'Team B'} serves first!
      </p>
    </div>
  );
}
