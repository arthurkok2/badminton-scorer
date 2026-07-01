import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePoseDetection } from './usePoseDetection';

const mockGetUserMedia = vi.fn();
const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
  getVideoTracks: vi.fn(() => [{ stop: vi.fn() }]),
} as unknown as MediaStream;

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
  });
  mockGetUserMedia.mockResolvedValue(mockMediaStream);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createStubPoseLandmarker() {
  return {
    detectForVideo: vi.fn().mockReturnValue({ landmarks: [] }),
    close: vi.fn(),
  };
}

describe('usePoseDetection', () => {
  it('isSupported is true when getUserMedia exists', () => {
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));
    expect(result.current.isSupported).toBe(true);
  });

  it('isSupported is false when getUserMedia is missing', () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: undefined, writable: true });
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));
    expect(result.current.isSupported).toBe(false);
  });

  it('isActive is false initially', () => {
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));
    expect(result.current.isActive).toBe(false);
  });

  it('isActive becomes true after start() succeeds', async () => {
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());
    const onLandmarks = vi.fn();
    const { result } = renderHook(() => usePoseDetection({ onLandmarks, loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isActive).toBe(true);
  });

  it('sets error when getUserMedia is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());

    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe('Camera permission denied');
    expect(result.current.isActive).toBe(false);
  });

  it('stop sets isActive to false', async () => {
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());

    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isActive).toBe(false);
  });

  it('does not throw when stop is called before start', () => {
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));

    expect(() => {
      act(() => {
        result.current.stop();
      });
    }).not.toThrow();
  });

  it('does not throw when start is called while already active', async () => {
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());

    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isActive).toBe(true);
  });
});
