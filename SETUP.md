# Setup, from nothing to both stores

Follow this top to bottom. Every command is copy-pasteable. Where a step needs
a browser or a paid account, it says so.

**Where to run each part:**

| Part | Machine |
| --- | --- |
| 1–3 GitHub, secrets, branches | Windows (this machine) |
| 4–6 Mac mini setup and running iOS | Mac mini |
| 7 TestFlight | Mac mini + App Store Connect |
| 8 Deployment | either |

---

# Part 1 — Put the code on GitHub

Run from `D:\spyder-mobile-app`.

### 1.1 Check what you are about to commit

```powershell
git status --short
```

You should see roughly 56 files. **`.env` must NOT appear in that list** — it
holds your Firebase keys. Confirm it is ignored:

```powershell
git check-ignore -v .env credentials.json
```

Both must print a `.gitignore` line. If `.env` is missing from that output,
**stop** and tell me before pushing.

### 1.2 Commit everything

```powershell
git add -A
git commit -m "Mobile app: account deletion, Apple sign-in, push, CI/CD and store docs"
```

### 1.3 Create the private repo and push

`gh` is already installed on this machine.

```powershell
gh auth login
gh repo create spyder-mobile-app --private --source=. --remote=origin --push
```

That creates the repo, adds it as `origin`, and pushes `main` in one go.

### 1.4 Create the `staging` branch

```powershell
git checkout -b staging
git push -u origin staging
git checkout main
```

You now have two branches, and this is what each one means:

| Branch | Meaning | What happens on push |
| --- | --- | --- |
| `staging` | what testers get | CI runs, **and an OTA update publishes to the `preview` channel** |
| `main` | what customers get | CI runs. Nothing ships — releasing is a separate, deliberate act |

Same model as the backend monorepo: pushing to `staging` ships staging,
production is never a branch head moving on its own.

### 1.5 Day-to-day flow

```
feature branch  ->  PR into staging  ->  test on TestFlight / Play internal
                ->  PR staging into main  ->  release to the stores
```

---

# Part 2 — Secrets and branch protection

### 2.1 The Expo token

1. Open <https://expo.dev/settings/access-tokens>
2. **Create token**, copy it
3. Then:

```powershell
gh secret set EXPO_TOKEN
# paste the token when prompted
```

Until this exists, `release.yml` fails with instructions and `update.yml` skips
cleanly. Nothing breaks; it just cannot ship.

### 2.2 Protect the branches

```powershell
gh repo view --web
```

**Settings → Branches → Add rule**, for `main` and again for `staging`:

- Require a pull request before merging
- Require status checks to pass → select **`Typecheck, lint and bundle`**

Without this the CI gate is advisory — it will go red and still let you merge.

### 2.3 Finish the Expo config

```powershell
eas update:configure
```

`eas init` did not write `updates.url`, and OTA updates need it. Then:

```powershell
git add app.json
git commit -m "Add updates.url for OTA"
git push
```

---

# Part 3 — What the pipeline does

Three workflows, all already committed in `.github/workflows/`.

| Workflow | Runs when | Does |
| --- | --- | --- |
| `ci.yml` | PR or push to `main`/`staging` | `expo export` → `tsc --noEmit` → `expo lint` |
| `update.yml` | push to `staging`; or manual | OTA update to the `preview` channel |
| `release.yml` | **manual only** | `eas build`, optionally submits to a store |

`release.yml` is manual on purpose: a build costs money and a store submission
is hard to take back.

**Why `expo export` runs before `tsc`:** typed routes are on, so `Href` is only
as strict as the generated `.expo/types/router.d.ts`, which is git-ignored.
Without the export first, a fresh checkout would accept a bad
`router.push('/wrong')`.

Verified on this machine right now: `tsc` clean, `expo lint` 0 errors (1 known
false-positive warning about `axios.create`), bundle builds at 5.5 MB.

---

# Part 4 — Prepare the Mac mini

> **Do not use a Mac mini that is in the relay fleet.** In this system a Mac
> mini *is* sending hardware — it has a customer's Apple ID signed into Messages
> and runs `spyder-relay`. Installing Xcode or rebooting it takes that
> customer's iMessage line offline. Use a spare or unassigned one. If unsure,
> check whether its `devices` row has an `apple_id` and an `organization_id`.

### 4.1 Install Xcode

Mac App Store → **Xcode** → Install. It is 7+ GB, so start it first and let it
run. Then once:

```bash
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
```

You need Xcode only for the **iOS Simulator** — the actual app builds happen on
Expo's servers, so you do not need the full local build toolchain.

### 4.2 Install the tools

```bash
# Homebrew, if not already there
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node@22 git
npm install -g eas-cli
```

Check the version — Expo 58 needs Node 22, 24, or 26+:

```bash
node --version
```

### 4.3 Clone the repo

```bash
cd ~/Developer        # or wherever you keep projects
git clone https://github.com/<your-org>/spyder-mobile-app.git
cd spyder-mobile-app
git checkout staging
npm ci
```

### 4.4 Create `.env` on the Mac

`.env` is git-ignored, so it did not come with the clone. Make it:

```bash
cat > .env <<'EOF'
EXPO_PUBLIC_API_URL=https://staging.solvedblue.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=solvedblue-staging.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=solvedblue-staging
EXPO_PUBLIC_FIREBASE_APP_ID=
EOF
```

Then copy the five filled-in values across from `D:\spyder-mobile-app\.env` on
Windows. Note the API URL is **staging**, not `127.0.0.1` — the Mac cannot
reach the Windows machine's localhost.

---

# Part 5 — Run the iOS app on the Mac mini (free, no Apple account)

This is the fastest way to see the iOS app. Simulator builds are not
code-signed, so they need **no Apple Developer membership**.

```bash
eas login
eas build --profile simulator --platform ios
```

Wait for it (~10–15 min), then:

```bash
eas build:run -p ios --latest
```

That downloads the build and launches it in the Simulator. In a second terminal:

```bash
npx expo start --dev-client
```

Press **`i`** to attach. The app loads.

### What works here

- ✅ The entire app UI, every screen, against the staging API
- ✅ **Google sign-in** (your iOS client ID is already set)
- ❌ **Apple sign-in** — Apple checks the bundle id against a real App ID with
  the Sign In with Apple capability, which needs the paid account
- ❌ **Push notifications** — needs a physical device

### Faster loop afterwards

Once the simulator build is installed, you do not need to rebuild for JS
changes. Just `npx expo start --dev-client` and press `i`. Only rebuild when a
**native** dependency changes.

---

# Part 6 — Android on the Mac (optional)

```bash
brew install --cask android-studio
```

Open it once to install the SDK, create a Pixel AVD, then:

```bash
eas build --profile development --platform android
eas build:run -p android --latest
npx expo start --dev-client
```

On Windows you already have `tools/run-mobile-app.ps1` for booting the emulator.

---

# Part 7 — TestFlight

**Needs the Apple Developer Program membership ($99/year).** Nothing in this
part works without it.

### 7.1 One-time Apple setup

1. Join at <https://developer.apple.com/programs/> (organisation enrolment needs
   a D-U-N-S number and can take over a week — start early)
2. App Store Connect → **My Apps** → **+** → **New App**
   - Platform: iOS
   - Bundle ID: `com.spyder.mobile`
   - SKU: `spyder-mobile`

### 7.2 Build and send it

```bash
eas build --profile staging --platform ios --auto-submit
```

Say **yes** to every credential prompt, including the APNs push key.

Apple processes the build in 5–10 minutes and emails you.

### 7.3 Create the tester group

App Store Connect → your app → **TestFlight** → **+** beside **Internal
Testing** → name the group → **+** beside **Testers** → add emails.

Internal testing needs **no Beta App Review**, so the build is available as soon
as processing finishes. Up to 100 testers, no device registration.

### 7.4 Testers install it

On an **iPhone or iPad**: install **TestFlight** from the App Store, open the
invite email, tap the link, install.

### Using TestFlight on the Mac mini itself

Possible, with two conditions:

1. The Mac mini must be **Apple Silicon** (M1 or later). Intel Macs cannot run
   iOS apps.
2. In App Store Connect → your app → **Pricing and Availability**, iOS apps must
   be made available on **Mac (Apple Silicon)**.

Then install TestFlight from the Mac App Store and the build appears there.

**If that is fiddly, use the Simulator (Part 5) on the Mac and TestFlight on a
real iPhone.** That is the combination that gives the least trouble.

### One thing to know

A TestFlight build **expires 90 days** after upload. Plan to rebuild.

---

# Part 8 — Deployment

This is the part that has no web equivalent, so read the distinction first.

## OTA update vs. new build

| | OTA update (`eas update`) | New build (`eas build`) |
| --- | --- | --- |
| Ships | JavaScript, styles, images | the whole native binary |
| Takes | ~2 minutes | 15–30 min + store processing |
| Review | none | TestFlight: none. Store: 1–3 days |
| Use for | bug fixes, copy, UI, logic | native dependency, `app.json` change, SDK upgrade |

`runtimeVersion` uses the **fingerprint** policy, so an OTA update physically
cannot land on a build that lacks a native module it needs — if you change
something native, the fingerprint changes and old builds simply never see the
update. That is the safety net; it is not a reason to skip rebuilding.

## 8.1 Staging deployment

**For a JS-only change — automatic:**

```powershell
git checkout staging
git merge my-feature
git push
```

Pushing to `staging` runs CI and then publishes an OTA update to the `preview`
channel. Testers get it next time they open the app. **Nothing else to do.**

**For a native change — a new build:**

```powershell
gh workflow run release.yml -f profile=staging -f platform=all -f submit=true
```

iOS goes to TestFlight, Android to the Play internal track.

## 8.2 Production deployment

**Step 1 — promote the code:**

```powershell
gh pr create --base main --head staging --title "Release"
# merge once CI is green
```

**Step 2 — build and submit:**

```powershell
gh workflow run release.yml -f profile=production -f platform=all -f submit=true
```

**Step 3 — finish the release by hand.** The upload is automated; the release is
not, deliberately.

- **App Store Connect** → your app → the new build → fill in What's New →
  **Add for Review** → **Submit**
- **Play Console** → your app → **Production** → create release → select the
  bundle → **Review release** → **Start rollout**

Review takes 1–3 days on Apple, a few hours to a few days on Google.

**Step 4 — a production hotfix, afterwards:**

```powershell
gh workflow run update.yml -f channel=production -f message="Fix inbox crash"
```

Reaches customers in minutes with no review. JS only.

## 8.3 Quick reference

| I want to… | Do this |
| --- | --- |
| Fix a bug for testers | push to `staging` |
| Fix a bug for customers, no review | `update.yml`, channel `production` |
| Ship a native change to testers | `release.yml`, profile `staging`, submit |
| Ship a new version to the stores | merge to `main`, then `release.yml` profile `production`, then finish in both consoles |
| See the iOS app right now, for free | Part 5 on the Mac mini |

---

# Order to actually do things

| # | Step | Blocked by | Cost |
| --- | --- | --- | --- |
| 1 | Parts 1–2: GitHub, secrets, branches | — | free |
| 2 | **Commit and push the backend**, so `/auth/apple` exists | — | free |
| 3 | Android OAuth client + `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | the SHA-1 you have | free |
| 4 | Android dev build, verify Google sign-in | 3 | free |
| 5 | Parts 4–5: Mac mini, iOS in the Simulator | a spare Mac | free |
| 6 | Apple Developer membership | — | $99/yr |
| 7 | Part 7: TestFlight, and Apple sign-in at last | 6 | — |
| 8 | Google Play account (**register as an organisation**) | — | $25 |
| 9 | Part 8.2: production | 6, 8, store paperwork | — |

Steps 1–5 are all free and unblocked today.

> **Register the Play account as an organisation, not personal.** A personal
> account created after 13 Nov 2023 must run a closed test with 12 testers for
> 14 days before it can even apply for production access. Organisations are
> exempt.

---

# Troubleshooting

**`npx eas-cli@latest` hangs or times out.** It re-downloads ~100 MB every call.
Install it once: `npm i -g eas-cli`, then use `eas`.

**Google sign-in button does nothing / "Sign-in is unavailable".** The client ID
for *that platform* is missing. Android needs
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, iOS needs the iOS one. The button is
disabled deliberately rather than failing obscurely.

**Google sign-in fails in Expo Go.** Expected, and unfixable. The redirect there
is `exp://<lan-ip>:8081/--/`, which Google refuses for an installed app. Use a
development build.

**Google sign-in works in my APK but not from the Play Store.** Play App Signing
re-signs your app with Google's key, so the SHA-1 changes. Add the **App signing
key certificate** SHA-1 from Play Console → Release → Setup → App Integrity to
the same Android OAuth client. It accepts several.

**Every screen shows "Could not load…".** The API is unreachable. On the Windows
emulator, `adb reverse tcp:3000 tcp:3000` must be active and the backend
running. On the Mac, `EXPO_PUBLIC_API_URL` should be `https://staging.solvedblue.com`.

**Apple sign-in returns 404.** The backend is not deployed — see step 2 above.

**Push notifications never arrive.** Needs a physical device, the `projectId` in
`app.json` (now present), and the FCM key for Android / APNs key for iOS.

**CI fails on `expo-doctor`.** It cannot — that job is `continue-on-error`. If
the `check` job fails, read the step that went red; all three of its commands
run locally too.

---

# Keep this safe

Your **Android keystore** now lives only on Expo's servers. If it is lost you
can never update the app under `com.spyder.mobile` again — you would need a new
package name and a new Play listing.

```powershell
eas credentials
# Android -> development -> credentials.json: Upload/Download credentials...
#         -> Download credentials from EAS to credentials.json
```

Put the `.jks` somewhere that is not one laptop. `credentials.json` and
`credentials/` are git-ignored, so neither can be committed by accident.
