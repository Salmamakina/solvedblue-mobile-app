# Roadmap to the App Store and Play Store

What is left before this app can ship, in the order it should be done.

Audited against `spyder-mobile-app`, `Spyder/spyder-web` and
`Spyder/spyder-backend` on 2026-11-09. Worked through from P0.2 on 2026-11-10,
and the pipeline, paperwork and deletion tests on 2026-11-11.

**The step-by-step runbook for everything that needs a browser and an account
now lives in `STORE_RELEASE.md`.** This file stays the record of what is left
and why; that one is the how.

## Where the app actually stands

Better than "half built". All 16 routes under `app/` and all 12 modules under
`src/api/` call real endpoints. There is no mock data, no placeholder screen and
no "coming soon" copy anywhere in the tree.

As of 2026-11-11 the engineering in P0.2–P0.5, P1.1, P2.1, P2.2, P3 and P6 is
written and checked in, the store paperwork is drafted, and `accountDeletion.ts`
has tests. What is left is almost entirely **credentials and accounts**: an Expo
login, an Apple Developer membership, a Google Play account, OAuth clients, and
pasting the drafted declarations into two consoles. Those cannot be done from a
keyboard here.

Nothing in this repo is now blocking. Every remaining item is either a **(you)**
step in `STORE_RELEASE.md` or depends on one.

Phases are ordered. P0 blocks everything; P1 and P2 can run in parallel once P0
is done; P4 is optional and P5 is explicitly out of scope.

---

## P0 — Release blockers

### P0.1 Fix Google OAuth and remove the dev bypass — **still open, deliberately**

**The single most important item on this list.** `src/config/devBypass.ts` sets:

```ts
export const DEV_BYPASS_AUTH = __DEV__ && true;
```

It ships a real backend JWT for `salma@offa.com`, signed with the local
backend's `JWT_SECRET` and expiring **2026-12-07**.

`__DEV__` is false in a release build, so a shipped app can never bypass the
guard. The risk is not a leak, it is that **sign-in has never been exercised end
to end.** Every screen has been developed against an injected session.

**The root cause recorded in the audit was wrong, and was corrected on
2026-11-11 by reading the installed library rather than the docs.**

The audit said `https://auth.expo.io/@solvedblue-app/spyder-mobile-app` needed
authorising as a redirect URI. The Expo auth proxy is legacy and
`expo-auth-session@58.0.17` does not use it: `makeRedirectUri`
(`build/AuthSession.js`) returns its `native` value whenever the execution
environment is not Expo Go, and the Google provider
(`build/providers/Google.js`) sets that to `${Application.applicationId}:/oauthredirect`
— so the real redirect is **`com.spyder.mobile:/oauthredirect`**. There is
nothing to authorise: only *Web* clients have a redirect-URI field, while iOS
clients match on bundle id and Android clients on package plus SHA-1.

What was actually wrong, both now fixed:

1. **The app claimed only the `spyder` URL scheme**, so the redirect had nowhere
   to land. `app.json` now has `"scheme": ["spyder", "com.spyder.mobile"]`.
2. **An empty `EXPO_PUBLIC_*` was passed to Google as `""`.** The provider
   resolves its client id with `??`, which does not treat `""` as missing, so a
   blank line in `.env` became the client id — and `invariantClientId` throws on
   it during render. This is the same `??`-versus-empty-string trap that
   produced a base URL of `/api` in `client.ts`. `envClientId` in
   `useGoogleSignIn.ts` now normalises blanks to `undefined`, and `configured`
   checks the client id **for the current platform** rather than any client id,
   so a missing iOS id disables the button with a message instead of sending the
   web client id with a custom-scheme redirect that Google would reject.

The remaining blocker is genuinely just the two missing OAuth clients, and the
Android one needs the signing SHA-1 from an EAS build.

> **Google sign-in cannot work in Expo Go on SDK 58.** The redirect there is
> `exp://<lan-ip>:8081/--/`, which Google refuses for an installed app. A
> development build is required. That is the SDK's behaviour, not a
> misconfiguration.

Written out click by click as **Phase 4** of `STORE_RELEASE.md`:

- [ ] **(you)** Add that redirect URI to the `solvedblue-staging` OAuth client in
      Google Cloud Console
- [ ] **(you)** Create the iOS OAuth client (bundle `com.spyder.mobile`)
- [ ] **(you)** Create the Android OAuth client (package `com.spyder.mobile` plus
      the signing SHA-1 — comes from EAS credentials, so this waits on P0.4)
- [ ] **(you)** Set the `EXPO_PUBLIC_GOOGLE_*` and `EXPO_PUBLIC_FIREBASE_*`
      values as EAS environment variables, per profile, for staging **and**
      production
- [ ] Set `DEV_BYPASS_AUTH = false` and sign in for real on a device
- [ ] Delete `src/config/devBypass.ts` and its three call sites once green

> `src/auth/useGoogleSignIn.ts` was left alone on purpose. It carries one
> `eslint-disable react-hooks/set-state-in-effect` with the reason written out,
> rather than the obvious rewrite (awaiting `promptAsync()` instead of reacting
> to `response`). Restructuring the one flow in the app that has never run
> against a real Google client, while it is still untestable, is the wrong risk.
> Do that refactor **after** this item is green, not before.

### P0.2 Stop shipping a localhost API URL — **done**

- [x] Remove the `extra.apiUrl` fallback, or set it to the production URL
- [x] Set `EXPO_PUBLIC_API_URL` per EAS build profile (P0.4)

`app.json` now carries `extra.apiUrl: "https://solvedblue.com"`. Set to
production rather than removed: a release build that somehow ships without the
env var then talks to production over HTTPS instead of to the phone itself.

`src/api/client.ts` also stopped treating an empty string as a value. It used
`??`, so `EXPO_PUBLIC_API_URL=` in a `.env` file (which Expo inlines as `""`)
beat the fallback and produced a base URL of `/api`.

### P0.3 Serve the API over HTTPS — **done**

- [x] Point production and preview builds at the HTTPS hostname
- [x] Do **not** add an ATS exemption to work around this

Verified live, not assumed: `https://solvedblue.com/health` and
`https://staging.solvedblue.com/health` both answer 200. The API shares its
origin with the web app — `deploy/nginx/nginx-tls.conf.template` routes `/api/`,
`/ws` and `/health` to the backend on the same `server_name` — so the mobile
app's base URL is the bare origin, exactly as `spyder-web` builds
`${VITE_API_URL}/api` itself.

`eas.json` sets `preview` → `https://staging.solvedblue.com` and `production` →
`https://solvedblue.com`. No ATS exemption anywhere.

> Note for whoever holds the GitHub repository variables: `PROD_API_URL` and
> `STAGING_API_URL` are not committed anywhere, so the two values above come
> from `docs/release-notes/v0.2.0.md` plus the nginx routing. Worth confirming
> with `gh variable list` that the web app agrees.

### P0.4 Create the EAS project and build profiles — **partly done**

- [x] Define the three profiles in `eas.json`
- [x] `npx expo install expo-dev-client expo-updates`
- [x] Set the API URL per profile as an `env` block in `eas.json`
- [ ] Run `eas init` (or `eas build:configure`) to write `projectId` into
      `app.json` and `updates.url`
- [ ] Move the Google and Firebase client ids to **EAS environment variables
      scoped per profile** — they differ between the staging and production
      Firebase projects, and `.env` is gitignored so it never reaches a cloud
      build
- [ ] Run `eas build -p ios` and `eas build -p android` interactively once; that
      first run is what generates credentials, and CI can only work
      non-interactively afterwards

| Profile | Build type | Distribution | API |
| --- | --- | --- | --- |
| `development` | debug + dev client | internal | local `.env` (Metro serves the JS) |
| `preview` | release | internal | `https://staging.solvedblue.com` |
| `production` | release (aab) | store | `https://solvedblue.com` |

`app.json` gained `runtimeVersion: { policy: "fingerprint" }` rather than
`appVersion`. Fingerprint derives the runtime from everything that affects the
native layer, so an OTA update can never land on a build that lacks a native
module it needs — which matters now that notifications and Apple sign-in have
been added. `appVersion` would have relied on remembering to bump a number.

`development` deliberately sets no API URL. A dev-client build embeds no JS
bundle, so its API URL comes from the local `.env` through Metro.

**Still needed, and only you can do these:** Apple Developer Program ($99/year),
Google Play ($25 one-time), an Expo account logged in via `eas login`.

### P0.5 In-app account deletion — **done**

- [x] Backend: `DELETE /account`, with the org-ownership and last-admin rules
      thought through
- [x] Mobile: a destructive, confirmed action on the Account screen
- [x] Decide what deletion means for an org owner with members and live
      campaigns

**The decision**, since the roadmap asked for one. In Spyder the contacts,
conversations and campaigns belong to the *organization*, not to whoever created
them, so deletion branches on who else is in it:

| Situation | What happens |
| --- | --- |
| Only member | The organization goes too, and every row scoped to it. A live Stripe subscription is cancelled first. |
| One of several | The person goes, the organization stays. Their campaigns, workflows and STOP-list entries are handed to the organization's owner. Read receipts and hidden conversations go with them. |
| Last admin, others remain | **Refused** (`last_admin`): promote someone first. |
| Live plan that could not be cancelled | **Refused** (`active_subscription`), with a Manage billing button. |
| Solvedblue staff or the internal org | **Refused** (`staff_account`): removed by the team, not from a phone. |

Lines are never deleted — a `devices` row is a Mac or phone Solvedblue owns, so
it is released to the unassigned pool and taken offline instead.

New files: `services/accountDeletion.ts`, `database/accountDeletionMigration.ts`.
`GET /account/deletion` returns a preview so the confirmation on the Account
screen can name the consequence instead of hedging, and so a refusal reads as an
explanation rather than a button that fails.

The purge introspects every table with an `organization_id` column — the same
trick `orgMembers.organizationIsEmpty` already uses — so a table added later is
covered without anyone remembering this file. It deletes behind savepoints and
retries what a foreign key still blocks, because introspection cannot reveal a
safe order, and abandons the whole transaction rather than half-deleting.

The migration also relaxes two foreign keys that were declared NO ACTION and
would simply have refused `DELETE FROM users`: `admin_audit_log.admin_user_id`
and `provisioning_tokens.created_by`. The audit trail now outlives the account,
with the actor's email written into `details` before the row goes.

- [ ] **Operational follow-up:** a released line still has the customer's Apple
      ID signed in on the physical Mac. The database row is cleared; the
      hardware needs wiping by hand. Worth a God mode checklist.

---

## P1 — Store compliance

### P1.1 Sign in with Apple — **done**

- [x] Add `expo-apple-authentication` plus a `POST /auth/apple` on the backend,
      mirroring how `POST /auth/firebase` resolves a user

Guideline 4.8 requires an equivalent privacy-preserving login option when you
offer third-party sign-in, and Google was the only provider. The exemption for
organisation-provisioned accounts arguably fitted Spyder's invite model, but
reviewers apply it inconsistently, so it was built rather than argued.

Two steps, not Google's three: the backend verifies Apple's identity token
against Apple's published keys itself (`services/appleAuth.ts`), so there is no
Firebase detour. Node's `crypto.createPublicKey({ format: 'jwk' })` turns
Apple's JWK into something `jsonwebtoken` verifies, so no new dependency.

A nonce guards replay: the app generates one, hands Apple its SHA-256, and sends
the original for comparison.

Apple is matched on its `sub` claim before email, because Hide My Email means
the address can change while the person does not —
`database/appleSignInMigration.ts` adds `users.apple_user_id`. A first Apple
sign-in on an email that already has a Google account links the two rather than
creating a second account. Reserved (internal and platform-admin) emails are
refused and pointed at Google, the same rule `/login` enforces.

- [ ] Set `APPLE_BUNDLE_IDS` in the backend env if the accepted audience is ever
      anything other than `com.spyder.mobile` (that is the default)
- [ ] The **Sign In with Apple** capability is enabled by EAS from
      `ios.usesAppleSignIn`, so it lands with the first iOS build (P0.4)

### P1.2 A working reviewer account — **specified, needs the account**

App Review needs credentials that work. With Google and Apple sign-in they need
a real account you control.

The backend has `passwordLoginAllowed()` gated behind `ALLOW_PASSWORD_LOGIN`,
which the sandbox uses, but this app has no password form — so that path is
unreachable from a phone. A real Google account is the only option.

- [x] Work out what the account has to look like — see *Reviewer account* in
      `STORE_RELEASE.md`
- [ ] **(you)** Seed a dedicated Google account with demo data
- [ ] **(you)** Make that organisation **billing-exempt or on `none` status**, so
      a reviewer poking at Delete account cannot hit the `active_subscription`
      refusal
- [ ] **(you)** Give it **a second member**

The second member is the non-obvious one, and it is why this needed specifying
rather than just doing. With one member, a reviewer who tests Delete account
purges the whole demo organisation and the next reviewer gets an empty app. With
two, deletion takes the hand-over branch, the demo data survives, and
re-inviting the address makes the account reusable.

### P1.3 Privacy declarations — **drafted; the manifest is done**

- [x] **Apple privacy manifest.** `app.json` → `ios.privacyManifests` is filled
      in, with the union of every `PrivacyInfo.xcprivacy` shipped by the
      installed dependencies: FileTimestamp (`C617.1`, `0A2A.1`, `3B52.1`),
      UserDefaults (`CA92.1`), DiskSpace (`E174.1`, `85F4.1`) and SystemBootTime
      (`35F9.1`). Apple does not reliably parse those out of static CocoaPods,
      so they have to be repeated in the app's own manifest.
- [x] Work out what the app actually collects, by reading the code rather than
      guessing, and map it to both forms — see `STORE_RELEASE.md`
- [x] `expo-updates`' own declarations folded into that mapping
- [ ] **(you)** Paste the App Store nutrition labels into App Store Connect
- [ ] **(you)** Paste the Data safety answers into Play Console
- [ ] **(you)** Confirm the account-deletion URL Play asks for is reachable

Two findings worth keeping, because the obvious answer is wrong in both cases:

**Device ID has to be declared as linked to identity.** Expo's guidance says
their client ID is unlinked, which is true of it — but this app also sends the
Expo **push token together with the signed-in user** to
`POST /account/push-tokens`. That makes the category as a whole linked.

**The customer's contact lists are not Apple's "Contacts" data type.** That type
means the device address book, and this app never touches it — `expo-contacts`
is not a dependency and no contacts permission is requested. They go under
*User Content → Other User Content*. Being able to say that plainly is also
useful for P1.4.

### P1.4 Pre-empt the content-policy review — **written**

This is bulk SMS and iMessage outreach tooling. Both stores scrutinise anything
that could facilitate spam.

The enforcement already exists server-side in
`spyder-backend/src/services/sendingRules.ts` (quiet hours 9:00–19:30, stop
after two unanswered follow-ups) along with opt-out handling.

- [x] Review notes written, leading with the consent model, opt-out handling and
      quiet hours, pointing at the enforced behaviour rather than at a policy
      promise — ready to paste, in `STORE_RELEASE.md`
- [ ] **(you)** Paste them into both consoles

> These notes cite specific enforced numbers. If quiet hours or the follow-up
> limit change in `sendingRules.ts`, the notes become false, and a false review
> note discovered on a later submission costs far more than an honest one.

---

## P2 — Push notifications

### P2.1 Backend: device tokens and sending — **done**

- [x] A device-token table keyed by user and organisation
- [x] `POST /account/push-tokens` and a matching delete
- [x] Send to `https://exp.host/--/api/v2/push/send` wherever `broadcast()`
      already fires

`database/pushTokensMigration.ts` creates `push_tokens`, a new table rather than
a column on `devices`: `devices.firebase_device_id` is a **fleet relay phone**,
hardware that sends, while a row here is a customer's handset that only
receives.

The token is the key, not the person, so signing in on a shared phone moves the
row and the previous user's replies stop arriving on it.

`services/pushNotifications.ts` sends in batches of 100, retires tokens Expo
reports as `DeviceNotRegistered`, and never throws into its caller — a reply
that is safely stored must not be rolled back because a notification failed.
Hooked in next to `broadcast()` at **both** reply paths:
`firebaseReplyWatcher.ts` and `routes/devices.ts` (the relay webhook, which the
original audit missed).

`EXPO_ACCESS_TOKEN` is read if set, for Expo's enhanced push security. Optional.

### P2.2 Mobile client — **done**

- [x] Add `expo-notifications` to the `plugins` array in `app.json`
- [x] Request permission, and handle refusal without breaking the inbox
- [x] Read `projectId` from `Constants.expoConfig.extra.eas.projectId`
- [x] Register the token on sign-in, drop it on sign-out
- [x] Deep-link a notification tap into `app/chat/[phone].tsx`

`src/notifications/push.ts` and `usePushNotifications.ts`. Every path fails
quietly: a refused permission, Expo Go (which dropped remote push in SDK 53), a
missing `projectId`, an emulator without Play services — all of them leave the
inbox polling exactly as before.

Registration is keyed on the signed-in user rather than run once, so switching
accounts moves the token. Both the live tap and the cold-start tap are handled;
the second delivers no event, so `getLastNotificationResponseAsync` is read once
at startup.

The foreground handler shows no banner. If you are already looking at the inbox,
a card sliding over it tells you nothing the list is about to show; the badge,
the sound and the notification list still fire.

> This will stay silently off until `eas init` writes the `projectId` (P0.4).
> That is by design, not a bug, but it does mean **push is untested** — it
> cannot be exercised without a development build.

### P2.3 Credentials — **not started (needs the accounts)**

- [ ] **(you)** Android: FCM V1 service account key
- [ ] **(you)** iOS: APNs key (needs the paid Apple account from P0.4). EAS
      offers to generate it on the first interactive iOS build; say yes.

Both are Phase 3 of `STORE_RELEASE.md`, with the console paths written out. One
thing to get right: use the **production** Firebase project's service account
for the production build and the staging one for preview. A token minted by one
project cannot be sent to by the other, and the failure is silent.

---

## P3 — Cheap parity wins

- [x] **Inbox folders and actions.** `app/(tabs)/inbox.tsx` now has the five
      folder chips with the server's own counts, and a long press opens an
      action sheet: Close/Reopen, Flag/Unflag, and Assign to me/Unassign where
      the plan includes `team_inbox`. It stays on `all` by default rather than
      `needs_reply`, because the tab badge counts unread across everything —
      opening on a narrower folder would let you tap a badge and land on a list
      that does not contain the thread it counted. Full member-picking for
      assignment stays on the web; "assign to me" is the phone case.
- [x] **Campaign metrics.** `app/campaigns/[id].tsx`, reached by tapping a
      campaign's name. Reply rate as a bar first, then the counts, then a
      per-channel breakdown that only lists channels the campaign actually used.
      Polls every 30s while the campaign is `active` and not at all once it is
      not. Recipients are capped at the first 50.
- [x] **Contact detail and edit.** `app/contacts/[id].tsx`. Tapping a contact
      now opens the contact rather than the conversation — the conversation is
      one button away there, and a contact with only an email address is
      reachable at all, where that row used to be `disabled` and did nothing.
      Needed one small backend addition: `GET /contacts/:id`, reusing
      `getContactsByIds` so the tenant scoping is the existing one.
- [x] **Fix the contradictory empty state.** `app/(tabs)/contacts.tsx` no longer
      tells an empty list to use the web app while an Import button sits above
      it, and now says something different per filter.
- [x] **Update `README.md`.** Rewritten. The three wrong claims are gone:
      campaign authoring and contact import are no longer listed as absent (both
      exist), `(auth)/sign-in.tsx` is described as Google and Apple rather than
      "email and password", and the Layout tree now matches the actual 19 routes
      and `src/notifications/`. Added what was missing rather than wrong: that
      Expo Go cannot exercise Apple sign-in or push, the `expo export`-before-
      `tsc` ordering and why, where each kind of configuration belongs, and the
      three workflows.

---

## P4 — Real-time (optional once P2 ships)

Unchanged, and now genuinely optional: with push in place this is an
optimisation (instant updates while foregrounded), not a necessity.

The websocket already exists and needs **no backend change** to serve mobile:
`authenticateSocketToken` in `spyder-backend/src/services/wsServer.ts` accepts a
Spyder JWT, which is exactly what this app holds in SecureStore.

1. The connection needs both a `token` and a `serviceToken` query param.
2. `SERVICE_WS_TOKEN` defaults to `spyder-service-token-default`. Baking a
   shared secret into a mobile binary is materially worse than baking it into a
   web bundle. **Decide deliberately** — preferably gate mobile on the JWT
   alone rather than shipping that token.

- [ ] Decide the `serviceToken` question
- [ ] Add a `useWebSocket` equivalent, mirroring
      `spyder-web/src/hooks/useWebSocket.ts`
- [ ] Invalidate the inbox and chat queries on `new_reply` instead of polling

> **Deliberately not built on 2026-11-11, and this is the reason.** The only way
> to implement it as the websocket stands today is to bake `SERVICE_WS_TOKEN`
> into the app binary. A mobile binary is trivially unpacked, and unlike a web
> bundle it sits on the device indefinitely, so that would be a real security
> regression traded for an optimisation that push notifications have already
> made unnecessary. The right fix is a small backend change — accept a Spyder
> JWT alone from a mobile client — and that is a decision about the backend's
> trust model, not a mobile task. Left for whoever owns that call.

---

## P5 — Deliberately out of scope

Not worth building on a phone. Recording them so the decision is not
relitigated:

- The seven `/admin/*` pages (overview, customers, setting-up, lines, alerts,
  audit, queues/system)
- The workflow canvas builder. `src/utils/workflowSteps.ts` already degrades
  gracefully: a branching workflow reports it "can only be edited on the web"
- Webhook management, queue and system monitoring, property matching
- Sending from the user's own SIM on iOS — there is no programmatic SMS API, so
  this is impossible rather than unbuilt
- Full member-picking when assigning a conversation (see P3)

---

## P6 — Pipeline

This repo is separate from the `Spyder` monorepo, so there is no collision with
the monorepo's `v*` production deploy tag. It now has a `.github/workflows`
directory with three files:

| Workflow | Trigger | Does |
| --- | --- | --- |
| `ci.yml` | pull request, push to main | typecheck, lint, bundle |
| `update.yml` | push to main; manual | OTA: `preview` automatically, `production` by hand |
| `release.yml` | manual only | `eas build`, optionally `--auto-submit` |

### P6.4 Testing against staging, and the API reference — **done**

Added because "see the app on iOS" turned out to need a build profile that did
not exist.

- [x] **A `staging` build profile.** `preview` cannot reach TestFlight:
      Expo's *internal distribution* is an ad-hoc build locked to device UDIDs,
      while TestFlight *internal testing* requires `distribution: store`. The
      two names sound identical and mean different things. `staging` extends
      `preview`, keeping the staging API and the `preview` update channel, and
      switches to store distribution. `eas.json` gained a matching `submit`
      profile so `--auto-submit` has something to use.
- [x] `release.yml` offers it, and now refuses `submit` only for `preview`
      (which genuinely cannot be submitted) rather than for everything that is
      not production.
- [x] **`spyder-backend/swagger.yaml` documents the mobile surface.** It had 29
      paths and none of the mobile endpoints; it now has 48. Added: account,
      deletion, push tokens, API keys, inbox and its actions, contacts
      (including the new `GET /contacts/:id`), home, lines, and
      `POST /auth/apple`. The placeholder `https://your-tunnel-url` server was
      replaced with staging and production, so the Servers dropdown switches
      environments.
- [x] Verified the spec with `swagger-parser`: valid, 48 paths, 39 schemas, all
      `$ref`s resolve. Worth knowing — `src/index.ts` loads the YAML inside a
      `try` and **logs a warning and boots anyway** if it fails, so a broken
      spec silently removes the docs rather than failing loudly.
- [x] Checked every documented route against the real router, which caught two
      wrong status codes: revoking an API key returns `200 {revoked:true}` not
      `204`, and `POST /contacts` returns **201 on create but 200 when it merges
      an existing contact with the same key**.

`https://staging.solvedblue.com/api-docs/` and the production equivalent were
already live and already proxied by nginx, so none of this needed a deploy
change — only a corrected `swagger.yaml`.

> **A trade-off left open.** `staging` uses the same bundle id as production, so
> both TestFlight builds live under one App Store Connect record, told apart
> only by build number and the "What to Test" note. A separate
> `com.spyder.mobile.staging` id would make them impossible to confuse but
> doubles the credential setup (its own OAuth clients, APNs key and app record).
> Revisit if a tester ever acts on staging data by mistake.

### P6.1 CI gate — **done, except making it required**

- [x] Clear the three pre-existing lint errors in `app/_layout.tsx`,
      `app/(tabs)/_layout.tsx` and `src/auth/useGoogleSignIn.ts`
- [x] `.github/workflows/ci.yml` running `npx tsc --noEmit` and `npx expo lint`
- [x] Add `npx expo export --platform ios` — it catches bundling errors that
      typecheck misses
- [x] `npx expo-doctor` as a separate advisory job, time-boxed
- [ ] **(you)** Make the `check` job required in branch protection for `main`,
      or the gate is advisory only

The lint fixes: `app/_layout.tsx` uses a ref instead of state for the
hydration-started flag (nothing renders differently, so state was wrong anyway),
`app/(tabs)/_layout.tsx` names the tab-icon component, and
`src/auth/useGoogleSignIn.ts` carries a justified disable with the reasoning
written out (see P0.1). `expo lint` is now **0 errors**, with one warning left:
`import/no-named-as-default-member` on `axios.create`, which is a false positive
on the documented axios API.

The workflow mirrors `Spyder/.github/workflows/ci.yml`: Node 22, `npm ci`,
typecheck as the merge gate, `actions/checkout@v4` and `setup-node@v4` for
consistency with the monorepo even though the Expo docs now show v5/v6.

The ordering note from the audit **turned out to be right, and was verified
rather than assumed.** `expo export` does regenerate `.expo/types/router.d.ts`
and `expo-env.d.ts`, so it runs before `tsc` and the gate typechecks against
real route types instead of a permissive `Href`. Worth knowing: the typed-routes
documentation recommends `npx expo customize tsconfig.json` for exactly this
purpose on CI, and on SDK 58 **it does not regenerate either file** — tested by
deleting both and running it. `expo export` is the only thing that works.

`expo-doctor` is a separate job with `continue-on-error` and a 10-minute cap,
and it **must stay advisory**. It compares installed packages against the newest
patch releases in the registries, and Expo ships patches most weeks, so it goes
red on its own with no commit involved. Gating merges on that teaches people to
ignore red crosses.

> **The "15 minute hang" is solved: it was never slow.** `npx expo-doctor` stops
> to ask *"Need to install expo-doctor@x. Ok to proceed?"* and waits for a
> keypress. CI only got away with it because npx auto-confirms when stdout is
> not a TTY. The workflow now runs `npx --yes expo-doctor`, and locally that
> finishes in seconds.

**It paid for itself on the first CI run**, catching three things that tsc, lint
and the bundler are all blind to:

1. **`react-native-worklets` was missing**, a required peer of
   react-native-reanimated 4.x. Expo's own warning: *"Your app may crash outside
   of Expo Go without this dependency."* That is every real build — exactly the
   development build being prepared. The most valuable find of the three.
2. **`newArchEnabled` is no longer in the SDK 58 schema.** The new architecture
   is the default; the field is now rejected.
3. **Top-level `splash` is no longer in the schema either.** It moved into the
   `expo-splash-screen` plugin's options, which is where it now lives.

Plus 15 packages a patch version behind, fixed with `npx expo install --fix`.
`expo-doctor` is now **18/18, no issues**.

### P6.2 Build and submit — **written, needs the token**

`.github/workflows/release.yml`. Deliberately `workflow_dispatch` only: a build
costs money and a submission is hard to take back, so neither happens because
someone merged a pull request.

```bash
gh workflow run release.yml -f profile=production -f platform=all -f submit=true
```

- [x] The workflow, with inputs for platform, profile, submit and wait
- [x] It re-runs the CI gate first, because a release can be cut from a commit
      that never went through a pull request
- [x] It refuses `submit=true` on any profile but `production` — submitting a
      preview build would ship the staging API URL to real customers
- [x] It fails with instructions when `EXPO_TOKEN` is absent, rather than
      skipping, because someone pressed the button on purpose
- [ ] **(you)** Store a personal access token as the `EXPO_TOKEN` secret
- [ ] Optionally add the ASC API key env vars so CI can repair iOS credentials
      (`EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`,
      `EXPO_APPLE_TEAM_ID`, `EXPO_APPLE_TEAM_TYPE`)
- [ ] **(you)** Run `eas submit` once interactively. `eas.json`'s
      `submit.production` is empty, so the first run prompts for the App Store
      Connect app id and the Play service account.

Submission uses `--auto-submit` on the build rather than a separate `eas submit`
step, so the hand-off happens on Expo's servers and does not depend on the
runner still being alive.

### P6.3 Over-the-air updates — **written, needs the token**

`eas update` ships JS-only fixes without a review cycle. This is the single
biggest operational win available, and `expo-updates` is installed.

- [x] `expo-updates` installed, `runtimeVersion` set to the fingerprint policy
- [x] Each build profile declares its `channel` (`development`, `preview`,
      `production`)
- [x] `.github/workflows/update.yml`
- [x] **The policy, decided.** `preview` publishes automatically on every push
      to `main`; `production` is manual. An update reaching customers in seconds
      with no review in the way should be a deliberate act, and `preview` is
      internal distribution so its audience is the team.
- [x] It runs the full CI gate first. An update bypasses store review, so it
      also bypasses every other chance to catch a bundle that crashes on launch.
- [x] It sets `EXPO_PUBLIC_API_URL` per channel. `eas update` does not read the
      `env` blocks in `eas.json`, so without this a production update would
      silently repoint the app at staging — a very hard failure to notice.
- [x] It **skips** rather than fails when `EXPO_TOKEN` is absent, the opposite
      of `release.yml`. A red cross on every push to `main` for something that
      cannot work yet trains people to ignore red crosses.
- [ ] Run `eas update:configure` so `updates.url` exists (comes with `eas init`)

> Naming: EAS Build, Submit and Update are now **Expo** Build, Submit and
> Update. The services are unchanged and the `eas` commands and `eas.json` keep
> their names.

---

## Sequencing

| Order | Work | Depends on | State |
| --- | --- | --- | --- |
| 1 | P0.2, P0.3 — config | — | done |
| 2 | P0.5 + P1.1 + P2.1 + P2.2 + P3 — the engineering | — | done |
| 3 | `eas login` and `eas init` — unblocks everything below | an Expo account | **next** |
| 4 | P6 — the pipeline, and the store paperwork drafted | — | done |
| 5 | Tests for `accountDeletion.ts` | — | done |
| 6 | P0.4 — first interactive build per platform | Apple + Play accounts | |
| 7 | P0.1 — Google OAuth (needs the Android SHA-1) | P0.4 | |
| 8 | P2.3 — push credentials | P0.4 | |
| 9 | P1.2, P1.3, P1.4 — paste the paperwork, seed the reviewer account | P0.4 | |
| 10 | P4 real-time | the `serviceToken` decision | optional |

**Nothing in this repo is blocking any more.** Every remaining item is a
**(you)** step in `STORE_RELEASE.md` — an account, a console, a credential — or
depends on one. The three things written but unverifiable until a device is in
hand are unchanged: Google sign-in, Apple sign-in and push notifications.

## What has been verified, and how

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (mobile) | clean |
| `npx expo lint` | 0 errors, 1 pre-existing false-positive warning |
| `npx expo export --platform ios` | bundles, 5.5 MB — exercises every new native import |
| `npx expo config` | resolves, including the new `ios.privacyManifests` |
| `.github/workflows/*.yml` | all three parse; every command in `ci.yml` was run locally |
| `npx tsc --noEmit` (backend) | clean |
| `npx vitest run` (backend) | 883 passed, 72 files |
| `npx vitest run test/accountDeletion.test.ts` | 29 passed |
| `https://solvedblue.com/health` | 200 |
| `https://staging.solvedblue.com/health` | 200 |

- [x] **Tests for `services/accountDeletion.ts` against a real Postgres.**
      `spyder-backend/test/accountDeletion.test.ts`, 29 tests. All five cases
      the audit asked for (sole member purges the org, member hands over, last
      admin refused, staff account refused, released line keeps its row) plus
      the Stripe paths, the successor ordering, the leftovers that would outlive
      the account, and the 409 mapping over HTTP.

Two things that test found worth recording. The **savepoint retry loop is now
genuinely exercised**, not just present: the test creates two org-scoped tables
with a foreign key between them and the log confirms a deferral
(`Deferring purge of t_purge_parent … violates foreign key constraint`) before
the retry clears it. And the table **introspection is covered the same way** —
tables created inside the test are purged without being named anywhere, which is
the property that makes a table added next year safe.

> One flake to know about, pre-existing and not related to any of this.
> `test/lineQueues.test.ts > two workers on one line queue > send at most one
> job per gap` asserts wall-clock gaps of ≥190 ms and failed once at 137 ms
> under load, then passed alone and passed on a full re-run. It is a timing
> assertion on a loaded machine. Worth making tolerant before the monorepo's CI
> starts failing on it intermittently.

Still not verified, and not verifiable from here: anything needing a device or a
signed build. The **mobile** account-deletion screen, Apple sign-in and push
notifications have never been run. The backend suite passing means nothing
regressed and that deletion itself now behaves — not that the screens work.
