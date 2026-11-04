# Spyder Mobile

The iOS and Android client for Spyder, built with Expo (SDK 58) and expo-router.
One codebase ships both platforms.

This repo is deliberately separate from the `Spyder` monorepo so releasing the
app never triggers a backend or web deploy. It talks to the same backend API as
`spyder-web`.

## Running it

```bash
npm install
cp .env.example .env     # then set EXPO_PUBLIC_API_URL
npm start                # press i for iOS, a for Android
```

`localhost` in `.env` points at the phone, not your machine. Use your LAN IP
(`http://192.168.x.x:3000`); the backend's CORS already allows private ranges,
and it allows requests with no `Origin` header, which is every native request.

iOS simulators need macOS. On Windows, use an Android emulator or Expo Go on a
physical device.

## Checks

```bash
npm run typecheck
npx expo export --platform ios      # catches bundling errors typecheck misses
```

## Layout

```
app/                  routes (expo-router: the file tree is the navigation)
  _layout.tsx         providers + the auth guard that picks sign-in vs tabs
  (auth)/sign-in.tsx  email and password sign-in
  (tabs)/             home, inbox, campaigns, contacts, account
  chat/[phone].tsx    one conversation
src/
  api/                one module per backend route group
  components/         Button, Card, Badge, Screen, StateView, Refresh
  stores/             auth session (zustand + SecureStore)
  theme/              design tokens ported from the web app
  utils/              shared formatting
```

## How it relates to the web app

`src/api/*` mirrors `spyder-web/src/api/*` endpoint for endpoint, and
`src/theme/tokens.ts` is a port of `spyder-web/src/styles/tokens.css`.

**There is no shared package across the two repos, so these are kept in step by
hand.** That is the cost of the split. When a backend response shape changes,
both clients need updating. The API modules carry a comment saying which web
file they mirror.

Auth works the same way as on web: the backend's `authenticateToken` accepts
either its own JWT or a Firebase ID token as `Authorization: Bearer`, so an
account works on both clients. The token is held in SecureStore (iOS Keychain,
Android Keystore) rather than plain storage.

## What is intentionally not here

- **Campaign authoring.** The create payload has 20+ fields (effects, throttles,
  schedules). The list is read-only here until a mobile flow is designed.
- **Contact import.** File and Google Sheet import stays on web.
- **The admin console.** Platform-admin screens are web-only.
- **Live updates.** The backend has a WebSocket server (`wsServer.ts`) that the
  web app uses; mobile polls for now. Worth wiring up next.

## Not to be confused with `android-app`

The `android-app` folder in the Spyder monorepo is **not** an earlier version of
this. It is the SMS relay agent: a headless HTTP server on port 8888 that runs
on the relay phones and sends messages through `SmsManager`. The backend drives
it (`androidApiMessaging.ts`, `firebaseDeviceWatcher.ts`). It is fleet
infrastructure, not a customer app, and it stays where it is.

## A note on iOS and SMS

iOS gives no programmatic SMS API. An iOS build can never send from the user's
own SIM, so on iOS this app is a dashboard and inbox over the relay fleet.
Sending happens on the relay devices through the backend, which is how the web
app works too.

## Node version

Expo 58 wants Node `^22.13 || ^24.3 || ^26 || >=27`. Node 23.x is outside that
range and npm will warn on install. It works for local development, but match a
supported version before setting up EAS builds.
