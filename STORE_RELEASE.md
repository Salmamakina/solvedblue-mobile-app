# Shipping Spyder Mobile to the App Store and Play Store

Everything the app needs to reach both stores, in the order it has to happen.

`ROADMAP.md` records *what* is left and why. This file is the *how*: the exact
console clicks, the exact values to paste, and the review paperwork written out
so it can be copied rather than composed under time pressure.

The engineering is done. What is left is accounts, credentials and declarations.
Steps marked **(you)** cannot be done from a keyboard by an agent — they need a
browser session on an account only you can log into.

## The facts you will be asked for, in one place

| Field | Value |
| --- | --- |
| App name | Spyder |
| iOS bundle identifier | `com.spyder.mobile` |
| Android package | `com.spyder.mobile` |
| Expo slug | `spyder-mobile-app` |
| Expo account | `solvedblue-app` |
| URL scheme | `spyder` |
| Expo auth redirect URI | `https://auth.expo.io/@solvedblue-app/spyder-mobile-app` |
| Production API | `https://solvedblue.com` |
| Staging API | `https://staging.solvedblue.com` |
| Update channels | `development`, `preview`, `production` |
| Support / privacy URL | confirm before submitting — the store listing needs a reachable privacy policy URL |

---

## Phase 1 — Accounts (blocks everything)

- [ ] **(you)** **Apple Developer Program**, $99/year, at
      <https://developer.apple.com/programs/>. Enrolment as an organisation needs
      a D-U-N-S number and can take days to over a week. **Start this first**;
      it is the longest lead time in this document.
- [ ] **(you)** **Google Play Developer**, $25 one-time, at
      <https://play.google.com/console/signup>. Identity verification is also
      required and also takes days.
- [ ] **(you)** **Expo account**, free. `eas login`.

> **Register the Play account as an organisation, not as an individual.** A
> **personal** Play account created after 13 November 2023 must run a closed test
> with at least 12 testers opted in continuously for 14 days before it can even
> apply for production access. Organisation accounts are not subject to that
> requirement. Picking the wrong account type here adds two weeks and a scramble
> to find twelve real testers.
>
> An organisation account needs a D-U-N-S number, the same as Apple. If you have
> to go personal, start recruiting testers on day one — see
> [Google's testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

## Phase 2 — Create the Expo project

```bash
cd spyder-mobile-app
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init` writes `extra.eas.projectId` into `app.json`. Commit that.

- [ ] **(you)** Run the two commands above
- [ ] Commit the `projectId` change
- [ ] Confirm `npx eas-cli@latest update:configure` has added `updates.url` to
      `app.json` (`eas init` usually does this; run it if `updates.url` is absent)

**Push notifications start working at this point and not before.** `push.ts`
reads the `projectId` and returns `{ status: 'unavailable' }` without one, by
design. Nothing to change — it simply begins registering tokens.

## Phase 3 — The first build per platform, interactively

This is the step that generates credentials. **It must be run interactively
once per platform**; CI can reuse credentials but can never create them.

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

Answer **yes** when EAS offers to generate:

| Prompt | Answer | Why |
| --- | --- | --- |
| Generate a new Apple Distribution Certificate? | yes | signing |
| Generate a new Apple Provisioning Profile? | yes | signing |
| Set up Push Notifications (APNs key)? | **yes** | this is P2.3 for iOS, done here |
| Generate a new Android Keystore? | yes | **EAS now holds the only copy** |

- [ ] **(you)** iOS development build
- [ ] **(you)** Android development build
- [ ] **(you)** Back up the Android keystore:
      `npx eas-cli@latest credentials` → Android → download. **Losing it means
      you can never update the app under the same package name again.** Put it
      somewhere that is not one laptop.
- [ ] **(you)** Note the Android signing **SHA-1** from the same screen — Phase 4
      needs it.
- [ ] Install both builds on a real device and confirm the app launches

### FCM for Android push (P2.3)

APNs is handled above. Android needs a Firebase service account key:

- [ ] **(you)** Firebase console → the project the backend verifies against →
      Project settings → Service accounts → **Generate new private key**
- [ ] **(you)** `npx eas-cli@latest credentials` → Android → **FCM V1 service
      account key** → upload that JSON

> Use the **production** Firebase project for the production build and the
> staging one for preview. A token minted by one project cannot be sent to by
> the other, and the failure is silent.

## Phase 3b — Seeing the app on iOS, from Windows, against staging

You have no Mac, so **the iOS Simulator is not an option** — it only runs on
macOS. Everything below works from Windows, because EAS builds on its own macOS
machines.

Three ways onto an iPhone, and the names are confusingly similar:

| Route | Profile | Who can install | Cost of adding a person |
| --- | --- | --- | --- |
| **Development build** | `development` | registered devices only | register the UDID, then rebuild |
| **Internal distribution** (ad-hoc) | `preview` | registered devices only | register the UDID, then rebuild |
| **TestFlight internal testing** | `staging` | up to 100 App Store Connect team members | add their email, no rebuild |

> **"Internal distribution" is not "internal testing."** Expo's internal
> distribution produces an ad-hoc build installed from a URL and locked to
> device UDIDs you registered in advance. TestFlight internal testing needs
> `"distribution": "store"` and goes through Apple. That is exactly why the
> `staging` profile exists in `eas.json` and `preview` was not enough.

### Recommended: the `staging` profile → TestFlight

`staging` extends `preview`, so it keeps the staging API URL and the `preview`
update channel, but switches to `distribution: store` so it can be submitted.

```bash
npx eas-cli@latest build --platform ios --profile staging --auto-submit
```

- [ ] **(you)** Run that once
- [ ] **(you)** Wait for Apple to finish processing (usually 5–10 minutes; they
      email you)
- [ ] **(you)** App Store Connect → your app → **TestFlight** → **+** next to
      **Internal Testing** → create a group → add testers by email
- [ ] **(you)** Testers install the **TestFlight** app from the App Store, tap
      the invite link, and the app appears there

Internal testing needs **no Beta App Review**, so the build is available as soon
as processing finishes. External testing (up to 10,000 testers, shareable link)
does need review on the first build of each version — only set that up if you
need people outside the team.

A TestFlight build **expires 90 days** after upload. Plan to rebuild.

### Android is much easier

`preview` already produces an installable APK:

```bash
npx eas-cli@latest build --platform android --profile preview
```

EAS gives you a URL and a QR code; anyone can install it directly, with no
account, no registration and no review. Use this for quick checks, and
`staging` (an `.aab` to the Play internal track) when you want it alongside the
iOS build.

### One trade-off I did not decide for you

The `staging` profile uses the **same bundle id** as production,
`com.spyder.mobile`. So staging and production TestFlight builds live under one
App Store Connect record and are told apart only by build number and the
"What to Test" note. Use `--what-to-test` to make that unambiguous:

```bash
npx eas-cli@latest submit --platform ios --profile staging \
  --groups "QA" --what-to-test "Points at STAGING. Not production data."
```

The cleaner alternative is a separate bundle id such as
`com.spyder.mobile.staging`, which would make the two impossible to confuse —
but it doubles the credential setup: its own OAuth clients, its own APNs key,
its own Apple app record. Not worth it for one app with a small team, but worth
revisiting if testers ever act on staging data by mistake.

### Driving the API directly while you test

Swagger UI is already live and needs no deploy:

| Environment | URL |
| --- | --- |
| Staging | <https://staging.solvedblue.com/api-docs/> |
| Production | <https://solvedblue.com/api-docs/> |

Pick the environment from the **Servers** dropdown. `swagger.yaml` now documents
**the mobile app's entire surface** — account, deletion, push tokens, inbox,
contacts, home, lines and `POST /auth/apple` — so anything the app does can be
reproduced and inspected there.

To authorise: sign in to the staging web app, copy the JWT from DevTools →
Application → Local Storage, then click **Authorize** in Swagger and paste it.
The app holds the same kind of token in SecureStore.

> **Use staging.** Try it out issues real requests, and `DELETE /api/account`
> really does delete an account.

## Phase 4 — Google sign-in (P0.1): the last code change

Sign-in has never run end to end. Every screen was built against the injected
session in `src/config/devBypass.ts`. This phase is where that gets fixed, and
it needs the SHA-1 from Phase 3.

> **Correction, 2026-11-11.** Earlier versions of this file and the comment in
> `devBypass.ts` said the fix was to authorise
> `https://auth.expo.io/@solvedblue-app/spyder-mobile-app` as a redirect URI.
> **That was wrong**, and following it would have wasted an afternoon.
>
> The Expo auth proxy is legacy and `expo-auth-session@58` does not use it. On a
> real build the redirect URI is `com.spyder.mobile:/oauthredirect`, derived
> from the application id — see `makeRedirectUri` in
> `node_modules/expo-auth-session/build/AuthSession.js`, which returns the
> `native` value whenever the execution environment is not Expo Go.
>
> **There is nothing to paste into a redirect-URI box.** Only *Web* OAuth
> clients have that field. iOS clients are matched on bundle id and Android
> clients on package name plus SHA-1, so creating the clients *is* the
> configuration.
>
> Two things were genuinely wrong and are now fixed in code: the app claimed
> only the `spyder` URL scheme (so the redirect had nowhere to land — app.json
> now claims `com.spyder.mobile` too), and an empty `EXPO_PUBLIC_*` client id
> was being passed to Google as `""` rather than treated as absent.

In **Google Cloud Console → APIs & Services → Credentials**, for the project the
backend verifies against (`solvedblue-staging` for dev and preview):

- [ ] **(you)** Create an **iOS** OAuth client — application type *iOS*, bundle
      id `com.spyder.mobile`. No redirect URI to set.
- [ ] **(you)** Create an **Android** OAuth client — application type *Android*,
      package `com.spyder.mobile`, SHA-1 from Phase 3. No redirect URI to set.
- [ ] **(you)** Copy the existing **Web** client id too. It is the fallback and
      the browser path; it already exists because the web app uses it.
- [ ] **(you)** Repeat for the **production** Google project

> **Google sign-in cannot be tested in Expo Go.** There the redirect becomes
> `exp://<lan-ip>:8081/--/`, which Google refuses for an installed app. Use the
> development build from Phase 3. This is a property of the SDK, not a
> misconfiguration — do not spend time trying to make Expo Go work.

Then wire them in. These are per-environment, and `.env` never reaches a cloud
build, so they belong in **EAS environment variables scoped per profile** rather
than in `eas.json`:

```bash
npx eas-cli@latest env:create --scope project --environment preview \
  --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value '<staging web client id>'
# repeat for IOS/ANDROID client ids and the four EXPO_PUBLIC_FIREBASE_* values,
# then again with --environment production and the production project's values
```

- [ ] **(you)** Set all seven `EXPO_PUBLIC_GOOGLE_*` / `EXPO_PUBLIC_FIREBASE_*`
      variables for **preview** and for **production**
- [ ] Set `DEV_BYPASS_AUTH = false` in `src/config/devBypass.ts`, rebuild, and
      **sign in for real on a device with both Google and Apple**
- [ ] Once both work: delete `src/config/devBypass.ts` and its three call sites
- [ ] Then, and only then, do the `useGoogleSignIn.ts` refactor the roadmap
      defers — await `promptAsync()` instead of reacting to `response`, and drop
      the `eslint-disable`. Doing it before sign-in works would mean rewriting an
      untestable flow blind.

## Phase 5 — Store listings and review paperwork

- [ ] **(you)** App Store Connect → create the app record, bundle
      `com.spyder.mobile`
- [ ] **(you)** Play Console → create the app, package `com.spyder.mobile`
- [ ] Fill in the privacy declarations below
- [ ] Paste the review notes below
- [ ] Create the reviewer account below

## Phase 6 — Submit

```bash
gh workflow run release.yml -f profile=production -f platform=all -f submit=true
```

- [ ] **(you)** Add an `EXPO_TOKEN` repository secret from
      <https://expo.dev/settings/access-tokens>, so CI can build
- [ ] **(you)** Make the `check` job of `ci.yml` **required** in branch
      protection for `main`, or the gate is advisory only
- [ ] First `eas submit` run prompts for the App Store Connect app id and a Play
      service account JSON; `eas.json`'s `submit.production` is empty and gets
      filled from those answers. Run it once interactively before relying on the
      workflow.

---

# Privacy declarations (P1.3)

**You are responsible for the accuracy of these.** What follows is a mapping
derived from reading the code, with the two genuine judgment calls flagged.

## What this app actually collects

| Data | Where it comes from | Where it goes |
| --- | --- | --- |
| Email address | The Google or Apple sign-in token | Stored as `users.email`. It is the only profile field the backend keeps — `INSERT INTO users` writes `email` and a placeholder password hash, plus `apple_user_id` for Apple. No name and no profile picture is stored, even when Google's token carries one. |
| The customer's own contact lists: names, phone numbers, email addresses, tags | Typed or imported **by the customer**, about their own business contacts | `contacts`, scoped to the organisation |
| Message and reply content | SMS and iMessage conversations the customer sends and receives | `messages`, `replies` |
| Expo push token + device name | `expo-notifications`, after the permission prompt | `push_tokens`, keyed to the signed-in user |
| Expo client ID, failed-update IDs, launch error text | `expo-updates`, on every update check | Expo, as our service provider |
| Session token, theme preference | Written locally by the app | `expo-secure-store` and local storage on the device only — never leaves it |

**What it does not collect**, which is worth being able to say plainly:

- **No analytics or advertising SDK, and no tracking.** `firebase` is in
  `package.json` for exactly one purpose — exchanging a Google token for a
  Firebase ID token — and `src/config/firebase.ts` sets `inMemoryPersistence`
  and signs the Firebase user out immediately after the exchange.
- **No access to the device address book.** `expo-contacts` is not a dependency.
  The contact lists are business data the customer enters or imports; the app
  never reads the phone's own contacts. Say so if a reviewer asks.
- **No location, camera, microphone, photos, or health data.**
- Apple sign-in requests the **email scope only**, not full name.

## App Store Connect → App Privacy

Answer **Yes, we collect data from this app**.

| Data type | Purposes | Linked to identity | Tracking |
| --- | --- | --- | --- |
| Contact Info → Email Address | App Functionality | **Yes** | No |
| User Content → Other User Content | App Functionality | **Yes** | No |
| Identifiers → Device ID | App Functionality, Analytics | **Yes** | No |
| Diagnostics → Crash Data | App Functionality | No | No |

Two of these deserve an explanation, because the obvious answer is wrong:

- **Device ID is linked**, not unlinked. Expo's own guidance says the
  `expo-updates` client ID is unlinked because it is random and unattached to an
  account — but this app also sends the **Expo push token together with the
  signed-in user** to `POST /account/push-tokens`. That makes a device
  identifier linked to identity, so the honest answer for the category as a
  whole is Yes.
- **The contact lists and message bodies go under User Content → Other User
  Content**, not under Contacts. Apple's *Contacts* type means the device
  address book, which this app never touches. This is the first judgment call;
  it is defensible and worth stating in the review notes so nobody has to guess.

## Play Console → Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share required user data types? | Yes |
| Is all user data encrypted in transit? | Yes — the API is HTTPS only and there is no ATS exemption anywhere |
| Do you provide a way to request data deletion? | **Yes**, and in-app: Account → Delete account |

Data types to select, all **Collected** (not Shared — Expo and our own backend
are service providers, which Play counts as collection), all **Required**, none
processed ephemerally:

| Data type | Why collected |
| --- | --- |
| Personal info → Email address | Account management, App functionality |
| Personal info → Name, Phone number | App functionality — *customer-uploaded contact data* |
| Messages → Other in-app messages | App functionality |
| Device or other IDs | App functionality, Analytics |
| App info and performance → Crash logs | Analytics |

> The second judgment call: Play's form is framed around data about *the app
> user*, and the contact lists are data about the user's **business contacts**.
> Play's policy still expects uploaded personal data to be declared, so they are
> declared here under Name / Phone number with the reason spelled out. Declaring
> more than strictly required is the safe direction; under-declaring is what gets
> an app pulled.

### Account deletion URL

Play's Data safety form asks for a deletion **URL** as well as the in-app route.
Point it at the web app's account page, the same `DELETE /account` endpoint this
app calls.

- [ ] **(you)** Confirm that URL exists and is reachable without signing in to a
      mobile app, then paste it into both consoles

## iOS privacy manifest — already configured

`app.json` → `ios.privacyManifests` is filled in. The values are not guesses:
they are the union of every `PrivacyInfo.xcprivacy` shipped by the installed
dependencies, which Apple does not reliably parse out of static CocoaPods, so
they have to be repeated in the app's own manifest.

| API category | Reasons | Comes from |
| --- | --- | --- |
| FileTimestamp | `C617.1`, `0A2A.1`, `3B52.1` | react-native, RCT-Folly, glog, boost, expo-application, expo-file-system |
| UserDefaults | `CA92.1` | expo-constants, expo-eas-client, expo-notifications, react-native |
| DiskSpace | `E174.1`, `85F4.1` | expo-file-system |
| SystemBootTime | `35F9.1` | react-native (`react/timing`), boost |

Re-run this scan after adding any native dependency:

```powershell
Get-ChildItem node_modules -Recurse -Filter PrivacyInfo.xcprivacy |
  ForEach-Object { Get-Content $_.FullName -Raw }
```

Apple emails within minutes of an upload if a reason is still missing; that
email names exactly what to add.

---

# Reviewer account (P1.2)

App Review has to be able to sign in. The app offers only Google and Apple, and
the backend's `passwordLoginAllowed()` path is gated behind
`ALLOW_PASSWORD_LOGIN` and has **no form in this app**, so it is unreachable
from a phone. A real Google account is therefore required.

- [ ] **(you)** Create a dedicated Google account, e.g.
      `appreview@solvedblue.com`, and keep the password stable
- [ ] **(you)** Invite it into a demo organisation seeded with believable data:
      a handful of contacts, two or three conversations with replies, one
      finished campaign with metrics
- [ ] **(you)** Make that organisation **`billing_exempt = true`**, or put its
      `billing_status` at `none`

That last point is not cosmetic. Apple requires the reviewer to be able to reach
account deletion, and `accountDeletion.ts` refuses with `active_subscription`
when the organisation is the sole member's and still charging. A reviewer who
taps **Delete account** and gets a refusal will read it as a broken requirement
and reject the app. Billing-exempt makes deletion succeed.

- [ ] **(you)** Give the reviewer account an **admin** role, and add a second
      member to the organisation

Why a second member: with one member, deletion purges the whole organisation and
the demo data is gone for the next reviewer. With two, the reviewer's deletion
takes the non-destructive path, hands the campaigns to the owner and leaves the
demo intact. Re-invite the address afterwards and the account is reusable.

- [ ] **(you)** Verify the whole flow on a device with the production build
      before submitting, including Delete account

---

# Review notes to paste (P1.4)

Both stores scrutinise bulk-messaging tools for spam facilitation. Lead with the
consent model and point at enforcement that already exists in code, rather than
at a policy promise.

Paste into **App Review Information → Notes** and **Play Console → App access /
review notes**:

> **What Spyder is.** A business tool for small real-estate and sales teams. It
> is the mobile client for an existing web product; the account, the data and
> the sending hardware all already exist before this app is installed. The app
> is a dashboard and a shared inbox.
>
> **Sign-in.** Google or Apple only. Credentials for a demo account with sample
> data are in the fields above. There is no password form.
>
> **Sending.** Messages are not sent from the reviewer's device or SIM. iOS
> exposes no programmatic SMS API, and this app does not attempt one. Sending
> happens on Mac and Android hardware that Solvedblue owns and operates, driven
> by the backend. On iOS the app only reads and composes.
>
> **Consent and opt-out.** Contacts are the customer's own business contacts,
> uploaded or typed by them. The app never reads the device address book — it
> does not request contacts permission at all. Every recipient can reply STOP;
> the reply is matched server-side and that number is added to a block list that
> survives the deletion of whoever imported it, because the consent decision
> belongs to the recipient, not to a staff member's account.
>
> **Anti-spam limits are enforced by the server, not left to the sender.**
> `sendingRules.ts` applies quiet hours (sending only between 09:00 and 19:30 in
> the organisation's time zone) and stops a sequence after two unanswered
> follow-ups. Per-line daily caps and throttling are applied by the dispatcher.
> A customer cannot raise these from the app.
>
> **Account deletion** is in the app at Account → Delete account, as required by
> guideline 5.1.1(v). It deletes the account and, when that person is the only
> member, the organisation and all of its data, and cancels the subscription
> first. The demo account is billing-exempt so the flow completes.
>
> **Notifications** are used for one thing: telling the user a customer has
> replied. No marketing push.

Keep this in step with the code. If quiet hours or the follow-up limit change in
`sendingRules.ts`, these notes become false, and a false review note found on a
later submission is much more expensive than an honest one.

---

# Known-untested paths

Honest state, so nobody reads a green checkmark as verification:

| Feature | State |
| --- | --- |
| Account deletion | Backend covered by `test/accountDeletion.test.ts` (29 tests, real Postgres). The **mobile screen** has never been run against a real session. |
| Google sign-in | Written, never run end to end. Phase 4 is the first real test. |
| Apple sign-in | Written, never run. Needs a development build and a paid Apple account. |
| Push notifications | Written, silently inert until Phase 2. Needs a development build. |

Verified, and how:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (mobile) | clean |
| `npx expo lint` | 0 errors, 1 known false-positive warning |
| `npx expo export --platform ios` | bundles, 5.5 MB |
| `npx vitest run` (backend) | 883 tests; see ROADMAP for the one timing-sensitive flake |
| `https://solvedblue.com/health` | 200 |

One operational follow-up that no store asks about but a customer would: when a
line is released by account deletion, the `devices` row is cleared but the
physical Mac still has the customer's Apple ID signed in on it. **The hardware
needs wiping by hand.** Worth a God-mode checklist item.
