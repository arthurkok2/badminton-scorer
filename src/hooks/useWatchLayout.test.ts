import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWatchLayout } from './useWatchLayout';

describe('useWatchLayout', () => {
  let listeners: Record<string, ((e: MediaQueryListEvent) => void)[]> = {};
  let currentMatches = false;

  const makeQueryList = (matches: boolean): MediaQueryList => {
    const mql = {
      matches,
      media: '(max-width: 400px) and (max-height: 420px)',
      onchange: null,
      addEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
      removeEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    return mql as unknown as MediaQueryList;
  };

  beforeEach(() => {
    listeners = {};
    currentMatches = false;
    window.matchMedia = vi.fn((_query: string) => {
      currentMatches = !currentMatches ? false : currentMatches;
      return makeQueryList(currentMatches);
    });
  });

  it('returns false for a non-watch viewport', () => {
    const { result } = renderHook(() => useWatchLayout());
    expect(result.current).toBe(false);
  });

  it('returns true for a watch-sized viewport', () => {
    currentMatches = true;
    const { result } = renderHook(() => useWatchLayout());
    expect(result.current).toBe(true);
  });

  it('reacts to media query changes', () => {
    const { result } = renderHook(() => useWatchLayout());
    expect(result.current).toBe(false);

    act(() => {
      listeners['change']?.[0]?.({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);

    act(() => {
      listeners['change']?.[0]?.({ matches: false } as MediaQueryListEvent);
    });
    expect(result.current).toBe(false);
  });

  it('cleans up listener on unmount', () => {
    const removeEventListener = vi.fn();
    const mql = makeQueryList(false);
    mql.removeEventListener = removeEventListener;
    window.matchMedia = vi.fn(() => mql);

    const { unmount } = renderHook(() => useWatchLayout());
    unmount();

    expect(removeEventListener).toHaveBeenCalled();
  });
});
