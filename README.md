# Badminton Scorer

Phone-first badminton scorekeeper for live games. It tracks rally scoring, the current serving team, serving player, receiver, court positions, score announcements, and Bluetooth remote input.

## Features

- Standard badminton rally scoring to 21, win by 2, capped at 30.
- Doubles-first scoring engine with singles support.
- Current server, receiver, and player court-side tracking.
- Last-action undo.
- Manual and optional automatic score announcements.
- Touch controls for scoring, undo, announcements, match mode, first-server setup, and new match.
- Web Bluetooth adapter for BLE remotes on Android Chrome.
- Installable PWA with manifest, icons, and service worker.

## Requirements

- Node.js `>=20.19.0` or `>=22.12.0`
- npm

The repo includes `.nvmrc` with `20.19.0`.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Then open the local Vite URL in a browser. For Bluetooth remote support, use Android Chrome with a compatible BLE device.

## Build And Preview

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

## Verification

```bash
npm test
npm run lint
npm run build
node --check public/sw.js
```

## Bluetooth Notes

The remote adapter supports a generic press/release byte mapping:

- `1`: button press
- `0`: button release

Gestures map to scoring commands:

- Single click: serving team wins the rally
- Double click: receiving team wins the rally
- Press and hold: undo last point

BLE devices vary, so service and characteristic UUIDs are configurable in the adapter. The default UUIDs are placeholders and may need device-specific mapping for a real clicker.

## Project Structure

- `src/domain/`: framework-independent scoring engine and types.
- `src/input/`: command reducer, gesture interpreter, and Bluetooth adapter.
- `src/speech/`: score announcement text and speech synthesis adapter.
- `src/components/`: React UI components.
- `public/`: PWA manifest, service worker, and icons.
- `docs/superpowers/`: design spec and implementation plan used to build the app.
