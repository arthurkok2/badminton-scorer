# Court Fullscreen Button Design

## Context

The live scorer has two Court display modes: the regulation court and the Little Fighters view. Users may want to use either mode as a courtside display without the rest of the app controls taking up screen space.

## Design

Add one shared fullscreen control to the Court view wrapper so it appears in both display modes. The control targets the Court section itself through the browser Fullscreen API, not the whole app, so match controls and surrounding layout stay outside fullscreen mode.

The button uses an icon-only visual treatment with an accessible label:

- `Enter fullscreen court view` when the Court section is not fullscreen.
- `Exit fullscreen court view` when the Court section is fullscreen.

The component listens for `fullscreenchange` and derives state from `document.fullscreenElement`. This keeps the label and icon correct when the user exits fullscreen through Esc, browser UI, or platform controls.

## Layout

The fullscreen button sits at the top-right of the Court section with a high z-index above both court presentations. In fullscreen mode, the Court section fills the viewport with the app background, centers the active court presentation, and preserves each display mode's aspect ratio.

## Error Handling

If `requestFullscreen` or `exitFullscreen` rejects, the app leaves the existing view intact. The control remains a best-effort browser feature and does not affect scoring.

## Testing

Add a focused CourtView test that stubs the Fullscreen API, clicks the shared button, verifies `requestFullscreen` targets the Court section, and verifies `exitFullscreen` is called after entering fullscreen. The test should also cover Little Fighters rendering the same control.
