import { useState, useRef, useCallback, useEffect } from 'react';

export interface DetectionResult {
  gestures: { categoryName: string; score: number }[][];
  handedness: { categoryName: string; score: number }[][];
  handLandmarks: any[][];
}

export interface UsePoseDetectionOptions {
  onResult?: (result: DetectionResult) => void;
  loadRecognizer?: () => Promise<any>;
  container?: HTMLElement | null;
}

export interface UsePoseDetectionResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
}

async function defaultLoadRecognizer() {
  const { GestureRecognizer, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  );
  return GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const COLORS = ['#4ade80', '#60a5fa'];

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: any[][],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);

  for (let pi = 0; pi < landmarks.length; pi++) {
    const hand = landmarks[pi];
    ctx.strokeStyle = COLORS[pi % COLORS.length];
    ctx.lineWidth = 2;

    for (const [i, j] of HAND_CONNECTIONS) {
      const a = hand[i];
      const b = hand[j];
      if (!a || !b || a.visibility < 0.5 || b.visibility < 0.5) continue;

      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS[pi % COLORS.length];
    for (let i = 0; i < hand.length; i++) {
      const p = hand[i];
      if (!p || p.visibility < 0.5) continue;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function usePoseDetection(options: UsePoseDetectionOptions = {}): UsePoseDetectionResult {
  const { onResult, loadRecognizer = defaultLoadRecognizer, container } = options;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => {
    return typeof navigator !== 'undefined' &&
           'mediaDevices' in navigator &&
           'getUserMedia' in (navigator.mediaDevices ?? {});
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef(container);
  containerRef.current = container;
  const recognizerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

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
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }

    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }

    if (recognizerRef.current) {
      recognizerRef.current.close();
      recognizerRef.current = null;
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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
      }
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (isActiveRef.current) return;

    setError(null);

    try {
      recognizerRef.current = await loadRecognizer();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        recognizerRef.current.close();
        recognizerRef.current = null;
        throw err;
      }

      streamRef.current = stream;
      setStream(stream);

      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      try {
        await video.play();
      } catch (err) {
        recognizerRef.current.close();
        recognizerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        throw err;
      }
      videoRef.current = video;

      const target = containerRef.current;
      if (target) {
        video.style.width = '160px';
        video.style.height = '120px';
        video.style.position = 'absolute';
        video.style.bottom = '8px';
        video.style.right = '8px';
        video.style.borderRadius = '6px';
        video.style.objectFit = 'cover';
        video.style.border = '1px solid rgba(255,255,255,0.2)';
        video.style.zIndex = '10';
        target.appendChild(video);

        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        canvas.style.position = 'absolute';
        canvas.style.bottom = '8px';
        canvas.style.right = '8px';
        canvas.style.width = '160px';
        canvas.style.height = '120px';
        canvas.style.borderRadius = '6px';
        canvas.style.zIndex = '11';
        canvas.style.pointerEvents = 'none';
        target.appendChild(canvas);
        canvasRef.current = canvas;
      }

      isActiveRef.current = true;
      setIsActive(true);

      let frameCount = 0;
      const detect = () => {
        if (!isActiveRef.current || !recognizerRef.current) return;

        frameCount++;
        if (frameCount % 4 !== 0) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const results = recognizerRef.current.recognizeForVideo(video, performance.now());
          if (results.gestures && results.gestures.length > 0 && onResultRef.current) {
            onResultRef.current({
              gestures: results.gestures.map((g: any[]) => g.map((c: any) => ({ categoryName: c.categoryName, score: c.score }))),
              handedness: results.handedness.map((h: any[]) => h.map((c: any) => ({ categoryName: c.categoryName, score: c.score }))),
              handLandmarks: results.handLandmarks,
            });
          }
          if (canvasRef.current && results.handLandmarks && results.handLandmarks.length > 0) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              drawSkeleton(ctx, results.handLandmarks, 160, 120);
            }
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
  }, [loadRecognizer]);

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
          if (!isActiveRef.current || !recognizerRef.current) return;

          frameCount++;
          if (frameCount % 4 !== 0) {
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          try {
            const results = recognizerRef.current.recognizeForVideo(videoRef.current!, performance.now());
            if (results.gestures && results.gestures.length > 0 && onResultRef.current) {
              onResultRef.current({
                gestures: results.gestures.map((g: any[]) => g.map((c: any) => ({ categoryName: c.categoryName, score: c.score }))),
                handedness: results.handedness.map((h: any[]) => h.map((c: any) => ({ categoryName: c.categoryName, score: c.score }))),
                handLandmarks: results.handLandmarks,
              });
            }
            if (canvasRef.current && results.handLandmarks && results.handLandmarks.length > 0) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                drawSkeleton(ctx, results.handLandmarks, 160, 120);
              }
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

  return { isSupported, isActive, error, stream, start, stop };
}
