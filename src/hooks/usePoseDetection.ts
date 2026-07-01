import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePoseDetectionOptions {
  onLandmarks?: (landmarks: any[]) => void;
  loadPoseLandmarker?: () => Promise<any>;
}

export interface UsePoseDetectionResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

async function defaultLoadPoseLandmarker() {
  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 2,
  });
}

export function usePoseDetection(options: UsePoseDetectionOptions = {}): UsePoseDetectionResult {
  const { onLandmarks, loadPoseLandmarker = defaultLoadPoseLandmarker } = options;
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => {
    return typeof navigator !== 'undefined' &&
           'mediaDevices' in navigator &&
           'getUserMedia' in (navigator.mediaDevices ?? {});
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poseLandmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const onLandmarksRef = useRef(onLandmarks);
  onLandmarksRef.current = onLandmarks;

  const stop = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (poseLandmarkerRef.current) {
      poseLandmarkerRef.current.close();
      poseLandmarkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (isActiveRef.current) return;

    setError(null);

    try {
      poseLandmarkerRef.current = await loadPoseLandmarker();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
        throw err;
      }

      streamRef.current = stream;

      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      try {
        await video.play();
      } catch (err) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        throw err;
      }
      videoRef.current = video;

      isActiveRef.current = true;
      setIsActive(true);

      let frameCount = 0;
      const detect = () => {
        if (!isActiveRef.current || !poseLandmarkerRef.current) return;

        frameCount++;
        if (frameCount % 4 !== 0) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
          if (results.landmarks && results.landmarks.length > 0 && onLandmarksRef.current) {
            onLandmarksRef.current(results.landmarks);
          }
        } catch {
          // Detection can fail if video isn't ready yet
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Camera permission denied');
      } else {
        setError('Failed to start camera');
      }
    }
  }, [loadPoseLandmarker]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isActiveRef.current) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else if (!document.hidden && isActiveRef.current && rafRef.current === null && videoRef.current) {
        let frameCount = 0;
        const detect = () => {
          if (!isActiveRef.current || !poseLandmarkerRef.current) return;

          frameCount++;
          if (frameCount % 4 !== 0) {
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          try {
            const results = poseLandmarkerRef.current.detectForVideo(videoRef.current!, performance.now());
            if (results.landmarks && results.landmarks.length > 0 && onLandmarksRef.current) {
              onLandmarksRef.current(results.landmarks);
            }
          } catch {
            // ignore
          }

          rafRef.current = requestAnimationFrame(detect);
        };
        rafRef.current = requestAnimationFrame(detect);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return { isSupported, isActive, error, start, stop };
}
