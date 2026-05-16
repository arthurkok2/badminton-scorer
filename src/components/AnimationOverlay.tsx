import { useEffect, useState } from 'react';
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch video as blob to avoid range-request failures on Firebase Hosting.
  // Chrome's media pipeline sends Range requests that Firebase rejects; a blob
  // URL plays entirely from memory with no network range requests.
  useEffect(() => {
    if (!event) {
      setBlobUrl(null);
      return;
    }
    let live = true;
    fetch(getVideoUrl(event.type))
      .then(r => r.blob())
      .then(blob => { if (live) setBlobUrl(URL.createObjectURL(blob)); })
      .catch(() => {});
    return () => { live = false; };
  }, [event]);

  // Revoke previous blob URL when it changes or component unmounts.
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  if (!event) return null;

  const label = EVENT_LABELS[event.type] ?? '';

  return (
    <div className="animation-overlay" role="img" aria-label={label}>
      {blobUrl && (
        <video key={blobUrl} className="animation-overlay-gif" src={blobUrl} autoPlay loop muted playsInline />
      )}
      <p className="animation-overlay-label">{label}</p>
    </div>
  );
}
