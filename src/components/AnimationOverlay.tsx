import { useEffect } from 'react';
import type { AnimationEvent } from '../animations/types';
import { getGifUrl } from '../animations/animationAssets';

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

  const gifUrl = getGifUrl(event.type);
  const label = EVENT_LABELS[event.type] ?? '';

  return (
    <div className="animation-overlay" role="img" aria-label={label}>
      <img className="animation-overlay-gif" src={gifUrl} alt="" />
      <p className="animation-overlay-label">{label}</p>
    </div>
  );
}
