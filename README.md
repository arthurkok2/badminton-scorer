# Badminton Scorer

Phone-first badminton scorekeeper for live games. It tracks rally scoring, the current serving team, serving player, receiver, court positions, score announcements, and remote input.

## Features

- Standard badminton rally scoring to 21, win by 2, capped at 30.
- Doubles-first scoring engine with singles support.
- Current server, receiver, and player court-side tracking.
- Regulation-proportioned court display with full badminton line markings.
- Last-action undo.
- Manual and optional automatic score announcements.
- Tap-to-score Team A and Team B scoreboard controls, plus controls for undo, announcements, match mode, first-server setup, and new match.
- Web Bluetooth adapter for BLE remotes on Android Chrome.
- Keyboard-style Bluetooth remote support for camera clickers that emit volume-up key presses.
- Gamepad API remote support.
- Firestore-based watch remote support (Garmin, Wear OS, and web-based controllers).
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

The app supports four remote input paths:

- BLE remotes through the Web Bluetooth adapter.
- Keyboard-style Bluetooth camera remotes that send `AudioVolumeUp`, legacy `VolumeUp`, or key code `175`.
- Gamepad API remotes (any standard gamepad with button mappings).
- Watch remotes via Firestore (Garmin, Wear OS, and web-based `/controller` page).

Both paths use the same gesture mapping:

- Single click: Team A wins the rally
- Double click: Team B wins the rally
- Press and hold: undo last point

The BLE adapter supports a generic press/release byte mapping:

- `1`: button press
- `0`: button release

BLE devices vary, so service and characteristic UUIDs are configurable in the adapter. The default UUIDs are placeholders and may need device-specific mapping for a real clicker.

Keyboard-style camera remotes depend on browser and operating system behavior. If the OS reserves volume keys, the web app may not receive the key events.

The app shows a Remote input log near the top of the screen. On Android Chrome, press the remote button and check this log for the latest `keydown` or `keyup` values. If no events appear, Chrome is not receiving the key from Android. If events appear with unexpected `key`, `code`, `keyCode`, or `which` values, those values can be used to add a device-specific keyboard mapping.

## Court Display Notes

The court view is drawn as a scaled top-down doubles court:

- Outer court: `13.40m x 6.10m`.
- Singles sidelines are inset by `0.46m` on each side.
- Short service lines are `1.98m` from the net.
- Doubles long service lines are `0.76m` from each back boundary.
- Center service lines divide the left and right service courts.

The display is rotated horizontally so the net runs vertically in the middle of the screen. Team A appears on the left and Team B appears on the right. Because teams face each other, Team B's visual lanes are mirrored so its right service court appears at the top of the right half and its left service court appears at the bottom.

## Firebase and Watch Remote Setup

The app works entirely offline for local scoring. Firebase is only required for watch remote hosting to sync match state across devices.

To use watch remotes with the Firebase emulator:

**Environment Variables:**
- `VITE_USE_FIRESTORE_EMULATOR=true` — Enable emulator connection
- `VITE_FIRESTORE_EMULATOR_HOST` — Emulator host (default: `localhost`)
- `VITE_FIRESTORE_EMULATOR_PORT` — Emulator port (default: `8080`)

**Start the Firestore Emulator:**
```bash
npx firebase emulators:start --only firestore
```

**Run the app with emulator:**
```bash
VITE_USE_FIRESTORE_EMULATOR=true npm run dev
```

The emulator UI will be available at `http://localhost:4000`. The Firestore collection used is `matches/{code}/commands/{commandId}`.

## Project Structure

- `src/domain/`: framework-independent scoring engine and types.
- `src/input/`: command reducer, gesture interpreter, Bluetooth adapter, and keyboard remote adapter.
- `src/speech/`: score announcement text and speech synthesis adapter.
- `src/components/`: React UI components, including the regulation court view.
- `public/`: PWA manifest, service worker, and icons.
## Wear OS Remote Setup

The `wear-os/` directory contains a native Wear OS watch app and Android phone companion that let you control the scorer from a Wear OS watch. Room code entry happens on the phone; the watch auto-connects.

### Requirements

- Android Studio (Hedgehog or newer)
- Android SDK 35
- Kotlin 2.1.0+
- Gradle 8.9
- A Firebase project (same one used by the PWA)

### Phone Companion Setup

1. Copy your `google-services.json` from the Firebase Console (Project Settings > Your apps > Android app) into `wear-os/companion/google-services.json`. Use the same Firebase project as the PWA.

2. Open `wear-os/` in Android Studio, or build from the command line:

   ```bash
   cd wear-os
   ./gradlew :companion:assembleDebug
   ```

3. Install `companion/build/outputs/apk/debug/companion-debug.apk` on your Android phone.

### Watch App Setup

1. Build the wear module:

   ```bash
   cd wear-os
   ./gradlew :wear:assembleDebug
   ```

2. Install `wear/build/outputs/apk/debug/wear-debug.apk` on your Wear OS watch via `adb` or Android Studio.

### Running

1. Start the PWA and create a match with watch remote enabled (tap the Remote button in settings).
2. On the phone, open the Badminton Remote companion app and enter the 4-character room code.
3. The watch auto-connects and displays live scores with Score Team A / Score Team B / Undo buttons.

### Architecture

```
Wear OS Watch (Jetpack Compose)
    ↕ Wearable Data Layer
Phone Companion (Foreground Service + Firebase)
    ↕ Firestore (matches/{code}, matches/{code}/commands)
Host PWA (React, unchanged)
```

- No changes needed to the PWA — the companion app uses the same Firestore remote protocol as the existing Garmin and web controllers.
- Both remotes (Garmin and Wear OS) can coexist.

### Project Structure (`wear-os/`)

- `companion/src/main/java/com/badminton/scorer/companion/` — Phone app: `FirebaseClient`, `RemoteForegroundService`, `MainActivity`, `DataLayerProtocol`, `RemoteTypes`.
- `wear/src/main/java/com/badminton/scorer/watch/` — Watch app: `WearDataLayerClient`, `RemoteViewModel`, `RemoteScreen`, `MainActivity`.
- `companion/src/test/` and `wear/src/test/` — Unit tests.

- `docs/superpowers/`: design spec and implementation plan used to build the app.
