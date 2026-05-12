# Firebase Authentication Design

**Date:** 2026-05-12

## Goal

Add Firebase Authentication to the app using the anonymous-to-named account upgrade pattern. Users start signed in silently (no UI), and can later link to Google to unlock future gated features. The Firebase `uid` replaces the current ephemeral `crypto.randomUUID()` `hostId`, allowing Firestore rules to cryptographically verify room ownership.

## Approach

Auth is initialised in `firebase.ts` alongside Firestore. A `useAuth` hook backed by `AuthContext` exposes auth state to the whole app. `AuthProvider` wraps the router in `main.tsx`. Sign-in UI consists of a persistent `SignInButton` in the `WatchRemotePanel` header and a reusable `RequiresAuth` wrapper for future gated features.

---

## 1. Auth Initialisation (`firebase.ts`)

Add `getFirebaseAuth()` alongside `getFirebaseDb()`. On first call it initialises the Firebase Auth instance. `signInAnonymously()` is called by `AuthProvider` when `onAuthStateChanged` fires with no user — not in `firebase.ts` itself.

The Firebase SDK persists the anonymous session in `localStorage`, so the same `uid` survives page refreshes. When the user links to Google via `linkWithPopup(new GoogleAuthProvider())`, Firebase upgrades the account in-place — the `uid` does not change, so existing rooms remain owned by the same user.

Auth emulator support mirrors the Firestore emulator pattern: connect when `VITE_USE_FIRESTORE_EMULATOR=true`.

---

## 2. `src/auth/` Module

Two new files:

### `authContext.ts`

Creates the React context and exports `useAuth()`.

```ts
interface AuthState {
  user: User | null;          // null while loading or auth unavailable
  loading: boolean;           // true until onAuthStateChanged fires once
  isAnonymous: boolean;
  authUnavailable: boolean;   // true = offline/network error, auth couldn't start
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

`signInWithGoogle` uses `linkWithPopup` when the current user is anonymous (upgrades in-place), or `signInWithPopup` for a fresh sign-in. On link conflict (the Google account already exists as a separate Firebase user) it falls back to `signInWithPopup` and lets Firebase merge.

### `AuthProvider.tsx`

- Calls `getFirebaseAuth()` and subscribes to `onAuthStateChanged`
- Calls `signInAnonymously()` if the callback fires with `user === null`
- If `signInAnonymously()` throws (device offline, network error), sets `user: null, loading: false, authUnavailable: true` — the app renders normally, only auth-dependent features are affected
- Provides `AuthContext` to its children
- Placed in `main.tsx` wrapping `<RouterProvider>` so every route has access

**Offline behaviour:** If the user was previously signed in, Firebase restores the session from `localStorage` even offline — `authUnavailable` stays false. Only first-time visitors with no network will see `authUnavailable: true`. All non-Firestore features (scoring engine, BLE/keyboard/gamepad remotes, session scheduler) are unaffected in all cases.

---

## 3. `useWatchRemoteHost` Change

Replace:
```ts
const hostIdRef = useRef<string>(crypto.randomUUID());
```
With:
```ts
const { user, loading, authUnavailable } = useAuth();
```

`user.uid` is passed as `hostId` wherever `hostIdRef.current` was used. While `loading` is true or `authUnavailable` is true, the host panel remains in its existing idle/disconnected state — no visible behaviour change for features that don't need Firestore.

---

## 4. Sign-in UI

### `SignInButton` component

Renders based on auth state:

| State | Renders |
|---|---|
| `loading` | nothing (avoids flash) |
| `authUnavailable` | "Unavailable offline" (muted, non-interactive) |
| `isAnonymous` | "Sign in with Google" button |
| signed in | user display name/avatar + "Sign out" |

Placed in the `WatchRemotePanel` header — unobtrusive, consistent with the phone-first UI.

### `RequiresAuth` wrapper component

```tsx
<RequiresAuth>
  <SomeGatedFeature />
</RequiresAuth>
```

When `isAnonymous` is true, renders a short inline nudge ("Sign in to use this feature") instead of children. Future gated features use this wrapper rather than re-implementing the prompt.

---

## 5. Firestore Rules Update

### `matches/{code}`

| Operation | Rule |
|---|---|
| read | `true` (anyone with the code can watch) |
| create | `request.auth != null && request.auth.uid == request.resource.data.hostId` |
| update | `request.auth != null && request.auth.uid == resource.data.hostId` |
| delete | `false` |

### `matches/{code}/commands/{commandId}`

| Operation | Rule |
|---|---|
| read | `true` |
| create | `request.auth != null` (any signed-in user, including anonymous) |
| update | `request.auth != null && request.auth.uid == get(/databases/$(database)/documents/matches/$(code)).data.hostId` |
| delete | `false` |

All existing field validation, type checks, immutability rules, and `hasOnly` constraints from the previous rules update are preserved unchanged.

---

## 6. Testing

- `AuthProvider` is tested with a mock `onAuthStateChanged` that exercises: loading state, anonymous sign-in trigger, signed-in state, sign-out, and offline/error path (`authUnavailable: true`).
- `useWatchRemoteHost` tests are updated to provide a mock `useAuth` returning a fixed `uid`.
- Firestore emulator tests covering room create/update are updated to use authenticated contexts (`signInAnonymously` via the Auth emulator).
- `SignInButton` and `RequiresAuth` are unit-tested with mocked `useAuth`.

---

## File Checklist

| File | Change |
|---|---|
| `src/firebase.ts` | Add `getFirebaseAuth()`, connect auth emulator |
| `src/auth/authContext.ts` | New — context + `useAuth` hook |
| `src/auth/AuthProvider.tsx` | New — provider component |
| `src/auth/index.ts` | New — barrel export |
| `src/main.tsx` | Wrap router in `<AuthProvider>` |
| `src/hooks/useWatchRemoteHost.ts` | Replace `randomUUID` hostId with `user.uid` |
| `src/components/SignInButton.tsx` | New — persistent sign-in UI |
| `src/components/RequiresAuth.tsx` | New — gated feature wrapper |
| `src/components/WatchRemotePanel.tsx` | Add `SignInButton` to header |
| `firestore.rules` | Tighten with `request.auth.uid` checks |
