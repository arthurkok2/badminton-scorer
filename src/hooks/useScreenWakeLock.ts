import { useCallback, useEffect, useRef } from 'react';

export function useScreenWakeLock(active: boolean): void {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Wake Lock not available or permission denied
    }
  }, []);

  const release = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (active) {
      void request();
      const onVisible = () => {
        if (document.visibilityState === 'visible' && !wakeLockRef.current) {
          void request();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    } else {
      release();
    }
  }, [active, request, release]);

  useEffect(() => () => release(), [release]);
}
