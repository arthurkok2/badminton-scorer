import { useEffect, useState } from 'react';

export function useWatchLayout(): boolean {
  const [isWatch, setIsWatch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 400px) and (max-height: 420px)');
    setIsWatch(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsWatch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isWatch;
}
