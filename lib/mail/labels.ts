import type {
  Address,
  Attachment,
  CategoryLabel,
  ComposeState,
  LabelId,
  Mailbox,
  Message,
  SaveDraftInput,
  SystemLabel,
  UserLabel,
} from './types'

export const SYSTEM_LABELS: SystemLabel[] = [
  'INBOX',
  'STARRED',
  'SNOOZED',
  'SENT',
  'DRAFT',
  'SPAM',
  'TRASH',
  'IMPORTANT',
  'UNREAD',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
]

export const SYSTEM_LABEL_SET = new Set<string>(SYSTEM_LABELS)

export const CATEGORY_LABELS: CategoryLabel[] = [
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
]

export const CATEGORY_SET = new Set<string>(CATEGORY_LABELS)

export const RESERVED_DISPLAY_NAMES = [
  'Inbox',
  'Starred',
  'Snoozed',
  'Sent',
  'Drafts',
  'Spam',
  'Trash',
  'Important',
  'Unread',
  'All Mail',
  'Primary',
  'Social',
  'Promotions',
  'Updates',
  'Forums',
]

export const CATEGORY_TAB_META: { id: CategoryLabel; name: string }[] = [
  { id: 'CATEGORY_PERSONAL', name: 'Primary' },
  { id: 'CATEGORY_SOCIAL', name: 'Social' },
  { id: 'CATEGORY_PROMOTIONS', name: 'Promotions' },
  { id: 'CATEGORY_UPDATES', name: 'Updates' },
  { id: 'CATEGORY_FORUMS', name: 'Forums' },
]

export const IN_OPERATOR_LABEL: Record<string, SystemLabel | 'ANYWHERE'> = {
  inbox: 'INBOX',
  sent: 'SENT',
  drafts: 'DRAFT',
  draft: 'DRAFT',
  spam: 'SPAM',
  trash: 'TRASH',
  starred: 'STARRED',
  snoozed: 'SNOOZED',
  important: 'IMPORTANT',
  anywhere: 'ANYWHERE',
}

export const LABEL_COLOR_CYCLE = ['#1a73e8', '#188038', '#e37400', '#d93025', '#a142f4', '#c5221f', '#1967d2']

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/

export function hasLabel(message: Message, id: LabelId): boolean {
  return message.labelIds.includes(id)
}

export function addLabel(ids: LabelId[], id: LabelId): LabelId[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function removeLabel(ids: LabelId[], id: LabelId): LabelId[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : ids
}

export function removeLabels(ids: LabelId[], remove: LabelId[]): LabelId[] {
  if (!remove.length) return ids
  const drop = new Set(remove)
  const next = ids.filter((id) => !drop.has(id))
  return next.length === ids.length ? ids : next
}

export function setLabel(ids: LabelId[], id: LabelId, present: boolean): LabelId[] {
  return present ? addLabel(ids, id) : removeLabel(ids, id)
}

export function isQuarantined(message: Message): boolean {
  return hasLabel(message, 'SPAM') || hasLabel(message, 'TRASH')
}

export function isDraftMessage(message: Message): boolean {
  return hasLabel(message, 'DRAFT')
}

export function categoryOf(message: Message): CategoryLabel {
  const found = message.labelIds.find((id) => CATEGORY_SET.has(id))
  return (found as CategoryLabel) ?? 'CATEGORY_PERSONAL'
}

export function replaceCategory(ids: LabelId[], category: CategoryLabel): LabelId[] {
  return addLabel(removeLabels(ids, CATEGORY_LABELS), category)
}

export function emailsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function addressKey(address: Address): string {
  return address.email.trim().toLowerCase()
}

export function uniqueAddresses(addresses: Address[]): Address[] {
  const seen = new Set<string>()
  const result: Address[] = []
  for (const address of addresses) {
    const key = addressKey(address)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(address)
  }
  return result
}

export function formatAddress(address: Address): string {
  const name = address.name.trim()
  if (!name) return address.email
  return `${name} <${address.email}>`
}

export function formatAddressList(addresses: Address[]): string {
  return addresses.map(formatAddress).join(', ')
}

export type ParsedAddresses = {
  addresses: Address[]
  errors: string[]
  tokens: string[]
}

export function parseAddressList(raw: string): ParsedAddresses {
  const tokens = splitAddressTokens(raw)
  const addresses: Address[] = []
  const errors: string[] = []
  for (const token of tokens) {
    const parsed = parseOneAddress(token)
    if (!parsed) errors.push(token)
    else addresses.push(parsed)
  }
  return { addresses, errors, tokens }
}

function splitAddressTokens(raw: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of raw) {
    if (char === '"') inQuotes = !inQuotes
    if (char === ',' && !inQuotes) {
      const trimmed = current.trim()
      if (trimmed) tokens.push(trimmed)
      current = ''
      continue
    }
    current += char
  }
  const trimmed = current.trim()
  if (trimmed) tokens.push(trimmed)
  return tokens
}

function parseOneAddress(token: string): Address | null {
  const angled = token.match(/^(?:"?([^"<]*)"?\s*)?<([^<>]+)>$/)
  if (angled) {
    const email = angled[2].trim()
    if (!EMAIL_RE.test(email)) return null
    return { name: (angled[1] ?? '').trim(), email }
  }
  if (EMAIL_RE.test(token)) return { name: '', email: token }
  const named = token.match(/^(.+?)\s+([^\s@]+@[^\s@]+)$/)
  if (named && EMAIL_RE.test(named[2])) {
    return { name: named[1].replace(/^"|"$/g, '').trim(), email: named[2] }
  }
  return null
}

export function validateRecipients(input: { toRaw: string; ccRaw: string; bccRaw: string }):
  | { ok: true; to: Address[]; cc: Address[]; bcc: Address[] }
  | { ok: false; error: string } {
  const to = parseAddressList(input.toRaw)
  const cc = parseAddressList(input.ccRaw)
  const bcc = parseAddressList(input.bccRaw)
  const firstError = to.errors[0] ?? cc.errors[0] ?? bcc.errors[0]
  if (firstError) return { ok: false, error: `Invalid email address: ${firstError}` }
  if (to.addresses.length + cc.addresses.length + bcc.addresses.length === 0) {
    return { ok: false, error: 'Please specify at least one recipient.' }
  }
  return { ok: true, to: to.addresses, cc: cc.addresses, bcc: bcc.addresses }
}

export function includesOwner(addresses: Address[], ownerEmail: string): boolean {
  return addresses.some((address) => emailsEqual(address.email, ownerEmail))
}

export function makeSnippet(bodyText: string): string {
  return bodyText.replace(/\s+/g, ' ').trim().slice(0, 100)
}

export function isComposeEmpty(input: {
  toRaw: string
  ccRaw: string
  bccRaw: string
  subject: string
  bodyText: string
  attachments: Attachment[]
}): boolean {
  return (
    !input.toRaw.trim() &&
    !input.ccRaw.trim() &&
    !input.bccRaw.trim() &&
    !input.subject.trim() &&
    !input.bodyText.trim() &&
    input.attachments.length === 0
  )
}

export function replySubject(subject: string): string {
  return /^re:\s/i.test(subject) ? subject : `Re: ${subject}`
}

export function forwardSubject(subject: string): string {
  return /^fwd:\s/i.test(subject) ? subject : `Fwd: ${subject}`
}

export function formatMessageDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function quoteReply(message: Message): string {
  const quoted = message.bodyText.split('\n').map((line) => `> ${line}`).join('\n')
  return `On ${formatMessageDate(message.internalDate)}, ${formatAddress(message.from)} wrote:\n${quoted}`
}

export function quoteForward(message: Message): string {
  const to = formatAddressList(message.to) || '(none)'
  return [
    '---------- Forwarded message ---------',
    `From: ${formatAddress(message.from)}`,
    `Date: ${formatMessageDate(message.internalDate)}`,
    `Subject: ${message.subject}`,
    `To: ${to}`,
    '',
    message.bodyText,
  ].join('\n')
}

export function cloneAttachment(attachment: Attachment): Attachment {
  return { ...attachment }
}

export function cloneMessage(message: Message): Message {
  return {
    ...message,
    from: { ...message.from },
    to: message.to.map((address) => ({ ...address })),
    cc: message.cc.map((address) => ({ ...address })),
    bcc: message.bcc.map((address) => ({ ...address })),
    replyTo: message.replyTo ? { ...message.replyTo } : undefined,
    attachments: message.attachments.map(cloneAttachment),
    labelIds: [...message.labelIds],
    draft: message.draft ? { ...message.draft } : undefined,
  }
}

export function cloneMailbox(mailbox: Mailbox): Mailbox {
  return {
    owner: { ...mailbox.owner },
    messages: mailbox.messages.map(cloneMessage),
    userLabels: mailbox.userLabels.map((label) => ({ ...label })),
    nextId: mailbox.nextId,
  }
}

export function allocId(mailbox: Mailbox, prefix: string): { id: string; mailbox: Mailbox } {
  return {
    id: `${prefix}_${mailbox.nextId}`,
    mailbox: { ...mailbox, nextId: mailbox.nextId + 1 },
  }
}

export function copyAttachments(attachments: Attachment[], mailbox: Mailbox): { attachments: Attachment[]; mailbox: Mailbox } {
  let current = mailbox
  const copied: Attachment[] = []
  for (const attachment of attachments) {
    const allocated = allocId(current, 'att')
    current = allocated.mailbox
    copied.push({ ...attachment, id: allocated.id })
  }
  return { attachments: copied, mailbox: current }
}

export function foldLabelName(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '-')
}

export function isReservedLabelName(name: string): boolean {
  const folded = foldLabelName(name)
  if (SYSTEM_LABELS.some((id) => foldLabelName(id) === folded)) return true
  return RESERVED_DISPLAY_NAMES.some((display) => foldLabelName(display) === folded)
}

export function validateUserLabelName(name: string, labels: UserLabel[], ignoreId?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Label name cannot be empty.'
  if (isReservedLabelName(trimmed)) return `"${trimmed}" is a reserved name.`
  const folded = foldLabelName(trimmed)
  const duplicate = labels.find((label) => label.id !== ignoreId && foldLabelName(label.name) === folded)
  if (duplicate) return `A label named "${duplicate.name}" already exists.`
  return null
}

export function userLabelByName(labels: UserLabel[], value: string): UserLabel | undefined {
  const folded = foldLabelName(value)
  return labels.find((label) => foldLabelName(label.name) === folded)
}

export function systemLabelFromName(value: string): SystemLabel | undefined {
  const folded = foldLabelName(value)
  const fromIn = IN_OPERATOR_LABEL[folded]
  if (fromIn && fromIn !== 'ANYWHERE') return fromIn
  return SYSTEM_LABELS.find((id) => foldLabelName(id) === folded || foldLabelName(id.replace('CATEGORY_', '')) === folded)
}

export function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.internalDate - b.internalDate || a.id.localeCompare(b.id))
}

export function messagesForThreads(messages: Message[], threadIds: Iterable<string>): Message[] {
  const ids = new Set(threadIds)
  return messages.filter((message) => ids.has(message.threadId))
}

export function replaceMessages(mailbox: Mailbox, updated: Message[]): Mailbox {
  if (!updated.length) return mailbox
  const map = new Map(updated.map((message) => [message.id, message]))
  return {
    ...mailbox,
    messages: mailbox.messages.map((message) => map.get(message.id) ?? message),
  }
}

export function upsertMessages(mailbox: Mailbox, updated: Message[]): Mailbox {
  const map = new Map(mailbox.messages.map((message) => [message.id, message]))
  for (const message of updated) map.set(message.id, message)
  return { ...mailbox, messages: [...map.values()] }
}

export function removeMessagesById(mailbox: Mailbox, ids: Iterable<string>): Mailbox {
  const drop = new Set(ids)
  if (!drop.size) return mailbox
  return { ...mailbox, messages: mailbox.messages.filter((message) => !drop.has(message.id)) }
}

export function emptyCompose(overrides: Partial<ComposeState> = {}): ComposeState {
  return {
    open: false,
    minimized: false,
    mode: 'new',
    toRaw: '',
    ccRaw: '',
    bccRaw: '',
    subject: '',
    bodyText: '',
    attachments: [],
    status: 'idle',
    showCc: false,
    showBcc: false,
    ...overrides,
  }
}

export function composeToSaveInput(compose: ComposeState): SaveDraftInput {
  return {
    messageId: compose.messageId,
    threadId: compose.threadId,
    mode: compose.mode,
    toRaw: compose.toRaw,
    ccRaw: compose.ccRaw,
    bccRaw: compose.bccRaw,
    subject: compose.subject,
    bodyText: compose.bodyText,
    attachments: compose.attachments,
  }
}

export function snapshotMessages(messages: Message[]): Message[] {
  return messages.map(cloneMessage)
}

export type SnoozePreset = { id: string; label: string; until: number }

function atLocal(now: Date, daysFromToday: number, hours: number, minutes = 0): number {
  const date = new Date(now)
  date.setDate(date.getDate() + daysFromToday)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

function daysUntilWeekday(now: Date, weekday: number): number {
  const current = now.getDay()
  const delta = (weekday - current + 7) % 7
  return delta === 0 ? 7 : delta
}

export function snoozePresets(nowMs = Date.now()): SnoozePreset[] {
  const now = new Date(nowMs)
  const presets: SnoozePreset[] = []
  const laterToday = atLocal(now, 0, 18, 0)
  if (laterToday > nowMs) presets.push({ id: 'later-today', label: 'Later today', until: laterToday })
  presets.push({ id: 'tomorrow', label: 'Tomorrow', until: atLocal(now, 1, 8, 0) })
  const day = now.getDay()
  const laterThisWeekDays = day >= 1 && day <= 4 ? daysUntilWeekday(now, 5) : daysUntilWeekday(now, 1)
  presets.push({
    id: 'later-week',
    label: 'Later this week',
    until: atLocal(now, laterThisWeekDays, 8, 0),
  })
  presets.push({
    id: 'weekend',
    label: 'This weekend',
    until: atLocal(now, daysUntilWeekday(now, 6), 8, 0),
  })
  presets.push({
    id: 'next-week',
    label: 'Next week',
    until: atLocal(now, daysUntilWeekday(now, 1), 8, 0),
  })
  return presets.filter((preset) => preset.until > nowMs)
}

export function formatSnoozeUntil(until: number): string {
  return new Date(until).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatListTime(timestamp: number, nowMs = Date.now()): string {
  const date = new Date(timestamp)
  const now = new Date(nowMs)
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday'
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function undoCopy(kind: string, count: number, until?: number): string {
  const many = count > 1
  switch (kind) {
    case 'archive':
      return many ? `${count} conversations archived` : 'Conversation archived'
    case 'trash':
      return many ? `${count} conversations moved to Trash` : 'Conversation moved to Trash'
    case 'deleteForever':
      return many ? `${count} conversations deleted forever` : 'Conversation deleted forever'
    case 'spam':
      return many ? `${count} conversations marked as spam` : 'Conversation marked as spam'
    case 'notSpam':
    case 'moveToInbox':
    case 'unsnooze':
      return many ? `${count} conversations moved to Inbox` : 'Conversation moved to Inbox'
    case 'snooze':
      return many
        ? `${count} conversations snoozed`
        : `Conversation snoozed until ${formatSnoozeUntil(until ?? Date.now())}`
    case 'discardDraft':
      return many ? `${count} drafts discarded` : 'Draft discarded'
    case 'send':
      return 'Message sent. Undo'
    case 'applyLabel':
      return 'Label applied'
    case 'removeLabel':
      return 'Label removed'
    default:
      return many ? `${count} conversations updated` : 'Conversation updated'
  }
}

export function checkInvariants(mailbox: Mailbox): string[] {
  const errors: string[] = []
  const userIds = new Set(mailbox.userLabels.map((label) => label.id))
  const seenNames = new Map<string, string>()
  for (const label of mailbox.userLabels) {
    if (isReservedLabelName(label.name)) errors.push(`I1 reserved user label ${label.name}`)
    const folded = foldLabelName(label.name)
    const prior = seenNames.get(folded)
    if (prior) errors.push(`duplicate user label ${label.name}`)
    seenNames.set(folded, label.id)
  }

  for (const message of mailbox.messages) {
    for (const id of message.labelIds) {
      if (!SYSTEM_LABEL_SET.has(id) && !userIds.has(id)) {
        errors.push(`I1 orphan label ${id} on ${message.id}`)
      }
    }
    const spam = hasLabel(message, 'SPAM')
    const trash = hasLabel(message, 'TRASH')
    const snoozed = hasLabel(message, 'SNOOZED')
    const inbox = hasLabel(message, 'INBOX')
    const draft = hasLabel(message, 'DRAFT')
    const sent = hasLabel(message, 'SENT')
    if (spam && trash) errors.push(`I2 SPAM+TRASH ${message.id}`)
    if ((spam || trash || snoozed) && inbox) errors.push(`I3 inbox mutex ${message.id}`)
    if (snoozed !== (typeof message.snoozeUntil === 'number')) errors.push(`I4 snooze fields ${message.id}`)
    if (draft !== Boolean(message.draft)) errors.push(`I5 draft fields ${message.id}`)
    if (draft && (sent || spam || hasLabel(message, 'UNREAD'))) errors.push(`I5 draft combo ${message.id}`)
    if (sent && draft) errors.push(`I6 SENT+DRAFT ${message.id}`)
    const categories = message.labelIds.filter((id) => CATEGORY_SET.has(id))
    if (categories.length > 1) errors.push(`I7 category cardinality ${message.id}`)
    if ((sent || draft) && !emailsEqual(message.from.email, mailbox.owner.email)) {
      errors.push(`I17 owner send ${message.id}`)
    }
  }
  return errors
}
