// src/hooks/usePoseDetection.ts
export interface UsePoseDetectionResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function usePoseDetection(): UsePoseDetectionResult {
  return {
    isSupported: false,
    isActive: false,
    error: null,
    start: async () => {},
    stop: () => {},
  };
}
