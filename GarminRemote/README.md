# Garmin Remote — Badminton Scorer Controller

A Connect IQ watch app for the Garmin Forerunner 265 that lets you score badminton rallies from your wrist.

## How it works

The watch sends commands to the same Firestore room that the existing web controller uses. Your phone (paired via Garmin Connect) relays the HTTP requests — it stays in your bag, no interaction needed during play.

```
Watch button press
  → Garmin Connect app on phone (Bluetooth)
    → Firestore REST API (internet)
      → Scorer app on tablet
```

## Prerequisites

- [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) installed
- Garmin Forerunner 265 (or 265S) device or simulator
- The badminton scorer running on a tablet with internet access
- The scorer's watch remote feature started (generates a 4-char room code)

## Button mapping

| Button | Action |
|--------|--------|
| UP (top-right) | Team A point |
| DOWN (bottom-right) | Team B point |
| Hold BACK (top-left) | Undo last point |
| Short BACK | Return to room code entry |

## Build and install

```bash
# Build a .prg file for the simulator
connectiq build --device fr265

# Build a .prg file for sideloading to a physical watch
connectiq build --device fr265 --release
```

Sideload via Garmin Express or drag the `.prg` to the watch's `GARMIN/APPS/` folder when connected over USB.

## Pairing flow

1. On the tablet, open the scorer and start watch remote hosting — note the 4-character room code shown on screen.
2. Open this app on the watch.
3. Scroll UP/DOWN to set each character of the room code, press START to confirm each one.
4. The watch enters the active remote screen. The room code is saved for next time.

## Feedback

- **Short vibration** — command sent successfully.
- **"Sending…"** — request in flight.
- **"Error HTTP xxx"** — Firestore rejected the request. Press any button to retry. Common causes: phone not connected, Garmin Connect not running, invalid room code.

## Design

See [`.specs/2026/06/2026-06-24-garmin-connect-iq-remote.md`](../.specs/2026/06/2026-06-24-garmin-connect-iq-remote.md) for the full design rationale, security considerations, and alternatives considered.

## Source files

| File | Purpose |
|------|---------|
| `manifest.xml` | App metadata and device targets |
| `source/GarminRemoteApp.mc` | App entry point |
| `source/Storage.mc` | Persist room code and device ID |
| `source/FirestoreClient.mc` | Firestore REST API calls |
| `source/RoomCodeView.mc` | Room code entry screen |
| `source/RemoteView.mc` | Active remote screen and button handling |
