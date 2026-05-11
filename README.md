# Badminton Scorer

Phone-first badminton scorekeeper for live games. It tracks rally scoring, the current serving team, serving player, receiver, court positions, score announcements, and remote input.

## Features

- Standard badminton rally scoring to 21, win by 2, capped at 30.
- Doubles-first scoring engine with singles support.
- Current server, receiver, and player court-side tracking.
- Regulation-proportioned court display with full badminton line markings.
- Last-action undo.
- Manual and optional automatic score announcements.
- Touch controls for scoring, undo, announcements, match mode, first-server setup, and new match.
- Web Bluetooth adapter for BLE remotes on Android Chrome.
- Keyboard-style Bluetooth remote support for camera clickers that emit volume-up key presses.
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

Then open the local Vite URL in a browser. For BLE remote support, use Android Chrome with a compatible Web Bluetooth device. Keyboard-style camera remotes that emit volume-up key presses work when the browser exposes those key events to the app.

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

## Remote Input Notes

The app supports two remote input paths:

- BLE remotes through the Web Bluetooth adapter.
- Keyboard-style Bluetooth camera remotes that send `AudioVolumeUp`, legacy `VolumeUp`, or key code `175`.

Both paths use the same gesture mapping:

- Single click: serving team wins the rally
- Double click: receiving team wins the rally
- Press and hold: undo last point

The BLE adapter supports a generic press/release byte mapping:

- `1`: button press
- `0`: button release

BLE devices vary, so service and characteristic UUIDs are configurable in the adapter. The default UUIDs are placeholders and may need device-specific mapping for a real clicker.

Keyboard-style camera remotes depend on browser and operating system behavior. If the OS reserves volume keys, the web app may not receive the key events.

## Court Display Notes

The court view is drawn as a scaled top-down doubles court:

- Outer court: `13.40m x 6.10m`.
- Singles sidelines are inset by `0.46m` on each side.
- Short service lines are `1.98m` from the net.
- Doubles long service lines are `0.76m` from each back boundary.
- Center service lines divide the left and right service courts.

The display is rotated horizontally so the net runs vertically in the middle of the screen. Team A appears on the left and Team B appears on the right. Because teams face each other, Team B's visual lanes are mirrored so its right service court appears at the top of the right half and its left service court appears at the bottom.

## Project Structure

- `src/domain/`: framework-independent scoring engine and types.
- `src/input/`: command reducer, gesture interpreter, Bluetooth adapter, and keyboard remote adapter.
- `src/speech/`: score announcement text and speech synthesis adapter.
- `src/components/`: React UI components, including the regulation court view.
- `public/`: PWA manifest, service worker, and icons.
- `docs/superpowers/`: design spec and implementation plan used to build the app.
