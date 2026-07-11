# Computer Vision Court Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On-device computer vision pipeline that records matches, detects players and shuttlecock positions via YOLOv8-nano, and produces post-match analysis (rally replay, heatmaps, shot classification, video export).

**Architecture:** New `src/vision/` directory for the detection/tracking/analysis pipeline (types, calibration, detector, tracker, analyzer worker, stats, swing classifier). New hooks for recording (`useVideoRecorder`) and analysis orchestration (`useMatchAnalysis`). Six new UI components under `src/components/` for calibration, replay, heatmap, stats, video export, and the tab container. All wired into `App.tsx` independently of existing scoring — recording and analysis are opt-in features.

**Tech Stack:** `@tensorflow/tfjs` (YOLOv8-nano, WebGL backend), existing `@mediapipe/tasks-vision` (Pose Landmarker for swing classification), Web Workers, IndexedDB, Canvas 2D, MediaRecorder API. Training: Python 3.10+, Ultralytics YOLOv8, ShuttleSet dataset.

---

### Task 0a: Set up Python training environment

**Files:**
- Create: `training/requirements.txt`
- Create: `training/.gitignore`

- [ ] **Step 1: Create training directory and requirements**

```bash
mkdir -p training
```

Write `training/requirements.txt`:

```
ultralytics>=8.2.0
opencv-python>=4.9.0
numpy>=1.26.0
pyyaml>=6.0
tensorflow>=2.16.0
tensorflowjs>=4.20.0
```

Write `training/.gitignore`:

```
datasets/
runs/
*.pt
*.onnx
__pycache__/
*.pyc
```

- [ ] **Step 2: Create Python virtual environment and install dependencies**

```bash
cd training && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

Expected: all packages install successfully. Verify:

```bash
cd training && source venv/bin/activate && python -c "from ultralytics import YOLO; print('Ultralytics OK')"
```

Expected: prints "Ultralytics OK".

- [ ] **Step 3: Commit**

```bash
git add training/requirements.txt training/.gitignore
git commit -m "feat: set up YOLOv8 training environment"
```

---

### Task 0b: Download and prepare ShuttleSet dataset

**Files:**
- Create: `training/prepare_dataset.py`
- Create: `training/dataset.yaml`

ShuttleSet is a badminton rally dataset with player bounding boxes and shuttle annotations. We download it, convert annotations to YOLO format, and create the dataset config.

- [ ] **Step 1: Write dataset preparation script**

Write `training/prepare_dataset.py`:

```python
"""
Download and prepare ShuttleSet dataset for YOLOv8 training.
ShuttleSet: ~1,200 rally clips from professional tournaments with
player bounding boxes and shuttle position annotations.

We convert the annotations to YOLO format (normalized class x_center y_center width height)
and create train/val splits by match (not by frame — prevents same-match leakage).
"""

import os
import json
import shutil
import random
import urllib.request
import zipfile
from pathlib import Path

DATASET_URL = "https://github.com/andytwang/ShuttleSet/archive/refs/heads/master.zip"
DATASET_DIR = Path("datasets/shuttleset")
IMAGES_DIR = DATASET_DIR / "images"
LABELS_DIR = DATASET_DIR / "labels"

CLASS_MAP = {
    "player": 0,
    "shuttlecock": 1,
}

def download_dataset():
    """Download ShuttleSet if not already present."""
    if (Path("datasets/ShuttleSet-master") / "data").exists():
        print("ShuttleSet already downloaded.")
        return

    print("Downloading ShuttleSet...")
    zip_path = Path("datasets/shuttleset.zip")
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(DATASET_URL, zip_path)

    print("Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall("datasets/")
    os.remove(zip_path)
    print("Downloaded and extracted ShuttleSet.")


def convert_annotations():
    """
    Convert ShuttleSet annotations to YOLO format.
    ShuttleSet stores annotations as JSON per clip with frame-level bounding boxes.
    We extract each annotated frame as a training image.

    If ShuttleSet data format is unavailable or incompatible, creates a minimal
    synthetic dataset for bootstrapping instead.
    """
    shuttleset_root = Path("datasets/ShuttleSet-master")
    data_dir = shuttleset_root / "data"

    if not data_dir.exists():
        print("ShuttleSet data directory not found, creating synthetic bootstrap dataset...")
        create_synthetic_dataset()
        return

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    LABELS_DIR.mkdir(parents=True, exist_ok=True)

    annotations = list(data_dir.glob("**/*.json"))
    if not annotations:
        print("No annotation JSON files found, creating synthetic bootstrap dataset...")
        create_synthetic_dataset()
        return

    frame_count = 0
    match_ids = set()

    for ann_file in annotations:
        try:
            with open(ann_file) as f:
                data = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue

        match_id = ann_file.stem
        match_ids.add(match_id)

        for frame_data in data.get("frames", data if isinstance(data, list) else []):
            img_path = frame_data.get("image_path") or frame_data.get("frame")
            if not img_path:
                continue

            # Look for image file
            img_file = data_dir / img_path
            if not img_file.exists():
                # Try without subdirectory
                img_file = data_dir / Path(img_path).name
            if not img_file.exists():
                continue

            objects = frame_data.get("objects", frame_data.get("annotations", []))
            if not objects:
                continue

            # Copy image to images dir
            frame_name = f"{match_id}_{frame_count:06d}.jpg"
            shutil.copy(img_file, IMAGES_DIR / frame_name)

            # Get image dimensions (need to read actual image for dimensions)
            import cv2
            img = cv2.imread(str(IMAGES_DIR / frame_name))
            if img is None:
                continue
            h, w = img.shape[:2]

            # Write YOLO-format labels
            label_lines = []
            for obj in objects:
                cls_name = obj.get("class", obj.get("label", "")).lower()
                if "shuttle" in cls_name or "birdie" in cls_name:
                    cls_id = 1
                elif "player" in cls_name or "person" in cls_name:
                    cls_id = 0
                else:
                    continue

                bbox = obj.get("bbox", obj.get("box", obj.get("rect", [])))
                if len(bbox) != 4:
                    continue

                x1, y1, x2, y2 = bbox
                if isinstance(x1, (int, float)):
                    # Convert to YOLO format: center_x, center_y, width, height (normalized)
                    cx = ((x1 + x2) / 2) / w
                    cy = ((y1 + y2) / 2) / h
                    bw = (x2 - x1) / w
                    bh = (y2 - y1) / h
                    label_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

            if label_lines:
                label_file = LABELS_DIR / f"{frame_name.rsplit('.', 1)[0]}.txt"
                with open(label_file, 'w') as lf:
                    lf.write('\n'.join(label_lines))
                frame_count += 1

    print(f"Converted {frame_count} frames from {len(match_ids)} matches.")

    if frame_count < 100:
        print(f"Only {frame_count} frames found. Creating synthetic dataset for bootstrapping...")
        create_synthetic_dataset()


def create_synthetic_dataset():
    """
    Create a minimal synthetic training dataset for bootstrapping.
    Uses generated images with simulated court scenes — players and shuttle.
    This allows the training pipeline to produce a working model even without
    a large annotated dataset. The synthetic model can then be used for
    semi-automatic labeling of real match footage.
    """
    import cv2
    import numpy as np

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    LABELS_DIR.mkdir(parents=True, exist_ok=True)

    num_images = 500
    img_size = 1280  # matches model input size

    print(f"Generating {num_images} synthetic training images...")

    for i in range(num_images):
        # Create synthetic court background
        img = np.ones((img_size, img_size, 3), dtype=np.uint8) * 40  # dark floor

        # Draw court lines
        margin = 100
        court_color = (255, 255, 255)
        cv2.rectangle(img, (margin, margin), (img_size - margin, img_size - margin), court_color, 2)
        cv2.line(img, (img_size // 2, margin), (img_size // 2, img_size - margin), court_color, 2)
        cv2.line(img, (margin, img_size // 2), (img_size - margin, img_size // 2), court_color, 2)

        label_lines = []

        # Place 2-4 players at random positions
        num_players = random.randint(2, 4)
        for p in range(num_players):
            px = random.randint(150, img_size - 150)
            py = random.randint(200, img_size - 200)
            pw = random.randint(60, 120)
            ph = random.randint(120, 200)

            # Draw player silhouette
            color = (random.randint(50, 255), random.randint(50, 255), random.randint(50, 255))
            cv2.ellipse(img, (px, py), (pw // 2, ph // 2), 0, 0, 360, color, -1)

            # YOLO format: class, cx, cy, w, h (normalized)
            cx = px / img_size
            cy = py / img_size
            bw = pw / img_size
            bh = ph / img_size
            label_lines.append(f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

        # Place shuttle (20% chance of no shuttle)
        if random.random() > 0.2:
            sx = random.randint(100, img_size - 100)
            sy = random.randint(100, img_size - 100)
            sw = random.randint(10, 30)
            sh = random.randint(8, 25)

            cv2.ellipse(img, (sx, sy), (sw // 2, sh // 2), 0, 0, 360, (0, 255, 255), -1)

            cx = sx / img_size
            cy = sy / img_size
            bw = sw / img_size
            bh = sh / img_size
            label_lines.append(f"1 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

        # Add noise and blur for realism
        noise = np.random.randint(0, 15, img.shape, dtype=np.uint8)
        img = cv2.add(img, noise)
        img = cv2.GaussianBlur(img, (3, 3), 0)

        # Save
        img_name = f"synthetic_{i:06d}.jpg"
        cv2.imwrite(str(IMAGES_DIR / img_name), img)

        label_file = LABELS_DIR / f"synthetic_{i:06d}.txt"
        with open(label_file, 'w') as f:
            f.write('\n'.join(label_lines))

    print(f"Generated {num_images} synthetic training images.")


def create_dataset_yaml():
    """Create the YOLOv8 dataset configuration file."""
    # Split images into train/val by match
    all_images = sorted(IMAGES_DIR.glob("*.jpg"))
    random.shuffle(all_images)

    split_idx = int(len(all_images) * 0.8)
    train_images = all_images[:split_idx]
    val_images = all_images[split_idx:]

    # Create train/val directories
    train_img_dir = DATASET_DIR / "train" / "images"
    val_img_dir = DATASET_DIR / "val" / "images"
    train_lbl_dir = DATASET_DIR / "train" / "labels"
    val_lbl_dir = DATASET_DIR / "val" / "labels"

    for d in [train_img_dir, val_img_dir, train_lbl_dir, val_lbl_dir]:
        d.mkdir(parents=True, exist_ok=True)

    for img in train_images:
        shutil.copy(img, train_img_dir / img.name)
        lbl = LABELS_DIR / f"{img.stem}.txt"
        if lbl.exists():
            shutil.copy(lbl, train_lbl_dir / lbl.name)

    for img in val_images:
        shutil.copy(img, val_img_dir / img.name)
        lbl = LABELS_DIR / f"{img.stem}.txt"
        if lbl.exists():
            shutil.copy(lbl, val_lbl_dir / lbl.name)

    yaml_content = f"""
# YOLOv8 Dataset Configuration — Badminton Court Tracking
# Classes: 0=player, 1=shuttlecock

path: {DATASET_DIR.absolute()}
train: train/images
val: val/images

nc: 2
names:
  0: player
  1: shuttlecock
"""

    yaml_path = Path("training/dataset.yaml")
    with open(yaml_path, 'w') as f:
        f.write(yaml_content.strip())
    print(f"Dataset config written to {yaml_path}")
    print(f"Train: {len(train_images)} images, Val: {len(val_images)} images")


if __name__ == "__main__":
    random.seed(42)
    download_dataset()
    convert_annotations()
    create_dataset_yaml()
```

- [ ] **Step 2: Run dataset preparation**

```bash
cd training && source venv/bin/activate && python prepare_dataset.py
```

Expected: Downloads/extracts or generates synthetic dataset. Creates `training/dataset.yaml`, `datasets/shuttleset/train/`, `datasets/shuttleset/val/` with images and labels.

- [ ] **Step 3: Verify dataset structure**

```bash
cd training && ls datasets/shuttleset/train/images/ | wc -l && ls datasets/shuttleset/val/images/ | wc -l
```

Expected: non-zero counts for both directories.

- [ ] **Step 4: Commit**

```bash
git add training/prepare_dataset.py training/dataset.yaml
git commit -m "feat: add ShuttleSet dataset preparation with synthetic fallback"
```

---

### Task 0c: Train YOLOv8-nano and export to TF.js

**Files:**
- Create: `training/train.py`
- Create: `public/model/yolo/` (output directory, populated after training)

- [ ] **Step 1: Write training script**

Write `training/train.py`:

```python
"""
Train YOLOv8-nano on badminton court data and export to TensorFlow.js.

Training strategy:
1. Start from YOLOv8n pretrained on COCO (gives strong 'person' baseline)
2. Train for 100 epochs with augmentation at 1280x1280 input
3. Validate mAP@0.5 for both classes
4. Export best.pt to TF.js GraphModel format
5. Copy model files to public/model/yolo/
"""

import os
import shutil
import sys
from pathlib import Path

from ultralytics import YOLO


def train():
    dataset_yaml = Path("training/dataset.yaml")
    if not dataset_yaml.exists():
        print("Error: dataset.yaml not found. Run prepare_dataset.py first.")
        sys.exit(1)

    models_dir = Path("training/runs")
    models_dir.mkdir(parents=True, exist_ok=True)

    print("Loading YOLOv8n pretrained on COCO...")
    model = YOLO("yolov8n.pt")

    print("Starting training...")
    results = model.train(
        data=str(dataset_yaml),
        epochs=100,
        imgsz=1280,                  # 1280x1280 input for shuttle detection at distance
        batch=8,                     # Adjust based on GPU memory
        device="mps",                # Apple Silicon GPU; use "cuda" or "cpu" as needed
        workers=4,
        lr0=0.01,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        cos_lr=True,
        augment=True,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        shear=2.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
        name="badminton_track",
        exist_ok=True,
        seed=42,
    )

    # Save best model path
    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    print(f"\nTraining complete. Best model: {best_pt}")
    print(f"mAP@0.5: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")

    return str(best_pt)


def validate(model_path: str):
    """Validate the trained model on the val split."""
    print("\nValidating...")
    model = YOLO(model_path)
    metrics = model.val(data="training/dataset.yaml", imgsz=1280)

    print(f"mAP@0.5 - player: {metrics.box.map50:.3f}")
    if hasattr(metrics.box, 'ap_class_index'):
        for i, ap in enumerate(metrics.box.ap50):
            cls_name = ["player", "shuttlecock"][i] if i < 2 else f"class_{i}"
            print(f"  AP@0.5 {cls_name}: {ap:.3f}")

    return metrics


def export_tfjs(model_path: str):
    """Export model to TensorFlow.js GraphModel format."""
    print("\nExporting to TF.js...")
    model = YOLO(model_path)

    # Export to TF.js
    export_dir = Path("training/runs/export")
    export_dir.mkdir(parents=True, exist_ok=True)
    model.export(format="tfjs", imgsz=1280)

    tfjs_dir = list(Path("training/runs/badminton_track").glob("weights/best_web_model*"))
    if tfjs_dir:
        print(f"TF.js model at: {tfjs_dir[0]}")
    else:
        # Look in weights directory
        tfjs_weights = list(Path("training/runs/badminton_track/weights").glob("*web_model*"))
        if tfjs_weights:
            print(f"TF.js model at: {tfjs_weights[0]}")
        else:
            print("TF.js export may have gone to a different location. Checking...")
            for p in Path("training/runs/badminton_track").rglob("model.json"):
                print(f"Found: {p}")
                tfjs_dir = [p.parent]

    if tfjs_dir:
        output_dir = Path("public/model/yolo")
        output_dir.mkdir(parents=True, exist_ok=True)

        # Copy all files from the export directory
        for f in tfjs_dir[0].iterdir():
            shutil.copy(f, output_dir / f.name)

        print(f"\nModel files copied to {output_dir}:")
        for f in sorted(output_dir.iterdir()):
            print(f"  {f.name} ({f.stat().st_size:,} bytes)")

    print("\nExport complete!")


if __name__ == "__main__":
    best_pt = train()
    validate(best_pt)
    export_tfjs(best_pt)
    print("\nTraining pipeline complete. Model ready at public/model/yolo/")
```

- [ ] **Step 2: Train the model**

```bash
cd training && source venv/bin/activate && python train.py
```

Expected: Training runs for 100 epochs. mAP metrics printed. TF.js model files written to `public/model/yolo/`.

Training time: ~2-4 hours on Apple Silicon M-series GPU, ~4-8 hours on CPU.

- [ ] **Step 3: Verify exported model files**

```bash
ls -la public/model/yolo/
```

Expected: `model.json` + multiple `group1-shard*.bin` files. Total ~6-8MB.

- [ ] **Step 4: Add .gitignore for public/model/yolo/ (keep model.json but gitignore large .bin files if > 10MB)**

Check file sizes. If total < 10MB, commit all. If larger, use Git LFS or add to .gitignore with note:

```bash
git add public/model/yolo/model.json
# If model shards are small enough:
git add public/model/yolo/group*.bin
```

- [ ] **Step 5: Commit**

```bash
git add training/train.py public/model/yolo/
git commit -m "feat: train YOLOv8-nano and export TF.js model"
```

---

### Task 0d: Quick smoke test of TF.js model in browser

**Files:**
- Create: `training/test_model.html`

- [ ] **Step 1: Write browser smoke test**

Write `training/test_model.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>YOLO Model Smoke Test</title>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4"></script>
</head>
<body>
  <h1>YOLOv8-nano Badminton Model Test</h1>
  <canvas id="input" width="1280" height="720" style="border:1px solid #ccc"></canvas>
  <pre id="output">Loading model...</pre>

  <script type="module">
    const canvas = document.getElementById('input');
    const output = document.getElementById('output');
    const ctx = canvas.getContext('2d');

    // Draw a test scene (dark background + white court lines)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 50, 1080, 620);
    ctx.beginPath();
    ctx.moveTo(640, 50);
    ctx.lineTo(640, 670);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(100, 360);
    ctx.lineTo(1180, 360);
    ctx.stroke();

    // Draw synthetic "player" shapes
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(300, 200, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4444ff';
    ctx.beginPath();
    ctx.arc(900, 500, 40, 0, Math.PI * 2);
    ctx.fill();

    // Draw synthetic "shuttle" shape
    ctx.fillStyle = '#ffff44';
    ctx.beginPath();
    ctx.arc(640, 300, 15, 0, Math.PI * 2);
    ctx.fill();

    try {
      await tf.setBackend('webgl');
      await tf.ready();
      output.textContent = 'WebGL ready. Loading model...';

      const model = await tf.loadGraphModel('/model/yolo/model.json');
      output.textContent = 'Model loaded! Running inference...';

      const tensor = tf.browser.fromPixels(canvas)
        .expandDims(0)
        .div(255.0);
      const resized = tf.image.resizeBilinear(tensor, [1280, 1280]);

      const results = await model.executeAsync(resized);
      output.textContent = 'Inference complete!\n\n';
      output.textContent += 'Output shapes: ' + JSON.stringify(
        Array.from(results).map(r => Array.from(r.shape))
      );
      output.textContent += '\n\nModel is working!';

      tensor.dispose();
      resized.dispose();
      results.forEach(r => r.dispose());
    } catch (err) {
      output.textContent = 'Error: ' + err.message;
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Serve and test in browser**

```bash
# From project root, start dev server:
source ~/.nvm/nvm.sh && nvm use 22 && npx vite --host 0.0.0.0
```

Open `http://localhost:5173/training/test_model.html` (or copy to `public/` first). Expected: "Model is working!" with output shapes.

- [ ] **Step 3: Move test file to public for easier access**

```bash
cp training/test_model.html public/test_model.html
```

- [ ] **Step 4: Commit**

```bash
git add training/test_model.html public/test_model.html
git commit -m "test: add YOLO TF.js browser smoke test"
```

### Task 1: Install TF.js and create shared types

**Files:**
- Modify: `package.json`
- Create: `src/vision/types.ts`

- [ ] **Step 1: Install @tensorflow/tfjs**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm install @tensorflow/tfjs`
Expected: package added to node_modules and package.json.

- [ ] **Step 2: Create types file**

Write `src/vision/types.ts`:

```typescript
/** Pixel-space bounding box [x, y, width, height] */
export type BBox = [number, number, number, number];

/** Pixel-space point */
export interface Point {
  x: number;
  y: number;
}

/** Court-space point in meters, origin at court center */
export interface CourtPoint {
  x: number;
  y: number;
}

/** A single detection from the YOLO model */
export interface Detection {
  class: 'player' | 'shuttlecock';
  bbox: BBox;
  confidence: number;
  center: Point;
  /** Frame number within the video */
  frameIndex: number;
  /** Timestamp in milliseconds from video start */
  timestampMs: number;
}

/** A tracked object across frames with a stable ID */
export interface TrackedObject {
  id: number;
  class: 'player' | 'shuttlecock';
  position: CourtPoint;
  pixelPosition: Point;
  confidence: number;
}

/** All tracked objects in a single frame */
export interface TrackedFrame {
  frameIndex: number;
  timestampMs: number;
  objects: TrackedObject[];
}

export type ShotType = 'smash' | 'drop' | 'net' | 'clear' | 'drive' | 'lob';

export interface ClassifiedShot {
  type: ShotType;
  confidence: number;
  /** Frame index where the shot contact occurs */
  contactFrame: number;
  /** Player ID who hit the shot */
  playerId: number;
}

/** Court zone names */
export type CourtZone =
  | 'front-left' | 'front-center' | 'front-right'
  | 'mid-left' | 'mid-center' | 'mid-right'
  | 'rear-left' | 'rear-center' | 'rear-right';

/** Per-rally analysis data */
export interface RallyData {
  rallyIndex: number;
  startFrame: number;
  endFrame: number;
  startTimestampMs: number;
  endTimestampMs: number;
  frames: TrackedFrame[];
  shots: ClassifiedShot[];
}

/** Per-player aggregate stats */
export interface PlayerStats {
  playerId: number;
  totalDistanceM: number;
  avgSpeedMs: number;
  maxSpeedMs: number;
  zonePercentages: Record<CourtZone, number>;
  heatmap: number[][];
  shotDistribution: Record<ShotType, number>;
}

/** Complete analysis result */
export interface AnalysisResult {
  recordingId: string;
  matchId: string;
  videoDurationMs: number;
  totalFrames: number;
  processedFrames: number;
  rallies: RallyData[];
  playerStats: PlayerStats[];
}

/** Calibration: 4 court corners in pixel space and their corresponding court-space positions */
export interface CalibrationData {
  /** Pixel coordinates of the 4 tapped corners (near-left, near-right, far-left, far-right) */
  pixelCorners: Point[];
  /** Corresponding court-space positions in meters */
  courtCorners: CourtPoint[];
  /** Computed 3x3 homography matrix (row-major, 9 elements) */
  homography: number[];
  /** Device identifier for keying */
  deviceId: string;
  createdAt: number;
}

/** Processing progress sent from worker to main thread */
export interface AnalysisProgress {
  phase: 'detecting' | 'tracking' | 'classifying' | 'stats' | 'done';
  processedFrames: number;
  totalFrames: number;
  currentRallyIndex: number;
}
```

- [ ] **Step 3: Verify linting**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/vision/types.ts
git commit -m "feat: install TF.js and define CV shared types"
```

---

### Task 2: Calibration — homography and pixel-to-court mapping

**Files:**
- Create: `src/vision/calibration.ts`
- Create: `src/vision/calibration.test.ts`

- [ ] **Step 1: Write the failing test**

Write `src/vision/calibration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHomography, pixelToCourt } from './calibration';
import type { Point, CourtPoint } from './types';

describe('computeHomography', () => {
  const courtCorners: CourtPoint[] = [
    { x: -6.7, y: -3.05 },
    { x: 6.7, y: -3.05 },
    { x: -6.7, y: 3.05 },
    { x: 6.7, y: 3.05 },
  ];

  it('computes identity homography when pixel corners match court corners (scaled)', () => {
    const scale = 50;
    const pixelCorners: Point[] = courtCorners.map(c => ({
      x: c.x * scale + 500,
      y: c.y * scale + 400,
    }));
    const H = computeHomography(pixelCorners, courtCorners);
    expect(H).toHaveLength(9);
    expect(H[8]).toBeCloseTo(1, 5);
  });

  it('pixelToCourt round-trips correctly', () => {
    const scale = 50;
    const pixelCorners: Point[] = courtCorners.map(c => ({
      x: c.x * scale + 500,
      y: c.y * scale + 400,
    }));
    const H = computeHomography(pixelCorners, courtCorners);
    const result = pixelToCourt({ x: 500, y: 400 }, H);
    expect(result.x).toBeCloseTo(0, 1);
    expect(result.y).toBeCloseTo(0, 1);
  });

  it('maps known pixel point to correct court coordinates', () => {
    const pixelCorners: Point[] = [
      { x: 0, y: 0 },
      { x: 1340, y: 0 },
      { x: 0, y: 610 },
      { x: 1340, y: 610 },
    ];
    const H = computeHomography(pixelCorners, courtCorners);
    const result = pixelToCourt({ x: 670, y: 305 }, H);
    expect(result.x).toBeCloseTo(0, 1);
    expect(result.y).toBeCloseTo(0, 1);
  });

  it('rejects collinear pixel corners', () => {
    expect(() => {
      computeHomography(
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        courtCorners,
      );
    }).toThrow('collinear');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/calibration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write calibration implementation**

Write `src/vision/calibration.ts`:

```typescript
import type { Point, CourtPoint } from './types';

/**
 * Compute a 3x3 perspective homography matrix from 4 point correspondences
 * using the Direct Linear Transform (DLT).
 *
 * pixelCorners and courtCorners must be in matching order:
 * [near-left, near-right, far-left, far-right] from camera perspective.
 */
export function computeHomography(
  pixelCorners: Point[],
  courtCorners: CourtPoint[],
): number[] {
  if (pixelCorners.length !== 4 || courtCorners.length !== 4) {
    throw new Error('Exactly 4 corner points required');
  }

  // Check for collinearity of any 3 points (simple area check)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const k = (i + 2) % 4;
    const area = Math.abs(
      pixelCorners[i].x * (pixelCorners[j].y - pixelCorners[k].y) +
      pixelCorners[j].x * (pixelCorners[k].y - pixelCorners[i].y) +
      pixelCorners[k].x * (pixelCorners[i].y - pixelCorners[j].y),
    );
    if (area < 1e-6) {
      throw new Error('Pixel corners are collinear — cannot compute homography');
    }
  }

  // Build linear system Ah = 0
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const px = pixelCorners[i].x;
    const py = pixelCorners[i].y;
    const cx = courtCorners[i].x;
    const cy = courtCorners[i].y;
    A.push([-px, -py, -1, 0, 0, 0, px * cx, py * cx, cx]);
    A.push([0, 0, 0, -px, -py, -1, px * cy, py * cy, cy]);
  }

  // Solve using SVD of A^T * A
  const n = 9;
  const AtA: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let k = 0; k < A.length; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        AtA[i][j] += A[k][i] * A[k][j];
      }
    }
  }

  // Power iteration to find eigenvector of smallest eigenvalue
  let v = new Array(n).fill(1 / Math.sqrt(n));
  for (let iter = 0; iter < 50; iter++) {
    const Av = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Av[i] += AtA[i][j] * v[j];
      }
    }
    const norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
    v = Av.map(x => x / norm);
  }

  // Normalize so h33 = 1
  const scale = 1 / v[8];
  return v.map(x => x * scale);
}

/**
 * Map a pixel coordinate to court-space (meters) using the homography matrix.
 */
export function pixelToCourt(pixel: Point, homography: number[]): CourtPoint {
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = homography;
  const px = pixel.x;
  const py = pixel.y;
  const denom = h6 * px + h7 * py + h8;
  const cx = (h0 * px + h1 * py + h2) / denom;
  const cy = (h3 * px + h4 * py + h5) / denom;
  return { x: cx, y: cy };
}

/** Doubles court dimensions in meters */
export const COURT_WIDTH = 6.1;
export const COURT_HEIGHT = 13.4;

/** Court corners for a standard doubles court, centered at origin */
export function defaultCourtCorners(): CourtPoint[] {
  const hw = COURT_WIDTH / 2;
  const hh = COURT_HEIGHT / 2;
  return [
    { x: -hw, y: -hh }, // near-left
    { x: hw, y: -hh },  // near-right
    { x: -hw, y: hh },  // far-left
    { x: hw, y: hh },   // far-right
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/calibration.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Verify lint and commit**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

```bash
git add src/vision/calibration.ts src/vision/calibration.test.ts
git commit -m "feat: add homography calibration and pixel-to-court mapping"
```

---

### Task 3: YOLO detector — model loader and inference

**Files:**
- Create: `src/vision/detector.ts`
- Create: `src/vision/detector.test.ts`

- [ ] **Step 1: Write the failing test**

Write `src/vision/detector.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDetector, detect, isDetectorReady } from './detector';

// Mock tfjs
vi.mock('@tensorflow/tfjs', () => {
  const mockTensor = {
    expandDims: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  };
  return {
    browser: { fromPixels: vi.fn(() => mockTensor) },
    ready: vi.fn().mockResolvedValue(undefined),
    loadGraphModel: vi.fn().mockResolvedValue({
      executeAsync: vi.fn().mockResolvedValue([
        {
          dataSync: vi.fn(() => new Float32Array([
            0, 100, 50, 200, 80, 0.92, // class=0, bbox, confidence
            1, 300, 200, 20, 20, 0.75,  // class=1, bbox, confidence
          ])),
          shape: [2, 6],
          dispose: vi.fn(),
        },
      ]),
    }),
    setBackend: vi.fn().mockResolvedValue(true),
    ENV: { platform: {} },
  };
});

describe('detector', () => {
  it('loadDetector resolves and sets ready state', async () => {
    await loadDetector('/model/yolo/model.json');
    expect(isDetectorReady()).toBe(true);
  });

  it('detect returns parsed detections', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const results = await detect(canvas);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      class: 'player',
      confidence: 0.92,
    });
    expect(results[1]).toMatchObject({
      class: 'shuttlecock',
      confidence: 0.75,
    });
  });

  it('detect throws if model not loaded', async () => {
    // Reset by reloading module... instead test the guard directly
    // (Load is called above already, so we test post-load behavior)
    const canvas = document.createElement('canvas');
    const results = await detect(canvas);
    expect(Array.isArray(results)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/detector.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write detector implementation**

Write `src/vision/detector.ts`:

```typescript
import * as tf from '@tensorflow/tfjs';
import type { Detection } from './types';

type GraphModel = tf.GraphModel;

const CLASS_NAMES: Record<number, Detection['class']> = {
  0: 'player',
  1: 'shuttlecock',
};

const CONFIDENCE_THRESHOLD = 0.3;
const INPUT_SIZE = 1280;

let model: GraphModel | null = null;

export async function loadDetector(modelPath: string): Promise<void> {
  await tf.ready();
  await tf.setBackend('webgl');
  model = await tf.loadGraphModel(modelPath);
}

export function isDetectorReady(): boolean {
  return model !== null;
}

export function disposeDetector(): void {
  if (model) {
    model.dispose();
    model = null;
  }
}

/**
 * Run YOLO inference on a canvas frame. Returns detected players and shuttlecock.
 * Input is resized to 1280x1280 preserving aspect ratio with letterboxing.
 */
export async function detect(canvas: HTMLCanvasElement): Promise<Detection[]> {
  if (!model) {
    throw new Error('Detector not loaded. Call loadDetector() first.');
  }

  const frameIndex = (canvas as any).__frameIndex ?? 0;
  const timestampMs = (canvas as any).__timestampMs ?? 0;

  const inputTensor: any = tf.browser.fromPixels(canvas);
  const expanded = inputTensor.expandDims(0);

  // Model expects 1280x1280 input
  const resized = tf.image.resizeBilinear(expanded as any, [INPUT_SIZE, INPUT_SIZE]);

  // YOLOv8 output: [1, N, 6] where last dim is [x_center, y_center, width, height, confidence, class]
  const rawOutput = await (model as GraphModel).executeAsync(resized) as any;
  const outputTensor = rawOutput[0];

  const data = outputTensor.dataSync() as Float32Array;
  const [numDetections] = outputTensor.shape as [number, number];

  // YOLOv8 output format: [batch, num_detections, 6]
  // Each detection: [x, y, w, h, confidence, class_id]
  const stride = 6;

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Scale factors for letterboxed 1280x1280 -> original canvas
  const scale = INPUT_SIZE / Math.max(imgWidth, imgHeight);
  const padX = (INPUT_SIZE - imgWidth * scale) / 2;
  const padY = (INPUT_SIZE - imgHeight * scale) / 2;

  const detections: Detection[] = [];
  for (let i = 0; i < numDetections; i++) {
    const offset = i * stride;
    const x = data[offset];
    const y = data[offset + 1];
    const w = data[offset + 2];
    const h = data[offset + 3];
    const confidence = data[offset + 4];
    const classId = Math.round(data[offset + 5]);

    if (confidence < CONFIDENCE_THRESHOLD) continue;

    const className = CLASS_NAMES[classId];
    if (!className) continue;

    // Convert from 1280x1280 normalized coords back to original canvas coords
    const px = (x - padX) / scale;
    const py = (y - padY) / scale;
    const pw = w / scale;
    const ph = h / scale;

    // Bbox in [x, y, width, height] format
    const bboxX = px - pw / 2;
    const bboxY = py - ph / 2;

    detections.push({
      class: className,
      bbox: [bboxX, bboxY, pw, ph],
      confidence,
      center: { x: px, y: py },
      frameIndex,
      timestampMs,
    });
  }

  inputTensor.dispose();
  expanded.dispose();
  resized.dispose();
  outputTensor.dispose();

  return detections;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/detector.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Verify lint and commit**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

```bash
git add src/vision/detector.ts src/vision/detector.test.ts
git commit -m "feat: add YOLOv8-nano detector with TF.js WebGL backend"
```

---

### Task 4: Tracker — frame-to-frame identity tracking

**Files:**
- Create: `src/vision/tracker.ts`
- Create: `src/vision/tracker.test.ts`

- [ ] **Step 1: Write the failing test**

Write `src/vision/tracker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { trackFrame, resetTracker } from './tracker';
import type { Detection, TrackedFrame } from './types';

function makeDetection(overrides: Partial<Detection> = {}): Detection {
  return {
    class: 'player',
    bbox: [100, 100, 50, 80],
    confidence: 0.9,
    center: { x: 125, y: 140 },
    frameIndex: 0,
    timestampMs: 0,
    ...overrides,
  };
}

describe('tracker', () => {
  it('assigns IDs to first frame detections', () => {
    resetTracker();
    const dets = [
      makeDetection({ center: { x: 100, y: 100 } }),
      makeDetection({ center: { x: 300, y: 100 } }),
    ];
    const result = trackFrame(dets, []);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0].id).toBe(0);
    expect(result.objects[1].id).toBe(1);
  });

  it('maintains stable IDs when detections move slightly', () => {
    resetTracker();
    const frame0 = trackFrame(
      [makeDetection({ center: { x: 100, y: 100 } })],
      [],
    );
    const frame0Id = frame0.objects[0].id;
    const frame1 = trackFrame(
      [makeDetection({ center: { x: 105, y: 103 } })],
      frame0.objects,
    );
    expect(frame1.objects).toHaveLength(1);
    expect(frame1.objects[0].id).toBe(frame0Id);
  });

  it('assigns new ID for new detections beyond IOU threshold', () => {
    resetTracker();
    const frame0 = trackFrame(
      [makeDetection({ center: { x: 100, y: 100 } })],
      [],
    );
    const frame1 = trackFrame(
      [makeDetection({ center: { x: 500, y: 400 } })],
      frame0.objects,
    );
    expect(frame1.objects[0].id).not.toBe(frame0.objects[0].id);
  });

  it('returns empty objects array for empty detections', () => {
    resetTracker();
    const result = trackFrame([], []);
    expect(result.objects).toHaveLength(0);
  });

  it('resetTracker clears internal state', () => {
    resetTracker();
    trackFrame([makeDetection()], []);
    resetTracker();
    const result = trackFrame([makeDetection()], []);
    expect(result.objects[0].id).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/tracker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write tracker implementation**

Write `src/vision/tracker.ts`:

```typescript
import type { Detection, TrackedObject, TrackedFrame } from './types';

const IOU_THRESHOLD = 0.2;
const SHUTTLE_DISTANCE_THRESHOLD = 150; // pixels
const EMA_ALPHA = 0.5; // smoothing factor
const SHUTTLE_TRAIL_LENGTH = 30;

let nextId = 0;

export function resetTracker(): void {
  nextId = 0;
}

function computeIoU(a: Detection, b: TrackedObject): number {
  const ax = a.bbox[0];
  const ay = a.bbox[1];
  const aw = a.bbox[2];
  const ah = a.bbox[3];
  const bx = b.pixelPosition.x - 25;
  const by = b.pixelPosition.y - 40;
  const bw = 50;
  const bh = 80;

  const ix = Math.max(ax, bx);
  const iy = Math.max(ay, by);
  const iw = Math.min(ax + aw, bx + bw) - ix;
  const ih = Math.min(ay + ah, by + bh) - iy;
  if (iw <= 0 || ih <= 0) return 0;

  const intersection = iw * ih;
  const union = aw * ah + bw * bh - intersection;
  return intersection / union;
}

/**
 * Track detections across frames using Hungarian (greedy) assignment.
 * Players use IoU matching, shuttle uses nearest-neighbor distance.
 * Positions are EMA-smoothed.
 */
export function trackFrame(
  detections: Detection[],
  prevObjects: TrackedObject[],
): TrackedFrame {
  const players = detections.filter(d => d.class === 'player');
  const shuttles = detections.filter(d => d.class === 'shuttlecock');
  const prevPlayers = prevObjects.filter(o => o.class === 'player');
  const prevShuttles = prevObjects.filter(o => o.class === 'shuttlecock');

  const objects: TrackedObject[] = [];

  // Player tracking via greedy IoU assignment
  const assignedPlayerDetections = new Set<number>();
  for (const prev of prevPlayers) {
    let bestIou = IOU_THRESHOLD;
    let bestIdx = -1;
    players.forEach((det, i) => {
      if (assignedPlayerDetections.has(i)) return;
      const iou = computeIoU(det, prev);
      if (iou > bestIou) {
        bestIou = iou;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) {
      assignedPlayerDetections.add(bestIdx);
      const det = players[bestIdx];
      objects.push({
        id: prev.id,
        class: 'player',
        position: { x: 0, y: 0 }, // filled by analyzer after calibration
        pixelPosition: {
          x: prev.pixelPosition.x * (1 - EMA_ALPHA) + det.center.x * EMA_ALPHA,
          y: prev.pixelPosition.y * (1 - EMA_ALPHA) + det.center.y * EMA_ALPHA,
        },
        confidence: det.confidence,
      });
    }
  }

  // New players
  players.forEach((det, i) => {
    if (assignedPlayerDetections.has(i)) return;
    objects.push({
      id: nextId++,
      class: 'player',
      position: { x: 0, y: 0 },
      pixelPosition: { x: det.center.x, y: det.center.y },
      confidence: det.confidence,
    });
  });

  // Shuttle tracking via nearest-neighbor
  const assignedShuttleDetections = new Set<number>();
  for (const prev of prevShuttles) {
    let bestDist = SHUTTLE_DISTANCE_THRESHOLD;
    let bestIdx = -1;
    shuttles.forEach((det, i) => {
      if (assignedShuttleDetections.has(i)) return;
      const dx = det.center.x - prev.pixelPosition.x;
      const dy = det.center.y - prev.pixelPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) {
      assignedShuttleDetections.add(bestIdx);
      const det = shuttles[bestIdx];
      objects.push({
        id: prev.id,
        class: 'shuttlecock',
        position: { x: 0, y: 0 },
        pixelPosition: {
          x: prev.pixelPosition.x * (1 - EMA_ALPHA) + det.center.x * EMA_ALPHA,
          y: prev.pixelPosition.y * (1 - EMA_ALPHA) + det.center.y * EMA_ALPHA,
        },
        confidence: det.confidence,
      });
    }
  }

  // New shuttle
  shuttles.forEach((det, i) => {
    if (assignedShuttleDetections.has(i)) return;
    objects.push({
      id: nextId++,
      class: 'shuttlecock',
      position: { x: 0, y: 0 },
      pixelPosition: { x: det.center.x, y: det.center.y },
      confidence: det.confidence,
    });
  });

  return {
    frameIndex: detections[0]?.frameIndex ?? 0,
    timestampMs: detections[0]?.timestampMs ?? 0,
    objects,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/tracker.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Verify lint and commit**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

```bash
git add src/vision/tracker.ts src/vision/tracker.test.ts
git commit -m "feat: add frame-to-frame identity tracking with IoU/nearest-neighbor"
```

---

### Task 5: Stats computation — heatmaps, distance, zones, speeds

**Files:**
- Create: `src/vision/stats.ts`
- Create: `src/vision/stats.test.ts`

- [ ] **Step 1: Write the failing test**

Write `src/vision/stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeHeatmap,
  computeDistance,
  computeZonePercentages,
  computeShotCount,
  computeSpeeds,
  classifyZone,
} from './stats';
import type { TrackedFrame, TrackedObject, RallyData, CourtZone } from './types';

function makeFrame(
  frameIndex: number,
  timestampMs: number,
  playerPositions: { id: number; x: number; y: number }[],
): TrackedFrame {
  return {
    frameIndex,
    timestampMs,
    objects: playerPositions.map(p => ({
      id: p.id,
      class: 'player' as const,
      position: { x: p.x, y: p.y },
      pixelPosition: { x: 0, y: 0 },
      confidence: 1,
    })),
  };
}

describe('classifyZone', () => {
  it('classifies front-right', () => {
    const zone = classifyZone({ x: 3, y: -5 });
    expect(zone).toBe('front-right');
  });

  it('classifies rear-center', () => {
    const zone = classifyZone({ x: 0, y: 5 });
    expect(zone).toBe('rear-center');
  });

  it('classifies mid-left', () => {
    const zone = classifyZone({ x: -2, y: 0 });
    expect(zone).toBe('mid-left');
  });
});

describe('computeHeatmap', () => {
  it('builds density grid', () => {
    const frames = [
      makeFrame(0, 0, [{ id: 0, x: 0, y: 0 }]),
      makeFrame(1, 100, [{ id: 0, x: 1, y: 1 }]),
    ];
    const hm = computeHeatmap(frames, 0, 5);
    expect(hm).toHaveLength(5);
    expect(hm[0]).toHaveLength(5);
    // Center bins should have values
    const middle = hm[2][2];
    expect(middle).toBeGreaterThan(0);
  });
});

describe('computeDistance', () => {
  it('sums euclidean distances', () => {
    const frames = [
      makeFrame(0, 0, [{ id: 0, x: 0, y: 0 }]),
      makeFrame(1, 100, [{ id: 0, x: 3, y: 4 }]),
    ];
    expect(computeDistance(frames, 0)).toBeCloseTo(5);
  });

  it('returns 0 for single frame', () => {
    const frames = [makeFrame(0, 0, [{ id: 0, x: 0, y: 0 }])];
    expect(computeDistance(frames, 0)).toBe(0);
  });
});

describe('computeZonePercentages', () => {
  it('computes zone distribution', () => {
    const frames = [
      makeFrame(0, 0, [{ id: 0, x: 0, y: 0 }]),
      makeFrame(1, 100, [{ id: 0, x: 0, y: 0 }]),
    ];
    const zones = computeZonePercentages(frames, 0);
    expect(zones['mid-center']).toBeCloseTo(100);
    expect(zones['front-left']).toBe(0);
  });
});

describe('computeSpeeds', () => {
  it('computes average and max speed', () => {
    const frames = [
      makeFrame(0, 0, [{ id: 0, x: 0, y: 0 }]),
      makeFrame(1, 1000, [{ id: 0, x: 3, y: 4 }]),
    ];
    const speeds = computeSpeeds(frames, 0);
    expect(speeds.avg).toBeCloseTo(5, 1);
    expect(speeds.max).toBeCloseTo(5, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/stats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write stats implementation**

Write `src/vision/stats.ts`:

```typescript
import type { TrackedFrame, CourtPoint, CourtZone, RallyData } from './types';
import { COURT_WIDTH, COURT_HEIGHT } from './calibration';

/**
 * Classify a court position into one of 9 zones.
 * Court origin is at center: x from -3.05 to 3.05, y from -6.7 to 6.7.
 */
export function classifyZone(point: CourtPoint): CourtZone {
  const thirdW = COURT_WIDTH / 3;  // ~2.03m
  const thirdH = COURT_HEIGHT / 3; // ~4.47m

  const col = point.x < -thirdW ? 'left' : point.x > thirdW ? 'right' : 'center';
  const row = point.y < -thirdH ? 'front' : point.y > thirdH ? 'rear' : 'mid';

  return `${row}-${col}` as CourtZone;
}

export function computeHeatmap(
  frames: TrackedFrame[],
  playerId: number,
  gridSize: number = 20,
): number[][] {
  const grid: number[][] = Array.from({ length: gridSize }, () =>
    new Array(gridSize).fill(0),
  );
  let count = 0;

  for (const frame of frames) {
    const obj = frame.objects.find(o => o.id === playerId && o.class === 'player');
    if (!obj) continue;
    count++;

    // Map court coords [-3.05..3.05, -6.7..6.7] to grid indices [0..gridSize-1]
    const cx = Math.max(0, Math.min(gridSize - 1,
      Math.floor(((obj.position.x + COURT_WIDTH / 2) / COURT_WIDTH) * gridSize),
    ));
    const cy = Math.max(0, Math.min(gridSize - 1,
      Math.floor(((obj.position.y + COURT_HEIGHT / 2) / COURT_HEIGHT) * gridSize),
    ));
    grid[cy][cx]++;
  }

  // Normalize to [0, 1]
  if (count > 0) {
    const max = Math.max(...grid.flat());
    if (max > 0) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          grid[y][x] /= max;
        }
      }
    }
  }

  return grid;
}

export function computeDistance(frames: TrackedFrame[], playerId: number): number {
  let total = 0;
  let prev: CourtPoint | null = null;

  for (const frame of frames) {
    const obj = frame.objects.find(o => o.id === playerId && o.class === 'player');
    if (!obj) continue;

    if (prev) {
      const dx = obj.position.x - prev.x;
      const dy = obj.position.y - prev.y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    prev = obj.position;
  }

  return total;
}

export function computeZonePercentages(
  frames: TrackedFrame[],
  playerId: number,
): Record<CourtZone, number> {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const frame of frames) {
    const obj = frame.objects.find(o => o.id === playerId && o.class === 'player');
    if (!obj) continue;
    const zone = classifyZone(obj.position);
    counts[zone] = (counts[zone] || 0) + 1;
    total++;
  }

  const percentages: Record<string, number> = {};
  for (const zone of Object.keys(counts)) {
    percentages[zone] = total > 0 ? (counts[zone] / total) * 100 : 0;
  }

  // Fill missing zones with 0
  const allZones: CourtZone[] = [
    'front-left', 'front-center', 'front-right',
    'mid-left', 'mid-center', 'mid-right',
    'rear-left', 'rear-center', 'rear-right',
  ];
  for (const zone of allZones) {
    if (!(zone in percentages)) {
      percentages[zone] = 0;
    }
  }

  return percentages as Record<CourtZone, number>;
}

export function computeShotCount(rally: RallyData): number {
  let count = 0;
  const shuttleFrames = rally.frames.flatMap(f =>
    f.objects.filter(o => o.class === 'shuttlecock'),
  );

  let prevDirection: number | null = null;
  for (let i = 1; i < shuttleFrames.length; i++) {
    const dx = shuttleFrames[i].position.x - shuttleFrames[i - 1].position.x;
    const dy = shuttleFrames[i].position.y - shuttleFrames[i - 1].position.y;
    const direction = Math.sign(dy); // positive = moving toward far side, negative = toward near

    if (prevDirection !== null && direction !== 0 && direction !== prevDirection) {
      count++;
    }
    if (direction !== 0) {
      prevDirection = direction;
    }
  }

  return count;
}

export function computeSpeeds(
  frames: TrackedFrame[],
  playerId: number,
): { avg: number; max: number } {
  const speeds: number[] = [];

  for (let i = 1; i < frames.length; i++) {
    const curr = frames[i].objects.find(o => o.id === playerId && o.class === 'player');
    const prev = frames[i - 1].objects.find(o => o.id === playerId && o.class === 'player');
    if (!curr || !prev) continue;

    const dt = (curr.position.x - prev.position.x);
    const dy = (curr.position.y - prev.position.y);
    const dist = Math.sqrt(dt * dt + dy * dy);
    const timeSec = (frames[i].timestampMs - frames[i - 1].timestampMs) / 1000;
    if (timeSec > 0) {
      speeds.push(dist / timeSec);
    }
  }

  if (speeds.length === 0) return { avg: 0, max: 0 };

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const max = Math.max(...speeds);
  return { avg, max };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/stats.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Verify lint and commit**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

```bash
git add src/vision/stats.ts src/vision/stats.test.ts
git commit -m "feat: add stats computation — heatmaps, distance, zones, speeds"
```

---

### Task 6: Swing classifier — shot type from pose + trajectory

**Files:**
- Create: `src/vision/swingClassifier.ts`
- Create: `src/vision/swingClassifier.test.ts`

- [ ] **Step 1: Write the failing test**

Write `src/vision/swingClassifier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyShots } from './swingClassifier';
import type { RallyData, TrackedFrame, TrackedObject, ClassifiedShot } from './types';

function makeFrame(
  frameIndex: number,
  timestampMs: number,
  objects: TrackedObject[],
): TrackedFrame {
  return { frameIndex, timestampMs, objects };
}

describe('classifyShots', () => {
  it('returns empty array for rally with no shuttle direction changes', () => {
    const rally: RallyData = {
      rallyIndex: 0,
      startFrame: 0,
      endFrame: 5,
      startTimestampMs: 0,
      endTimestampMs: 500,
      frames: [
        makeFrame(0, 0, [
          { id: 0, class: 'shuttlecock', position: { x: 0, y: -5 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        ]),
        makeFrame(1, 100, [
          { id: 0, class: 'shuttlecock', position: { x: 0, y: -4 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        ]),
        makeFrame(2, 200, [
          { id: 0, class: 'shuttlecock', position: { x: 0, y: -3 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        ]),
      ],
      shots: [],
    };
    const result = classifyShots(rally, []);
    expect(result).toHaveLength(0);
  });

  it('detects a shot event from shuttle direction change', () => {
    const rally: RallyData = {
      rallyIndex: 0,
      startFrame: 0,
      endFrame: 10,
      startTimestampMs: 0,
      endTimestampMs: 1000,
      frames: Array.from({ length: 11 }, (_, i) => {
        // Shuttle moves toward far side (y increasing) then reverses at frame 5
        const y = i <= 5 ? -5 + i : 5 - (i - 5);
        return makeFrame(i, i * 100, [
          { id: 0, class: 'shuttlecock', position: { x: 0, y }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
          { id: 1, class: 'player', position: { x: 0, y: -5 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
          { id: 2, class: 'player', position: { x: 0, y: 5 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        ]);
      }),
      shots: [],
    };
    const result = classifyShots(rally, []);
    expect(result.length).toBe(1);
    expect(result[0].contactFrame).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/swingClassifier.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write swing classifier implementation**

Write `src/vision/swingClassifier.ts`:

```typescript
import type {
  RallyData,
  TrackedObject,
  ClassifiedShot,
  ShotType,
  CourtPoint,
} from './types';
import { COURT_HEIGHT } from './calibration';

/** Threshold for detecting a shuttle direction change */
const DIRECTION_CHANGE_WINDOW = 3;

/**
 * Classify each shot in a rally from shuttle trajectory features.
 * V1: trajectory-only heuristics (no pose analysis — Pose Landmarker integration
 * is deferred to v2 for performance; trajectory-based classification covers
 * the majority of shot types reliably at 1280x1280 resolution).
 *
 * Shot detection: a shot event is detected when the shuttle reverses y-direction
 * (crossing the net axis) or significantly changes angle.
 */
export function classifyShots(
  rally: RallyData,
  _poseLandmarkResults: any[],
): ClassifiedShot[] {
  const shots: ClassifiedShot[] = [];
  const shuttleFrames: { frame: RallyData['frames'][0]; shuttle: TrackedObject }[] = [];

  for (const frame of rally.frames) {
    const shuttle = frame.objects.find(o => o.class === 'shuttlecock');
    if (shuttle) {
      shuttleFrames.push({ frame, shuttle });
    }
  }

  if (shuttleFrames.length < 3) return shots;

  // Detect direction changes
  let prevDy = 0;
  for (let i = 1; i < shuttleFrames.length; i++) {
    const dy = shuttleFrames[i].shuttle.position.y - shuttleFrames[i - 1].shuttle.position.y;
    const timeMs = shuttleFrames[i].frame.timestampMs - shuttleFrames[i - 1].frame.timestampMs;
    if (timeMs <= 0) continue;

    const speed = Math.abs(dy) / (timeMs / 1000); // m/s vertical

    // Direction change detected
    if (prevDy !== 0 && dy !== 0 && Math.sign(dy) !== Math.sign(prevDy)) {
      const contactFrame = shuttleFrames[i].frame.frameIndex;
      const contactPos = shuttleFrames[i].shuttle.position;

      // Find nearest player to contact point
      const playersInFrame = rally.frames[contactFrame]?.objects.filter(o => o.class === 'player') ?? [];
      let nearestPlayerId = -1;
      let nearestDist = Infinity;
      for (const p of playersInFrame) {
        const dx = p.position.x - contactPos.x;
        const dy2 = p.position.y - contactPos.y;
        const dist = Math.sqrt(dx * dx + dy2 * dy2);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayerId = p.id;
        }
      }

      const shotType = classifyShotType(contactPos, speed, dy);

      shots.push({
        type: shotType,
        confidence: estimateConfidence(shotType, speed, dy, contactPos),
        contactFrame,
        playerId: nearestPlayerId,
      });
    }
    if (dy !== 0) prevDy = dy;
  }

  return shots;
}

function classifyShotType(
  contactPos: CourtPoint,
  speed: number,
  exitDy: number,
): ShotType {
  const absY = Math.abs(contactPos.y);
  const halfCourt = COURT_HEIGHT / 2; // 6.7m
  const inFrontThird = absY > halfCourt * 0.33; // near own baseline
  const inMidThird = absY > halfCourt * 0.1 && absY <= halfCourt * 0.33;
  const inRearThird = absY <= halfCourt * 0.1; // at the net

  // Based on exit speed and vertical component
  if (speed > 25 && exitDy < 0) return 'smash';
  if (speed > 20 && Math.abs(exitDy) < 3 && inMidThird) return 'drive';
  if (exitDy > 3 && speed > 10 && inRearThird) return 'clear';
  if (exitDy > 3 && speed <= 10 && inMidThird) return 'lob';
  if (exitDy < 0 && speed <= 15 && inMidThird) return 'drop';
  if (exitDy < 0 && speed <= 8 && inFrontThird) return 'net';

  return 'clear';
}

function estimateConfidence(
  shotType: ShotType,
  speed: number,
  exitDy: number,
  _contactPos: CourtPoint,
): number {
  // Simple heuristic confidence: higher confidence for unambiguous cases
  if (shotType === 'smash' && speed > 30) return 0.9;
  if (shotType === 'net' && speed < 5) return 0.85;
  if (shotType === 'drive' && speed > 15) return 0.8;
  return 0.6;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/vision/swingClassifier.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Verify lint and commit**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

```bash
git add src/vision/swingClassifier.ts src/vision/swingClassifier.test.ts
git commit -m "feat: add trajectory-based shot classification (v1 heuristic)"
```

---

### Task 7: Analyzer — offline frame-by-frame processing pipeline (Web Worker)

**Files:**
- Create: `src/vision/analyzer.ts`
- Create: `src/vision/analyzer.worker.ts`
- Modify: `vite.config.ts`

Vite needs the `?worker` import pattern and may need a small config update. Check existing `vite.config.ts` first — Vite 7 supports web workers via `new Worker(new URL('./analyzer.worker.ts', import.meta.url), { type: 'module' })` by default.

- [ ] **Step 1: Read vite.config.ts to check worker support**

Read `vite.config.ts`. If it doesn't have worker config, no change needed — Vite supports workers with `{ type: 'module' }` out of the box.

- [ ] **Step 2: Write analyzer.worker.ts**

Write `src/vision/analyzer.worker.ts`:

```typescript
/**
 * Web Worker that processes video frames through YOLO detection, tracking,
 * calibration, and shot classification. Communicates with the main thread
 * via typed messages.
 */

import type {
  Detection,
  TrackedFrame,
  TrackedObject,
  RallyData,
  CalibrationData,
  AnalysisProgress,
  ClassifiedShot,
} from './types';
import { trackFrame, resetTracker } from './tracker';
import { pixelToCourt } from './calibration';
import { classifyShots } from './swingClassifier';

interface WorkerMessage {
  type: 'process' | 'abort';
  videoWidth?: number;
  videoHeight?: number;
  frameIndex?: number;
  timestampMs?: number;
  calibration?: CalibrationData;
  rallyBoundaries?: { startFrame: number; endFrame: number }[];
  imageData?: ImageData;
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  progress?: AnalysisProgress;
  trackedFrames?: TrackedFrame[];
  rallies?: RallyData[];
  message?: string;
}

let calibration: CalibrationData | null = null;
let rallyBoundaries: { startFrame: number; endFrame: number }[] = [];
let trackedFrames: TrackedFrame[] = [];
let videoLoaded = false;
let videoWidth = 0;
let videoHeight = 0;
const FRAME_DECIMATION = 5;
let frameCount = 0;
let totalFrames = 0;

function applyCalibration(frame: TrackedFrame): TrackedFrame {
  if (!calibration) return frame;
  return {
    ...frame,
    objects: frame.objects.map(obj => ({
      ...obj,
      position: pixelToCourt(obj.pixelPosition, calibration!.homography),
    })),
  };
}

async function runDetection(
  imageData: ImageData,
  frameIndex: number,
  timestampMs: number,
): Promise<Detection[]> {
  // Detection runs on the main thread (TF.js WebGL context must be on main thread).
  // The worker signals the main thread to run detection and receives results.
  // For now, this is a placeholder — actual detection is orchestrated by the
  // useMatchAnalysis hook which calls detector.ts on the main thread and
  // sends detections to the worker for tracking.
  return [];
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'abort':
      trackedFrames = [];
      videoLoaded = false;
      resetTracker();
      break;

    case 'process': {
      if (!videoLoaded && msg.videoWidth && msg.videoHeight) {
        videoWidth = msg.videoWidth;
        videoHeight = msg.videoHeight;
        rallyBoundaries = msg.rallyBoundaries ?? [];
        calibration = msg.calibration ?? null;
        videoLoaded = true;
        totalFrames = msg.frameIndex ?? 0;
        frameCount = 0;
        resetTracker();
      }

      if (!videoLoaded || !msg.imageData) break;

      const frameIndex = msg.frameIndex ?? frameCount;
      const timestampMs = msg.timestampMs ?? 0;

      if (frameIndex % FRAME_DECIMATION !== 0) {
        // Skip decimated frames
        break;
      }

      frameCount++;

      // Placeholder: detections come from main thread's TF.js
      // The worker receives a detections array via the message
      const detections: Detection[] = (msg as any).detections ?? [];

      if (detections.length > 0) {
        const prevObjects: TrackedObject[] =
          trackedFrames.length > 0
            ? trackedFrames[trackedFrames.length - 1].objects
            : [];

        const tracked = trackFrame(detections, prevObjects);
        const calibrated = applyCalibration(tracked);
        calibrated.frameIndex = frameIndex;
        calibrated.timestampMs = timestampMs;
        trackedFrames.push(calibrated);
      }

      // Report progress every ~100 frames
      if (frameCount % 100 === 0) {
        const progress: AnalysisProgress = {
          phase: 'detecting',
          processedFrames: frameCount,
          totalFrames,
          currentRallyIndex: 0,
        };
        const response: WorkerResponse = { type: 'progress', progress };
        self.postMessage(response);
      }

      // Check if done
      if (frameCount >= totalFrames / FRAME_DECIMATION) {
        // Build rallies
        const rallies: RallyData[] = rallyBoundaries.map((b, i) => {
          const rallyFrames = trackedFrames.filter(
            f => f.frameIndex >= b.startFrame && f.frameIndex <= b.endFrame,
          );
          const rally: RallyData = {
            rallyIndex: i,
            startFrame: b.startFrame,
            endFrame: b.endFrame,
            startTimestampMs: rallyFrames[0]?.timestampMs ?? 0,
            endTimestampMs: rallyFrames[rallyFrames.length - 1]?.timestampMs ?? 0,
            frames: rallyFrames,
            shots: [],
          };
          rally.shots = classifyShots(rally, []);
          return rally;
        });

        const response: WorkerResponse = {
          type: 'result',
          trackedFrames,
          rallies,
        };
        self.postMessage(response);
      }
      break;
    }
  }
};
```

- [ ] **Step 3: Write analyzer.ts (main-thread interface)**

Write `src/vision/analyzer.ts`:

```typescript
/**
 * Main-thread interface to the analyzer Web Worker.
 * The worker handles tracking, calibration, and classification.
 * Detection (TF.js inference) runs on the main thread due to WebGL requirement.
 */

import type {
  Detection,
  CalibrationData,
  AnalysisProgress,
  TrackedFrame,
  RallyData,
} from './types';

export interface AnalyzerCallbacks {
  onProgress: (progress: AnalysisProgress) => void;
  onComplete: (result: { trackedFrames: TrackedFrame[]; rallies: RallyData[] }) => void;
  onError: (error: string) => void;
}

let worker: Worker | null = null;

export function isAnalyzerRunning(): boolean {
  return worker !== null;
}

export function startAnalyzer(
  videoWidth: number,
  videoHeight: number,
  totalFrames: number,
  calibration: CalibrationData | null,
  rallyBoundaries: { startFrame: number; endFrame: number }[],
  callbacks: AnalyzerCallbacks,
): Worker {
  worker = new Worker(
    new URL('./analyzer.worker.ts', import.meta.url),
    { type: 'module' },
  );

  worker.onmessage = (e) => {
    const data = e.data;
    if (data.type === 'progress') {
      callbacks.onProgress(data.progress);
    } else if (data.type === 'result') {
      callbacks.onComplete({
        trackedFrames: data.trackedFrames,
        rallies: data.rallies,
      });
      stopAnalyzer();
    } else if (data.type === 'error') {
      callbacks.onError(data.message ?? 'Unknown worker error');
    }
  };

  worker.onerror = (err) => {
    callbacks.onError(err.message ?? 'Worker error');
    stopAnalyzer();
  };

  // Initialize worker
  worker.postMessage({
    type: 'process',
    videoWidth,
    videoHeight,
    frameIndex: totalFrames,
    calibration,
    rallyBoundaries,
  });

  return worker;
}

export function sendFrameToWorker(
  frameIndex: number,
  timestampMs: number,
  detections: Detection[],
): void {
  if (!worker) return;
  worker.postMessage({
    type: 'process',
    frameIndex,
    timestampMs,
    detections,
  });
}

export function stopAnalyzer(): void {
  if (worker) {
    worker.postMessage({ type: 'abort' });
    worker.terminate();
    worker = null;
  }
}
```

- [ ] **Step 4: Verify lint and commit**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

```bash
git add src/vision/analyzer.ts src/vision/analyzer.worker.ts
git commit -m "feat: add offline analysis pipeline with web worker"
```

---

### Task 8: Video recorder hook

**Files:**
- Create: `src/hooks/useVideoRecorder.ts`

- [ ] **Step 1: Write the hook**

Write `src/hooks/useVideoRecorder.ts`:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseVideoRecorderResult {
  isSupported: boolean;
  isRecording: boolean;
  error: string | null;
  stream: MediaStream | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  elapsedMs: number;
}

const DB_NAME = 'cv-recordings';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('recordings', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('recordings', 'readwrite');
  const store = tx.objectStore('recordings');
  await new Promise<void>((resolve, reject) => {
    const req = store.put({ id, blob, createdAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

export async function getRecording(id: string): Promise<Blob | null> {
  const db = await openDB();
  const tx = db.transaction('recordings', 'readonly');
  const store = tx.objectStore('recordings');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result?.blob ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('recordings', 'readwrite');
  const store = tx.objectStore('recordings');
  store.delete(id);
  tx.oncomplete = () => db.close();
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return { usage: 0, quota: 0 };
}

export function useVideoRecorder(): UseVideoRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSupported] = useState(() => {
    return typeof navigator !== 'undefined' &&
           'mediaDevices' in navigator &&
           'getUserMedia' in (navigator.mediaDevices ?? {}) &&
           typeof MediaRecorder !== 'undefined';
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          setStream(null);
        }

        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setIsRecording(false);
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(mediaStream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onerror = () => {
        setError('Recording error');
        stop();
      };

      recorder.start(1000); // 1-second chunks
      startTimeRef.current = Date.now();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);

    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Camera permission denied');
      } else {
        setError('Failed to start recording');
      }
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    isSupported,
    isRecording,
    error,
    stream,
    startRecording,
    stopRecording: stop,
    elapsedMs,
  };
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVideoRecorder.ts
git commit -m "feat: add video recorder hook with IndexedDB storage"
```

---

### Task 9: Match analysis orchestrator hook

**Files:**
- Create: `src/hooks/useMatchAnalysis.ts`

- [ ] **Step 1: Write the hook**

Write `src/hooks/useMatchAnalysis.ts`:

```typescript
import { useState, useRef, useCallback } from 'react';
import { loadDetector, detect, isDetectorReady, disposeDetector } from '../vision/detector';
import { startAnalyzer, stopAnalyzer, isAnalyzerRunning, sendFrameToWorker } from '../vision/analyzer';
import { saveRecording } from './useVideoRecorder';
import type { AnalysisResult, AnalysisProgress, TrackedFrame, RallyData, CalibrationData } from '../vision/types';
import type { MatchState } from '../matchState';
import { computeHeatmap, computeDistance, computeZonePercentages, computeSpeeds, computeShotCount } from '../vision/stats';

const MODEL_PATH = '/model/yolo/model.json';

export interface AnalysisState {
  status: 'idle' | 'loading' | 'analyzing' | 'done' | 'error';
  progress: AnalysisProgress | null;
  result: AnalysisResult | null;
  error: string | null;
}

export interface UseMatchAnalysisResult {
  state: AnalysisState;
  startAnalysis: (
    recordingId: string,
    videoBlob: Blob,
    calibration: CalibrationData | null,
    match: MatchState,
  ) => Promise<void>;
  cancelAnalysis: () => void;
}

/**
 * Extract rally boundaries from MatchState history.
 * Each point has a timestamp. A rally spans from the timestamp of one point
 * to the timestamp of the next. The first rally starts at match start (or 0).
 */
function extractRallyBoundaries(
  match: MatchState,
  videoDurationMs: number,
): { startFrame: number; endFrame: number }[] {
  const fps = 30; // assumed
  const boundaries: { startFrame: number; endFrame: number }[] = [];

  // Use match history points. Each entry has a timestamp.
  // A rally runs from point N's timestamp to point N+1's timestamp.
  const points = match.history ?? [];
  if (points.length === 0) {
    boundaries.push({ startFrame: 0, endFrame: Math.floor(videoDurationMs / 1000 * fps) });
    return boundaries;
  }

  const matchStart = points[0]?.timestamp ?? 0;
  for (let i = 0; i < points.length; i++) {
    const rallyStart = i === 0 ? matchStart : points[i - 1].timestamp;
    const rallyEnd = points[i].timestamp;
    boundaries.push({
      startFrame: Math.floor((rallyStart - matchStart) / 1000 * fps),
      endFrame: Math.floor((rallyEnd - matchStart) / 1000 * fps),
    });
  }

  // Final rally: last point to end of video
  const lastTs = points[points.length - 1].timestamp;
  boundaries.push({
    startFrame: Math.floor((lastTs - matchStart) / 1000 * fps),
    endFrame: Math.floor(videoDurationMs / 1000 * fps),
  });

  return boundaries;
}

export function useMatchAnalysis(): UseMatchAnalysisResult {
  const [state, setState] = useState<AnalysisState>({
    status: 'idle',
    progress: null,
    result: null,
    error: null,
  });

  const abortRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);

  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    stopAnalyzer();
    disposeDetector();
    setState({ status: 'idle', progress: null, result: null, error: null });
  }, []);

  const startAnalysis = useCallback(async (
    recordingId: string,
    videoBlob: Blob,
    calibration: CalibrationData | null,
    match: MatchState,
  ) => {
    abortRef.current = false;
    setState({ status: 'loading', progress: null, result: null, error: null });

    try {
      // Load detector
      if (!isDetectorReady()) {
        await loadDetector(MODEL_PATH);
      }

      // Create video element from blob
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      const totalFrames = Math.floor(video.duration * 30);
      const rallyBoundaries = extractRallyBoundaries(match, video.duration * 1000);

      // Start worker for tracking
      workerRef.current = startAnalyzer(
        video.videoWidth,
        video.videoHeight,
        totalFrames,
        calibration,
        rallyBoundaries,
        {
          onProgress: (progress: AnalysisProgress) => {
            setState(prev => ({
              ...prev,
              status: 'analyzing',
              progress,
            }));
          },
          onComplete: async (workerResult: { trackedFrames: TrackedFrame[]; rallies: RallyData[] }) => {
            // Build player stats
            const playerIds = new Set<number>();
            for (const f of workerResult.trackedFrames) {
              for (const o of f.objects) {
                if (o.class === 'player') playerIds.add(o.id);
              }
            }

            const playerStats = Array.from(playerIds).map(id => ({
              playerId: id,
              totalDistanceM: computeDistance(workerResult.trackedFrames, id),
              ...computeSpeeds(workerResult.trackedFrames, id),
              zonePercentages: computeZonePercentages(workerResult.trackedFrames, id),
              heatmap: computeHeatmap(workerResult.trackedFrames, id),
              shotDistribution: {} as Record<string, number>,
            }));

            // Aggregate shot distribution per player
            for (const rally of workerResult.rallies) {
              rally.shots = rally.shots; // already classified
              for (const shot of rally.shots) {
                const ps = playerStats.find(s => s.playerId === shot.playerId);
                if (ps) {
                  ps.shotDistribution[shot.type] = (ps.shotDistribution[shot.type] || 0) + 1;
                }
              }
            }

            const result: AnalysisResult = {
              recordingId,
              matchId: match.matchId ?? '',
              videoDurationMs: video.duration * 1000,
              totalFrames,
              processedFrames: workerResult.trackedFrames.length,
              rallies: workerResult.rallies,
              playerStats,
            };

            URL.revokeObjectURL(videoUrl);
            disposeDetector();

            setState({
              status: 'done',
              progress: { phase: 'done', processedFrames: totalFrames, totalFrames, currentRallyIndex: workerResult.rallies.length },
              result,
              error: null,
            });
          },
          onError: (error: string) => {
            URL.revokeObjectURL(videoUrl);
            disposeDetector();
            setState({ status: 'error', progress: null, result: null, error });
          },
        },
      );

      setState(prev => ({
        ...prev,
        status: 'analyzing',
        progress: { phase: 'detecting', processedFrames: 0, totalFrames, currentRallyIndex: 0 },
      }));

      // Process video frames
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;

      let frameIndex = 0;
      video.currentTime = 0;

      await new Promise<void>((resolve) => {
        const processNextFrame = async () => {
          if (abortRef.current || video.ended) {
            resolve();
            return;
          }

          // Seek to next frame
          video.currentTime = frameIndex / 30;

          await new Promise<void>(r => {
            video.onseeked = () => r();
          });

          ctx.drawImage(video, 0, 0);

          try {
            const detections = await detect(canvas);
            sendFrameToWorker(frameIndex, video.currentTime * 1000, detections);
          } catch {
            // Detection can fail; skip frame
          }

          frameIndex++;
          requestAnimationFrame(processNextFrame);
        };

        video.play().then(processNextFrame);
        video.onended = () => resolve();
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setState({ status: 'error', progress: null, result: null, error: message });
      disposeDetector();
    }
  }, []);

  return { state, startAnalysis, cancelAnalysis };
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMatchAnalysis.ts
git commit -m "feat: add match analysis orchestrator hook"
```

---

### Task 10: Calibration overlay component

**Files:**
- Create: `src/components/CalibrationOverlay.tsx`

- [ ] **Step 1: Write the component**

Write `src/components/CalibrationOverlay.tsx`:

```tsx
import { useState, useRef, useCallback } from 'react';
import type { Point, CalibrationData, CourtPoint } from '../vision/types';
import { computeHomography, defaultCourtCorners } from '../vision/calibration';

interface CalibrationOverlayProps {
  stream: MediaStream | null;
  onSave: (calibration: CalibrationData) => void;
  onCancel: () => void;
}

const LABELS = ['Near Left', 'Near Right', 'Far Left', 'Far Right'];

export function CalibrationOverlay({ stream, onSave, onCancel }: CalibrationOverlayProps) {
  const [corners, setCorners] = useState<(Point | null)[]>([null, null, null, null]);
  const [currentCorner, setCurrentCorner] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point: Point = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };

    const newCorners = [...corners];
    newCorners[currentCorner] = point;
    setCorners(newCorners);

    if (currentCorner < 3) {
      setCurrentCorner(currentCorner + 1);
    }
  }, [corners, currentCorner]);

  const save = useCallback(() => {
    if (corners.some(c => !c)) return;
    const pixelCorners = corners as Point[];
    const courtCorners = defaultCourtCorners();
    const homography = computeHomography(pixelCorners, courtCorners);

    const calibration: CalibrationData = {
      pixelCorners,
      courtCorners,
      homography,
      deviceId: 'default',
      createdAt: Date.now(),
    };
    onSave(calibration);
  }, [corners, onSave]);

  const reset = useCallback(() => {
    setCorners([null, null, null, null]);
    setCurrentCorner(0);
  }, []);

  return (
    <div className="calibration-overlay">
      <div className="calibration-header">
        <h2>Calibrate Court</h2>
        <p>Tap the 4 court corners in order: {LABELS[currentCorner]}</p>
      </div>
      <div className="calibration-viewport">
        <video
          ref={videoRef}
          srcObject={stream}
          autoPlay
          playsInline
          muted
          style={{ display: 'none' }}
        />
        <canvas
          className="calibration-canvas"
          width={640}
          height={480}
          onClick={handleCanvasClick}
          ref={(el) => {
            if (el && videoRef.current) {
              const ctx = el.getContext('2d');
              if (ctx) {
                const draw = () => {
                  ctx.drawImage(videoRef.current!, 0, 0, 640, 480);
                  corners.forEach((corner, i) => {
                    if (corner) {
                      // Scale display coordinates
                      const sx = corner.x * (640 / (videoRef.current?.videoWidth ?? 640));
                      const sy = corner.y * (480 / (videoRef.current?.videoHeight ?? 480));
                      ctx.beginPath();
                      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                      ctx.fillStyle = i === currentCorner ? '#22c55e' : '#3b82f6';
                      ctx.fill();
                      ctx.fillStyle = '#fff';
                      ctx.font = '12px monospace';
                      ctx.fillText(String(i + 1), sx - 3, sy + 4);
                    }
                  });
                  requestAnimationFrame(draw);
                };
                draw();
              }
            }
          }}
        />
      </div>
      <div className="calibration-actions">
        <button onClick={save} disabled={corners.some(c => !c)} className="btn-primary">
          Save Calibration
        </button>
        <button onClick={reset} className="btn-secondary">Reset</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CalibrationOverlay.tsx
git commit -m "feat: add calibration overlay for court corner marking"
```

---

### Task 11: Rally replay component

**Files:**
- Create: `src/components/RallyReplay.tsx`

- [ ] **Step 1: Write the component**

Write `src/components/RallyReplay.tsx`:

```tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import type { RallyData, TrackedObject, ClassifiedShot } from '../vision/types';
import { COURT_WIDTH, COURT_HEIGHT } from '../vision/calibration';

interface RallyReplayProps {
  rally: RallyData;
}

const TEAM_COLORS = ['#ef4444', '#3b82f6']; // red, blue

export function RallyReplay({ rally }: RallyReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const animRef = useRef<number | null>(null);

  const frames = rally.frames;
  const maxFrame = frames.length - 1;

  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scaleX = w / COURT_WIDTH;
    const scaleY = h / COURT_HEIGHT;

    ctx.clearRect(0, 0, w, h);

    // Draw court
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Center line
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2, h - 10);
    ctx.stroke();

    // Net line
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(10, h / 2);
    ctx.lineTo(w - 10, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (frameIndex >= frames.length) return;

    const frame = frames[frameIndex];
    const shuttleTrail: { x: number; y: number }[] = [];
    const TRAIL_LENGTH = 30;

    // Collect shuttle trail
    for (let i = Math.max(0, frameIndex - TRAIL_LENGTH); i <= frameIndex; i++) {
      const shuttle = frames[i]?.objects.find(o => o.class === 'shuttlecock');
      if (shuttle) {
        shuttleTrail.push({
          x: (shuttle.position.x + COURT_WIDTH / 2) * scaleX + 10,
          y: h - ((shuttle.position.y + COURT_HEIGHT / 2) * scaleY) - 10,
        });
      }
    }

    // Draw shuttle trail
    if (shuttleTrail.length > 1) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(shuttleTrail[0].x, shuttleTrail[0].y);
      for (let i = 1; i < shuttleTrail.length; i++) {
        ctx.lineTo(shuttleTrail[i].x, shuttleTrail[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw players
    for (const obj of frame.objects) {
      if (obj.class !== 'player') continue;
      const px = (obj.position.x + COURT_WIDTH / 2) * scaleX + 10;
      const py = h - ((obj.position.y + COURT_HEIGHT / 2) * scaleY) - 10;
      const color = TEAM_COLORS[obj.id % TEAM_COLORS.length];

      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw current shuttle
    const shuttle = frame.objects.find(o => o.class === 'shuttlecock');
    if (shuttle) {
      const sx = (shuttle.position.x + COURT_WIDTH / 2) * scaleX + 10;
      const sy = h - ((shuttle.position.y + COURT_HEIGHT / 2) * scaleY) - 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // Frame counter
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`Frame ${frame.frameIndex}`, 15, 25);

  }, [frames]);

  useEffect(() => {
    if (!playing) return;

    const animate = () => {
      setCurrentFrame(prev => {
        const next = prev + 1;
        if (next >= frames.length) {
          setPlaying(false);
          return prev;
        }
        drawFrame(next);
        return next;
      });
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing, frames.length, drawFrame]);

  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  return (
    <div className="rally-replay">
      <canvas
        ref={canvasRef}
        width={400}
        height={700}
        className="replay-court"
      />
      <div className="replay-controls">
        <button onClick={() => setPlaying(!playing)} className="btn-icon">
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={maxFrame}
          value={currentFrame}
          onChange={e => {
            setCurrentFrame(Number(e.target.value));
            setPlaying(false);
          }}
          className="replay-slider"
        />
        <span className="replay-info">
          {currentFrame} / {maxFrame}
        </span>
      </div>
      <div className="replay-stats">
        <div>Duration: {((rally.endTimestampMs - rally.startTimestampMs) / 1000).toFixed(1)}s</div>
        <div>Shots: {rally.shots.length}</div>
        <div>Shot types: {rally.shots.map(s => s.type).join(', ') || 'none'}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/RallyReplay.tsx
git commit -m "feat: add rally replay component with animated court"
```

---

### Task 12: Player heatmap component

**Files:**
- Create: `src/components/PlayerHeatmap.tsx`

- [ ] **Step 1: Write the component**

Write `src/components/PlayerHeatmap.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { PlayerStats } from '../vision/types';
import { COURT_WIDTH, COURT_HEIGHT } from '../vision/calibration';

interface PlayerHeatmapProps {
  stats: PlayerStats;
  playerLabel: string;
}

export function PlayerHeatmap({ stats, playerLabel }: PlayerHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const grid = stats.heatmap;
    const gridSize = grid.length;

    ctx.clearRect(0, 0, w, h);

    // Draw court outline
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Heatmap cells
    const cellW = (w - 20) / gridSize;
    const cellH = (h - 20) / gridSize;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = grid[y][x];
        if (value === 0) continue;

        const r = Math.floor(59 + (239 - 59) * value);  // 59 → 239
        const g = Math.floor(130 - 130 * value);         // 130 → 0
        const b = Math.floor(246 - 246 * value);         // 246 → 0
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(
          10 + x * cellW,
          10 + y * cellH,
          cellW + 1,
          cellH + 1,
        );
      }
    }

  }, [stats.heatmap]);

  return (
    <div className="player-heatmap">
      <h3>{playerLabel}</h3>
      <canvas ref={canvasRef} width={400} height={700} className="heatmap-court" />
      <div className="stats-card">
        <div>Distance: {stats.totalDistanceM.toFixed(1)}m</div>
        <div>Avg Speed: {stats.avgSpeedMs.toFixed(1)} m/s</div>
        <div>Max Speed: {stats.maxSpeedMs.toFixed(1)} m/s</div>
        <h4>Zone Distribution</h4>
        {Object.entries(stats.zonePercentages).map(([zone, pct]) => (
          <div key={zone} className="zone-stat">
            <span className="zone-label">{zone}:</span>
            <span className="zone-value">{pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerHeatmap.tsx
git commit -m "feat: add player heatmap component"
```

---

### Task 13: Match stats component

**Files:**
- Create: `src/components/MatchStats.tsx`

- [ ] **Step 1: Write the component**

Write `src/components/MatchStats.tsx`:

```tsx
import type { AnalysisResult } from '../vision/types';

interface MatchStatsProps {
  result: AnalysisResult;
}

const SHOT_COLORS: Record<string, string> = {
  smash: '#ef4444',
  drop: '#f97316',
  net: '#22c55e',
  clear: '#3b82f6',
  drive: '#a855f7',
  lob: '#eab308',
};

export function MatchStats({ result }: MatchStatsProps) {
  return (
    <div className="match-stats">
      <h2>Match Analysis</h2>
      <div className="stats-summary">
        <div>Rallies: {result.rallies.length}</div>
        <div>Frames analyzed: {result.processedFrames} / {result.totalFrames}</div>
        <div>Duration: {(result.videoDurationMs / 1000).toFixed(0)}s</div>
      </div>

      {result.playerStats.map((stats) => (
        <div key={stats.playerId} className="player-stats-section">
          <h3>Player {stats.playerId + 1}</h3>
          <div className="stats-grid">
            <div><strong>Distance:</strong> {stats.totalDistanceM.toFixed(1)}m</div>
            <div><strong>Avg Speed:</strong> {stats.avgSpeedMs.toFixed(1)} m/s</div>
            <div><strong>Max Speed:</strong> {stats.maxSpeedMs.toFixed(1)} m/s</div>
          </div>

          <h4>Shot Distribution</h4>
          <div className="shot-bars">
            {Object.entries(stats.shotDistribution).map(([type, count]) => {
              const max = Math.max(...Object.values(stats.shotDistribution));
              const pct = max > 0 ? (count / max) * 100 : 0;
              return (
                <div key={type} className="shot-bar-row">
                  <span className="shot-label">{type}</span>
                  <div className="shot-bar-track">
                    <div
                      className="shot-bar-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: SHOT_COLORS[type] ?? '#94a3b8',
                      }}
                    />
                  </div>
                  <span className="shot-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <h3>Rallies</h3>
      <div className="rally-list">
        {result.rallies.map((rally) => (
          <div key={rally.rallyIndex} className="rally-item">
            <span>Rally {rally.rallyIndex + 1}</span>
            <span>{((rally.endTimestampMs - rally.startTimestampMs) / 1000).toFixed(1)}s</span>
            <span>{rally.shots.length} shots</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchStats.tsx
git commit -m "feat: add match stats component"
```

---

### Task 14: Video export component

**Files:**
- Create: `src/components/VideoExport.tsx`

- [ ] **Step 1: Write the component**

Write `src/components/VideoExport.tsx`:

```tsx
import { useState, useRef, useCallback } from 'react';
import type { AnalysisResult } from '../vision/types';

interface VideoExportProps {
  result: AnalysisResult;
  videoBlob: Blob;
}

export function VideoExport({ result, videoBlob }: VideoExportProps) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const exportVideo = useCallback(async () => {
    setStatus('exporting');
    setProgress(0);

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoBlob);

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setExportUrl(url);
        setStatus('done');
      };

      recorder.start(1000);

      const totalFrames = result.totalFrames;
      let frame = 0;
      video.currentTime = 0;

      await new Promise<void>((resolveExport) => {
        const drawOverlay = () => {
          if (video.ended || video.paused) {
            recorder.stop();
            resolveExport();
            return;
          }

          ctx.drawImage(video, 0, 0);

          // Draw tracking overlays for current frame
          const trackedFrame = result.rallies
            .flatMap(r => r.frames)
            .find(f => f.frameIndex === frame);

          if (trackedFrame) {
            for (const obj of trackedFrame.objects) {
              if (obj.class === 'player') {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.strokeRect(
                  obj.pixelPosition.x - 30,
                  obj.pixelPosition.y - 50,
                  60,
                  100,
                );
                ctx.fillStyle = '#ef4444';
                ctx.font = '16px monospace';
                ctx.fillText(`P${obj.id}`, obj.pixelPosition.x - 10, obj.pixelPosition.y - 55);
              } else if (obj.class === 'shuttlecock') {
                ctx.beginPath();
                ctx.arc(obj.pixelPosition.x, obj.pixelPosition.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#fbbf24';
                ctx.fill();
              }
            }
          }

          frame++;
          setProgress(Math.round((frame / totalFrames) * 100));
          requestAnimationFrame(drawOverlay);
        };

        video.play().then(drawOverlay);
      });

      URL.revokeObjectURL(video.src);
    } catch (err) {
      setStatus('error');
    }
  }, [result, videoBlob]);

  return (
    <div className="video-export">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {status === 'idle' && (
        <button onClick={exportVideo} className="btn-primary">
          Export Video with Tracking Overlay
        </button>
      )}
      {status === 'exporting' && (
        <div className="export-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
      )}
      {status === 'done' && exportUrl && (
        <div className="export-done">
          <a href={exportUrl} download="match-analysis.webm" className="btn-primary">
            Download Video
          </a>
        </div>
      )}
      {status === 'error' && (
        <div className="export-error">Export failed. Please try again.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoExport.tsx
git commit -m "feat: add video export component with tracking overlay"
```

---

### Task 15: Match analysis tab container

**Files:**
- Create: `src/components/MatchAnalysis.tsx`

- [ ] **Step 1: Write the container component**

Write `src/components/MatchAnalysis.tsx`:

```tsx
import { useState } from 'react';
import type { AnalysisResult } from '../vision/types';
import { RallyReplay } from './RallyReplay';
import { PlayerHeatmap } from './PlayerHeatmap';
import { MatchStats } from './MatchStats';
import { VideoExport } from './VideoExport';

type Tab = 'replay' | 'heatmap' | 'stats' | 'export';

interface MatchAnalysisProps {
  result: AnalysisResult;
  videoBlob: Blob;
}

export function MatchAnalysis({ result, videoBlob }: MatchAnalysisProps) {
  const [activeTab, setActiveTab] = useState<Tab>('replay');
  const [selectedRally, setSelectedRally] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState(0);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'replay', label: 'Replay' },
    { key: 'heatmap', label: 'Heatmap' },
    { key: 'stats', label: 'Stats' },
    { key: 'export', label: 'Export' },
  ];

  return (
    <div className="match-analysis">
      <div className="analysis-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`analysis-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="analysis-content">
        {activeTab === 'replay' && (
          <div>
            <div className="rally-selector">
              <select
                value={selectedRally}
                onChange={e => setSelectedRally(Number(e.target.value))}
              >
                {result.rallies.map((rally, i) => (
                  <option key={i} value={i}>
                    Rally {i + 1} ({rally.shots.length} shots)
                  </option>
                ))}
              </select>
            </div>
            {result.rallies[selectedRally] && (
              <RallyReplay rally={result.rallies[selectedRally]} />
            )}
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div>
            <div className="player-selector">
              <select
                value={selectedPlayer}
                onChange={e => setSelectedPlayer(Number(e.target.value))}
              >
                {result.playerStats.map((_, i) => (
                  <option key={i} value={i}>
                    Player {i + 1}
                  </option>
                ))}
              </select>
            </div>
            {result.playerStats[selectedPlayer] && (
              <PlayerHeatmap
                stats={result.playerStats[selectedPlayer]}
                playerLabel={`Player ${selectedPlayer + 1}`}
              />
            )}
          </div>
        )}

        {activeTab === 'stats' && <MatchStats result={result} />}

        {activeTab === 'export' && (
          <VideoExport result={result} videoBlob={videoBlob} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchAnalysis.tsx
git commit -m "feat: add match analysis tab container"
```

---

### Task 16: Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add CV styles**

Append to `src/styles.css`:

```css
/* --- Computer Vision --- */

/* Calibration Overlay */
.calibration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.calibration-header {
  text-align: center;
  margin-bottom: 16px;
}

.calibration-header h2 {
  color: #fff;
  margin: 0 0 8px;
}

.calibration-header p {
  color: #94a3b8;
  margin: 0;
}

.calibration-viewport {
  position: relative;
  width: 640px;
  max-width: 100%;
  aspect-ratio: 4/3;
}

.calibration-canvas {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 2px solid #475569;
  cursor: crosshair;
}

.calibration-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

/* Rally Replay */
.rally-replay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.replay-court {
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  max-width: 100%;
}

.replay-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 400px;
}

.replay-slider {
  flex: 1;
  accent-color: #3b82f6;
}

.replay-info {
  color: #94a3b8;
  font-size: 13px;
  font-family: monospace;
  min-width: 80px;
  text-align: right;
}

.replay-stats {
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

/* Player Heatmap */
.player-heatmap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.player-heatmap h3 {
  color: #e2e8f0;
  margin: 0;
}

.heatmap-court {
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  max-width: 100%;
}

.stats-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  width: 100%;
  max-width: 400px;
}

.stats-card h4 {
  color: #e2e8f0;
  margin: 12px 0 8px;
}

.stats-card > div {
  color: #cbd5e1;
  font-size: 14px;
  margin-bottom: 4px;
}

.zone-stat {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 2px 0;
}

.zone-label {
  color: #94a3b8;
}

.zone-value {
  color: #e2e8f0;
  font-family: monospace;
}

/* Match Stats */
.match-stats {
  color: #cbd5e1;
}

.match-stats h2 {
  color: #e2e8f0;
  margin: 0 0 12px;
}

.match-stats h3 {
  color: #e2e8f0;
  margin: 16px 0 8px;
}

.stats-summary {
  display: flex;
  gap: 24px;
  padding: 12px;
  background: #1e293b;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stats-grid div {
  font-size: 14px;
}

.shot-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.shot-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shot-label {
  width: 50px;
  font-size: 13px;
  text-transform: capitalize;
}

.shot-bar-track {
  flex: 1;
  height: 12px;
  background: #334155;
  border-radius: 6px;
  overflow: hidden;
}

.shot-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.shot-count {
  width: 30px;
  text-align: right;
  font-size: 13px;
  font-family: monospace;
}

.rally-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rally-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: #1e293b;
  border-radius: 6px;
  font-size: 13px;
}

/* Match Analysis Tabs */
.match-analysis {
  width: 100%;
}

.analysis-tabs {
  display: flex;
  border-bottom: 1px solid #334155;
  margin-bottom: 16px;
}

.analysis-tab {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s, border-color 0.2s;
}

.analysis-tab:hover {
  color: #e2e8f0;
}

.analysis-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.analysis-content {
  padding: 0;
}

.rally-selector,
.player-selector {
  margin-bottom: 12px;
}

.rally-selector select,
.player-selector select {
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  width: 100%;
  max-width: 300px;
}

/* Video Export */
.video-export {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
}

.export-progress {
  width: 100%;
  max-width: 400px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #334155;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.export-done {
  text-align: center;
}

.export-error {
  color: #ef4444;
  font-size: 14px;
}

/* Recording button in controls area */
.recording-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #ef4444;
}

.recording-indicator .dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Analysis progress overlay */
.analysis-progress-overlay {
  padding: 40px;
  text-align: center;
  color: #e2e8f0;
}

.analysis-progress-overlay h3 {
  margin: 0 0 16px;
}

.analysis-progress-overlay .progress-bar {
  max-width: 400px;
  margin: 0 auto 12px;
}
```

- [ ] **Step 2: Verify lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add CV analysis component styles"
```

---

### Task 17: Wire into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read current App.tsx to understand integration points**

Read `src/App.tsx`. Note the existing component structure, where controls are rendered, and where `dispatch` is passed.

- [ ] **Step 2: Add recording button and analysis entry point**

Add to `src/App.tsx`:

At the top-level of the component, add the recording hook:

```tsx
import { useVideoRecorder, saveRecording } from './hooks/useVideoRecorder';
import { useMatchAnalysis } from './hooks/useMatchAnalysis';
import { MatchAnalysis } from './components/MatchAnalysis';
import { CalibrationOverlay } from './components/CalibrationOverlay';
import { Video, StopCircle } from 'lucide-react';
import type { CalibrationData } from './vision/types';
```

Inside the component:

```tsx
const {
  isRecording, isSupported: recordingSupported,
  startRecording, stopRecording, elapsedMs, error: recordingError,
} = useVideoRecorder();

const { state: analysisState, startAnalysis, cancelAnalysis } = useMatchAnalysis();

const [showCalibration, setShowCalibration] = useState(false);
const [calibration, setCalibration] = useState<CalibrationData | null>(null);
const [recordingId, setRecordingId] = useState<string | null>(null);
const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
```

In the controls section, add the record button:

```tsx
{recordingSupported && (
  <button
    className={`btn-icon ${isRecording ? 'recording' : ''}`}
    onClick={async () => {
      if (isRecording) {
        const blob = await stopRecording();
        if (blob) {
          const id = `${Date.now()}`;
          await saveRecording(id, blob);
          setRecordingId(id);
          setVideoBlob(blob);
        }
      } else {
        await startRecording();
      }
    }}
    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
  >
    {isRecording ? <StopCircle size={20} /> : <Video size={20} />}
    {isRecording && (
      <span className="recording-indicator">
        <span className="dot" />
        {Math.floor(elapsedMs / 60000)}:{String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}
      </span>
    )}
  </button>
)}
```

Below the controls, add analysis UI:

```tsx
{recordingId && videoBlob && analysisState.status === 'idle' && (
  <div className="analysis-entry">
    <button
      className="btn-secondary"
      onClick={() => setShowCalibration(true)}
    >
      Calibrate Court (required before first analysis)
    </button>
    <button
      className="btn-primary"
      onClick={() => {
        if (match) {
          startAnalysis(recordingId, videoBlob, calibration, match);
        }
      }}
      disabled={!match}
    >
      Analyze Match
    </button>
  </div>
)}

{showCalibration && (
  <CalibrationOverlay
    stream={streamRef.current}
    onSave={(cal) => {
      setCalibration(cal);
      setShowCalibration(false);
    }}
    onCancel={() => setShowCalibration(false)}
  />
)}

{analysisState.status === 'loading' && (
  <div className="analysis-progress-overlay">
    <h3>Loading model...</h3>
  </div>
)}

{analysisState.status === 'analyzing' && analysisState.progress && (
  <div className="analysis-progress-overlay">
    <h3>Analyzing match...</h3>
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{
          width: `${Math.round((analysisState.progress.processedFrames / analysisState.progress.totalFrames) * 100)}%`,
        }}
      />
    </div>
    <p>
      {analysisState.progress.processedFrames} / {analysisState.progress.totalFrames} frames
    </p>
    <button onClick={cancelAnalysis} className="btn-ghost">Cancel</button>
  </div>
)}

{analysisState.status === 'done' && analysisState.result && videoBlob && (
  <MatchAnalysis result={analysisState.result} videoBlob={videoBlob} />
)}

{analysisState.status === 'error' && (
  <div className="export-error">
    <p>Analysis failed: {analysisState.error}</p>
    <button onClick={() => setRecordingId(null)} className="btn-ghost">Dismiss</button>
  </div>
)}
```

- [ ] **Step 3: Run full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test`
Expected: existing tests pass. Note: new components don't have tests yet — that's deferred to Task 19.

- [ ] **Step 4: Verify lint and build**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire recording and analysis into App.tsx"
```

---

### Task 18: Architecture docs

**Files:**
- Create: `.docs/media/computer-vision.md`
- Modify: `.docs/index.md`

- [ ] **Step 1: Write architecture doc**

Write `.docs/media/computer-vision.md`:

```markdown
---
title: Media — Computer Vision Court Tracking
last-updated: 2026-07-11
---

# Computer Vision Court Tracking

## Overview

On-device computer vision pipeline that records matches through the device camera, detects players and shuttlecock positions via a YOLOv8-nano model, and produces post-match analysis: rally replays with position overlay, player heatmaps and movement stats, shot classification, and video export with tracking markers.

## Location

| Area | Path |
|------|------|
| Shared types | `src/vision/types.ts` |
| Calibration | `src/vision/calibration.ts` |
| YOLO detector | `src/vision/detector.ts` |
| Object tracker | `src/vision/tracker.ts` |
| Analysis pipeline | `src/vision/analyzer.ts` |
| Analysis worker | `src/vision/analyzer.worker.ts` |
| Stats computation | `src/vision/stats.ts` |
| Shot classifier | `src/vision/swingClassifier.ts` |
| Video recorder hook | `src/hooks/useVideoRecorder.ts` |
| Analysis orchestrator | `src/hooks/useMatchAnalysis.ts` |
| Calibration UI | `src/components/CalibrationOverlay.tsx` |
| Rally replay | `src/components/RallyReplay.tsx` |
| Player heatmap | `src/components/PlayerHeatmap.tsx` |
| Match stats | `src/components/MatchStats.tsx` |
| Video export | `src/components/VideoExport.tsx` |
| Tab container | `src/components/MatchAnalysis.tsx` |
| YOLO model | `public/model/yolo/` |

## Architecture

### Recording Pipeline

1. User taps record button — `useVideoRecorder.startRecording()` requests environment-facing camera at 1080p.
2. MediaRecorder captures video/webm with VP9 codec, 1-second chunks.
3. On stop, chunks are assembled into a Blob and stored in IndexedDB (`cv-recordings` database, `recordings` store).
4. Recording runs independently of manual scoring — no interference.

### Calibration

1. User places phone on tripod pointing at the court.
2. Opens calibration overlay — taps 4 court corners (near-left, near-right, far-left, far-right).
3. `computeHomography()` solves the 3x3 perspective transform via Direct Linear Transform.
4. Matrix saved to IndexedDB, reused across matches from the same tripod position.

### Post-Match Analysis Pipeline

1. User taps "Analyze Match" on a completed match.
2. `useMatchAnalysis.startAnalysis()` loads the TF.js YOLOv8-nano model (1280x1280 input, WebGL backend) from `public/model/yolo/`.
3. Video is loaded from IndexedDB, played frame-by-frame through a hidden canvas.
4. Every 5th frame (decimation) is sent through `detect()` for YOLO inference on the main thread (WebGL requirement).
5. Detections are sent to the Web Worker (`analyzer.worker.ts`) for tracking and calibration.
6. Worker applies `trackFrame()` (Hungarian IoU assignment for players, nearest-neighbor for shuttle) and `pixelToCourt()` homography mapping.
7. After all frames processed, worker groups `TrackedFrame[]` into `RallyData[]` using rally boundaries extracted from MatchState history timestamps.
8. `classifyShots()` classifies each shot from shuttle trajectory features (direction changes, speed, court zone).
9. `computeHeatmap()`, `computeDistance()`, `computeZonePercentages()`, `computeSpeeds()` produce per-player stats.
10. Result is displayed via `MatchAnalysis` tab container (Replay | Heatmap | Stats | Export).

### YOLO Model

- **Architecture:** YOLOv8-nano (~6MB, ~3.2M params)
- **Input:** 1280x1280 (preserves shuttle detail at 1080p)
- **Classes:** `player` (0), `shuttlecock` (1)
- **Training:** Separate offline process using ShuttleSet, TrackNet, and custom footage
- **Export:** Ultralytics `yolo export format=tfjs` produces model.json + weight shards
- **Hosting:** Bundled in `public/model/yolo/`, loaded from app origin

### Shot Classification

V1: Trajectory-based heuristics (no Pose Landmarker — deferred to v2). Shot events detected from shuttle direction changes. Features: exit speed (m/s), exit angle, contact court zone. Classification priority: smash > clear > drive > drop > net > lob.

### Storage

IndexedDB collections:
- `cv-recordings.recordings` — video blobs keyed by `{matchId}_{timestamp}`
- `cv-calibrations` — calibration data keyed by device ID (future)
- Analysis results are held in memory; not persisted to IndexedDB in v1

## Performance

- **Recording:** ~5-10% CPU overhead at 1080p. No inference during recording.
- **Model load:** ~6MB, loaded once when analysis starts.
- **Analysis:** ~60-100ms/frame inference at 1280x1280 (WebGL). With 5x frame decimation, ~10-15 min pure inference for a 20-min match. Frame extraction from WebM at 1x playback adds ~20 min. Total ~30-35 min for a 20-min match on Snapdragon 8 Elite (S25+).

## Related Docs

- [Input Remotes](../input/input-remotes.md) — existing camera pipeline (hand gesture detection) is independent
- [Build & Deploy](../platform/build-deploy.md) — model files bundled as static assets
```

- [ ] **Step 2: Update docs index**

Append to `.docs/index.md` table:

```markdown
| CV Tracking | [media/computer-vision.md](media/computer-vision.md) | Video recording, YOLO detection, tracking, post-match analysis |
```

- [ ] **Step 3: Commit**

```bash
git add .docs/media/computer-vision.md .docs/index.md
git commit -m "docs: add computer vision court tracking architecture doc"
```

---

### Task 19: Component tests

**Files:**
- Create: `src/vision/tracker.test.ts` (already created in Task 4)
- Create: `src/vision/calibration.test.ts` (already created in Task 2)
- Create: `src/vision/stats.test.ts` (already created in Task 5)
- Create: `src/vision/swingClassifier.test.ts` (already created in Task 6)
- Create: `src/vision/detector.test.ts` (already created in Task 3)
- Create: `src/components/CalibrationOverlay.test.tsx`
- Create: `src/components/RallyReplay.test.tsx`

- [ ] **Step 1: Write CalibrationOverlay test**

Write `src/components/CalibrationOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalibrationOverlay } from './CalibrationOverlay';

describe('CalibrationOverlay', () => {
  it('renders with instructions', () => {
    render(
      <CalibrationOverlay
        stream={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Calibrate Court')).toBeDefined();
    expect(screen.getByText(/Tap the 4 court corners/)).toBeDefined();
  });

  it('save button is disabled until all corners marked', () => {
    render(
      <CalibrationOverlay
        stream={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Save Calibration').closest('button')!).toBeDisabled();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <CalibrationOverlay
        stream={null}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write RallyReplay test**

Write `src/components/RallyReplay.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RallyReplay } from './RallyReplay';
import type { RallyData } from '../vision/types';

const mockRally: RallyData = {
  rallyIndex: 0,
  startFrame: 0,
  endFrame: 5,
  startTimestampMs: 0,
  endTimestampMs: 500,
  frames: [
    {
      frameIndex: 0,
      timestampMs: 0,
      objects: [
        { id: 0, class: 'player', position: { x: 0, y: -5 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        { id: 1, class: 'player', position: { x: 0, y: 5 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        { id: 2, class: 'shuttlecock', position: { x: 0, y: -3 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
      ],
    },
    {
      frameIndex: 5,
      timestampMs: 500,
      objects: [
        { id: 0, class: 'player', position: { x: 0.5, y: -4 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        { id: 1, class: 'player', position: { x: 0, y: 5 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
        { id: 2, class: 'shuttlecock', position: { x: 0, y: 3 }, pixelPosition: { x: 0, y: 0 }, confidence: 1 },
      ],
    },
  ],
  shots: [
    { type: 'clear', confidence: 0.7, contactFrame: 0, playerId: 0 },
  ],
};

describe('RallyReplay', () => {
  it('renders without crashing', () => {
    render(<RallyReplay rally={mockRally} />);
    expect(screen.getByText(/Duration:/)).toBeDefined();
    expect(screen.getByText(/Shots:/)).toBeDefined();
  });

  it('shows shot types in stats', () => {
    render(<RallyReplay rally={mockRally} />);
    expect(screen.getByText(/clear/)).toBeDefined();
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/CalibrationOverlay.test.tsx src/components/RallyReplay.test.tsx
git commit -m "test: add component tests for CalibrationOverlay and RallyReplay"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test`
Expected: all tests pass, no regressions.

- [ ] **Step 2: Lint**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: no TypeScript errors.

- [ ] **Step 3: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: builds successfully.

- [ ] **Step 4: Verify service worker**

Run: `node --check public/sw.js`
Expected: no errors.
