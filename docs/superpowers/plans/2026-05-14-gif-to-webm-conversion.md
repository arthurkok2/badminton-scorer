# GIF to WebM Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all GIF animation assets with WebM (VP9) equivalents and update the overlay component to use `<video>` instead of `<img>`.

**Architecture:** ffmpeg batch-converts all real GIFs to VP9 WebM; four 43-byte placeholder GIFs become minimal valid 1×1 black WebM files. `animationAssets.ts` is updated in-place (rename map and getter). `AnimationOverlay.tsx` swaps `<img>` for `<video>`. All GIF files are deleted.

**Tech Stack:** ffmpeg (CLI), React 19, TypeScript, Vitest

---

### Task 1: Install ffmpeg

**Files:**
- No code files — environment setup only

- [ ] **Step 1: Install ffmpeg via winget**

```powershell
winget install --id Gyan.FFmpeg -e
```

If winget is unavailable, download from https://ffmpeg.org/download.html and add the `bin/` folder to your PATH.

- [ ] **Step 2: Verify ffmpeg is available**

Open a new terminal (winget installs require a fresh shell to update PATH), then run:

```bash
ffmpeg -version
```

Expected: first line starts with `ffmpeg version 7.x.x` or similar. If not found, restart terminal and retry.

---

### Task 2: Convert real GIFs to WebM

**Files:**
- Modify: `public/animations/` (add `.webm` files, GIFs still present for now)

- [ ] **Step 1: Run batch conversion**

From the repo root:

```bash
cd public/animations
for f in bagel_1.gif bagel_2.gif deuce_1.gif first_to_11_1.gif match_won_1.gif match_won_2.gif score_6_7_1.gif shutout_1.gif streak_3_1.gif streak_3_2.gif streak_6_1.gif streak_6_2.gif streak_9_1.gif streak_9_2.gif; do
  ffmpeg -i "$f" -c:v libvpx-vp9 -b:v 0 -crf 33 -an -y "${f%.gif}.webm"
done
cd ../..
```

Expected: each file prints a conversion summary ending with `video:Xkb audio:0kB`. No errors.

- [ ] **Step 2: Verify output sizes are smaller**

```bash
ls -lh public/animations/*.webm
```

Expected: files exist, most well under their GIF equivalents (e.g. `match_won_1.webm` < 5.9 MB).

---

### Task 3: Create WebM placeholders for comeback and match_point

**Files:**
- Modify: `public/animations/` (add 4 placeholder `.webm` files)

- [ ] **Step 1: Generate minimal 1×1 black WebM files**

```bash
cd public/animations
for name in comeback_1 comeback_2 match_point_1 match_point_2; do
  ffmpeg -f lavfi -i color=black:size=1x1:rate=1 -t 0.04 -c:v libvpx-vp9 -b:v 0 -crf 63 -an -y "${name}.webm"
done
cd ../..
```

Expected: 4 small `.webm` files created (each a few KB or less).

- [ ] **Step 2: Verify all 18 WebM files exist**

```bash
ls public/animations/*.webm | wc -l
```

Expected: `18`

---

### Task 4: Delete all GIF files

**Files:**
- Delete: `public/animations/*.gif`

- [ ] **Step 1: Remove all GIF files**

```bash
rm public/animations/*.gif
```

- [ ] **Step 2: Confirm only WebM files remain**

```bash
ls public/animations/
```

Expected: 18 `.webm` files, no `.gif` files.

---

### Task 5: Update animationAssets.ts

**Files:**
- Modify: `src/animations/animationAssets.ts`

- [ ] **Step 1: Update the asset map and getter**

Replace the entire contents of `src/animations/animationAssets.ts` with:

```ts
// src/animations/animationAssets.ts
import type { AnimationEventType } from './types';

const VIDEO_MAP: Record<AnimationEventType, string[]> = {
  match_won:   ['animations/match_won_1.webm', 'animations/match_won_2.webm'],
  shutout:     ['animations/shutout_1.webm'],
  bagel:       ['animations/bagel_1.webm', 'animations/bagel_2.webm'],
  match_point: ['animations/match_point_1.webm', 'animations/match_point_2.webm'],
  deuce:       ['animations/deuce_1.webm'],
  streak_9:    ['animations/streak_9_1.webm', 'animations/streak_9_2.webm'],
  streak_6:    ['animations/streak_6_1.webm', 'animations/streak_6_2.webm'],
  streak_3:    ['animations/streak_3_1.webm', 'animations/streak_3_2.webm'],
  comeback:    ['animations/comeback_1.webm', 'animations/comeback_2.webm'],
  first_to_11: ['animations/first_to_11_1.webm'],
  score_6_7:   ['animations/score_6_7_1.webm'],
};

export function getVideoUrl(type: AnimationEventType): string {
  const options = VIDEO_MAP[type];
  return `${import.meta.env.BASE_URL}${options[Math.floor(Math.random() * options.length)]}`;
}
```

- [ ] **Step 2: Run lint to catch any import issues**

```bash
npm run lint
```

Expected: no errors related to `animationAssets.ts`.

---

### Task 6: Update AnimationOverlay.tsx

**Files:**
- Modify: `src/components/AnimationOverlay.tsx`

- [ ] **Step 1: Update import and render**

Replace the entire contents of `src/components/AnimationOverlay.tsx` with:

```tsx
import { useEffect } from 'react';
import type { AnimationEvent } from '../animations/types';
import { getVideoUrl } from '../animations/animationAssets';

const EVENT_LABELS: Record<string, string> = {
  match_won:   'MATCH!',
  shutout:     'SHUTOUT!',
  bagel:       'BAGEL 🥯',
  match_point: 'MATCH POINT',
  deuce:       'DEUCE',
  streak_9:    'ON FIRE 🔥🔥🔥',
  streak_6:    'ON FIRE 🔥🔥',
  streak_3:    'ON FIRE 🔥',
  comeback:    'COMEBACK!',
  first_to_11: 'HALFWAY THERE',
  score_6_7:   '6 - 7 👀',
};

interface Props {
  readonly event: AnimationEvent | null;
  readonly onDismiss: () => void;
}

export function AnimationOverlay({ event, onDismiss }: Props) {
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  if (!event) return null;

  const videoUrl = getVideoUrl(event.type);
  const label = EVENT_LABELS[event.type] ?? '';

  return (
    <div className="animation-overlay" role="img" aria-label={label}>
      <video className="animation-overlay-gif" src={videoUrl} autoPlay loop muted playsInline />
      <p className="animation-overlay-label">{label}</p>
    </div>
  );
}
```

---

### Task 7: Verify tests, lint, build — then commit

**Files:**
- No changes — verification only

- [ ] **Step 1: Run tests**

```bash
npm test
```

Expected: all tests pass. The `AnimationOverlay` tests use `getByRole('img')` which matches the container `<div role="img">` — not the media element — so no test changes are needed.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Check service worker**

```bash
node --check public/sw.js
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add public/animations/ src/animations/animationAssets.ts src/components/AnimationOverlay.tsx
git commit -m "feat: convert animation assets from GIF to WebM (VP9)"
```
