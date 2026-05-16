# GIF to WebM Conversion Design

**Date:** 2026-05-14

## Overview

Convert all animation assets from GIF to WebM (VP9) to dramatically reduce bundle size (~80–95% smaller). Replace `<img>` with `<video>` in the overlay component. Delete all `.gif` files.

## Motivation

The 14 real GIF assets total ~55 MB. WebM (VP9) typically achieves 80–95% reduction for animated content, bringing the total to an estimated 3–8 MB. This improves initial load time on mobile networks.

## Changes

### Assets (`public/animations/`)

- Convert all 14 real GIFs to `.webm` using `ffmpeg` with VP9 codec, no audio:
  ```
  ffmpeg -i input.gif -c:v libvpx-vp9 -b:v 0 -crf 33 -an output.webm
  ```
- For the 4 placeholder files (`comeback_1`, `comeback_2`, `match_point_1`, `match_point_2`): create minimal valid 1×1 black WebM files using ffmpeg.
- Delete all `.gif` files.

### `src/animations/animationAssets.ts`

- Rename `GIF_MAP` → `VIDEO_MAP`
- Update all paths from `.gif` → `.webm`
- Rename `getGifUrl` → `getVideoUrl`

### `src/components/AnimationOverlay.tsx`

- Replace `<img>` with `<video autoPlay loop muted playsInline>`.
- Videos are fetched as blobs via `fetch()` and played via `URL.createObjectURL()`. Direct `src` URLs cause `net::ERR_FAILED` on Firebase Hosting because Chrome's media pipeline sends HTTP range requests, and Firebase Hosting does not respond with proper 206 Partial Content — it returns 200 with the full file, which Chrome's video pipeline rejects. A blob URL plays from memory with no range requests.
- The label renders immediately; the `<video>` element appears once the blob fetch resolves.
- Blob URLs are revoked when the event changes or the component unmounts.
- Update import: `getGifUrl` → `getVideoUrl`

### `docs/superpowers/specs/2026-05-13-meme-gif-animations-design.md`

- Update asset format references from GIF/`.gif` to WebM/`.webm`
- Update component snippet from `<img>` to `<video>`
- Update `animationAssets.ts` snippet to use `VIDEO_MAP` and `getVideoUrl`

## Files Changed

| File | Change |
|------|--------|
| `public/animations/*.gif` | Deleted |
| `public/animations/*.webm` | New — converted from GIF via ffmpeg |
| `src/animations/animationAssets.ts` | `GIF_MAP` → `VIDEO_MAP`, `getGifUrl` → `getVideoUrl`, `.gif` → `.webm` paths |
| `src/components/AnimationOverlay.tsx` | `<img>` → `<video autoPlay loop muted playsInline>`, update import |
| `docs/superpowers/specs/2026-05-13-meme-gif-animations-design.md` | Updated to reflect WebM format |

## Browser Support

WebM VP9 is supported in all modern browsers: Chrome, Firefox, Edge, and Safari 15+. No fallback needed for a PWA targeting current devices.

## Testing

- Existing `AnimationOverlay` tests pass with `<video>` element (update selector if tests query by tag)
- Visual check: animations play correctly in browser after conversion
- Run `npm test && npm run lint && npm run build` to verify no regressions
