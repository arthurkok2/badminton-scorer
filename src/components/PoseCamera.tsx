import { useCallback, useRef, useEffect, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import type { PoseInterpreter } from '../input/poseRemote';
import { createPoseInterpreter } from '../input/poseRemote';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { AppCommand } from '../input/commands';

interface PoseCameraProps {
  readonly onCommand: (command: AppCommand) => void;
}

export function PoseCamera({ onCommand }: PoseCameraProps) {
  const interpreterRef = useRef<PoseInterpreter>(null!);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [pipContainer, setPipContainer] = useState<HTMLDivElement | null>(null);

  const handleLandmarks = useCallback((landmarks: NormalizedLandmark[][]) => {
    interpreterRef.current.processLandmarks(landmarks);
  }, []);

  const { isSupported, isActive, error, start, stop } = usePoseDetection({
    onLandmarks: handleLandmarks,
    container: pipContainer,
  });

  useEffect(() => {
    return () => {
      interpreterRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    interpreterRef.current = createPoseInterpreter({
      dispatch: (command) => {
        feedbackRef.current?.classList.add('pose-feedback-flash');
        setTimeout(() => {
          feedbackRef.current?.classList.remove('pose-feedback-flash');
        }, 300);
        onCommand(command);
      },
    });
  }, [onCommand]);

  if (!isSupported) return null;

  return (
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
      <div ref={feedbackRef} className="pose-feedback" aria-live="polite" />
      {error && <div className="pose-camera-error" role="alert">{error}</div>}
    </div>
  );
}
