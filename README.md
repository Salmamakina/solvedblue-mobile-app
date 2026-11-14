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

Point `EXPO_PUBLIC_API_URL` at **staging** (`https://staging.solvedblue.com`).
That is what every machine uses, so a bug reproduces the same way on all of
them, and there is no local backend to start.

If you do run the backend locally, `localhost` in `.env` points at the phone,
not your machine. Use your LAN IP (`http://192.168.x.x:3000`); the backend's
CORS already allows private ranges, and allows requests with no `Origin`
header, which is every native request.

iOS simulators need macOS. On Windows, use an Android emulator; on either,
`tools/run-mobile-app.ps1` (Windows) boots the emulator and attaches Metro.

**Expo Go is not enough for everything.** It only contains the native modules
Expo bundles into it, and it dropped remote push in SDK 53. **Google sign-in**,
Sign in with Apple and push notifications all need a development build — in Expo
Go the OAuth redirect becomes `exp://…`, which Google refuses with
`redirect_uri_mismatch`:

```bash
npx expo run:ios            # or run:android, locally
eas build --profile development --platform ios
```

## Checks

```bash
npx expo export --platform ios   # bundle; also writes the typed route definitions
npx tsc --noEmit
npx expo lint
```

Run `expo export` **before** `tsc`. `experiments.typedRoutes` is on, so `Href`
is only as strict as the generated `.expo/types/router.d.ts`, and that file is
git-ignored — a fresh checkout typechecks a bad `router.push('/campaign/1')` as
valid until the export regenerates it. `.github/workflows/ci.yml` runs them in
that order for the same reason.

One lint warning is expected and left alone: `import/no-named-as-default-member`
on `axios.create`, which is a false positive on the documented axios API.

## Layout

```
app/                      routes (expo-router: the file tree is the navigation)
  _layout.tsx             providers + the auth guard that picks sign-in vs tabs
  (auth)/sign-in.tsx      Google and Apple sign-in
  (tabs)/                 home, inbox, campaigns, contacts, account
  chat/[phone].tsx        one conversation
  campaigns/[id].tsx      campaign results and metrics
  campaigns/new.tsx       campaign authoring
  contacts/[id].tsx       contact detail and edit
  contacts/new.tsx        add a contact
  contacts/import.tsx     paste or map a contact list
  organization/           members, invites
  workflows/new.tsx       simple (non-branching) workflows
src/
  api/                    one module per backend route group
  auth/                   useGoogleSignIn, useAppleSignIn
  components/             Screen, Button, Card, Badge, StateView, AppHeader, Field,
                          ProgressBar, Wordmark, ContactSalesButton
  config/                 firebase, devBypass (temporary — see below)
  notifications/          push token registration and tap handling
  stores/                 auth session (zustand + SecureStore), theme preference
  theme/                  design tokens ported from the web app
  utils/                  shared formatting, import mapping, workflow steps
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
Android Keystore) rather than plain storage. `app/_layout.tsx` holds the only
guard that decides signed-in versus signed-out.

Sign in with Apple takes a shorter path than Google: the backend verifies
Apple's identity token against Apple's published keys itself
(`POST /auth/apple`), with no Firebase hop. An Apple account is matched on its
`sub` claim before its email, because Hide My Email means the address can change
while the person does not.

## Push notifications

A reply arriving fires a notification next to the existing `broadcast()` in the
backend, and tapping it deep-links into `app/chat/[phone].tsx`. Every path fails
quietly — a refused permission, Expo Go, a missing `projectId`, an emulator
without Play services — and leaves the inbox polling exactly as before.

**Push stays silently off until `eas init` writes an EAS `projectId` into
app.json.** That is by design, not a bug, but it does mean push is untested.

## Configuration

`EXPO_PUBLIC_*` variables are inlined into the bundle at build time, so they are
not secrets — treat them as public. `.env` is git-ignored and `.env.example` is
the committed template.

| Where | Used for |
| --- | --- |
| `.env` | local development only |
| `eas.json` `env` blocks | the API URL per build profile |
| EAS environment variables | the Google and Firebase client ids, which differ between the staging and production Firebase projects |

The Google and Firebase ids belong in **EAS environment variables scoped per
profile**, not in `eas.json`: they differ per environment, and `.env` never
reaches a cloud build.

`app.json` sets `extra.apiUrl` to `https://solvedblue.com` as a last-resort
fallback, so a release build that somehow ships without `EXPO_PUBLIC_API_URL`
talks to production over HTTPS rather than to the phone itself.

## Releasing

**Start with [SETUP.md](./SETUP.md)** — the step-by-step from an empty GitHub
repo through the Mac mini, TestFlight and both stores, with every command
written out.

[STORE_RELEASE.md](./STORE_RELEASE.md) is the reference behind it: the privacy
declarations, review notes and the reasoning for each decision.
[ROADMAP.md](./ROADMAP.md) records what is left and why.

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | pull request, push to main | typecheck, lint, bundle |
| `update.yml` | push to main; manual | OTA update: `preview` automatically, `production` by hand |
| `release.yml` | manual | `eas build`, optionally `--auto-submit` to a store |

`runtimeVersion` uses the `fingerprint` policy, so an OTA update can never land
on a build missing a native module it needs. Anything native needs a new store
build, not an update.

### Build profiles

| Profile | Distribution | API | Use for |
| --- | --- | --- | --- |
| `development` | internal | local `.env` via Metro | day-to-day development |
| `preview` | internal (ad-hoc) | staging | quick installs: an Android APK, or iOS on registered devices |
| `staging` | **store** | staging | **TestFlight** and the Play internal track |
| `production` | store | production | store releases |

`staging` exists because `preview` cannot reach TestFlight: Expo's *internal
distribution* is an ad-hoc build locked to device UDIDs, while TestFlight
*internal testing* requires `distribution: store`. The two names sound
identical and mean different things.

### Testing against staging

Swagger UI is live at <https://staging.solvedblue.com/api-docs/> and documents
the whole mobile surface, so any request the app makes can be reproduced and
inspected there. Pick the environment from the Servers dropdown.

On Windows there is no iOS Simulator, so iOS testing means a physical iPhone via
TestFlight (or a registered device). See **STORE_RELEASE.md → Phase 3b**.

## Temporary: the dev sign-in bypass

`src/config/devBypass.ts` injects a real backend JWT so screens could be built
while Google sign-in was blocked on an OAuth redirect URI. `__DEV__` is false in
a release build, so a shipped app can never bypass the guard.

The risk is not a leak — it is that **sign-in has never been exercised end to
end.** Deleting this file and its three call sites is the first item in
STORE_RELEASE.md.

## What is intentionally not here

- **The admin console.** The seven `/admin/*` pages are web-only.
- **The workflow canvas.** Simple workflows can be created here; a branching one
  reports that it "can only be edited on the web" (`src/utils/workflowSteps.ts`).
- **Full member-picking when assigning a conversation.** A long press offers
  "assign to me", which is the phone case; picking another member stays on web.
- **Webhook management, queue and system monitoring, property matching.**
- **Live updates.** The backend has a WebSocket server (`wsServer.ts`) that the
  web app uses; mobile polls. With push in place this is now an optimisation
  rather than a gap — see P4 in `ROADMAP.md`, including the `serviceToken`
  question that has to be decided before mobile connects.

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

## Native projects

`ios/` and `android/` are generated by prebuild and git-ignored. `app.json` and
its config plugins are the source of truth — never edit the native directories
by hand, because the next prebuild discards the changes.

## Node version

Expo 58 wants Node `^22.13 || ^24.3 || ^26 || >=27`. Node 23.x is outside that
range and npm will warn on install. CI uses Node 22.
