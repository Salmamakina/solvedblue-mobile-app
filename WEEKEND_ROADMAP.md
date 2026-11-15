# Weekend roadmap — catching the app up to the web

Branch `feat/weekend-sprint`, cut from `staging` on 2026-11-14.

Your notes, regrouped so each page is opened, changed and checked once instead of
five times. Every item was checked against the code before it was written down:
`spyder-mobile-app`, `Spyder/spyder-web` and `Spyder/spyder-backend`.

The useful finding from that check: **the web already does almost all of this,
and the backend already supports it.** Read receipts, pictures, voice messages,
emoji reactions, the per-conversation flag and opt-out buttons, the assign menu,
inbox search and the new-message dialog are all live on the web and all served by
endpoints that exist today. So most of this weekend is porting, not inventing,
and each task below names the web file to port from.

`ROADMAP.md` is a different document: it tracks what is left before the app can
ship to the two stores. This one tracks this weekend's feature work.

---

## Progress

| Phase | What it covers | Tasks | Written | State |
| --- | --- | --- | --- | --- |
| P0 | Shared groundwork | 4 | 3 | P0.2 and P0.4 need a handset |
| P1 | App chrome: back arrow, logo, dark mode | 3 | 3 | Written |
| P2 | Inbox list | 5 | 4 | P2.5 deferred on purpose |
| P3 | Conversation | 5 | 5 | Written |
| P4 | Home | 1 | 1 | Written |
| P5 | Contacts | 2 | 2 | P5.1 parser unproven on device |
| P6 | Campaigns out, Developers in | 2 | 2 | Written |

**"Written" is not "done".** Everything below typechecks, lints clean and passes
`expo-doctor` 18/18, and each piece names the web file it was ported from. None
of it has run on a handset. P0.2 adds native modules, so the whole lot needs a
development build before any of it can be called finished — the pictures, the
voice recorder and the file picker in particular cannot work in Expo Go and do
not work in a simulator either.

What genuinely cannot be closed from a keyboard is called out under each task.
There are three such items: the development build (P0.2), the emoji diagnosis
(P0.4) and whether SheetJS parses a real XLSX under Hermes (P5.1).

Phases are ordered by dependency, not by importance. P0 is shared plumbing that
P2, P3 and P5 all import, so it goes first. After that, P1 through P6 are
independent of each other and can be done in any order, or by different people.

Update the table and the **Progress** line under each task as work lands. The
convention: `Not started` → `In progress` → `Done <date>`, and a one-line note
when something turned out differently than planned.

---

## What is left

In the order it should be picked up.

1. **A development build.** `npx expo run:ios` / `run:android`, or
   `eas build --profile development`. Nothing involving a picture, a voice
   message or a file has executed yet, and none of it can in Expo Go.
2. **The emoji diagnosis** (P0.4). Fifteen minutes with a real handset, and it
   either confirms the line-height fix or points somewhere else.
3. **A real XLSX and a real CSV through the importer** (P5.1), on both
   platforms.
4. **A pass over every changed screen in dark mode**, which after P1.3 is most
   of them.
5. Two things I could not settle from the code are below; one is answered, one
   is still open.

### Answered: the docs on the Developers tab

Option (a). The backend already serves the full reference at `/developers` to
anyone, signed in or not, so the tab opens that rather than carrying a second
copy that would drift from it. Details under P6.2.

### Still open: deleting contacts needs a backend endpoint that does not exist

Your note asks for *flag, send a message, delete* on a contact selection. Flag
and send are ready: `POST /contacts/flag` and `POST /contacts/send` are both
live, and the web's Contacts page already uses them.

There is no delete. `spyder-backend/src/routes/contacts.ts` exposes `GET /`,
`POST /`, `POST /import`, `POST /google-sheet`, `POST /opt-out`, `POST /flag`,
`POST /send`, `GET /send-preview`, `GET /:id` and `PATCH /:id`. No `DELETE`. The
web's Contacts page doesn't offer delete either, for that reason.

So deleting contacts is a change in the **backend** repo plus the web, not
something the mobile app can do alone. It also needs a decision: does deleting a
contact erase their conversation history and their opt-out record? Erasing an
opt-out would let someone be messaged again after they said STOP, which is the
one outcome we must not ship.

My recommendation: this weekend, ship the selection with **Flag** and **Send a
message**, and leave delete out. I'll write up the endpoint and the opt-out
question as a separate backend ticket. Task P5.2 is written that way; say the
word and I'll change it.

### 2. "Remove always dark, always light"

Two readings, and they lead to different code:

- **(a)** Drop the Light and Dark options from Account, so appearance always
  follows the phone. The caption "Always dark." disappears with them.
- **(b)** Keep all three options and only reword the caption.

I've assumed **(a)**, because it sits in the same note as the logo being
invisible in dark mode, and because one appearance path is one path to get the
brand right in. It's a small change to reverse if you meant (b).

---

## P0 — Shared groundwork

Four pieces that P2, P3 and P5 all build on. Doing these first means the feature
work afterwards is mostly layout.

### P0.1 Media upload and download

**Progress:** Done 2026-11-14. `src/api/media.ts`, and `ChatMessage` gained the four fields. One departure from the plan: the web posts a `Blob`, so the bytes are read off the picker's `file://` URI with `expo-file-system`'s `File.arrayBuffer()` and posted as an ArrayBuffer, which axios passes through its default transform untouched. `mediaSrc` joins to a new `apiOrigin` export, not `apiBaseUrl`, which would have produced `/api/api/media/<id>`.

The contract already exists and is the same one the web uses.
`POST /api/media` takes the raw file bytes with the file's `Content-Type` and
returns `{ id, url, kind }`, where `kind` is `'image'` or `'audio'`. `url` is
`/api/media/<uuid>`. `GET /api/media/:id` is public by its random id and needs no
token, so an RN `<Image>` and an audio player can both read it directly. The
limit is 10 MB; accepted types are JPEG, PNG, GIF, WebP, HEIC, and M4A, AAC or
MP3 for audio (`spyder-backend/src/services/media.ts`).

- [x] Add `src/api/media.ts`, mirroring `spyder-web/src/api/media.ts`:
      `MAX_MEDIA_BYTES`, `PICTURE_TYPES`, `mediaApi.upload`, `mediaSrc`.
      `mediaSrc` has to prepend our base URL, the same way the web prepends
      `VITE_API_URL`; on the phone a bare `/api/media/x` resolves to nothing.
- [x] Upload from a local `file://` URI, which is what the pickers return. The
      web posts a `Blob`; RN can't. Read the file and post the bytes with the
      right `Content-Type`, and give the request its own 60 s timeout like the
      web does, because the shared axios timeout is for JSON.
- [x] Extend `ChatMessage` in `src/api/messages.ts` with the four fields the
      backend already returns and the mobile type is missing: `read_at`,
      `media_url`, `media_kind`, `error_note`. Add `mediaUrl` to
      `SendMessageRequest`. Confirmed present in the response built at
      `spyder-backend/src/routes/messages.ts:193` and `:373`.
- [x] Map the error codes to wording, porting `sendFailureText` from the web's
      `Composer.tsx`: `media_too_large`, `media_type`, `media_empty`, 413,
      `opted_out`.

### P0.2 Native modules and a development build

**Progress:** **Blocked on a device.** Packages installed at SDK 58 versions and the permission strings are in `app.json` as plugin options. `expo-doctor` caught `expo-asset` as a missing direct peer of `expo-audio`; installed, now 18/18. The development build itself has not been run, so nothing in P3.2 or P5.1 has executed. This is the next thing to do.

Pictures, recordings and file import all need native code that Expo Go does not
carry, so this is the one task that must finish before P3.2 and P5.1 can be
tested on a phone at all.

Verified against the SDK 58 reference (`docs.expo.dev/versions/v58.0.0/`), not
from memory — `expo` in `package.json` is `~58.0.25`:

- [x] `npx expo install expo-image-picker expo-audio expo-document-picker expo-image expo-file-system`
- [x] Add the permission strings to `app.json` as config plugin options, so CNG
      generates them. `expo-audio` takes `microphonePermission`; `expo-image-picker`
      takes `photosPermission` and `cameraPermission`. Do **not** hand-edit
      `android/` or `ios/`; they're generated and `.gitignore`d.
- [ ] `npx expo run:ios` / `run:android`, or `eas build --profile development`,
      and confirm the app boots with the new modules linked.
- [x] `npx expo-doctor` clean.

Two API notes worth writing down, because both of these changed in recent SDKs
and the old shapes are what most examples still show:

- Recording is `expo-audio`, not `expo-av`. The hook shape is
  `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` plus
  `useAudioRecorderState(recorder)`, then `prepareToRecordAsync()`, `record()`,
  `stop()`, and the file lands on `recorder.uri`. Permission comes from
  `AudioModule.requestRecordingPermissionsAsync()`, and `setAudioModeAsync({
  playsInSilentMode: true, allowsRecording: true })` has to run before
  recording. Recordings go to the cache directory by default, which the OS may
  clear; pass `{ ...RecordingPresets.HIGH_QUALITY, directory: 'document' }` if
  one needs to outlive the upload.
- `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })` — `mediaTypes`
  is an array of strings now, not the old `MediaTypeOptions` enum.

### P0.3 One timestamp rule, matching the web

**Progress:** Done 2026-11-14. `listTime` and `stampTime` in `src/utils/format.ts`, plus `STAMP_GAP_MS`. Wired into the inbox, Home's waiting card and the contacts list. `shortTime` is left in place for the campaign screens, which prefix it with a verb ("Created Tue") and are being hidden anyway in P6.1.

> *Note: "If the message is older we need date instead of Thu"*

`shortTime` in `src/utils/format.ts` prints the weekday for anything under seven
days old, so a message from last Tuesday says `Tue` with no way to tell it from
this Tuesday. The web settled this already in `formatListTime`
(`spyder-web/src/pages/inbox/ThreadList.tsx`): time of day today, `Yesterday`,
the full weekday within the week, then `Oct 19`.

- [x] Port `formatListTime` as `listTime` in `src/utils/format.ts`, keeping the
      web's exact thresholds so the two apps never disagree about the same row.
- [x] Use it in the inbox list, the Home "Waiting on you" card, and the contacts
      list. All three call `shortTime` today.
- [x] Separately, port the web's in-thread stamp rule from `Thread.tsx`:
      `Today 8:02 AM`, `Yesterday 4:05 PM`, `Mon, 20 Oct at 4:05 PM`, shown
      above a message only when more than an hour has passed since the one
      before it. Feeds P3.1.

### P0.4 Find out why emoji don't show, before changing anything

**Progress:** **Partly done; the diagnosis still needs a handset.** Two things were ruled out by reading: no custom font is loaded anywhere, so the system emoji font is in play, and nothing in the backend or the relay strips non-ASCII. Two things were found. First, a real bug: `ChatMessage.reactions` was populated by the backend and never rendered: the conversation now draws them. Second, the leading hypothesis for the original report: the type ramp is ported from the web, where a tight line height is free, but on Android an explicit `lineHeight` crops a glyph taller than it, and emoji are taller than Latin text. The two places emoji were reported missing use the two tightest styles in the ramp -- the inbox preview is `footnote` (13/18) and Home's waiting preview is `caption` (12/16). `emojiSafe` in `src/theme/tokens.ts` raises the line height to 1.45x the font size and is applied to every `Text` that renders what a contact sent. **Unconfirmed.** Send yourself an emoji and a tapback from a real handset and check the three surfaces; if they are right, record it here and close this.

> *Notes: "Emojis needs to be displayed in the app (waiting on you)",
> "Emojis needs to be displayed in inbox"*

This one I will not guess at. No custom font is loaded anywhere in the app — no
`useFonts`, no `fontFamily` in the tree — so the system emoji font is in play and
plain emoji inside a message ought to render. Something more specific is wrong,
and the fix depends on which.

The two candidates I can see from the code, in order of likelihood:

1. **Reactions are dropped on the floor.** `ChatMessage.reactions` is declared in
   `src/api/messages.ts`, the backend fills it in (`messages.ts:177`, via
   `message_reactions`), and `app/chat/[phone].tsx` never reads it. An iMessage
   tapback *is* an emoji, so "emoji don't show" and "reactions don't show" are
   plausibly the same report. The web doesn't render them either, so there's no
   port to copy here.
2. **An emoji-only inbound message has empty text.** If a reaction arrives as a
   row with no `reply_text`, the inbox preview falls back to `'No messages yet'`
   and Home shows the same, which would read as a missing emoji in exactly the
   two places you noted.

- [ ] Send yourself an emoji, then a tapback, from a real handset, and read the
      raw `/messages/chat/:phone` response. Write down which of the two it is.
- [x] Fix accordingly, then re-check the same three surfaces: the thread, the
      inbox row preview, and Home's "Waiting on you".
- [ ] Record the answer here, so the next person doesn't repeat the diagnosis.

Picking emoji to *send* is a separate thing and lives in P3.2.

---

## P1 — App chrome

Small, visible, and touches every screen. Good first commits.

### P1.1 Back arrow only, no "Back" label

**Progress:** Done 2026-11-14. `headerBackButtonDisplayMode: 'minimal'` in the Stack's shared `screenOptions`, replacing six per-screen `headerBackTitle` labels, so a new screen inherits it. Campaign detail's in-body "Back to campaigns" link went with them.

> *Note: "Remove the back and keep the arrow for all pages when we have back
> button keep just the arrow"*

Six stack screens set a back-button label in `app/_layout.tsx`: `'Back'` on
`chat/[phone]`, and `'Campaigns'`, `'Contacts'`, `'Account'`, `'Account'` on the
rest. `app/campaigns/[id].tsx:206` also draws its own "Back to campaigns" text
button in the body.

- [x] Replace every `headerBackTitle` with
      `headerBackButtonDisplayMode: 'minimal'` in the Stack's shared
      `screenOptions`, so it's one rule rather than six and new screens inherit
      it. On Android the label was never shown anyway, so this only changes iOS.
- [x] Drop the per-screen `headerBackTitle` lines.
- [x] Replace the in-body "Back to campaigns" button on the campaign detail
      screen with the header arrow alone.
- [ ] Walk every pushed screen on an iPhone and confirm: arrow, no word.

### P1.2 The logo goes home

**Progress:** Done 2026-11-14. The mark and wordmark are one `Pressable` in `AppHeader`, inert on Home so it cannot stack a second copy. `router.navigate`, not `push`, for the same reason.

> *Note: "Logo takes you to home"*

`src/components/AppHeader.tsx` draws the mark and the wordmark as plain,
non-interactive views.

- [x] Wrap the mark and wordmark in one `Pressable` that calls
      `router.push('/(tabs)/home')`, with `accessibilityRole="link"` and a label
      of "Solvedblue, home".
- [x] Keep it a single touch target covering both, 44 pt minimum, and leave the
      Contact sales button outside it.
- [x] From Home, make it a no-op rather than pushing Home onto itself.

### P1.3 The logo in dark mode, and one appearance path

**Progress:** Done 2026-11-14, with one finding. The mark needs no dark variant: it is a blue bubble with a white check on transparency, which carries on both palettes, so only the wordmark text was ever the problem. "Solved" now follows the theme, with an `onLight` prop for the sign-in screen, which is always light whatever the device. Decision (a) taken: `themeStore` is deleted, the Appearance control is gone from Account, and the root layout no longer waits on a stored preference before its first paint. The formal WCAG check is still outstanding.

> *Note: "Logo when it's dark needs to be white like visible, remove always
> dark, always light"*

Two separate bugs in one note. `Wordmark.tsx` hard-codes `brand.navy` for
"Solved" regardless of theme, which on the dark palette is navy on near-black.
And `assets/solvedblue-mark.png` is a fixed-colour PNG with the same problem.

- [x] Make `Wordmark` read `useTheme()` and use white for "Solved" when `dark`,
      keeping "blue" in `brand.blue`, which has enough contrast on both
      palettes. Check the result against WCAG AA.
- [x] Give the mark a light-on-dark treatment: either a second asset or a
      `tintColor`. Check it on the sign-in screen too, which deliberately runs
      `useLightTheme()` and must keep the navy version.
- [x] Per the decision above, remove `'light'` and `'dark'` from
      `THEME_OPTIONS` and `ThemePreference` in `src/stores/themeStore.ts`, drop
      the Appearance segmented control from `app/(tabs)/account.tsx`, and
      simplify `useTheme` to follow `useColorScheme()`. Leave the stored key
      readable so an existing preference degrades to system rather than
      crashing.
- [ ] Sweep every screen in dark mode for anything else that assumed light.

---

## P2 — Inbox list

`app/(tabs)/inbox.tsx`, and `spyder-web/src/pages/inbox/ThreadList.tsx` and
`FolderTabs.tsx` as the reference.

### P2.1 Filters on one swipeable line

**Progress:** Done 2026-11-14. `FilterChips` ports the web's `FolderTabs` `variant="bar"`, with the selected chip scrolled into view. Applied to Contacts too, which wrapped the same way. On the ambiguity in the note: scrolling the chip row is what "swipe" was taken to mean, which is the web's behaviour; a swipe on the list body would collide with P2.5 and was left alone.

> *Note: "For the inbox, filters should be same line and you should swipe"*

The five folder chips are in a `flexWrap: 'wrap'` row, so on a narrow phone
"Flagged" and "Closed" drop to a second line and the list below loses a row of
height. The web hit this and solved it the same way you're asking for: a
horizontally scrolling row of tabs on phones (`FolderTabs`, `variant="bar"`).

- [x] Change the folder row to a horizontal `ScrollView` with
      `showsHorizontalScrollIndicator={false}` and `flexWrap` removed, so the
      five chips stay on one line and scroll.
- [x] Scroll the selected chip into view when the folder changes, which is what
      the web's `scrollIntoView` effect does. Otherwise tapping the tab badge
      can select a folder that's off-screen.
- [x] Keep `accessibilityRole="tab"` and the counts in the spoken label.
- [x] Decide and note whether swiping the *list* should also change folder.
      "You should swipe" could mean either. Scrolling the chip row is the web's
      behaviour and the safer default; a swipe on the list body would collide
      with P2.5's row actions.

### P2.2 Search

**Progress:** Done 2026-11-14. `SearchField` and `useDebounced` are shared with Contacts. `q` was already accepted by `inboxApi.list` and simply never sent. `placeholderData` keeps the previous results on screen while the next load, so the list does not empty on every pause.

> *Note: "Search inside inbox"*

`inboxApi.list` already takes `q` and passes it to the server; the screen just
never sends one. The contacts screen already has the search field to copy.

- [x] Add a search field above the folder row, styled like the one in
      `app/(tabs)/contacts.tsx`, with `accessibilityLabel="Search conversations"`.
- [x] Put `q` in the react-query key and debounce it, so typing doesn't fire a
      request per keystroke.
- [x] Distinguish the two empty states the way the web does: "No matches, try a
      different name or number" when searching, the per-folder hint otherwise.
      `emptyHint` already handles the second.

### P2.3 New message

**Progress:** Done 2026-11-14. `app/inbox/new.tsx` as a modal route, porting `NewMessageDialog` including the `send-preview` check and the contact picker. `contactsApi.sendPreview` and `isSendableAddress` were missing from the mobile API module and were added. On success it opens the new conversation rather than returning to a list that would need a refetch to show it.

> *Note: "Add new message for the whole inbox page"*

- [x] Add a "New message" action in the inbox header row, beside the title.
- [x] Port `spyder-web/src/pages/inbox/NewMessageDialog.tsx` as a modal route,
      `app/inbox/new.tsx`, registered in `app/_layout.tsx` with
      `presentation: 'modal'` like `contacts/new`.
- [x] Use `GET /contacts/send-preview?to=` before sending, which the web does.
      It reports `opted_out`, `first_contact` and `quiet_until`, so the screen
      can warn that a first message will wait for quiet hours instead of looking
      broken when nothing sends.
- [x] On success, open the new conversation rather than returning to the list.
- [x] Offer it from the empty state too, as the web does for the `all` folder.

### P2.4 Previews: emoji, and say when there's a voice message

**Progress:** Done 2026-11-14, with a limitation worth recording. A row whose latest message carried only a file now says "Attachment" instead of "No messages yet". It cannot say which kind: `GET /inbox` builds `last_text` from `message_text` and `reply_text` alone (the `items` CTE in `spyder-backend/src/services/inboxQuery.ts`) and returns no media column, which is also why the web says a generic "Attachment". "Photo" or "Voice message" needs that query to carry `media_kind` through -- a backend change, not a mobile one.

> *Notes: "Emojis needs to be displayed in inbox", "Voice message needs to be
> displayed"*

A row whose latest message is a picture or a recording has no `last_text`, so it
reads "No messages yet" — the same wording as a genuinely empty conversation.
The web shows `Attachment` there.

- [x] Fall back to "Photo" or "Voice message" by `media_kind` when `last_text` is
      empty, and keep "No messages yet" only for an actually empty thread.
      `InboxThread` carries no media fields yet, so check what the server
      returns and extend the type, or derive it in the thread query.
- [x] Apply whatever P0.4 concludes about emoji to the preview line.

### P2.5 Keep the long-press actions reachable

**Progress:** **Deferred, deliberately.** The long press on an inbox row is untouched. P3.3 and P3.4 have just given the conversation its own settings and assign menus, so the right call is to use both for a week and then decide whether the list still needs the long press at all. Changing it now would be guessing, and every action remains reachable.

Not from your notes — a consequence of P2.1. Row actions are on a long press
today, which is undiscoverable but currently the only route to close, flag and
assign from the list.

- [ ] Once the conversation has its own settings menu (P3.3) and assign button
      (P3.4), decide whether the list still needs the long press, or whether a
      swipe on the row is the better home for it. `react-native-gesture-handler`
      and `react-native-reanimated` are both already installed.
- [ ] Whatever is chosen, every action must stay reachable without a gesture,
      for accessibility.

---

## P3 — The conversation

`app/chat/[phone].tsx`, which is the thinnest screen in the app relative to its
web counterpart. `spyder-web/src/pages/inbox/Thread.tsx` and `Composer.tsx` are
the reference, and between them they cover four of your notes.

### P3.1 Read receipts

**Progress:** Done 2026-11-14. `receiptText` ported; the receipt shows under the newest outgoing message only. Every failed message is marked, not just the newest, with the server's `error_note` and a Try again that re-sends and carries `media_url` over. Pending says "Sending...", and an outgoing SMS says "Sent as text message".

> *Note: "Sent, read, delivery, failed when we send a mesage we need read
> reciepts"*

Everything needed is already in the database and in the response. `read_at`
exists on `messages` (`db.ts:1171`), the relay posts it
(`routes/devices.ts:330`), the chat query selects it (`messages.ts:193`), and the
backend computes a safe-to-show `error_note` from the failure
(`messages.ts:373`). The mobile type simply doesn't declare the fields, which
P0.1 fixes, and the bubble shows only ` · failed`.

- [x] Port `receiptText` from the web: `Read 4:21 PM` when `read_at`,
      `Delivered` when `delivered_at`, `Sent` when `status === 'sent'`.
- [x] Show it under the **newest outgoing message only**, which is what iMessage
      does and what the web's `lastOutIndex` picks out. On every bubble it is
      noise.
- [x] Mark every failed message, not just the newest: an older failure must not
      look sent. Show `error_note` and a "Try again" action that re-sends,
      carrying `media_url` over if there was one.
- [x] Show `Sending…` for `status === 'pending'`.
- [x] Note "Sent as text message" on an outgoing SMS, which is the web's cue
      that it didn't go as iMessage.
- [x] Use the P0.3 in-thread stamps so the receipts have time context.

### P3.2 Send pictures and voice messages, and pick emoji

**Progress:** Written 2026-11-14; **none of it has run.** Picture (long press for the camera), voice recorder on `expo-audio`, the web's 32 emoji, an attachment preview that can be dropped, and rendering for inbound and outbound media. The microphone is released on unmount, which is the bug the web hook exists to avoid. Two notes: the emoji insert appends rather than inserting at the cursor, because React Native gives no reliable selection offset for a controlled multiline `TextInput` on both platforms and a misplaced insert is worse than one at the end; and recordings are written to the document directory, not the cache, which the OS may clear before an upload finishes. Needs P0.2.

> *Notes: "Send voice message, images in the inbox", "Voice message needs to be
> displayed", "Emojis needs to be displayed in inbox"*

The composer is a text field and a Send button. The web's has a photo button, an
emoji panel of 32, a microphone with a running timer, and an attachment preview
that can be removed before sending. Needs P0.1 and P0.2.

- [x] Photo: `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })`,
      validated against `PICTURE_TYPES` and the 10 MB limit before upload.
      Offer the camera as well, which the web can't.
- [x] Voice: `expo-audio` per the P0.2 notes. Press to start, a visible timer,
      Stop and Cancel as separate actions, and a 120-second cap matching the
      web's `MAX_RECORDING_SECONDS`. Record as M4A — the backend accepts
      `audio/mp4`, `audio/x-m4a`, `audio/aac` and `audio/mpeg`, and an iPhone
      plays M4A.
- [x] Release the microphone when the screen unmounts mid-recording. The web
      has an explicit effect for this and it's the bug worth copying the fix for.
- [x] Attachment preview above the field, with a remove button, before sending.
- [x] Emoji: port the web's 32-emoji panel and insert at the cursor. On a phone
      the system keyboard has emoji, so this is lower value than on the web —
      do it last in this task and drop it if the weekend runs short.
- [x] Render inbound and outbound media in the thread: `expo-image` for a
      picture, tappable to full screen; an `expo-audio` player with play/pause
      and duration for a recording. Both read `mediaSrc(media_url)`, which needs
      no token.
- [x] Mirror the web's two guards: the composer is disabled for an opted-out
      contact with the reason shown, and attachments are offered only on iMessage
      conversations, since SMS carries text only.

### P3.3 A settings menu with Flag and Mark as opted out

**Progress:** Done 2026-11-14. A `Menu` component anchored under its trigger, carrying flag, mark as opted out and close/reopen. Opting out confirms first and says it cannot be undone from the app, because there is no endpoint to undo it. Two implementation notes: the menu is a `Modal`, since anything drawn inside the navigator header is clipped by it; and `contactsApi.optOut` was missing from the mobile API module.

> *Note: "Add Flag and mark as opted out inside the conversation of someone as
> settings icon that has drop down"*

Both endpoints are live — `POST /contacts/flag` and `POST /contacts/opt-out` —
and the web has them as two header buttons plus a confirmation dialog
(`useFlagThread.ts`, `useOptOutThread.ts`).

- [x] Add a settings (gear) button to the conversation header. The screen uses
      the stock navigator header, so this goes in `headerRight` via
      `navigation.setOptions`, next to the title that `useLayoutEffect` already
      sets.
- [x] Dropdown items: Flag / Unflag, Mark as opted out, Close / Reopen. Closing
      is in the list's long-press menu today and belongs here too.
- [x] Opting out must confirm first, and say what it does: the same block a STOP
      reply sets, and it cannot be undone from the app. Port the web's dialog
      wording. Hide the item when `tag === 'opted_out'` already.
- [x] Invalidate both the chat and the inbox queries after each action, so the
      list, the row badges and the tab badge all agree.
- [x] The chat screen reads `thread` state from nothing today — it only gets
      `phone` and `name` as params. It needs the thread's `flagged`, `closed`,
      `tag` and `assigned_user_id`, so either pass them through or read the
      thread from the inbox query cache.

### P3.4 Assign to someone

**Progress:** Done 2026-11-14. Assign sits beside the settings gear, listing every organization member rather than only "assign to me", gated on the `team_inbox` entitlement. The screen now resolves its own thread state through a new `inboxApi.findByAddress`, because it can be opened from the inbox, from Home or straight after a first send, and only the inbox would have had that state to pass in.

> *Note: "Assign to someone button next to settings inside the conversation of
> inbox"*

`inboxApi.assign(contact, userId)` exists on mobile already but is only ever
called with my own id, from the list's long press. The web has a full menu of
teammates (`AssignMenu` in `Thread.tsx`), fed by
`organizationsApi.getUsers(orgId)`.

- [x] Put an assign button in `headerRight`, beside the settings gear, with the
      current assignee as its label: `Assign`, `Assigned to you`, or
      `Assigned to <email>`.
- [x] Dropdown of `Unassigned` plus every organization member. `src/api/organizations.ts`
      already has the call the members screen uses.
- [x] Gate it on the `team_inbox` entitlement, which the inbox list already
      checks via `account.data.entitlements.features.team_inbox`. Offering it
      without the feature means a 403 after the tap.
- [x] Assign takes the thread's `contact` key, not `phone_number`. The existing
      `runAction` comment in `inbox.tsx` explains why; getting this wrong fails
      quietly.

### P3.5 Tidy the header

**Progress:** Done 2026-11-14. Both controls are icons in `headerRight`, with a dot on the gear when the conversation is flagged so that state reads without opening the menu. Not yet checked against a long contact name on a real screen.

Not from your notes, but P3.3 and P3.4 both add to a header that currently holds
only a title, and iOS gives `headerRight` little room.

- [ ] Fit the gear and the assign control in `headerRight` without crowding the
      name. If both don't fit, the assignee's name moves into a subtitle and the
      control becomes an icon.
- [ ] Check it with a long contact name and with the P1.1 minimal back arrow.

---

## P4 — Home

### P4.1 "Waiting on you": three rows, an Inbox button, and emoji

**Progress:** Done 2026-11-14. Three rows, and an Inbox button on the card's title row. `Card` gained an `action` slot for it rather than the header being hand-rolled inside this one card. The preview line uses `emojiSafe` and the same "Attachment" fallback as the inbox.

> *Note: "Home page: Emojis needs to be displayed in the app (waiting on you),
> maximum 3 contacts and inbox button on the right of the header Waiting on
> you"*

`app/(tabs)/home.tsx` slices `data.waiting` to 5 and the card title is plain
text with nothing on the right.

- [x] `.slice(0, 5)` → `.slice(0, 3)`.
- [x] Add an "Inbox" action to the right of the card's title, pushing
      `/(tabs)/inbox`. `Card` takes a `title` string today, so it needs an
      optional right-hand slot — worth adding to the component rather than
      hand-rolling a header inside this one card, since the same pattern will
      want it elsewhere.
- [x] Apply the P0.4 emoji fix to the preview line here.
- [x] Use the P0.3 `listTime` for the row timestamps.
- [ ] With three rows and more waiting, the Inbox button is the way to see the
      rest; check it still reads that way when `waiting.length` is 20.

---

## P5 — Contacts

### P5.1 Import from CSV, Excel or a Google Sheet

**Progress:** Written 2026-11-14; **the parser is unproven on a device.** The risk flagged in this plan was real and the answer was to pin the web's exact SheetJS version (0.20.3, from the same CDN tarball), so a spreadsheet imports the same way on both. `src/utils/parseSheetFile.ts` ports `parseFile.ts`, including its two-pass read -- the reason a long phone number does not arrive as `4.47911E+11`. A binary workbook goes in as base64, which is the route SheetJS documents for React Native and avoids relying on a `TextDecoder` under Hermes. **That is reasoning, not evidence.** Import a real XLSX and a real CSV on both platforms before trusting it; if XLSX misbehaves, the fallback is CSV plus Sheets with the UI saying to save as CSV.

> *Note: "Import contacts: from csv/execl/google sheet"*

`app/contacts/import.tsx` does Google Sheets only, and says so in its own header
comment: a file picker and a spreadsheet parser were the missing pieces. The web
does all three in `ImportDialog.tsx`, parsing in the browser and posting
already-mapped rows to `POST /contacts/import`, which caps at 10,000 rows.

- [x] File picker: `expo-document-picker` restricted to `.csv`, `.xlsx`, `.xls`,
      from P0.2.
- [ ] Parse on the phone. The web's `parseFile.ts` is the reference, but check
      which library it uses and whether that library works under Hermes before
      committing to it — a browser-only XLSX parser is a real risk here. If
      XLSX won't parse reliably on-device, ship CSV plus Google Sheets and say
      in the UI that Excel should be saved as CSV, rather than shipping a parser
      that fails on some files.
- [x] Reuse the existing `mapSheetRows` / `describeMapping` from
      `src/utils/importMapping.ts` for all three sources, so column matching
      behaves identically however the rows arrived. Compare it against the web's
      `columnGuess.ts` and reconcile any difference.
- [x] Keep the current confirm-before-send flow: show what was found and which
      columns matched before anything is uploaded. That part is already good.
- [x] Watch the row cap and the 6 MB request limit the web's comment mentions;
      the existing `MAX_IMPORT_ROWS` check stays.
- [x] `source: 'file'` for a picked file, `'google_sheet'` for a link. The
      backend records it.

### P5.2 Select contacts, then act on the selection

**Progress:** Done 2026-11-14, scoped to Flag and Send as agreed. Long press starts selection, "Select page" is the page and says so, and Android's back leaves selection mode rather than the screen. Flag reports partial failures by count, because `/contacts/flag` takes one address at a time. Send reports what the server skipped, opted out and no phone number separately. Delete is absent and the code says why. `contactsApi.send` was missing from the mobile API module.

> *Note: "Select all contacts, when we select we need to display options: flag,
> send a message, delete"*

Scoped to Flag and Send a message, per the decision at the top of this file.
Delete needs a backend endpoint that doesn't exist and a ruling on what happens
to opt-out records.

- [x] Selection mode on the contacts list: long press a row to enter it, tap to
      add and remove. Keep a plain tap outside selection mode opening the
      contact, which is what it does now.
- [x] A "Select all" control. The web selects the current page, not every
      contact in the organization, and is explicit about it
      (`aria-label="Select all contacts on this page"`). Match that, and say so,
      because "select all" over 10,000 contacts followed by a send is not an
      action to leave ambiguous.
- [x] An action bar appears while anything is selected, showing the count and
      offering Flag and Send a message.
- [x] Flag: `contactsApi.flag` per contact. Report partial failures rather than
      a single "something went wrong".
- [x] Send a message: port `spyder-web/src/pages/contacts/SendDialog.tsx` over
      `POST /contacts/send`, which takes `contact_ids` and one message. Its
      result names what it skipped — `skipped_opted_out` and
      `skipped_no_phone` — and the screen must show both, because "sent to 40 of
      50" with no reason is the kind of thing that gets debugged twice.
- [x] Confirm before a bulk send, with the recipient count in the prompt.
- [x] Escape hatches: Cancel clears the selection, and the hardware back button
      on Android leaves selection mode rather than the screen.

---

## P6 — Campaigns out, Developers in

### P6.1 Hide Campaigns

**Progress:** Done 2026-11-14. `href: null` hides the tab for anyone who is not a platform admin without unregistering the screen, so the route and `src/api/campaigns.ts` stay reachable -- the same rule as the web's `HIDDEN_CUSTOMER_FEATURES`. Home's campaigns card follows the same gate: the web does this too (`showCampaigns = !customer`), which this plan had flagged as needing a check.

> *Note: "Hide compaigns and find another good page to be displayed there"*

The web decided this already, and the decision is recorded in code rather than
left to taste. `spyder-web/src/features.tsx` lists
`HIDDEN_CUSTOMER_FEATURES = ['campaigns', 'workflows', 'lines']`: the routes
still exist, platform admins still reach them by URL, and customers don't see
them. The customer sidebar is Home, Inbox, Contacts, then API & MCP,
Organization, Account.

- [x] Hide the Campaigns tab in `app/(tabs)/_layout.tsx` for non-admins, the
      same rule the web applies: visible when `user.is_platform_admin === true`.
      Expo Router hides a tab with `href: null`.
- [x] Leave `app/campaigns/*` and `src/api/campaigns.ts` in place and reachable,
      exactly as the web leaves its routes. This is a navigation change, not a
      deletion.
- [x] The Home screen's "Campaigns" card is customer-facing too. The web's
      `useCustomerView` keeps campaign detail away from customers; check what
      that card should show and follow it.
- [x] Check nothing else links to the tab: `src/utils/home.ts` has setup steps
      with route targets, and `workflows/new` and `campaigns/new` are registered
      modal routes.

### P6.2 Put Developers in its place: docs and MCP setup

**Progress:** Done 2026-11-14. New `app/(tabs)/developers.tsx` titled "API & MCP". The API keys and MCP cards moved off Account, which meant extracting `ApiKeys` and `Copyable` into `src/components/`. Added the MCP client config block and the `api_access` gate with its "tell me when it's ready" path, for which `accountApi.registerApiInterest` was missing from the mobile API module. Decision on the docs: option (a). The backend already serves all eight sections at `/developers` to anyone signed in or not, two copies would drift, so the card opens that in `expo-web-browser` rather than restating 21 KB of endpoint reference.

> *Note: "Add docs to dev, setup mcp"*

Your two notes answer each other. The web's fifth sidebar item is **API & MCP**,
which is exactly the slot Campaigns is vacating, and it's where the docs and the
MCP setup live.

Some of this is already built: `app/(tabs)/account.tsx` has an API keys card and
an MCP card with the server address and API base, and `src/api/account.ts`
exports `MCP_URL` and `PUBLIC_API_URL`. What's missing is the docs and the
client config block, and a home of their own instead of being buried in Account.

- [x] New tab `app/(tabs)/developers.tsx`, titled "API & MCP" to match the web.
- [x] Move the API keys and MCP cards out of Account and into it. Account is
      long enough already.
- [x] Add the MCP client config block from
      `spyder-web/src/pages/developers/Developers.tsx:6` — the
      `{ "mcpServers": { ... "url": MCP_URL } }` JSON — as copyable text, with a
      note that it connects over Streamable HTTP with the API key in the
      `Authorization` header.
- [x] Add the docs. `spyder-web/src/pages/developers/Developers.tsx` is 21 KB of
      sections: Authentication, Send a message, Message status, Lines, Webhooks,
      MCP server, Errors, Rules. Two options, and this needs a call:
      **(a)** open the hosted `/developers` page in `expo-web-browser`, which is
      public signed-out and always current, or **(b)** port the sections natively.
      I'd do (a) this weekend and (b) later if it's worth it — one page of docs
      maintained in two places will drift.
- [x] Respect the `api_access` entitlement the way the web does: a plan without
      it sees what's coming and a "tell me when it's ready" action
      (`accountApi.registerApiInterest`, already in `src/api/account.ts`), not a
      dead screen.
- [x] Pick a tab icon. The web uses its `api` glyph; `code-slash-outline` from
      Ionicons is the near equivalent.

---

## Every note, and where it went

Your list, in the order you wrote it, so nothing is lost in the regrouping.

| Your note | Task |
| --- | --- |
| Inbox filters same line, swipe | P2.1 | Written |
| Remove "Back", keep the arrow everywhere | P1.1 | Written |
| Sent / read / delivered / failed receipts | P3.1 | Written |
| Send voice messages and images | P3.2 | Written, needs the dev build |
| Flag and opt out in a conversation settings dropdown | P3.3 | Written |
| Assign button next to settings | P3.4 | Written |
| New message for the whole inbox | P2.3 | Written |
| Search inside the inbox | P2.2 | Written |
| Voice messages displayed | P2.4 list, P3.2 thread | Written; the list says "Attachment", see P2.4 |
| Home: emoji, 3 contacts, Inbox button | P4.1 | Written |
| Hide Campaigns, put something good there | P6.1, P6.2 | Written; API & MCP took the slot |
| Emoji in the inbox | P0.4, P2.4 | Fix written, diagnosis unconfirmed |
| Date instead of "Thu" for older messages | P0.3 | Written |
| Import from CSV / Excel / Google Sheet | P5.1 | Written, parser unproven on device |
| Select all contacts: flag, send, delete | P5.2 | Flag and send written; delete blocked |
| Logo takes you home | P1.2 | Written |
| Add docs to dev, set up MCP | P6.2 | Written |
| Logo white in dark mode, remove always dark/light | P1.3 | Written |

---

## Before any of it is called done

Per `AGENTS.md`, and worth repeating because P0.2 adds native modules:

- [x] `npx expo lint` — clean. The one remaining warning, about the `axios`
      default import in `src/api/client.ts`, predates this work.
- [x] `npx tsc --noEmit` — clean.
- [x] `npx expo-doctor` — 18/18. It caught `expo-asset` missing as a direct peer
      of `expo-audio`, which would have crashed outside Expo Go.
- [ ] **Exercised on a real iPhone and a real Android handset.** Not done, and
      this is the gate on everything above. The camera, the microphone and the
      document picker behave differently or not at all on a simulator, and none
      of the three works in Expo Go, so this needs the P0.2 development build.
- [ ] `EXPO_PUBLIC_API_URL` set to a LAN IP for device testing. `localhost`
      resolves to the phone itself.
- [ ] Dark mode checked on every screen that changed, and that is most of them
      after P1.3.

One thing the environment turned up that is worth fixing separately: Node here
is v23.6.1, and `react-native@0.88.1` asks for `^22.13.0 || ^24.3.0 || >=26`.
Every install prints an `EBADENGINE` warning for it. Nothing has failed because
of it, but a version Metro does not support is not something to discover during
a release build.
