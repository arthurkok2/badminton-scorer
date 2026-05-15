import { useEffect } from 'react';
import type { AnimationEvent } from '../animations/types';
import { getVideoUrl } from '../animations/animationAssets';

const EVENT_LABELS: Record<string, string> = {
  match_won:   'MATCH!',
  shutout:     'SHUTOUT!',
  bagel:       'BAGEL 🥯',
  match_point: 'MATCH POINT',
  deuce:       'DEUCE',
  streak_9:    'ON FIRE 🔥🔥🔥',
  streak_6:    'ON FIRE 🔥🔥',
  streak_3:    'ON FIRE 🔥',
  comeback:    'COMEBACK!',
  first_to_11: 'HALFWAY THERE',
  score_6_7:   '6 - 7 👀',
};

interface Props {
  readonly event: AnimationEvent | null;
  readonly onDismiss: () => void;
}

export function AnimationOverlay({ event, onDismiss }: Props) {
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  if (!event) return null;

  const videoUrl = getVideoUrl(event.type);
  const label = EVENT_LABELS[event.type] ?? '';

  return (
    <div className="animation-overlay" role="img" aria-label={label}>
      <video key={event.type} className="animation-overlay-gif" src={videoUrl} autoPlay loop muted playsInline />
      <p className="animation-overlay-label">{label}</p>
    </div>
  );
}
