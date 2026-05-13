# Global Account Menu Design

## Goal

Make authentication feel like a normal app-level account feature instead of a watch-remote-specific control. Users should see a compact profile control at the top right of the scorer after signing in with Google, using their Google profile photo when available.

## UI

Add an app chrome row above the main scorer layout and controller content. The row keeps a small product label on the left and places the account control on the right. This keeps the avatar visible even when the watch remote panel is lower on the page.

Anonymous users continue to see a compact "Sign in with Google" button. Auth loading renders no control, and auth unavailable renders the existing muted "Unavailable offline" text.

Signed-in Google users see a circular avatar button. The avatar uses `user.photoURL` when present and falls back to initials derived from `displayName` or `email`. The button has an accessible label that includes the account name where available.

## Dropdown

Clicking the avatar opens a right-aligned menu. The menu shows the avatar, display name, and email, then menu actions:

- Settings: visible but disabled for now, because no settings page exists yet.
- Sign out: calls the existing auth `signOut` function.

The dropdown closes when the user clicks outside it, presses Escape, or activates Sign out. It must remain usable on narrow phone screens without overflowing horizontally.

## Component Boundaries

`SignInButton` remains the reusable auth entry point and becomes responsible for both anonymous sign-in and signed-in account-menu states. `WatchRemotePanel` stops rendering auth UI directly; it continues to receive `authUnavailable` only for disabling watch remote start actions. `App` and `ControllerPage` render the global account row.

## Testing

Update `SignInButton` tests to cover:

- Anonymous sign-in still renders and calls `signInWithGoogle`.
- Signed-in users render an avatar button rather than inline profile text.
- `photoURL` is used when present.
- Initials fallback is used when no profile photo exists.
- Clicking the avatar opens the menu with profile details, Settings, and Sign out.
- Escape/outside click closes the menu.
- Sign out calls the auth action and closes the menu.

Update placement tests so the watch remote panel no longer owns sign-in UI and the main scorer renders the global sign-in/account control.
