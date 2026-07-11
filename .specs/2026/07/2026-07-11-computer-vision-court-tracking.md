---
title: Computer Vision Court Tracking for Post-Match Analysis
author: arthur.kok
date: 2026-07-11
status: draft
tags: [computer-vision, tracking, analysis, yolo, tfjs]
domain: feature
---

# Computer Vision Court Tracking for Post-Match Analysis

## Problem

The scorer app captures point-by-point scoring data but has no visibility into what happens during rallies — player movement, shuttle trajectory, court positioning. Coaches and players who want to analyze their game after a match have no data beyond the final score. The app already has a camera pipeline via MediaPipe for hand gesture scoring, but this is pointed at the players' hands, not the court.

## Goal

On-device computer vision pipeline that detects players and shuttlecock positions from a video recording of a match, producing post-match analysis outputs: rally replays with position overlay, player heatmaps and movement stats, and an exported video with tracking markers.

## Constraints

- Phone/tablet on a tripod pointed at the court. Camera must capture the full court including both sides.
- All processing on-device (PWA, no cloud inference, no internet required for analysis).
- Must integrate with existing match data: recording is associated with a match session, rally boundaries come from the scoring engine's timestamped history.
- No real-time detection during recording — analysis runs after the match.
- Must coexist with existing manual scoring. Recording and scoring happen simultaneously but independently.

## Non-Goals

- Real-time detection during play.
- Automatic scoring from vision (scoring remains manual).
- Player identity/person recognition (just "player on team A" and "player on team B").
- Multi-camera setups.
- Live streaming or cloud upload.
- Court line detection from video (user manually calibrates once).

## Acceptance Criteria

- **Recording:** User can start/stop video recording from the scorer UI. Recording saves to IndexedDB as WebM. Recording does not interfere with manual scoring.
- **Calibration:** Before first analysis, user taps 4 court corners on a still frame from the camera. A homography matrix is computed and saved (reused for subsequent matches from same tripod position).
- **Detection:** Post-match, user taps "Analyze" on a recorded match. The app processes video frames through a YOLOv8-nano TF.js model, detecting players and shuttlecock per frame. Processing runs offline (no real-time constraint).
- **Rally Replay:** Animated 2D top-down court showing player positions (team-colored circles) and shuttle trajectory (dot + trailing line) for each rally. Play/pause/seek controls. Rally duration, shot count, and distance stats shown alongside.
- **Player Heatmaps:** Per-player position density heatmap overlaid on the court. Color gradient from blue (rare) to red (frequent). Stats dashboard: total distance covered, average/max speed, % time in each court zone (front/mid/rear × left/center/right).
- **Video Export:** Re-encode original recording with tracking markers burned in (player bounding boxes, shuttle circle + trail, court line projection). Export as WebM via download/share.
- **Verification:** `npm test && npm run lint && npm run build` all pass.
- Existing input methods, scoring engine, and UI continue to work unchanged.

## Approach

### Recording (`src/hooks/useVideoRecorder.ts`)

MediaRecorder API wrapper:
- `startRecording()` — requests `getUserMedia` with environment-facing camera (`facingMode: 'environment'`), 1080p or device-native resolution. Creates MediaRecorder with `video/webm; codecs=vp9` MIME type. Stores chunks in memory.
- `stopRecording()` — finalizes recording, assembles Blob, stores in IndexedDB keyed by match ID + timestamp.
- `isRecording` state, error handling for permission denied.
- Independent of the gesture camera (different facing mode, different video element).

### Calibration (`src/vision/calibration.ts`)

- `computeHomography(srcPoints: Point[], dstPoints: Point[]): Matrix3x3`
- User marks 4 court corners on a still frame from the camera feed. Points are ordered: near-left, near-right, far-left, far-right (from camera perspective).
- Destination points are real court dimensions: 13.4m × 6.1m (doubles court).
- Uses Direct Linear Transform (DLT) via least squares to compute the 3×3 homography matrix.
- `pixelToCourt(px: Point, H: Matrix3x3): Point` — maps any pixel coordinate to court meters.
- Calibration is stored in IndexedDB, keyed by device + camera position. User recalibrates only when moving the tripod.

### Detection (`src/vision/detector.ts`)

TF.js YOLOv8-nano model:
- Model: YOLOv8-nano (~6MB, ~3.2M parameters), converted to TF.js GraphModel format.
- Classes: `player` (0), `shuttlecock` (1).
- `loadModel(): Promise<GraphModel>` — loads from a CDN or bundled public/ URL.
- `detect(model, frame: ImageData): Detection[]` — runs inference, returns bounding boxes with class, confidence, and center point.
- Output: `{ class: 'player' | 'shuttlecock', bbox: [x, y, w, h], confidence: number, center: {x, y} }`

### Tracking (`src/vision/tracker.ts`)

Simple frame-to-frame identity tracking:
- Player tracking: Hungarian algorithm on bounding box IoU between consecutive frames. Assigns stable IDs to each detected player.
- Shuttle tracking: nearest-neighbor matching between consecutive frames. Short trail history (last 30 positions).
- `trackDetections(prev: TrackedFrame, detections: Detection[]): TrackedFrame`
- Smoothing via exponential moving average on position for jitter reduction.

### Analysis Pipeline (`src/vision/analyzer.ts`)

Orchestrates post-match processing:
1. Load video from IndexedDB.
2. Load calibration matrix.
3. Seek video to each frame, draw to offscreen canvas, run detector.
4. Track detections across frames.
5. Apply homography to map pixel positions to court coordinates.
6. Map timestamps to rally boundaries from MatchState history.
7. Output: `AnalysisResult` containing per-frame `TrackedFrame[]` and per-rally `RallyData[]`.

Processing runs in a Web Worker to avoid blocking the UI. Progress is reported back to the main thread.

### Stats Computation (`src/vision/stats.ts`)

Pure functions operating on `AnalysisResult`:
- `computeHeatmap(frames, playerId): number[][]` — 2D grid of court position density.
- `computeDistance(frames, playerId): number` — sum of Euclidean distances between consecutive positions.
- `computeZonePercentages(frames, playerId): Record<CourtZone, number>` — % time in each zone.
- `computeShotCount(rally: RallyData): number` — shuttle direction changes within a rally.
- `computeSpeeds(frames, playerId): { avg, max }` — m/s from position deltas and frame timestamps.

### UI Components

**`CalibrationOverlay.tsx`:** Full-screen overlay with camera preview. User taps 4 corners of the court in order. Visual feedback shows numbered markers. "Save" button stores calibration.

**`RallyReplay.tsx`:** Animated 2D court canvas. Player circles in team colors. Shuttle dot with gradient trail. Play/pause/speed controls. Rally selector dropdown or prev/next buttons. Sidebar stats panel.

**`PlayerHeatmap.tsx`:** Court SVG with heatmap gradient overlay. Stats card alongside with distance, speed, zone percentages. Player selector to switch between players.

**`MatchStats.tsx`:** Aggregate dashboard showing per-player summary stats, rally list with key metrics.

**`VideoExport.tsx`:** Progress bar during re-encoding. Download button or share sheet when complete.

### Storage

IndexedDB collections:
- `recordings` — video blobs keyed by `{matchId}_{timestamp}`.
- `analysisResults` — `AnalysisResult` JSON keyed by recording ID.
- `calibrations` — homography matrices keyed by device identifier.

### Integration into App.tsx

- Recording start/stop button added to the controls area (near existing camera toggle, distinct icon — `Video` lucide icon).
- "Analyze" button appears on completed matches in match history.
- Analysis results accessible from match detail view with tabs: Replay, Heatmap, Stats, Export.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| MediaPipe Pose Landmarker + motion tracking | Pose Landmarker unreliable for 2-4 people at court distance. Shuttle tracking via frame differencing fails at 1080p court-scale resolution due to small shuttle size (~5-10px). |
| MediaPipe Object Detector (EfficientDet-Lite) | Detects players adequately but shuttlecock is too small/fast for general-purpose object detectors. Would still need a custom shuttle model. |
| Cloud-based processing (e.g., upload to server) | Requires internet, adds latency, privacy concern. User wants on-device. |
| Real-time detection during recording | Too heavy for phone CPU while also recording. Post-match offline processing is more practical. |
| Auto-calibration via court line detection | Unreliable on indoor courts with varied lighting, floor colors, and line markings. Manual corner marking is simple and robust. |

## What Changes

| File | Change |
|---|---|
| `src/vision/detector.ts` | New. YOLOv8-nano TF.js model loader and inference. |
| `src/vision/calibration.ts` | New. Homography computation and pixel-to-court mapping. |
| `src/vision/tracker.ts` | New. Frame-to-frame player/shuttle identity tracking. |
| `src/vision/analyzer.ts` | New. Offline analysis pipeline (web worker). |
| `src/vision/analyzer.worker.ts` | New. Web Worker entry for frame processing. |
| `src/vision/stats.ts` | New. Heatmap, distance, zone, shot count computation. |
| `src/vision/types.ts` | New. Shared types: Detection, TrackedFrame, AnalysisResult, RallyData, CourtZone. |
| `src/hooks/useVideoRecorder.ts` | New. MediaRecorder wrapper hook. |
| `src/hooks/useMatchAnalysis.ts` | New. Orchestrates analysis from video loading through stats generation. |
| `src/components/CalibrationOverlay.tsx` | New. Court corner marking UI. |
| `src/components/RallyReplay.tsx` | New. Animated court replay with controls. |
| `src/components/PlayerHeatmap.tsx` | New. Heatmap overlay with stats dashboard. |
| `src/components/MatchStats.tsx` | New. Aggregate per-player stats dashboard. |
| `src/components/VideoExport.tsx` | New. Export progress and download. |
| `src/components/MatchAnalysis.tsx` | New. Tab container for Replay/Heatmap/Stats/Export. |
| `src/App.tsx` | Wire recording button and analysis entry points. |
| `src/styles.css` | New styles for calibration, replay controls, heatmap, stats. |
| `package.json` | Add `@tensorflow/tfjs` dependency. |
| `public/model/` | Bundled YOLOv8-nano TF.js model files (model.json + shards). |
| `.docs/media/computer-vision.md` | New architecture doc for CV pipeline. |
| `.docs/index.md` | Add computer-vision.md entry. |
| `.specs/SPEC-INDEX.md` | Add this spec. |

## What Stays the Same

- `src/domain/matchEngine.ts` — no changes. Scoring engine is vision-agnostic.
- `src/input/commands.ts` — no changes. Vision is read-only (analysis), not an input source.
- `src/input/poseRemote.ts` — unchanged. Gesture camera (user-facing, 640x480) is independent from recording camera (environment-facing, 1080p).
- `src/hooks/usePoseDetection.ts` — unchanged.
- All input connectors (BLE, keyboard, gamepad, Firestore) — untouched.
- `src/remote/` — no changes.
- `src/matchState.ts` — no changes. Rally boundaries come from existing history timestamps.

## Architecture Impact

New `.docs/media/computer-vision.md` covering:
- Video recording pipeline (MediaRecorder → IndexedDB).
- YOLOv8-nano model and TF.js integration.
- Homography calibration and perspective correction.
- Post-match analysis pipeline (frame extraction → detection → tracking → stats).
- Rally replay, heatmap, and video export output formats.

Update `.docs/index.md` to add computer-vision.md entry under Media domain.

## Testing Strategy

- **`src/vision/calibration.test.ts`:** Unit tests for homography computation (known input → known output), pixel-to-court mapping, edge cases (collinear points, near-identical points).
- **`src/vision/tracker.test.ts`:** Unit tests for Hungarian assignment, IoU matching, shuttle nearest-neighbor tracking, smoothing, ID stability.
- **`src/vision/stats.test.ts`:** Unit tests for heatmap grid computation, distance calculation, zone percentages, shot counting, speed stats.
- **`src/vision/detector.test.ts`:** Unit tests with a lightweight TF.js test model or mocked model, verifying detection output format.
- **`src/hooks/useVideoRecorder.test.ts`:** Hook tests mocking MediaRecorder, verifying start/stop, blob assembly, IndexedDB storage.
- **`src/components/RallyReplay.test.tsx`:** Canvas rendering test (snapshot or pixel check) for player circles, shuttle trail, court lines.
- **`src/components/PlayerHeatmap.test.tsx`:** Test heatmap gradient rendering and stat display.
- **`src/components/CalibrationOverlay.test.tsx`:** Test corner tap interaction and calibration save.
- **Integration:** Full test suite passes with no regressions.

## Verification

1. `npm test` — all tests pass.
2. `npm run lint` — no TypeScript errors.
3. `npm run build` — builds successfully with `@tensorflow/tfjs` and model files bundled.
4. Manual E2E: set up phone on tripod, record a match, calibrate corners, run analysis, verify replay/heatmap/export outputs.

## Performance Impact

- **Recording:** MediaRecorder at 1080p adds ~5-10% CPU overhead. No inference during recording.
- **Model load:** YOLOv8-nano TF.js model ~6MB. Loaded once when analysis starts, not at app launch.
- **Analysis processing:** Offline, frame-by-frame. ~2-5 FPS on modern phone CPU for YOLOv8-nano at 1080p. A 20-minute match at 30fps (~36,000 frames) takes ~3-5 hours to fully process. User is shown a progress bar and can cancel.
- **Memory:** ~100-200MB during analysis (video in memory + model + tracking data). Video is read in chunks to avoid full decode.
- **Storage:** ~500MB-1GB for a 20-minute 1080p WebM recording. Analysis results ~5-20MB JSON. Users can delete recordings after analysis.
- **Battery:** Recording drains battery (camera + encode). Analysis drains battery (CPU-heavy). App warns if battery < 20%.

## Security Considerations

- `getUserMedia` requires explicit permission. User must also consent to recording separately from the gesture camera.
- All processing on-device. No video or position data leaves the device.
- Recordings stored in IndexedDB, accessible only by the app origin.
- No facial recognition or person identification — only generic "player" detections.

## Risk Analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| YOLO model can't detect shuttle at 1080p court scale | Medium | Training data includes court-level shuttle images. If detection rate < 50%, fall back to motion-based interpolation between player-to-player trajectories. |
| Analysis too slow on mid-range phones | High | Decimate frames (process every Nth frame). Offer "quick analysis" mode at lower resolution. Model runs on WebGL backend when available for GPU acceleration. |
| Recording fills device storage | Medium | Show available storage before recording. Warn if < 2GB free. Delete recording after analysis (user choice). |
| Camera permission denied | Low | Clear error messaging. Recording is optional — scoring still works. |
| Model training data doesn't exist | Medium | Use existing badminton datasets (ShuttleSet, TrackNet) for shuttle detection. Synthetic data generation via augmentation. Fall back to publicly available person detection model + custom shuttle fine-tuning. |
| Web Worker TF.js compatibility | Low | TF.js supports Web Workers via `tf.setBackend('webgl')`. Fall back to main thread if Worker initialization fails. |
| Perspective calibration drift (tripod bumped) | Medium | Show calibration verification overlay before analysis. User can confirm or recalibrate. |

## Rollback & Deployment

- Standard Vite build + Firebase Hosting deploy.
- Recording and analysis are opt-in features. All existing functionality is independent.
- Rollback: remove recording/analysis components from App.tsx, remove `@tensorflow/tfjs` dependency. No data migration needed (recordings in IndexedDB are inert without the analysis UI).

## Observability

- **Recording indicator:** Red dot + timer in controls area while recording.
- **Analysis progress:** Progress bar with current frame / total frames and estimated time remaining.
- **Error states:** Camera permission denied, model load failure, analysis crash (worker error), insufficient storage — each with clear messaging and recovery actions.
- **Debug mode:** Optional overlay showing raw detections (bounding boxes) on the replay court for verification.

## Affected Components

- `src/vision/` — new directory: detector, calibration, tracker, analyzer, stats, types
- `src/hooks/useVideoRecorder.ts` — new
- `src/hooks/useMatchAnalysis.ts` — new
- `src/components/CalibrationOverlay.tsx` — new
- `src/components/RallyReplay.tsx` — new
- `src/components/PlayerHeatmap.tsx` — new
- `src/components/MatchStats.tsx` — new
- `src/components/VideoExport.tsx` — new
- `src/components/MatchAnalysis.tsx` — new
- `src/App.tsx` — wiring
- `src/styles.css` — new styles

## Dependencies

- `@tensorflow/tfjs` — TensorFlow.js core + WebGL backend for on-device YOLO inference.
- YOLOv8-nano model — converted to TF.js GraphModel format, bundled in `public/model/` or loaded from CDN.
- Training dataset — existing badminton datasets (ShuttleSet, TrackNet) or custom labeled match footage.
- No server-side changes, no Firestore changes, no auth changes.

## Reviewer Context

- This is a new feature domain (computer vision analysis) for a project that already has a camera pipeline (MediaPipe hand gesture recognition). The two camera pipelines are independent: gesture uses user-facing camera at 640x480 with MediaPipe, analysis uses environment-facing camera at 1080p with TF.js.
- Recording happens during the match (user taps record before starting), scoring is manual as today. Analysis is post-match, offline, frame-by-frame.
- YOLOv8-nano is the lightest YOLOv8 variant (~6MB). At 1080p it may need frame decimation for acceptable processing time on phones.
- The homography calibration is a critical step — if calibration is wrong, all court position data is offset. The UI must make this easy and reliable.
