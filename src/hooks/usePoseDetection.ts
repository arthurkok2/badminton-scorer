import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePoseDetectionOptions {
  onLandmarks?: (landmarks: any[]) => void;
  loadPoseLandmarker?: () => Promise<any>;
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

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
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
    const person = landmarks[pi];
    ctx.strokeStyle = COLORS[pi % COLORS.length];
    ctx.lineWidth = 2;

    for (const [i, j] of POSE_CONNECTIONS) {
      const a = person[i];
      const b = person[j];
      if (!a || !b || a.visibility < 0.5 || b.visibility < 0.5) continue;

      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS[pi % COLORS.length];
    for (let i = 0; i < person.length; i++) {
      const p = person[i];
      if (!p || p.visibility < 0.5) continue;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
export function usePoseDetection(options: UsePoseDetectionOptions = {}): UsePoseDetectionResult {
  const { onLandmarks, loadPoseLandmarker = defaultLoadPoseLandmarker, container } = options;
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
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
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
      setStream(stream);

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
        if (!isActiveRef.current || !poseLandmarkerRef.current) return;

        frameCount++;
        if (frameCount % 4 !== 0) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
          if (results.landmarks && results.landmarks.length > 0) {
            if (onLandmarksRef.current) {
              onLandmarksRef.current(results.landmarks);
            }
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                drawSkeleton(ctx, results.landmarks, 160, 120);
              }
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
            if (results.landmarks && results.landmarks.length > 0) {
              if (onLandmarksRef.current) {
                onLandmarksRef.current(results.landmarks);
              }
              if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  drawSkeleton(ctx, results.landmarks, 160, 120);
                }
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
