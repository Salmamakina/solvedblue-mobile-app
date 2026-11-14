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

| Phase | What it covers | Tasks | Done | State |
| --- | --- | --- | --- | --- |
| P0 | Shared groundwork | 4 | 0 | Not started |
| P1 | App chrome: back arrow, logo, dark mode | 3 | 0 | Not started |
| P2 | Inbox list | 5 | 0 | Not started |
| P3 | Conversation | 5 | 0 | Not started |
| P4 | Home | 1 | 0 | Not started |
| P5 | Contacts | 2 | 0 | Not started |
| P6 | Campaigns out, Developers in | 2 | 0 | Not started |

Phases are ordered by dependency, not by importance. P0 is shared plumbing that
P2, P3 and P5 all import, so it goes first. After that, P1 through P6 are
independent of each other and can be done in any order, or by different people.

Update the table and the **Progress** line under each task as work lands. The
convention: `Not started` → `In progress` → `Done <date>`, and a one-line note
when something turned out differently than planned.

---

## Two things I need from you

These are the only items I can't settle by reading the code.

### 1. Deleting contacts needs a backend endpoint that does not exist

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

**Progress:** Not started

The contract already exists and is the same one the web uses.
`POST /api/media` takes the raw file bytes with the file's `Content-Type` and
returns `{ id, url, kind }`, where `kind` is `'image'` or `'audio'`. `url` is
`/api/media/<uuid>`. `GET /api/media/:id` is public by its random id and needs no
token, so an RN `<Image>` and an audio player can both read it directly. The
limit is 10 MB; accepted types are JPEG, PNG, GIF, WebP, HEIC, and M4A, AAC or
MP3 for audio (`spyder-backend/src/services/media.ts`).

- [ ] Add `src/api/media.ts`, mirroring `spyder-web/src/api/media.ts`:
      `MAX_MEDIA_BYTES`, `PICTURE_TYPES`, `mediaApi.upload`, `mediaSrc`.
      `mediaSrc` has to prepend our base URL, the same way the web prepends
      `VITE_API_URL`; on the phone a bare `/api/media/x` resolves to nothing.
- [ ] Upload from a local `file://` URI, which is what the pickers return. The
      web posts a `Blob`; RN can't. Read the file and post the bytes with the
      right `Content-Type`, and give the request its own 60 s timeout like the
      web does, because the shared axios timeout is for JSON.
- [ ] Extend `ChatMessage` in `src/api/messages.ts` with the four fields the
      backend already returns and the mobile type is missing: `read_at`,
      `media_url`, `media_kind`, `error_note`. Add `mediaUrl` to
      `SendMessageRequest`. Confirmed present in the response built at
      `spyder-backend/src/routes/messages.ts:193` and `:373`.
- [ ] Map the error codes to wording, porting `sendFailureText` from the web's
      `Composer.tsx`: `media_too_large`, `media_type`, `media_empty`, 413,
      `opted_out`.

### P0.2 Native modules and a development build

**Progress:** Not started

Pictures, recordings and file import all need native code that Expo Go does not
carry, so this is the one task that must finish before P3.2 and P5.1 can be
tested on a phone at all.

Verified against the SDK 58 reference (`docs.expo.dev/versions/v58.0.0/`), not
from memory — `expo` in `package.json` is `~58.0.25`:

- [ ] `npx expo install expo-image-picker expo-audio expo-document-picker expo-image expo-file-system`
- [ ] Add the permission strings to `app.json` as config plugin options, so CNG
      generates them. `expo-audio` takes `microphonePermission`; `expo-image-picker`
      takes `photosPermission` and `cameraPermission`. Do **not** hand-edit
      `android/` or `ios/`; they're generated and `.gitignore`d.
- [ ] `npx expo run:ios` / `run:android`, or `eas build --profile development`,
      and confirm the app boots with the new modules linked.
- [ ] `npx expo-doctor` clean.

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

**Progress:** Not started

> *Note: "If the message is older we need date instead of Thu"*

`shortTime` in `src/utils/format.ts` prints the weekday for anything under seven
days old, so a message from last Tuesday says `Tue` with no way to tell it from
this Tuesday. The web settled this already in `formatListTime`
(`spyder-web/src/pages/inbox/ThreadList.tsx`): time of day today, `Yesterday`,
the full weekday within the week, then `Oct 19`.

- [ ] Port `formatListTime` as `listTime` in `src/utils/format.ts`, keeping the
      web's exact thresholds so the two apps never disagree about the same row.
- [ ] Use it in the inbox list, the Home "Waiting on you" card, and the contacts
      list. All three call `shortTime` today.
- [ ] Separately, port the web's in-thread stamp rule from `Thread.tsx`:
      `Today 8:02 AM`, `Yesterday 4:05 PM`, `Mon, 20 Oct at 4:05 PM`, shown
      above a message only when more than an hour has passed since the one
      before it. Feeds P3.1.

### P0.4 Find out why emoji don't show, before changing anything

**Progress:** Not started

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
- [ ] Fix accordingly, then re-check the same three surfaces: the thread, the
      inbox row preview, and Home's "Waiting on you".
- [ ] Record the answer here, so the next person doesn't repeat the diagnosis.

Picking emoji to *send* is a separate thing and lives in P3.2.

---

## P1 — App chrome

Small, visible, and touches every screen. Good first commits.

### P1.1 Back arrow only, no "Back" label

**Progress:** Not started

> *Note: "Remove the back and keep the arrow for all pages when we have back
> button keep just the arrow"*

Six stack screens set a back-button label in `app/_layout.tsx`: `'Back'` on
`chat/[phone]`, and `'Campaigns'`, `'Contacts'`, `'Account'`, `'Account'` on the
rest. `app/campaigns/[id].tsx:206` also draws its own "Back to campaigns" text
button in the body.

- [ ] Replace every `headerBackTitle` with
      `headerBackButtonDisplayMode: 'minimal'` in the Stack's shared
      `screenOptions`, so it's one rule rather than six and new screens inherit
      it. On Android the label was never shown anyway, so this only changes iOS.
- [ ] Drop the per-screen `headerBackTitle` lines.
- [ ] Replace the in-body "Back to campaigns" button on the campaign detail
      screen with the header arrow alone.
- [ ] Walk every pushed screen on an iPhone and confirm: arrow, no word.

### P1.2 The logo goes home

**Progress:** Not started

> *Note: "Logo takes you to home"*

`src/components/AppHeader.tsx` draws the mark and the wordmark as plain,
non-interactive views.

- [ ] Wrap the mark and wordmark in one `Pressable` that calls
      `router.push('/(tabs)/home')`, with `accessibilityRole="link"` and a label
      of "Solvedblue, home".
- [ ] Keep it a single touch target covering both, 44 pt minimum, and leave the
      Contact sales button outside it.
- [ ] From Home, make it a no-op rather than pushing Home onto itself.

### P1.3 The logo in dark mode, and one appearance path

**Progress:** Not started

> *Note: "Logo when it's dark needs to be white like visible, remove always
> dark, always light"*

Two separate bugs in one note. `Wordmark.tsx` hard-codes `brand.navy` for
"Solved" regardless of theme, which on the dark palette is navy on near-black.
And `assets/solvedblue-mark.png` is a fixed-colour PNG with the same problem.

- [ ] Make `Wordmark` read `useTheme()` and use white for "Solved" when `dark`,
      keeping "blue" in `brand.blue`, which has enough contrast on both
      palettes. Check the result against WCAG AA.
- [ ] Give the mark a light-on-dark treatment: either a second asset or a
      `tintColor`. Check it on the sign-in screen too, which deliberately runs
      `useLightTheme()` and must keep the navy version.
- [ ] Per the decision above, remove `'light'` and `'dark'` from
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

**Progress:** Not started

> *Note: "For the inbox, filters should be same line and you should swipe"*

The five folder chips are in a `flexWrap: 'wrap'` row, so on a narrow phone
"Flagged" and "Closed" drop to a second line and the list below loses a row of
height. The web hit this and solved it the same way you're asking for: a
horizontally scrolling row of tabs on phones (`FolderTabs`, `variant="bar"`).

- [ ] Change the folder row to a horizontal `ScrollView` with
      `showsHorizontalScrollIndicator={false}` and `flexWrap` removed, so the
      five chips stay on one line and scroll.
- [ ] Scroll the selected chip into view when the folder changes, which is what
      the web's `scrollIntoView` effect does. Otherwise tapping the tab badge
      can select a folder that's off-screen.
- [ ] Keep `accessibilityRole="tab"` and the counts in the spoken label.
- [ ] Decide and note whether swiping the *list* should also change folder.
      "You should swipe" could mean either. Scrolling the chip row is the web's
      behaviour and the safer default; a swipe on the list body would collide
      with P2.5's row actions.

### P2.2 Search

**Progress:** Not started

> *Note: "Search inside inbox"*

`inboxApi.list` already takes `q` and passes it to the server; the screen just
never sends one. The contacts screen already has the search field to copy.

- [ ] Add a search field above the folder row, styled like the one in
      `app/(tabs)/contacts.tsx`, with `accessibilityLabel="Search conversations"`.
- [ ] Put `q` in the react-query key and debounce it, so typing doesn't fire a
      request per keystroke.
- [ ] Distinguish the two empty states the way the web does: "No matches, try a
      different name or number" when searching, the per-folder hint otherwise.
      `emptyHint` already handles the second.

### P2.3 New message

**Progress:** Not started

> *Note: "Add new message for the whole inbox page"*

- [ ] Add a "New message" action in the inbox header row, beside the title.
- [ ] Port `spyder-web/src/pages/inbox/NewMessageDialog.tsx` as a modal route,
      `app/inbox/new.tsx`, registered in `app/_layout.tsx` with
      `presentation: 'modal'` like `contacts/new`.
- [ ] Use `GET /contacts/send-preview?to=` before sending, which the web does.
      It reports `opted_out`, `first_contact` and `quiet_until`, so the screen
      can warn that a first message will wait for quiet hours instead of looking
      broken when nothing sends.
- [ ] On success, open the new conversation rather than returning to the list.
- [ ] Offer it from the empty state too, as the web does for the `all` folder.

### P2.4 Previews: emoji, and say when there's a voice message

**Progress:** Not started

> *Notes: "Emojis needs to be displayed in inbox", "Voice message needs to be
> displayed"*

A row whose latest message is a picture or a recording has no `last_text`, so it
reads "No messages yet" — the same wording as a genuinely empty conversation.
The web shows `Attachment` there.

- [ ] Fall back to "Photo" or "Voice message" by `media_kind` when `last_text` is
      empty, and keep "No messages yet" only for an actually empty thread.
      `InboxThread` carries no media fields yet, so check what the server
      returns and extend the type, or derive it in the thread query.
- [ ] Apply whatever P0.4 concludes about emoji to the preview line.

### P2.5 Keep the long-press actions reachable

**Progress:** Not started

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

**Progress:** Not started

> *Note: "Sent, read, delivery, failed when we send a mesage we need read
> reciepts"*

Everything needed is already in the database and in the response. `read_at`
exists on `messages` (`db.ts:1171`), the relay posts it
(`routes/devices.ts:330`), the chat query selects it (`messages.ts:193`), and the
backend computes a safe-to-show `error_note` from the failure
(`messages.ts:373`). The mobile type simply doesn't declare the fields, which
P0.1 fixes, and the bubble shows only ` · failed`.

- [ ] Port `receiptText` from the web: `Read 4:21 PM` when `read_at`,
      `Delivered` when `delivered_at`, `Sent` when `status === 'sent'`.
- [ ] Show it under the **newest outgoing message only**, which is what iMessage
      does and what the web's `lastOutIndex` picks out. On every bubble it is
      noise.
- [ ] Mark every failed message, not just the newest: an older failure must not
      look sent. Show `error_note` and a "Try again" action that re-sends,
      carrying `media_url` over if there was one.
- [ ] Show `Sending…` for `status === 'pending'`.
- [ ] Note "Sent as text message" on an outgoing SMS, which is the web's cue
      that it didn't go as iMessage.
- [ ] Use the P0.3 in-thread stamps so the receipts have time context.

### P3.2 Send pictures and voice messages, and pick emoji

**Progress:** Not started

> *Notes: "Send voice message, images in the inbox", "Voice message needs to be
> displayed", "Emojis needs to be displayed in inbox"*

The composer is a text field and a Send button. The web's has a photo button, an
emoji panel of 32, a microphone with a running timer, and an attachment preview
that can be removed before sending. Needs P0.1 and P0.2.

- [ ] Photo: `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })`,
      validated against `PICTURE_TYPES` and the 10 MB limit before upload.
      Offer the camera as well, which the web can't.
- [ ] Voice: `expo-audio` per the P0.2 notes. Press to start, a visible timer,
      Stop and Cancel as separate actions, and a 120-second cap matching the
      web's `MAX_RECORDING_SECONDS`. Record as M4A — the backend accepts
      `audio/mp4`, `audio/x-m4a`, `audio/aac` and `audio/mpeg`, and an iPhone
      plays M4A.
- [ ] Release the microphone when the screen unmounts mid-recording. The web
      has an explicit effect for this and it's the bug worth copying the fix for.
- [ ] Attachment preview above the field, with a remove button, before sending.
- [ ] Emoji: port the web's 32-emoji panel and insert at the cursor. On a phone
      the system keyboard has emoji, so this is lower value than on the web —
      do it last in this task and drop it if the weekend runs short.
- [ ] Render inbound and outbound media in the thread: `expo-image` for a
      picture, tappable to full screen; an `expo-audio` player with play/pause
      and duration for a recording. Both read `mediaSrc(media_url)`, which needs
      no token.
- [ ] Mirror the web's two guards: the composer is disabled for an opted-out
      contact with the reason shown, and attachments are offered only on iMessage
      conversations, since SMS carries text only.

### P3.3 A settings menu with Flag and Mark as opted out

**Progress:** Not started

> *Note: "Add Flag and mark as opted out inside the conversation of someone as
> settings icon that has drop down"*

Both endpoints are live — `POST /contacts/flag` and `POST /contacts/opt-out` —
and the web has them as two header buttons plus a confirmation dialog
(`useFlagThread.ts`, `useOptOutThread.ts`).

- [ ] Add a settings (gear) button to the conversation header. The screen uses
      the stock navigator header, so this goes in `headerRight` via
      `navigation.setOptions`, next to the title that `useLayoutEffect` already
      sets.
- [ ] Dropdown items: Flag / Unflag, Mark as opted out, Close / Reopen. Closing
      is in the list's long-press menu today and belongs here too.
- [ ] Opting out must confirm first, and say what it does: the same block a STOP
      reply sets, and it cannot be undone from the app. Port the web's dialog
      wording. Hide the item when `tag === 'opted_out'` already.
- [ ] Invalidate both the chat and the inbox queries after each action, so the
      list, the row badges and the tab badge all agree.
- [ ] The chat screen reads `thread` state from nothing today — it only gets
      `phone` and `name` as params. It needs the thread's `flagged`, `closed`,
      `tag` and `assigned_user_id`, so either pass them through or read the
      thread from the inbox query cache.

### P3.4 Assign to someone

**Progress:** Not started

> *Note: "Assign to someone button next to settings inside the conversation of
> inbox"*

`inboxApi.assign(contact, userId)` exists on mobile already but is only ever
called with my own id, from the list's long press. The web has a full menu of
teammates (`AssignMenu` in `Thread.tsx`), fed by
`organizationsApi.getUsers(orgId)`.

- [ ] Put an assign button in `headerRight`, beside the settings gear, with the
      current assignee as its label: `Assign`, `Assigned to you`, or
      `Assigned to <email>`.
- [ ] Dropdown of `Unassigned` plus every organization member. `src/api/organizations.ts`
      already has the call the members screen uses.
- [ ] Gate it on the `team_inbox` entitlement, which the inbox list already
      checks via `account.data.entitlements.features.team_inbox`. Offering it
      without the feature means a 403 after the tap.
- [ ] Assign takes the thread's `contact` key, not `phone_number`. The existing
      `runAction` comment in `inbox.tsx` explains why; getting this wrong fails
      quietly.

### P3.5 Tidy the header

**Progress:** Not started

Not from your notes, but P3.3 and P3.4 both add to a header that currently holds
only a title, and iOS gives `headerRight` little room.

- [ ] Fit the gear and the assign control in `headerRight` without crowding the
      name. If both don't fit, the assignee's name moves into a subtitle and the
      control becomes an icon.
- [ ] Check it with a long contact name and with the P1.1 minimal back arrow.

---

## P4 — Home

### P4.1 "Waiting on you": three rows, an Inbox button, and emoji

**Progress:** Not started

> *Note: "Home page: Emojis needs to be displayed in the app (waiting on you),
> maximum 3 contacts and inbox button on the right of the header Waiting on
> you"*

`app/(tabs)/home.tsx` slices `data.waiting` to 5 and the card title is plain
text with nothing on the right.

- [ ] `.slice(0, 5)` → `.slice(0, 3)`.
- [ ] Add an "Inbox" action to the right of the card's title, pushing
      `/(tabs)/inbox`. `Card` takes a `title` string today, so it needs an
      optional right-hand slot — worth adding to the component rather than
      hand-rolling a header inside this one card, since the same pattern will
      want it elsewhere.
- [ ] Apply the P0.4 emoji fix to the preview line here.
- [ ] Use the P0.3 `listTime` for the row timestamps.
- [ ] With three rows and more waiting, the Inbox button is the way to see the
      rest; check it still reads that way when `waiting.length` is 20.

---

## P5 — Contacts

### P5.1 Import from CSV, Excel or a Google Sheet

**Progress:** Not started

> *Note: "Import contacts: from csv/execl/google sheet"*

`app/contacts/import.tsx` does Google Sheets only, and says so in its own header
comment: a file picker and a spreadsheet parser were the missing pieces. The web
does all three in `ImportDialog.tsx`, parsing in the browser and posting
already-mapped rows to `POST /contacts/import`, which caps at 10,000 rows.

- [ ] File picker: `expo-document-picker` restricted to `.csv`, `.xlsx`, `.xls`,
      from P0.2.
- [ ] Parse on the phone. The web's `parseFile.ts` is the reference, but check
      which library it uses and whether that library works under Hermes before
      committing to it — a browser-only XLSX parser is a real risk here. If
      XLSX won't parse reliably on-device, ship CSV plus Google Sheets and say
      in the UI that Excel should be saved as CSV, rather than shipping a parser
      that fails on some files.
- [ ] Reuse the existing `mapSheetRows` / `describeMapping` from
      `src/utils/importMapping.ts` for all three sources, so column matching
      behaves identically however the rows arrived. Compare it against the web's
      `columnGuess.ts` and reconcile any difference.
- [ ] Keep the current confirm-before-send flow: show what was found and which
      columns matched before anything is uploaded. That part is already good.
- [ ] Watch the row cap and the 6 MB request limit the web's comment mentions;
      the existing `MAX_IMPORT_ROWS` check stays.
- [ ] `source: 'file'` for a picked file, `'google_sheet'` for a link. The
      backend records it.

### P5.2 Select contacts, then act on the selection

**Progress:** Not started

> *Note: "Select all contacts, when we select we need to display options: flag,
> send a message, delete"*

Scoped to Flag and Send a message, per the decision at the top of this file.
Delete needs a backend endpoint that doesn't exist and a ruling on what happens
to opt-out records.

- [ ] Selection mode on the contacts list: long press a row to enter it, tap to
      add and remove. Keep a plain tap outside selection mode opening the
      contact, which is what it does now.
- [ ] A "Select all" control. The web selects the current page, not every
      contact in the organization, and is explicit about it
      (`aria-label="Select all contacts on this page"`). Match that, and say so,
      because "select all" over 10,000 contacts followed by a send is not an
      action to leave ambiguous.
- [ ] An action bar appears while anything is selected, showing the count and
      offering Flag and Send a message.
- [ ] Flag: `contactsApi.flag` per contact. Report partial failures rather than
      a single "something went wrong".
- [ ] Send a message: port `spyder-web/src/pages/contacts/SendDialog.tsx` over
      `POST /contacts/send`, which takes `contact_ids` and one message. Its
      result names what it skipped — `skipped_opted_out` and
      `skipped_no_phone` — and the screen must show both, because "sent to 40 of
      50" with no reason is the kind of thing that gets debugged twice.
- [ ] Confirm before a bulk send, with the recipient count in the prompt.
- [ ] Escape hatches: Cancel clears the selection, and the hardware back button
      on Android leaves selection mode rather than the screen.

---

## P6 — Campaigns out, Developers in

### P6.1 Hide Campaigns

**Progress:** Not started

> *Note: "Hide compaigns and find another good page to be displayed there"*

The web decided this already, and the decision is recorded in code rather than
left to taste. `spyder-web/src/features.tsx` lists
`HIDDEN_CUSTOMER_FEATURES = ['campaigns', 'workflows', 'lines']`: the routes
still exist, platform admins still reach them by URL, and customers don't see
them. The customer sidebar is Home, Inbox, Contacts, then API & MCP,
Organization, Account.

- [ ] Hide the Campaigns tab in `app/(tabs)/_layout.tsx` for non-admins, the
      same rule the web applies: visible when `user.is_platform_admin === true`.
      Expo Router hides a tab with `href: null`.
- [ ] Leave `app/campaigns/*` and `src/api/campaigns.ts` in place and reachable,
      exactly as the web leaves its routes. This is a navigation change, not a
      deletion.
- [ ] The Home screen's "Campaigns" card is customer-facing too. The web's
      `useCustomerView` keeps campaign detail away from customers; check what
      that card should show and follow it.
- [ ] Check nothing else links to the tab: `src/utils/home.ts` has setup steps
      with route targets, and `workflows/new` and `campaigns/new` are registered
      modal routes.

### P6.2 Put Developers in its place: docs and MCP setup

**Progress:** Not started

> *Note: "Add docs to dev, setup mcp"*

Your two notes answer each other. The web's fifth sidebar item is **API & MCP**,
which is exactly the slot Campaigns is vacating, and it's where the docs and the
MCP setup live.

Some of this is already built: `app/(tabs)/account.tsx` has an API keys card and
an MCP card with the server address and API base, and `src/api/account.ts`
exports `MCP_URL` and `PUBLIC_API_URL`. What's missing is the docs and the
client config block, and a home of their own instead of being buried in Account.

- [ ] New tab `app/(tabs)/developers.tsx`, titled "API & MCP" to match the web.
- [ ] Move the API keys and MCP cards out of Account and into it. Account is
      long enough already.
- [ ] Add the MCP client config block from
      `spyder-web/src/pages/developers/Developers.tsx:6` — the
      `{ "mcpServers": { ... "url": MCP_URL } }` JSON — as copyable text, with a
      note that it connects over Streamable HTTP with the API key in the
      `Authorization` header.
- [ ] Add the docs. `spyder-web/src/pages/developers/Developers.tsx` is 21 KB of
      sections: Authentication, Send a message, Message status, Lines, Webhooks,
      MCP server, Errors, Rules. Two options, and this needs a call:
      **(a)** open the hosted `/developers` page in `expo-web-browser`, which is
      public signed-out and always current, or **(b)** port the sections natively.
      I'd do (a) this weekend and (b) later if it's worth it — one page of docs
      maintained in two places will drift.
- [ ] Respect the `api_access` entitlement the way the web does: a plan without
      it sees what's coming and a "tell me when it's ready" action
      (`accountApi.registerApiInterest`, already in `src/api/account.ts`), not a
      dead screen.
- [ ] Pick a tab icon. The web uses its `api` glyph; `code-slash-outline` from
      Ionicons is the near equivalent.

---

## Every note, and where it went

Your list, in the order you wrote it, so nothing is lost in the regrouping.

| Your note | Task |
| --- | --- |
| Inbox filters same line, swipe | P2.1 |
| Remove "Back", keep the arrow everywhere | P1.1 |
| Sent / read / delivered / failed receipts | P3.1 |
| Send voice messages and images | P3.2 (needs P0.1, P0.2) |
| Flag and opt out in a conversation settings dropdown | P3.3 |
| Assign button next to settings | P3.4 |
| New message for the whole inbox | P2.3 |
| Search inside the inbox | P2.2 |
| Voice messages displayed | P2.4 (list), P3.2 (thread) |
| Home: emoji, 3 contacts, Inbox button | P4.1 |
| Hide Campaigns, put something good there | P6.1, P6.2 |
| Emoji in the inbox | P0.4, then P2.4 |
| Date instead of "Thu" for older messages | P0.3 |
| Import from CSV / Excel / Google Sheet | P5.1 |
| Select all contacts: flag, send, delete | P5.2 (delete is blocked) |
| Logo takes you home | P1.2 |
| Add docs to dev, set up MCP | P6.2 |
| Logo white in dark mode, remove always dark/light | P1.3 |

---

## Before any of it is called done

Per `AGENTS.md`, and worth repeating because P0.2 adds native modules:

- [ ] `npx expo lint`
- [ ] `npx tsc --noEmit`
- [ ] `npx expo-doctor`
- [ ] Exercised on a real iPhone and a real Android handset, not just a
      simulator. The camera, the microphone and the document picker all behave
      differently or not at all on a simulator.
- [ ] `EXPO_PUBLIC_API_URL` set to a LAN IP for device testing. `localhost`
      resolves to the phone itself.
- [ ] Dark mode checked on every screen that changed, and that is most of them
      after P1.3.
