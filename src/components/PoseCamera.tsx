import { useCallback, useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Maximize2 } from 'lucide-react';
import { usePoseDetection, drawSkeleton } from '../hooks/usePoseDetection';
import type { PoseInterpreter } from '../input/poseRemote';
import { createPoseInterpreter, classifyBothArms, detectGesture, type Landmark, type ArmClassification, type GestureType } from '../input/poseRemote';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { AppCommand } from '../input/commands';

interface PoseCameraProps {
  readonly onCommand: (command: AppCommand) => void;
}

interface DebugState {
  gesture: string;
  frames: number;
  lastCommand: string;
  cooldownRemaining: number;
}

const MODAL_VIDEO_W = 320;
const MODAL_VIDEO_H = 240;

export function PoseCamera({ onCommand }: PoseCameraProps) {
  const interpreterRef = useRef<PoseInterpreter>(null!);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [pipContainer, setPipContainer] = useState<HTMLDivElement | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const debugVideoRef = useRef<HTMLVideoElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugRef = useRef<{
    gesture: string;
    frames: number;
    lastGesture: GestureType | null;
    lastCommand: string;
    lastCommandTime: number;
  }>({
    gesture: '-',
    frames: 0,
    lastGesture: null,
    lastCommand: '-',
    lastCommandTime: 0,
  });
  const [debug, setDebug] = useState<DebugState>({
    gesture: '-',
    frames: 0,
    lastCommand: '-',
    cooldownRemaining: 0,
  });

  const handleLandmarks = useCallback((landmarks: NormalizedLandmark[][]) => {
    interpreterRef.current.processLandmarks(landmarks);

    if (landmarks.length > 0 && landmarks[0].length >= 17) {
      const arms = classifyBothArms(landmarks[0] as unknown as Landmark[]);
      const gesture = detectGesture(arms.left, arms.right);
      const d = debugRef.current;
      if (gesture === d.lastGesture && gesture !== null) {
        d.frames++;
      } else if (gesture !== null) {
        d.lastGesture = gesture;
        d.frames = 1;
      } else {
        d.lastGesture = null;
        d.frames = 0;
      }
      d.gesture = gesture ?? '-';
    }

    if (debugCanvasRef.current) {
      const ctx = debugCanvasRef.current.getContext('2d');
      if (ctx) drawSkeleton(ctx, landmarks as any[][], MODAL_VIDEO_W, MODAL_VIDEO_H);
    }
  }, []);

  const { isSupported, isActive, error, stream, start, stop } = usePoseDetection({
    onLandmarks: handleLandmarks,
    container: pipContainer,
  });

  useEffect(() => {
    if (debugVideoRef.current && stream) {
      debugVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      interpreterRef.current.destroy();
    };
  }, []);

  const wrapDispatch = useCallback((command: AppCommand) => {
    const d = debugRef.current;
    d.lastCommand = command.type === 'UNDO' ? 'UNDO' : `POINT ${command.type === 'POINT_TEAM' ? command.teamId : ''}`;
    d.lastCommandTime = Date.now();
    d.gesture = '-';
    d.frames = 0;
    d.lastGesture = null;

    feedbackRef.current?.classList.add('pose-feedback-flash');
    setTimeout(() => {
      feedbackRef.current?.classList.remove('pose-feedback-flash');
    }, 300);
    onCommand(command);
  }, [onCommand]);

  useEffect(() => {
    interpreterRef.current = createPoseInterpreter({
      dispatch: wrapDispatch,
    });
  }, [wrapDispatch]);

  useEffect(() => {
    if (!showDebug) return;
    const interval = setInterval(() => {
      const d = debugRef.current;
      const cooldown = Math.max(0, Math.ceil((d.lastCommandTime + 2000 - Date.now()) / 1000));
      setDebug({
        gesture: d.gesture,
        frames: d.frames,
        lastCommand: d.lastCommand,
        cooldownRemaining: cooldown,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [showDebug]);

  if (!isSupported) return null;

  return (
    <>
      <div className="pose-camera-controls">
        <div ref={setPipContainer} className="pose-pip-container" />
        <button
          className={`icon-button ${isActive ? 'pose-camera-active' : ''}`}
          type="button"
          onClick={isActive ? stop : start}
          aria-label={isActive ? 'Disable camera gestures' : 'Enable camera gestures'}
          title={isActive ? 'Disable camera gestures' : 'Enable camera gestures'}
        >
          {isActive ? <CameraOff size={22} aria-hidden="true" /> : <Camera size={22} aria-hidden="true" />}
        </button>
        {isActive && (
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowDebug(true)}
            aria-label="Show debug view"
            title="Show debug view"
          >
            <Maximize2 size={22} aria-hidden="true" />
          </button>
        )}
        <div ref={feedbackRef} className="pose-feedback" aria-live="polite" />
        {error && <div className="pose-camera-error" role="alert">{error}</div>}
      </div>

      {showDebug && (
        <div className="pose-debug-overlay" onClick={() => setShowDebug(false)}>
          <div className="pose-debug-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pose-debug-header">
              <span>Camera Debug</span>
              <button className="icon-button" type="button" onClick={() => setShowDebug(false)} aria-label="Close debug">×</button>
            </div>
            <div className="pose-debug-video-wrap">
              <video
                ref={debugVideoRef}
                playsInline
                autoPlay
                muted
                style={{ width: MODAL_VIDEO_W, height: MODAL_VIDEO_H, borderRadius: 6, objectFit: 'cover' }}
              />
              <canvas
                ref={debugCanvasRef}
                width={MODAL_VIDEO_W}
                height={MODAL_VIDEO_H}
                style={{ position: 'absolute', top: 0, left: 0, width: MODAL_VIDEO_W, height: MODAL_VIDEO_H, borderRadius: 6, pointerEvents: 'none' }}
              />
            </div>
            <div className="pose-debug-info">
              <div className="pose-debug-row">
                <span>Gesture</span>
                <span className="pose-debug-val">{debug.gesture}</span>
              </div>
              <div className="pose-debug-row">
                <span>Frames</span>
                <span className="pose-debug-val">{debug.frames} / 5</span>
              </div>
              <div className="pose-debug-row">
                <span>Cooldown</span>
                <span className="pose-debug-val">{debug.cooldownRemaining > 0 ? `${debug.cooldownRemaining}s` : '-'}</span>
              </div>
              <div className="pose-debug-row">
                <span>Last command</span>
                <span className="pose-debug-val">{debug.lastCommand}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
