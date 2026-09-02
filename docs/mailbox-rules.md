# Gmail mailbox rules — client-side MVP

Normative spec for implementers. Conversation list, thread view, compose, search, and toolbar mutations MUST obey these rules. UI chrome that does not change mailbox state is out of scope.

RFC 2119 keywords: MUST, MUST NOT, SHOULD, MAY.

The current UI (`components/gmail-clone.tsx`) is a visual mock. It treats mail as flat rows, hard-codes folder membership, and deletes rows on archive. Do not copy that behavior.

---

## 1. Scope

In scope: one mailbox, conversation view on, category tabs on Inbox, local mutations, local search, undo of the last mutation, draft autosave, snooze with a client clock.

Out of scope: multiple accounts, server sync, IMAP, filters/rules engine, mute, scheduled send beyond undo-send, confidential mode, superstars, labs, keyboard shortcuts, pagination of >1 page, nested label trees, Contacts, Drive attachments as first-class objects, HTML sanitizer details, true SMTP.

Time source: the client clock. Snooze wake MUST be evaluated on an interval ≤ 30s and on window focus.

---

## 2. Data model

There is no folder. Membership is labels on messages. Views are predicates over conversations.

### 2.1 Identity

- `Mailbox.owner`: `{ name: string, email: string }` — the signed-in user. Email compare is case-insensitive.
- `LabelId`: system id (exact strings in §4) or user-label id (`ulbl_*`).
- `MessageId`, `ThreadId`, `DraftId`: opaque strings. Never reuse a deleted id in-session.

### 2.2 Message (source of truth)

```
Message {
  id: MessageId
  threadId: ThreadId
  from: Address
  to: Address[]
  cc: Address[]
  bcc: Address[]
  replyTo?: Address
  subject: string
  bodyText: string
  snippet: string                 // first ~100 chars of bodyText, whitespace-collapsed
  attachments: Attachment[]       // { id, filename, mimeType, sizeBytes }
  labelIds: Set<LabelId>
  internalDate: number            // epoch ms, immutable after send
  snoozeUntil?: number            // epoch ms; present iff SNOOZED ∈ labelIds
  draft?: {                       // present iff DRAFT ∈ labelIds
    draftId: DraftId
    toRaw: string                 // composer field as typed
    ccRaw: string
    bccRaw: string
    savedAt: number
  }
}
```

Labels live only on messages. Threads do not store labels.

### 2.3 Conversation (derived)

A conversation is the set of messages sharing `threadId`, ordered by `internalDate` ascending, then `id` ascending.

```
Conversation {
  id: ThreadId
  messages: Message[]             // all messages, including drafts / spam / trash
  labelIds: union(messages.labelIds)
  unread: some message has UNREAD and is not DRAFT
  starred: some message has STARRED
  important: some message has IMPORTANT
  hasAttachment: some non-hidden message has attachments.length > 0
  latest: the last message in `visibleMessages` for the current view;
          if that set is empty, the last message overall
  sortKey: latest.internalDate    // see unsnooze bump in §10
  snoozeUntil?: min(messages.snoozeUntil) among SNOOZED messages
}
```

`visibleMessages(conv, view)` is defined in §7. List rows and thread summaries MUST use `visibleMessages`, not the raw array.

### 2.4 User labels

```
UserLabel { id: LabelId, name: string, color?: string }
```

Names are unique per mailbox, compared case-insensitively, trimmed. Empty names are illegal. Names MUST NOT case-insensitively match a system label id or the display names in §4.3.

MVP: flat list. `/` in a name is a literal character, not a hierarchy.

---

## 3. Conversations vs messages

| Surface | Unit |
|---|---|
| List rows, selection, toolbar, star, snooze, archive, delete, spam, read/unread, label apply, search hits | Conversation |
| Compose body, send, draft autosave, reply quoting, per-message headers in thread view | Message |

Rules:

1. Opening a list row opens the conversation, not a single message. Thread view renders `visibleMessages` in date order. Messages that are drafts render as an inline draft card, not as a sent bubble.
2. A conversation is **in** a view iff `visibleMessages(conv, view)` is non-empty.
3. A conversation-level mutation MUST apply to every message in the conversation that the action names in §8–§13. It MUST NOT create a second conversation.
4. Reply and reply-all MUST insert a new message with the same `threadId`. Forward MUST create a new `threadId`.
5. A conversation MAY mix SENT, INBOX, DRAFT, STARRED, user labels. It MUST NOT be split by those labels.
6. List participant string: unique `from` addresses of visible messages, owner replaced with `"me"`, in date order, truncated in the UI. List subject: subject of `latest` with a single leading `Re:` / `Fwd:` preserved as stored. List snippet: `latest.snippet`.
7. Unread styling applies to the row iff `conversation.unread` is true.
8. Do not implement subject/participant threading heuristics. `threadId` is assigned at message creation and never changed.

---

## 4. System labels

Exact ids. These are reserved. User code MUST NOT create, rename, or delete them.

| Id | Display | Kind | Manually togglable | Notes |
|---|---|---|---|---|
| `INBOX` | Inbox | view + state | yes (via archive / move to inbox) | Membership in Inbox. |
| `STARRED` | Starred | view + state | yes | Independent of inbox. |
| `SNOOZED` | Snoozed | view + state | via snooze / unsnooze only | Requires `snoozeUntil`. |
| `SENT` | Sent | view + state | no | Set only by send. |
| `DRAFT` | Drafts | view + state | no | Set only by compose autosave. Removed on send. |
| `SPAM` | Spam | view + state | yes | Quarantine. |
| `TRASH` | Trash | view + state | yes | Quarantine. |
| `IMPORTANT` | Important | state | yes | Not a required sidebar row. |
| `UNREAD` | — | state | yes | No sidebar row. |
| `CATEGORY_PERSONAL` | Primary | inbox tab | via tab move | Primary tab. |
| `CATEGORY_SOCIAL` | Social | inbox tab | via tab move | |
| `CATEGORY_PROMOTIONS` | Promotions | inbox tab | via tab move | |
| `CATEGORY_UPDATES` | Updates | inbox tab | via tab move | |
| `CATEGORY_FORUMS` | Forums | inbox tab | via tab move | |

`All Mail` is not a label. It is a view (§6).

### 4.1 Category set

```
CATEGORY = {
  CATEGORY_PERSONAL,
  CATEGORY_SOCIAL,
  CATEGORY_PROMOTIONS,
  CATEGORY_UPDATES,
  CATEGORY_FORUMS
}
```

### 4.2 Sidebar (required)

Inbox, Starred, Snoozed, Sent, Drafts, then user labels, then under a “More” disclosure: Important (optional), Spam, Trash, All Mail.

Unread badges:

- Inbox badge = count of unread conversations in **Inbox ∩ Primary** (see §16). Other category unread counts live on the tabs, not on the Inbox row.
- Drafts badge = count of conversations that have at least one DRAFT message (not unread).
- Spam / Trash MAY show unread counts; default off.
- User labels: no badge in MVP unless a label is applied to unread inbox mail; then MAY show that unread count.

### 4.3 Reserved display names

`Inbox`, `Starred`, `Snoozed`, `Sent`, `Drafts`, `Spam`, `Trash`, `Important`, `Unread`, `All Mail`, `Primary`, `Social`, `Promotions`, `Updates`, `Forums`.

---

## 5. User labels

- Apply / remove is a conversation action: add or remove the id on **all** messages in the conversation (including drafts).
- A labeled conversation still appears in All Mail, Starred, Sent, etc. per those views’ predicates.
- While every remaining labeled message is in SPAM or TRASH, the conversation MUST NOT appear in that user-label view. Restoring from Trash/Spam reveals it again with the label intact.
- Archive, star, snooze, read/unread MUST NOT add or remove user labels.
- Delete and spam MUST NOT strip user labels; they only hide the conversation from the label view via the quarantine rule.
- Creating, renaming, deleting a user label is in MVP. Deleting a user label removes its id from every message and from the label list. It MUST NOT delete messages.

---

## 6. All Mail

All Mail is the set of conversations that have at least one message with neither `SPAM` nor `TRASH`.

- Inbox, Starred, Snoozed, Sent, Drafts, user labels, and archived mail are subsets of All Mail (a conversation can appear in several at once).
- Spam and Trash are **not** in All Mail.
- There is no `ARCHIVE` label. “Archived” means: not INBOX, not SNOOZED, not SPAM, not TRASH, and not draft-only.
- Search with no `in:` operator uses the All Mail corpus (§14).
- Category tabs MUST NOT render in All Mail.

---

## 7. View membership

### 7.1 Hidden vs visible messages

```
isQuarantined(m)  ≡  SPAM ∈ m.labelIds  ∨  TRASH ∈ m.labelIds

visibleMessages(conv, view):
  if view is Spam:   messages with SPAM
  if view is Trash:  messages with TRASH
  else:              messages where not isQuarantined(m)
                     then apply the view predicate below
```

Search `in:spam` / `in:trash` / `in:anywhere` overrides this (§14).

### 7.2 View predicates (after the quarantine filter)

A conversation is in the view iff at least one visible message matches:

| View | Message predicate |
|---|---|
| Inbox | `INBOX ∈ labels` |
| Inbox / Primary | Inbox predicate ∧ categoryOf(m) = `CATEGORY_PERSONAL` |
| Inbox / Social | Inbox predicate ∧ categoryOf(m) = `CATEGORY_SOCIAL` |
| Inbox / Promotions | Inbox predicate ∧ categoryOf(m) = `CATEGORY_PROMOTIONS` |
| Inbox / Updates | Inbox predicate ∧ categoryOf(m) = `CATEGORY_UPDATES` |
| Inbox / Forums | Inbox predicate ∧ categoryOf(m) = `CATEGORY_FORUMS` |
| Starred | `STARRED ∈ labels` |
| Snoozed | `SNOOZED ∈ labels` |
| Sent | `SENT ∈ labels` |
| Drafts | `DRAFT ∈ labels` |
| Spam | `SPAM ∈ labels` (no quarantine filter) |
| Trash | `TRASH ∈ labels` (no quarantine filter) |
| All Mail | not quarantined (already filtered) |
| User label `L` | `L ∈ labels` |
| Search | see §14 |

```
categoryOf(m):
  the single CATEGORY_* on m, if any
  else CATEGORY_PERSONAL          // uncategorized inbox mail is Primary
```

Inbox **list** (with tabs on) uses the active tab predicate. `in:inbox` search ignores tabs and returns every INBOX conversation.

### 7.3 Sort

Descending `sortKey`. Stable by `threadId`. Drafts view uses the draft’s `savedAt` if newer than `internalDate`.

---

## 8. Archive vs delete vs spam vs move to inbox

All four are conversation actions. They MUST run on every message in the conversation. They MUST be undoable (§15).

### 8.1 Archive

Precondition: conversation is not exclusively in Trash or Spam. If it is, Archive is not offered.

```
for each message:
  remove INBOX
  remove SNOOZED
  clear snoozeUntil
  do not touch STARRED, IMPORTANT, UNREAD, SENT, DRAFT, CATEGORY_*, user labels
```

Effect: conversation leaves Inbox and Snoozed. It remains in All Mail, Sent, Starred, Drafts, user labels as applicable.

Incoming reply to an archived thread (if/when inbound mail exists): add `INBOX` + `UNREAD` to the new message. The conversation returns to Inbox. Out of scope for a compose-only seed mailbox, but the mutation MUST be implemented on message-insert if inbound is added later.

### 8.2 Delete (move to Trash)

```
for each message:
  add TRASH
  remove INBOX, SNOOZED, SPAM
  clear snoozeUntil
  keep STARRED, IMPORTANT, UNREAD, SENT, DRAFT, CATEGORY_*, user labels
```

Effect: conversation is only in Trash. Not in All Mail, Inbox, search-default, Starred, user labels.

Restore / Move to Inbox from Trash:

```
for each message:
  remove TRASH
  add INBOX
  if the message has no CATEGORY_*: add CATEGORY_PERSONAL
```

Delete forever (Trash toolbar, or after 30 days): remove the messages from the store. If a conversation has no messages left, it is gone. Delete forever SHOULD be undoable only for the snackbar window; after that it is permanent. 30-day auto-empty is SHOULD for MVP (document the timer; a stub that never fires is acceptable if labeled as such).

Discarding a **draft** is not this action (§11.5).

### 8.3 Report spam

```
for each message:
  add SPAM
  remove INBOX, SNOOZED, TRASH
  clear snoozeUntil
  keep remaining labels
```

Not spam:

```
for each message:
  remove SPAM
  add INBOX
  if the message has no CATEGORY_*: add CATEGORY_PERSONAL
```

Spam is not All Mail. “Delete” from Spam runs §8.2 (SPAM is removed, TRASH is added).

### 8.4 Move to Inbox (unarchive)

Offered in All Mail, Starred, Sent, user labels, Trash (as restore), Spam (as Not spam).

```
for each non-DRAFT message:
  add INBOX
  remove SNOOZED, SPAM, TRASH
  clear snoozeUntil
  if no CATEGORY_*: add CATEGORY_PERSONAL
```

Draft-only conversations: Move to Inbox is a no-op; they stay in Drafts.

### 8.5 Action availability

| Current view | Archive | Delete → Trash | Spam | Move to Inbox | Delete forever |
|---|---|---|---|---|---|
| Inbox | yes | yes | yes | no | no |
| Starred / All Mail / user label / Sent | yes if INBOX present, else hide Archive | yes | yes | yes if INBOX absent | no |
| Snoozed | yes (also unsnoozes) | yes | yes | unsnooze is the primary | no |
| Drafts | no | discard drafts in conv (§11.5) | no | no | no |
| Spam | no | yes | no (Not spam instead) | Not spam | yes |
| Trash | no | no | no | yes | yes |
| Search | per the hit’s state, same as All Mail | | | | |

---

## 9. Star

- Star / unstar toggles `STARRED` on **all** messages in the conversation.
- Independent of INBOX, SNOOZED, IMPORTANT, UNREAD, user labels, categories.
- Starred view excludes quarantined messages (§7.1). Starring then trashing removes the row from Starred until restore.
- Star is not undo-snackbar’d; the control is itself a toggle.
- Per-message stars inside thread view are optional. If omitted, the thread-view star MUST be conversation-level and stay in sync with the list star.

---

## 10. Snooze until

Snooze is a conversation action with a required `until: epoch ms` where `until > now`.

### 10.1 Apply snooze

Precondition: conversation has at least one non-quarantined, non-draft-only message. MUST NOT snooze Trash, Spam, or draft-only conversations.

```
for each non-DRAFT message:
  remove INBOX
  add SNOOZED
  set snoozeUntil = until
```

Keep STARRED, IMPORTANT, UNREAD, SENT, CATEGORY_*, user labels.

Effect: leaves Inbox; appears in Snoozed and All Mail (and Starred / user labels if those labels exist).

Presets the UI MUST offer: Later today (18:00 local), Tomorrow (08:00), Later this week (Monday–Thursday → Friday 08:00; else Monday 08:00), This weekend (Saturday 08:00), Next week (Monday 08:00), Pick date & time. Exact preset mapping can vary by ±0 min; the stored value is the absolute timestamp.

### 10.2 Wake / unsnooze

Fired when `now >= snoozeUntil`, or on explicit Unsnooze, or when the owner sends a reply in the thread.

```
for each SNOOZED message:
  remove SNOOZED
  add INBOX
  clear snoozeUntil
  set internalDate = max(internalDate, now)   // bump to top
```

Do not add `UNREAD` on timer wake unless the conversation was already unread. Do not change category.

If a future inbound reply arrives on a snoozed thread: treat as unsnooze and add `UNREAD` on the new message.

### 10.3 Re-snooze

Allowed. Overwrites `snoozeUntil`. Still not in Inbox.

### 10.4 Interaction with other actions

Archive on a snoozed conversation: remove SNOOZED and INBOX (already absent), clear `snoozeUntil`. It does **not** return to Inbox later.

Delete / spam: §8 removes SNOOZED and cancels the timer.

---

## 11. Compose, send, draft autosave

MVP: one composer at a time.

### 11.1 Draft creation

Opening Compose does **not** immediately insert a message.

On first autosave where any of `toRaw`, `ccRaw`, `bccRaw`, `subject`, `bodyText`, `attachments` is non-empty:

```
create Message {
  new id, new threadId          // reply/reply-all reuse the existing threadId
  from = owner
  labelIds = { DRAFT }
  internalDate = now
  draft = { new draftId, fields, savedAt: now }
}
```

Reply / reply-all drafts also copy the parent subject/quoting (§12) and use the parent `threadId`. They MUST NOT add INBOX, SENT, or UNREAD.

### 11.2 Autosave

- Debounce 1000 ms after last edit while the composer is open (including minimized).
- Write fields onto the existing draft message; set `draft.savedAt = now`; set `internalDate = now` if it is still a draft.
- Composer MUST show `Saving…` during the write and `Draft saved` after.
- Closing the composer (X or minimize-then-navigate) MUST flush a pending debounce immediately.
- Empty draft at close (all fields empty, no attachments): delete the draft message if it exists; do not put it in Trash. If that was the only message in the thread, the conversation disappears.
- Persistence: in-memory is required. `localStorage` of drafts is SHOULD.

### 11.3 Send

Preconditions, checked in order:

1. At least one parseable address in To, Cc, or Bcc. Else block: “Please specify at least one recipient.”
2. Every non-empty address token MUST parse as `local@domain`. Else block with the offending token.
3. If `subject` is empty: confirm “Send this message without a subject?” Cancel aborts send.

On confirm:

```
remove DRAFT, delete message.draft
add SENT
do not add UNREAD
if this is a reply/reply-all AND the conversation had INBOX on any non-quarantined message
   immediately before send:
     add INBOX
     if no CATEGORY_*: add CATEGORY_PERSONAL
else:
     do not add INBOX          // new outgoing mail is Sent + All Mail, not Inbox
set internalDate = now
clear snoozeUntil; remove SNOOZED on this message
```

Then enter undo-send (§15.2). Until the undo window ends, the message is in a pending-send state: treat as SENT for list membership but do not consider it final. If the product cannot represent pending-send, keep DRAFT + a `sending` flag and only apply the SENT transition when the window elapses; the Sent list MUST still show it during the window.

Send MUST close the composer and clear its fields.

### 11.4 Minimize / restore

Minimize hides the body, keeps the draft, keeps autosave. Title bar shows subject or “New Message”.

### 11.5 Discard draft

Toolbar trash in the composer, or Delete in Drafts view on a conversation:

- If the conversation has only DRAFT messages: delete those messages (not Trash). Conversation gone.
- If the conversation has sent/received messages plus a draft: delete only messages with `DRAFT`. The conversation remains.

Discard is undoable for the snackbar window by restoring the deleted draft message(s).

---

## 12. Reply, reply-all, forward

Operate on the **focused message** in thread view, defaulting to `latest` non-draft visible message. If there is no such message, disable the actions.

Shared: open composer, create/reuse a draft as in §11, quote the focused message in `bodyText` as:

```
On {date}, {from.name} <{from.email}> wrote:
> {each line of focused.bodyText}
```

Do not copy `UNREAD`, `INBOX`, `STARRED` onto the new draft.

### 12.1 Reply

- `threadId` = parent thread.
- To = `parent.replyTo ?? parent.from`. If that address is the owner (the user is replying to their own sent message), To = original `to[0]` instead.
- Cc, Bcc empty.
- Subject = parent.subject prefixed with `Re: ` unless it already matches `/^re:\s/i`.

### 12.2 Reply all

- `threadId` = parent thread.
- To = `[parent.replyTo ?? parent.from, ...parent.to]` with owner removed, then deduped case-insensitively, preserving order.
- Cc = `parent.cc` with owner removed and any address already in To removed.
- Bcc empty.
- If after owner-removal To is empty, To = `[parent.from]`.
- Subject same as Reply.

### 12.3 Forward

- **New** `threadId`.
- To, Cc, Bcc empty (user must fill).
- Subject = parent.subject prefixed with `Fwd: ` unless it already matches `/^fwd:\s/i`.
- Attachments: copy parent.attachments onto the draft (same filenames; new attachment ids).
- Body quote header SHOULD say “---------- Forwarded message ---------” plus From/Date/Subject/To.

Forward is not in the parent conversation and MUST NOT change the parent’s labels.

---

## 13. Mark read / unread

Unread state is the `UNREAD` label.

- Conversation is unread iff any **non-draft** message has `UNREAD`.
- Opening a conversation (list click → thread view) MUST remove `UNREAD` from every non-draft visible message. This is not snackbar-undoable.
- Mark as read (toolbar / bulk): remove `UNREAD` from all messages.
- Mark as unread: add `UNREAD` to the latest non-draft non-quarantined message. If none, no-op.
- Drafts are never unread. Autosave MUST NOT add `UNREAD`.
- Send MUST NOT add `UNREAD` to the sent copy.
- A future inbound message MUST be created with `UNREAD` (and usually `INBOX`).

IMPORTANT is independent: toggle adds/removes `IMPORTANT` on all messages. No snackbar.

---

## 14. Search operators

Search is evaluated against messages, then lifted to conversations: a conversation matches iff **at least one message in the search corpus satisfies every token**.

### 14.1 Corpus

Default: not quarantined (All Mail).

| Operator | Corpus override |
|---|---|
| `in:spam` | SPAM messages only |
| `in:trash` | TRASH messages only |
| `in:anywhere` | all messages, including spam and trash |

If several `in:` tokens appear, the message MUST match all of them (usually empty). `in:anywhere` plus another `in:` is the other `in:` (anywhere does not restrict).

### 14.2 Grammar (MVP)

Tokenize on whitespace. `key:value` is an operator token. `"quoted phrase"` is one term and may contain spaces. Remaining tokens are bare terms.

```
query     := token*
token     := operator | phrase | term
operator  := from:VALUE | to:VALUE | subject:VALUE
           | is:unread | is:starred | is:important | is:snoozed
           | has:attachment
           | in:INVALUE
           | label:VALUE
INVALUE   := inbox | sent | drafts | draft | spam | trash
           | starred | snoozed | important | anywhere
VALUE     := "quoted" | unquoted-run   // unquoted stops at whitespace
```

Unknown `key:value` tokens MUST be treated as bare terms (the whole string). Operator keys are case-insensitive. Values are case-insensitive.

No `OR`, no `-negation` in MVP. Tokens combine with AND.

### 14.3 Operators

Let `hay*` be lowercase strings.

| Token | Message matches if |
|---|---|
| `from:V` | `V` is a substring of `from.email` or `from.name` |
| `to:V` | `V` is a substring of any `to`/`cc`/`bcc` email or name |
| `subject:V` | `V` is a substring of `subject` |
| `is:unread` | `UNREAD ∈ labels` |
| `is:starred` | `STARRED ∈ labels` |
| `is:important` | `IMPORTANT ∈ labels` |
| `is:snoozed` | `SNOOZED ∈ labels` |
| `has:attachment` | `attachments.length > 0` |
| `in:inbox` | `INBOX ∈ labels` |
| `in:sent` | `SENT ∈ labels` |
| `in:drafts` / `in:draft` | `DRAFT ∈ labels` |
| `in:spam` | `SPAM ∈ labels` |
| `in:trash` | `TRASH ∈ labels` |
| `in:starred` | `STARRED ∈ labels` |
| `in:snoozed` | `SNOOZED ∈ labels` |
| `in:important` | `IMPORTANT ∈ labels` |
| `in:anywhere` | true (corpus already widened) |
| `label:V` | some user label on the message has `name` equal to `V` with spaces/`-` folded (`"Work travel"` ≡ `work-travel` ≡ `worktravel` not required; fold only space ↔ `-`). System ids also match: `label:inbox` ≡ `in:inbox`. |
| phrase `"P"` | `P` is a substring of `from`/`to`/`cc`/`bcc`/`subject`/`bodyText` |
| bare `T` | `T` is a substring of the same fields |

### 14.4 Search UX

- Submitting search (Enter) navigates to the Search view: no category tabs, title “Search results”, query preserved in the box.
- Clearing the box returns to the previous sidebar view.
- Sidebar selection: Search is not a nav row; highlight none or keep the previous row visually dimmed. Do not mix the previous view predicate with the query.
- Operators in the box are stripped of the raw query only for matching; the box keeps the user’s text.

---

## 15. Bulk select and undo snackbar

### 15.1 Selection

- Selection is a set of `ThreadId` in the **current view’s current list**.
- Row checkbox toggles one id.
- Shift-click selects the inclusive range between the last-toggled row and the current row, in list order. Required.
- Header checkbox: if any visible row is unselected, select all visible rows; else select none. Does not mean “entire mailbox.”
- Changing view, category tab, or search query MUST clear selection.
- Opening a thread MAY clear selection.
- Selection-dependent toolbar (Archive, Delete, Spam, Mark read/unread, Snooze, Label) is shown iff `selection.size > 0`. Refresh, compose, select-all remain.
- Bulk actions apply the same mutation to every selected conversation, as one transaction, one undo.

Empty selection: those actions are not runnable. Do not toast “Select at least one message”; the controls are hidden.

### 15.2 Undo snackbar

Exactly one pending undo. A new undoable action commits the previous one.

| Action | Snackbar copy (n=1 / n>1) | Window | Inverse |
|---|---|---|---|
| Archive | Conversation archived / n conversations archived | 5s | restore prior labels + snoozeUntil |
| Delete → Trash | Conversation moved to Trash / n conversations moved to Trash | 5s | restore prior labels + snoozeUntil |
| Delete forever | Conversation deleted forever / n … | 5s | re-insert removed messages |
| Spam | Conversation marked as spam / n … | 5s | restore prior labels |
| Not spam / Move to Inbox | Conversation moved to Inbox / n … | 5s | restore prior labels |
| Snooze | Conversation snoozed until {time} / n conversations snoozed | 5s | restore prior labels + snoozeUntil |
| Unsnooze | Conversation moved to Inbox | 5s | restore SNOOZED + snoozeUntil, remove INBOX |
| Discard draft | Draft discarded / n drafts discarded | 5s | re-insert draft messages |
| Send | Message sent. Undo | 5s | abort send; restore composer + DRAFT (§11.3) |
| Label apply/remove | Label applied / Label removed | 5s | inverse label set |
| Mark read/unread | (no snackbar) | — | — |
| Star, Important | (no snackbar) | — | — |

Implementation: snapshot the affected messages (deep copy of `labelIds`, `snoozeUntil`, `draft`, and for send/discard the full message) **before** mutating. Undo replaces them. After the window, drop the snapshot.

Rules:

- Snackbar MUST include an Undo button that runs the inverse and then dismisses.
- It MUST be `role="status"` and must not steal focus.
- Clicking Undo MUST NOT open a new undo for the undo itself.
- Navigating views does not commit early; only timeout, a newer undoable action, or unmount commits.
- During the send undo window the message MUST remain retractable as specified in §11.3.

---

## 16. Category tabs — Inbox only

Render Primary, Social, Promotions, Updates, Forums **if and only if**:

```
activeView === Inbox  ∧  searchQuery is empty  ∧  thread view is not full-page replacing the list
```

MUST NOT render on Starred, Snoozed, Sent, Drafts, Spam, Trash, All Mail, user labels, or search results.

Behavior:

- Exactly one tab selected. Default Primary on entering Inbox. Remember the last Inbox tab for the session.
- Switching tabs clears selection, does not mark read, does not change labels.
- Each tab lists Inbox conversations whose `categoryOf(latest visible inbox message)` equals that tab’s category.
- Unread count on a tab = unread conversations in that tab’s predicate.
- A conversation appears in **one** Inbox tab, never two.
- “Move to tab” (if offered in the Move menu): on all INBOX messages in the conversation, remove every `CATEGORY_*`, add the target category. Non-inbox messages unchanged.

Uncategorized mail is Primary (`categoryOf` default).

---

## 17. Empty states

Show when the current list’s conversation count is 0. Do not show a fake “1–0 of 0”. Hide pagination.

| View | Title | Body | Primary action |
|---|---|---|---|
| Inbox / Primary | Your Primary tab is empty | Mail from people you know will show up here. | none |
| Inbox / Social | No conversations in Social | Social updates will appear here. | none |
| Inbox / Promotions | No conversations in Promotions | Offers, deals, and marketing mail will appear here. | none |
| Inbox / Updates | No conversations in Updates | Receipts, alerts, and other updates will appear here. | none |
| Inbox / Forums | No conversations in Forums | Mailing lists and forums will appear here. | none |
| Starred | No starred conversations | Star conversations you want to find later. They stay starred after you archive them. | none |
| Snoozed | No snoozed conversations | Snooze a conversation to hide it from Inbox until a time you choose. | none |
| Sent | No sent messages | Messages you send will appear here. | Compose |
| Drafts | No drafts | A draft is saved automatically when you start writing. | Compose |
| Spam | Hooray, no spam here! | Messages reported as spam will appear here for 30 days. | none |
| Trash | No conversations in Trash | Deleted conversations stay here for 30 days, then are removed forever. | none |
| All Mail | No messages | All Mail contains everything except Spam and Trash. | Compose |
| User label | No conversations with the label “{name}” | Apply this label from the list or thread view. Archiving does not remove it. | none |
| Search | No messages matched your search | Try different keywords. Search spam and trash with `in:anywhere`. | none |

Do not reuse a generic “No messages here / Return to inbox” for every view.

---

## 18. Invariants

These MUST hold after every mutation, including undo. Assert them in tests.

**I1 — Label locus.** Every label id on a message is either a system id in §4 or a current user-label id. Orphan ids are illegal.

**I2 — Quarantine mutex.** `SPAM` and `TRASH` MUST NOT both be on the same message.

**I3 — Inbox mutex.** If `SPAM` or `TRASH` or `SNOOZED` is on a message, `INBOX` MUST NOT be.

**I4 — Snooze fields.** `SNOOZED ∈ labels` iff `snoozeUntil` is a number. If set, `snoozeUntil > internalDate - 1ms` is not required, but `snoozeUntil` MUST be in the future at apply-time.

**I5 — Draft fields.** `DRAFT ∈ labels` iff `message.draft` is present. A DRAFT message MUST NOT have `SENT`, `SPAM`, or `UNREAD`. A DRAFT message MAY have `INBOX` only if it is a reply draft in an inbox thread; MVP SHOULD omit `INBOX` on drafts and still show the conversation in Inbox via the other messages.

**I6 — Sent.** `SENT` is added only by §11.3. User actions MUST NOT toggle `SENT`. A message MAY have both `SENT` and `INBOX` (reply in an inbox thread). A message MUST NOT have both `SENT` and `DRAFT`.

**I7 — Category cardinality.** A message has 0 or 1 ids from `CATEGORY`. Inbox messages SHOULD have 1. After Move to Inbox / Not spam / tab move, they MUST have 1.

**I8 — All Mail exclusion.** A conversation is in All Mail iff it has ≥1 non-quarantined message. Equivalently: Spam-only and Trash-only conversations are absent from All Mail, Inbox, Starred, Snoozed, Sent, Drafts, user labels, and default search.

**I9 — Archive purity.** Archive removes only `INBOX` and `SNOOZED`. It never adds `TRASH` or `SPAM`. It never strips user labels, `STARRED`, `IMPORTANT`, `SENT`, `DRAFT`, or `CATEGORY_*`.

**I10 — Delete purity.** Delete adds `TRASH` and removes `INBOX`, `SNOOZED`, `SPAM`. It never strips user labels or `STARRED`.

**I11 — Conversation closure.** Archive, delete, spam, snooze, star, important, read/unread, and user-label apply/remove act on every message of the thread (subject to the per-action “non-DRAFT” clauses). Partial-thread archive is illegal.

**I12 — Tabs ⊂ Inbox.** Category tabs exist only in Inbox with an empty search. Tab predicates always include `INBOX`.

**I13 — Primary default.** `categoryOf` never returns undefined. Missing category ≡ `CATEGORY_PERSONAL`.

**I14 — Unread definition.** `conversation.unread` ignores drafts. Opening a thread clears `UNREAD` on visible non-drafts.

**I15 — Single undo.** At most one pending snapshot. Undo restores byte-for-byte the snapshotted messages (ids included) and does not enqueue another undo.

**I16 — Selection locality.** Selection ids are a subset of the currently listed conversation ids. After a mutation, drop ids that no longer match the view.

**I17 — Owner send.** Every SENT or DRAFT message has `from.email` equal to `owner.email`.

**I18 — Thread id stability.** `message.threadId` is immutable. Forward creates a new thread. Reply does not.

**I19 — No implicit delete.** Empty views, category switches, and search MUST NOT remove messages from the store.

**I20 — Star independence.** Toggling `STARRED` MUST NOT change `INBOX`, `SNOOZED`, `UNREAD`, or user labels.

---

## 19. Suggested TypeScript shapes

Non-normative, but this is the intended store. Views are selectors, not fields on the message.

```ts
type SystemLabel =
  | 'INBOX' | 'STARRED' | 'SNOOZED' | 'SENT' | 'DRAFT'
  | 'SPAM' | 'TRASH' | 'IMPORTANT' | 'UNREAD'
  | 'CATEGORY_PERSONAL' | 'CATEGORY_SOCIAL' | 'CATEGORY_PROMOTIONS'
  | 'CATEGORY_UPDATES' | 'CATEGORY_FORUMS'

type View =
  | { type: 'inbox'; category: 'CATEGORY_PERSONAL' | 'CATEGORY_SOCIAL'
      | 'CATEGORY_PROMOTIONS' | 'CATEGORY_UPDATES' | 'CATEGORY_FORUMS' }
  | { type: 'starred' | 'snoozed' | 'sent' | 'drafts' | 'spam' | 'trash' | 'all' }
  | { type: 'label'; labelId: string }
  | { type: 'search'; query: string }
```

Do not store `folder: 'Inbox'` on messages. Do not `filter` messages out of the array to archive them.

---

## 20. Acceptance checks (minimum)

1. Archive an inbox conversation: gone from Inbox, present in All Mail with the same user labels and star; Undo restores Inbox.
2. Delete that conversation: only in Trash; All Mail and the user label view empty of it; restore puts it in Inbox.
3. Mark spam, then Not spam: lands in Inbox / Primary.
4. Star, then archive: present in Starred and All Mail, absent from Inbox.
5. Snooze until 1 minute ahead: leaves Inbox, appears in Snoozed; after the clock fires, top of Inbox, not in Snoozed.
6. Compose, wait for “Draft saved”, close: Drafts list has it. Send with a recipient: Drafts empty, Sent has it, Inbox does not. Undo send restores the draft.
7. Reply in an inbox thread and send: thread stays in Inbox and appears in Sent; one conversation, two+ messages.
8. Forward: new conversation in Sent, parent unchanged.
9. `from:figma is:unread` does not return starred-but-read mail from Figma.
10. Category tabs disappear on Starred and on any search. Primary empty-state copy is the Primary copy, not a generic empty inbox.
11. Select two Inbox rows, delete: one snackbar “2 conversations moved to Trash”; Undo restores both.
12. Invariants I1–I20 hold on the seed dataset and after each check above.
