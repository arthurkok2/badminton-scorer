import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerId, TeamId } from '../domain/matchTypes';

interface Props {
  readonly playerNames: Record<PlayerId, string>;
  readonly onComplete: (teamId: TeamId) => void;
}

type Phase = 'idle' | 'spinning' | 'settled';

function randomSpin(): { targetRotation: number; winner: TeamId } {
  const baseSpins = (3 + Math.floor(Math.random() * 3)) * 360;
  const teamB = Math.random() < 0.5;

  let offset: number;
  if (teamB) {
    offset = 60 + Math.random() * 60;
  } else {
    offset = 240 + Math.random() * 60;
  }

  return {
    targetRotation: baseSpins + offset,
    winner: teamB ? 'teamB' : 'teamA',
  };
}

export function SpinningShuttle({ playerNames, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentRotation, setCurrentRotation] = useState(0);
  const [winner, setWinner] = useState<TeamId | null>(null);
  const [showResult, setShowResult] = useState(false);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const teamAName = playerNames.A1;
  const teamBName = playerNames.B1;

  const handleClick = useCallback(() => {
    if (phase !== 'idle') return;
    const { targetRotation, winner: w } = randomSpin();
    setWinner(w);
    setPhase('spinning');
    setCurrentRotation(targetRotation);
  }, [phase]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const handleTransitionEnd = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('settled');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowResult(true);
      });
    });

    timerRef.current = setTimeout(() => {
      if (winner) onComplete(winner);
    }, 500);
  }, [winner, onComplete]);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      doneRef.current = true;
    };
  }, []);

  const shuttleClasses = [
    'spinning-shuttle-svg',
    phase === 'spinning' && 'spinning-shuttle-svg--spinning',
    phase === 'settled' && 'spinning-shuttle-svg--settled',
  ]
    .filter(Boolean)
    .join(' ');

  const labelAClasses = [
    'spinning-shuttle-label',
    'spinning-shuttle-label--teamA',
    showResult && winner === 'teamA' && 'spinning-shuttle-label--winner',
  ]
    .filter(Boolean)
    .join(' ');

  const labelBClasses = [
    'spinning-shuttle-label',
    'spinning-shuttle-label--teamB',
    showResult && winner === 'teamB' && 'spinning-shuttle-label--winner',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="spinning-shuttle-overlay" role="dialog" aria-label="Spin shuttle to decide who serves first">
      <div className="spinning-shuttle-card">
        <p className="spinning-shuttle-prompt">
          {phase === 'idle' && 'Tap the shuttle to toss'}
          {phase === 'spinning' && 'Spinning...'}
          {showResult && (winner === 'teamA' ? `Team A ${teamAName} serves first!` : `Team B ${teamBName} serves first!`)}
        </p>

        <div className="spinning-shuttle-labels">
          <span className={labelAClasses}>Team A {teamAName}</span>
          <span className={labelBClasses}>Team B {teamBName}</span>
        </div>

        <svg
          className={shuttleClasses}
          style={{ transform: `rotate(${currentRotation}deg)` }}
          viewBox="0 0 60 80"
          xmlns="http://www.w3.org/2000/svg"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onTransitionEnd={handleTransitionEnd}
          role="button"
          aria-label="Tap to spin the shuttle"
          tabIndex={0}
        >
          <ellipse cx="30" cy="15" rx="8" ry="10" fill="#faf3e0" stroke="#c4b896" strokeWidth="1" />
          <rect x="27" y="24" width="6" height="10" rx="2" fill="#888" />
          <path
            d="M30 33 L52 68 L42 72 L30 48 L18 72 L8 68 Z"
            fill="#f0f0f0"
            stroke="#ccc"
            strokeWidth="1"
          />
          <line x1="30" y1="33" x2="45" y2="70" stroke="#ddd" strokeWidth="1" />
          <line x1="30" y1="33" x2="30" y2="72" stroke="#ddd" strokeWidth="1" />
          <line x1="30" y1="33" x2="15" y2="70" stroke="#ddd" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
