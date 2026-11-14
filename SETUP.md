# Setup, from nothing to both stores

Follow this top to bottom. Every command is copy-pasteable. Where a step needs
a browser or a paid account, it says so.

**Where to run each part:**

| Part | Machine | Required? |
| --- | --- | --- |
| 1–3 GitHub, secrets, branches | Windows | **yes** |
| 4–6 Mac, iOS Simulator, Android on Mac | a **non-fleet** Mac | **no — skip it** |
| 7 TestFlight | Windows + an iPhone | yes, for iOS testing |
| 8 Deployment | Windows | **yes** |

**You do not need a Mac.** Expo builds and submits iOS from Windows. Parts 4–6
only buy you the iOS Simulator, and if your only Mac mini runs `spyder-relay`,
do not touch it — see the warning in Part 4.

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

# Part 4 — Prepare a Mac (OPTIONAL — skip this)

## You do not need a Mac to ship iOS

Read this before buying or borrowing anything. The entire iOS pipeline runs from
Windows:

| Task | Needs a Mac? |
| --- | --- |
| `eas build --platform ios` | **No.** It builds on Expo's macOS machines |
| `eas submit` / `--auto-submit` to App Store Connect | **No.** Expo Submit runs on Windows |
| TestFlight testing | **No.** Testers use an iPhone |
| App Store review and release | **No.** Browser only |
| iOS **Simulator** | Yes — this is the only thing |

A Mac buys you one thing: the Simulator, for looking at the iOS app without a
physical iPhone. And in the Simulator you still **cannot** test Apple sign-in
(needs the paid account) or push notifications (needs a real device).

So the Simulator gets you: the UI, and Google sign-in on iOS. Useful, but not
worth disturbing production hardware for.

> ## Using a relay Mac mini as a dev machine
>
> A Mac mini in this system *is* sending hardware: it has an Apple ID signed
> into Messages and relays iMessages. The backend watches it —
> `services/fleetMinute.ts` raises `mac_offline` when it stops reporting and
> `apple_id_signed_out` when Messages loses its Apple ID.
>
> **A production relay Mac: don't.** A customer's line goes down and someone
> gets paged.
>
> **A staging relay Mac: acceptable**, with three precautions.
>
> 1. **Enable automatic login before rebooting.** System Settings → Users &
>    Groups → Automatic login. The relay is a *GUI* LaunchAgent
>    (`launchctl bootstrap gui/$UID`, `RunAtLoad` + `KeepAlive`), so it restarts
>    on **login**, not at boot. Without auto-login the Mac returns to a login
>    screen and the relay stays down until someone signs in.
> 2. **Never touch System Settings → Apple ID.** That is the account Messages
>    sends with. Xcode's own account (Xcode → Settings → Accounts) is a
>    different thing entirely and is safe to sign into — it does not affect
>    Messages.
> 3. Expect the Mac to be busy while the Simulator and Metro are running. The
>    relay is a light Node HTTP server and copes, but a low-RAM Mac will feel it.
>
> The cost is one-time: the Xcode install and one reboot. Running the Simulator
> afterwards has no effect on the relay.
>
> **TestFlight does not involve this Mac at all** — that runs on an iPhone, and
> the builds happen on Expo's servers. Only the Simulator needs the Mac.

### Check which kind of Mac you have

Before starting, confirm it is not serving a paying customer. In the admin
console under Lines, or directly:

```sql
SELECT name, organization_id, apple_id IS NOT NULL AS signed_in, status
FROM devices WHERE platform = 'macos';
```

A row with an `organization_id` belonging to a real customer is production —
leave it alone. A staging or unassigned Mac is fine to use.

### 4.1 Check what is already there

Run this first. It tells you which of the next steps you can skip.

```bash
echo "--- Xcode ---";      xcodebuild -version 2>/dev/null || echo "NOT INSTALLED"
echo "--- selected ---";   xcode-select -p
echo "--- simulators ---"; xcrun simctl list runtimes | grep -i ios || echo "NO iOS RUNTIME"
echo "--- node ---";       node --version 2>/dev/null || echo "NOT INSTALLED"
echo "--- git ---";        git --version 2>/dev/null || echo "NOT INSTALLED"
echo "--- eas ---";        eas --version 2>/dev/null || echo "NOT INSTALLED"
echo "--- brew ---";       brew --version 2>/dev/null | head -1 || echo "NOT INSTALLED"
```

### 4.2 Xcode

**If `xcodebuild -version` printed a version, Xcode is installed — skip the
download and the reboot.** You only need the Simulator, not the build
toolchain, because the real builds happen on Expo's servers.

Three things still to confirm:

```bash
# 1. xcode-select must point at Xcode, not the bare command line tools.
#    If it prints /Library/Developer/CommandLineTools, fix it:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# 2. Licence accepted (silent no-op if it already is)
sudo xcodebuild -license accept

# 3. An iOS simulator runtime must exist. Xcode 15+ downloads these
#    separately from Xcode itself, so "Xcode installed" does not imply it.
xcrun simctl list runtimes | grep -i ios
```

If that last command prints nothing, get a runtime (a few GB, **no reboot**):

```bash
xcodebuild -downloadPlatform iOS
```

Or in the UI: Xcode → Settings → Components (or Platforms) → iOS → Get.

**If Xcode is not installed:** Mac App Store → Xcode → Install (7+ GB). Then
run the three commands above. This is the only step that may want a reboot — do
Part 4.4 first if so.

### 4.3 Install Node and the EAS CLI

Expo 58 needs Node `^22.13 || ^24.3 || ^26 || >=27`. Note the gap: **25.x is not
supported**, and `brew install node` gives you whatever is latest.

Use a version manager rather than Homebrew's `node`. It pins the version and
pulls official prebuilt binaries, which avoids Homebrew's dependency graph:

```bash
brew install fnm
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
source ~/.zshrc

fnm install 22
fnm default 22
fnm use 22

node --version        # v22.x
npm install -g eas-cli
eas --version
```

Nothing here needs `sudo`.

> **If `node --version` aborts with `Library not loaded: libsimdjson.*.dylib`,**
> Homebrew's `node` is linked against a `simdjson` version that is no longer
> installed — a broken formula after an upgrade, not a missing Node. Seen in the
> wild with node 25.8.2 against simdjson 5.1.1.
>
> Do not repair it; 25.x is outside Expo's supported range anyway. `fnm`
> prepends to `PATH` and wins over it. To clear it out:
> `brew uninstall node`, or `brew reinstall simdjson` if something else needs it.

### 4.3b Confirm the Simulator opens

Worth 30 seconds before a 15-minute build:

```bash
open -a Simulator
```

A phone window should appear. If it asks for an **admin password**, Xcode's
first-run components were never installed and you will need it from whoever set
the Mac up. That is the only step in this part that can require admin, and if a
runtime is already listed it usually does not.

### 4.4 Only if you must reboot — enable automatic login first

**Skip this if Xcode was already installed and you are not rebooting.**

System Settings → Users & Groups → **Automatic login** → select the relay user.

The relay is a GUI LaunchAgent, so it restarts on **login**, not at boot.
Without this the Mac returns to a login screen and the relay stays down.

Verify after rebooting:

```bash
launchctl print "gui/$UID/com.solvedblue.relay" | head -5
curl -s http://127.0.0.1:4000/health
```

If it is down, bring it back without re-running setup:

```bash
launchctl kickstart -k "gui/$UID/com.solvedblue.relay"
```

(Port 4000 is the Mac relay. 8888 is the *Android* relay agent — different thing.)

### 4.5 Clone the repo

```bash
cd ~/Developer        # or wherever you keep projects
git clone https://github.com/<your-org>/spyder-mobile-app.git
cd spyder-mobile-app
git checkout staging
npm ci
```

### 4.6 Create `.env` on the Mac

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

On Windows the same two build commands apply, and
`tools/run-mobile-app.ps1 -Restart` then does the rest: boots the AVD, starts
Metro with `--dev-client`, reverses the Metro port and opens the build. It
checks the build is installed first and tells you these commands if it is not.

Everything points at `https://staging.solvedblue.com`, on both platforms. There
is no local-backend mode and nothing to start on port 3000.

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

### 7.2 Upload the client ids to EAS — do not skip this

**`.env` never reaches a cloud build.** It is git-ignored, and Expo Build uploads
a git archive of your commit. So a TestFlight build made without this step ships
with **empty Google client ids**, and the sign-in button disables itself with
"Sign-in is unavailable right now" — correct behaviour, baffling symptom.

```bash
cp .env .env.local                      # env:push reads .env.local, not .env
eas env:push --environment preview
eas env:list --environment preview      # expect all 8
```

Choose **plaintext** visibility for every value. `EXPO_PUBLIC_*` is inlined into
the JS bundle and readable by anyone who unpacks the app, so marking them secret
buys nothing.

`.env*.local` is already git-ignored, so copying commits nothing.

> Which environment? The `staging` **build profile** maps to the `preview`
> **environment** (`"environment": "preview"` in eas.json), so staging builds
> read the variables you just pushed. Repeat with
> `--environment production` before the first production build.

### 7.3 Build and send it

```bash
eas build --profile staging --platform ios --auto-submit
```

Say **yes** to every credential prompt, including the APNs push key.

Apple processes the build in 5–10 minutes and emails you.

### 7.4 Create the tester group

App Store Connect → your app → **TestFlight** → **+** beside **Internal
Testing** → name the group → **+** beside **Testers** → add emails.

Internal testing needs **no Beta App Review**, so the build is available as soon
as processing finishes. Up to 100 testers, no device registration.

### 7.5 Testers install it

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
| See the iOS app, no Mac | iPhone + TestFlight (Part 7) |
| See the iOS app on a spare Mac | Part 5, Simulator |

---

# Order to actually do things

| # | Step | Blocked by | Cost |
| --- | --- | --- | --- |
| 1 | Parts 1–2: GitHub, secrets, branches | — | free |
| 2 | **Commit and push the backend**, so `/auth/apple` exists | — | free |
| 3 | Android OAuth client + `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | the SHA-1 you have | free |
| 4 | Android dev build, verify Google sign-in | 3 | free |
| 5 | ~~Parts 4–5: Mac Simulator~~ — **skip, optional** | a **non-fleet** Mac | free |
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

**Every screen shows "Could not load…".** The API is unreachable.
`EXPO_PUBLIC_API_URL` should be `https://staging.solvedblue.com` on every
machine, Mac and Windows alike, and staging should be up. Nothing needs to run
on port 3000 and no `adb reverse tcp:3000` is required — that was the old
local-backend setup and is no longer used.

If the build came from EAS rather than `npx expo run:android`, check the
variables actually reached it: `.env` never leaves your machine. Run
`eas env:list --environment preview` and expect all 8. A build made against the
`development` environment gets nothing, because that environment is empty — see
7.2.

**`node` aborts with `Library not loaded: libsimdjson.*.dylib` on macOS.**
Homebrew's `node` is linked against a `simdjson` that is no longer installed.
Install Node through `fnm` instead (Part 4.3) — it takes `PATH` priority, so the
broken binary stops mattering. `brew uninstall node` to be rid of it.

**`xcrun simctl list runtimes` prints `Install Failed: Authorization is
required`.** Xcode tried to auto-install an extra component. Harmless if a real
runtime is also listed on the following line — that is the one you will use.

**`eas env:push` says `File .env.local does not exist`.** It reads `.env.local`,
not `.env`. Copy it; `.env*.local` is already git-ignored, so nothing needs
committing:

```bash
cp .env .env.local
eas env:push --environment preview
```

Choose **plaintext** visibility for every `EXPO_PUBLIC_*` value. They are inlined
into the JS bundle and readable by anyone who unpacks the app, so marking them
secret buys nothing and makes them harder to inspect.

**`eas env:push` or `eas build` says `Failed to resolve plugin for module
"expo-router"`.** `node_modules` is missing — those commands evaluate the app
config. Run `npm ci`.

**Apple sign-in returns 404.** The backend is not deployed — see step 2 above.

**Push notifications never arrive.** Needs a physical device, the `projectId` in
`app.json` (now present), and the FCM key for Android / APNs key for iOS.

**The `Dependency doctor` job is red.** It does not block anything —
`continue-on-error` is set, and the workflow run stays green. Only the
`Typecheck, lint and bundle` job gates a merge.

It mostly goes red because Expo published a patch release, not because of your
change. Fix it with:

```powershell
npx expo install --fix
```

Take it seriously when it reports a **missing peer dependency** — that is the
one failure mode that crashes real builds while tsc, lint and the bundler all
stay green.

**`npx expo-doctor` seems to hang locally.** It is not hanging. npx is asking
*"Need to install expo-doctor@x. Ok to proceed?"* and waiting for a keypress,
and the prompt is easy to miss. Run `npx --yes expo-doctor` instead — it
finishes in seconds.

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
