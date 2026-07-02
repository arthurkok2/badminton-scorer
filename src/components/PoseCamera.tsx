import { useCallback, useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Maximize2 } from 'lucide-react';
import { usePoseDetection, drawSkeleton, type DetectionResult } from '../hooks/usePoseDetection';
import type { PoseInterpreter } from '../input/poseRemote';
import { createPoseInterpreter } from '../input/poseRemote';
import type { AppCommand } from '../input/commands';

interface PoseCameraProps {
  readonly onCommand: (command: AppCommand) => void;
  readonly onStatus?: (gesture: string, frames: number) => void;
}

interface DebugState {
  gesture: string;
  frames: number;
  lastCommand: string;
  cooldownRemaining: number;
  leftHand: string;
  rightHand: string;
}

interface StatusState {
  gesture: string;
  frames: number;
}

const MODAL_VIDEO_W = 320;
const MODAL_VIDEO_H = 240;

function fmt(n: number) { return n.toFixed(3); }

export function PoseCamera({ onCommand, onStatus }: PoseCameraProps) {
  const interpreterRef = useRef<PoseInterpreter>(null!);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [pipContainer, setPipContainer] = useState<HTMLDivElement | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const debugVideoRef = useRef<HTMLVideoElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const debugRef = useRef<{
    gesture: string;
    frames: number;
    lastGesture: string | null;
    lastCommand: string;
    lastCommandTime: number;
    leftHand: string;
    rightHand: string;
    justFired: boolean;
  }>({
    gesture: '-',
    frames: 0,
    lastGesture: null,
    lastCommand: '-',
    lastCommandTime: 0,
    leftHand: '-',
    rightHand: '-',
    justFired: false,
  });

  const [debug, setDebug] = useState<DebugState>({
    gesture: '-',
    frames: 0,
    lastCommand: '-',
    cooldownRemaining: 0,
    leftHand: '-',
    rightHand: '-',
  });

  const [status, setStatus] = useState<StatusState>({ gesture: '-', frames: 0 });

  const handleResult = useCallback((result: DetectionResult) => {
    interpreterRef.current.processResult(result);

    const d = debugRef.current;
    let gesture: string | null = null;
    const openPalms: string[] = [];

    d.leftHand = '-';
    d.rightHand = '-';

    for (let i = 0; i < result.gestures.length; i++) {
      const top = result.gestures[i]?.[0];
      const handCat = result.handedness[i]?.[0];
      const hand = handCat?.categoryName ?? '?';
      const handConf = handCat ? fmt(handCat.score) : '?';
      if (top?.categoryName === 'Open_Palm' && top.score >= 0.5) {
        openPalms.push(hand);
      }
      const label = top
        ? `${top.categoryName} (${fmt(top.score)}) ${hand} (${handConf})`
        : `- ${hand} (${handConf})`;
      if (hand === 'Left') d.leftHand = label;
      else if (hand === 'Right') d.rightHand = label;
    }

    if (openPalms.length === 2) gesture = 'undo';
    else if (openPalms.length === 1) gesture = openPalms[0] === 'Left' ? 'teamA' : 'teamB';

    if (gesture === d.lastGesture && gesture !== null && !d.justFired) {
      d.frames = Math.min(d.frames + 1, 10);
    } else if (gesture !== null && !d.justFired) {
      d.lastGesture = gesture;
      d.frames = 1;
    } else if (gesture === null) {
      d.lastGesture = null;
      d.frames = 0;
      d.justFired = false;
    }
    d.gesture = d.justFired ? '-' : (gesture ?? '-');

    if (debugCanvasRef.current && result.handLandmarks && result.handLandmarks.length > 0) {
      const ctx = debugCanvasRef.current.getContext('2d');
      if (ctx) drawSkeleton(ctx, result.handLandmarks as any[][], MODAL_VIDEO_W, MODAL_VIDEO_H);
    }
  }, []);

  const { isSupported, isActive, error, stream, start, stop } = usePoseDetection({
    onResult: handleResult,
    container: pipContainer,
  });

  useEffect(() => {
    if (debugVideoRef.current && stream) {
      debugVideoRef.current.srcObject = stream;
      debugVideoRef.current.play().catch(() => {});
    }
  }, [stream, showDebug]);

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
    d.justFired = true;

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
        leftHand: d.leftHand,
        rightHand: d.rightHand,
      });
    }, 100);
    return () => clearInterval(interval);
  }, [showDebug]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const d = debugRef.current;
      setStatus({ gesture: d.gesture, frames: d.frames });
      onStatus?.(d.gesture, d.frames);
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, onStatus]);

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
              <span>Gesture Debug</span>
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
              <div className="pose-debug-section">Detection</div>
              <div className="pose-debug-row">
                <span>Gesture</span>
                <span className="pose-debug-val">{debug.gesture}</span>
              </div>
              <div className="pose-debug-row">
                <span>Frames</span>
                <span className="pose-debug-val">{debug.frames} / 10</span>
              </div>
              <div className="pose-debug-row">
                <span>Cooldown</span>
                <span className="pose-debug-val">{debug.cooldownRemaining > 0 ? `${debug.cooldownRemaining}s` : '-'}</span>
              </div>
              <div className="pose-debug-row">
                <span>Last command</span>
                <span className="pose-debug-val">{debug.lastCommand}</span>
              </div>
              <div className="pose-debug-section">Gestures (detection / handedness)</div>
              <div className="pose-debug-row">
                <span>Left</span>
                <span className="pose-debug-val">{debug.leftHand}</span>
              </div>
              <div className="pose-debug-row">
                <span>Right</span>
                <span className="pose-debug-val">{debug.rightHand}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isActive && status.frames > 0 && (
        <div className="pose-status-bar">
          <div className="pose-status-bar-fill" style={{ width: `${(status.frames / 10) * 100}%` }} />
          <span className="pose-status-bar-label">→ {status.gesture}</span>
        </div>
      )}
    </>
  );
}
