# Firebase Authentication Design

**Date:** 2026-05-12

## Goal

Add Firebase Authentication to the app using explicit Google sign-in only. Users do not start signed in silently, and the app must not create anonymous Firebase users. Firestore-backed advanced features use the named account `uid` for room ownership and are unavailable until the user signs in.

## Approach

Auth is initialised in `firebase.ts` alongside Firestore. A `useAuth` hook backed by `AuthContext` exposes auth state to the whole app. `AuthProvider` wraps the router in `main.tsx`. The global account menu is the sign-in entry point, and reusable auth gates prevent Firebase-backed features from running without a named account.

---

## 1. Auth Initialisation (`firebase.ts`)

Add `getFirebaseAuth()` alongside `getFirebaseDb()`. On first call it initialises the Firebase Auth instance. `AuthProvider` never calls `signInAnonymously()`. When `onAuthStateChanged` fires with no user, auth becomes ready with `user: null`.

If an older persisted anonymous Firebase user is restored from a previous app version, `AuthProvider` signs it out and exposes `user: null`. This clears the anonymous session instead of treating it as a valid account for advanced features.

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

`signInWithGoogle` uses `signInWithRedirect(new GoogleAuthProvider())` so mobile browsers, PWA contexts, and strict popup blockers do not reject the auth flow. There is no anonymous-to-named linking path.

### `AuthProvider.tsx`

- Calls `getFirebaseAuth()` and subscribes to `onAuthStateChanged`
- Exposes `user: null, loading: false` if the callback fires with `user === null`
- Signs out restored anonymous Firebase users and exposes them as signed out
- Provides `AuthContext` to its children
- Placed in `main.tsx` wrapping `<RouterProvider>` so every route has access

**Offline behaviour:** If the user was previously signed in, Firebase may restore the session from `localStorage` even offline. Signed-out users remain signed out. All non-Firestore features (scoring engine, BLE/keyboard/gamepad remotes, session scheduler) are unaffected in all cases.

---

## 3. `useWatchRemoteHost` Change

Replace:
```ts
const hostIdRef = useRef<string>(crypto.randomUUID());
```
With:
```ts
const { user, loading, isAnonymous, authUnavailable } = useAuth();
```

`user.uid` is passed as `hostId` only when `user` is present and `isAnonymous` is false. While auth is loading, unavailable, signed out, or anonymous, watch remote hosting remains inactive and does not call Firestore.

---

## 4. Sign-in UI

### `AccountMenu` component

Renders based on auth state:

| State | Renders |
|---|---|
| `loading` | nothing (avoids flash) |
| `authUnavailable` | "Unavailable offline" (muted, non-interactive) |
| signed out or anonymous | "Sign in with Google" button |
| signed in | user display name/avatar + "Sign out" |

Placed in the global account bar so it is available on the scorer and controller routes.

The remote controls modal receives a watch-remote unavailable reason from `App`. "Start watch remote" is disabled when auth is loading, unavailable, signed out, or anonymous. The controller page uses the same rule for joining Firebase rooms.

### `RequiresAuth` wrapper component

```tsx
<RequiresAuth>
  <SomeGatedFeature />
</RequiresAuth>
```

When `user` is missing or `isAnonymous` is true, renders a short inline nudge ("Sign in to use this feature") instead of children. Future gated features use this wrapper rather than re-implementing the prompt.

---

## 5. Firestore Rules Update

### `matches/{code}`

| Operation | Rule |
|---|---|
| read | `true` (anyone with the code can watch) |
| create | `isNamedSignedIn() && request.auth.uid == request.resource.data.hostId` |
| update | `isNamedSignedIn() && request.auth.uid == resource.data.hostId` |
| delete | `false` |

### `matches/{code}/commands/{commandId}`

| Operation | Rule |
|---|---|
| read | `true` |
| create | `isNamedSignedIn()` |
| update | `isNamedSignedIn() && request.auth.uid == get(/databases/$(database)/documents/matches/$(code)).data.hostId` |
| delete | `false` |

All existing field validation, type checks, immutability rules, and `hasOnly` constraints from the previous rules update are preserved unchanged.

---

## 6. Testing

- `AuthProvider` is tested with a mock `onAuthStateChanged` that exercises: loading state, signed-out state, clearing restored anonymous users, signed-in state, and Google sign-in.
- `useWatchRemoteHost` and `useControllerClient` tests verify that missing, loading, unavailable, and anonymous users cannot start Firestore-backed flows.
- Firestore rules tests verify that anonymous providers are explicitly rejected.
- `AccountMenu` and `RequiresAuth` are unit-tested with mocked `useAuth`.

---

## File Checklist

| File | Change |
|---|---|
| `src/firebase.ts` | Add `getFirebaseAuth()`, connect auth emulator |
| `src/auth/authContext.ts` | New — context + `useAuth` hook |
| `src/auth/AuthProvider.tsx` | New — provider component |
| `src/auth/index.ts` | New — barrel export |
| `src/main.tsx` | Wrap router in `<AuthProvider>` |
| `src/hooks/useWatchRemoteHost.ts` | Replace `randomUUID` hostId with signed-in `user.uid` |
| `src/hooks/useControllerClient.ts` | Gate `join()` on named sign-in readiness |
| `src/pages/ControllerPage.tsx` | Disable join unless signed in |
| `src/components/AccountMenu.tsx` | Persistent sign-in/account UI |
| `src/components/RequiresAuth.tsx` | New — gated feature wrapper |
| `src/components/RemoteControlsModal.tsx` | Disable "Start watch remote" with a signed-in-required message |
| `firestore.rules` | Tighten with named-account and `request.auth.uid` checks |
