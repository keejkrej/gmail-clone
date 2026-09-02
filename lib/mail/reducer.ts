import {
  addLabel,
  allocId,
  cloneMessage,
  copyAttachments,
  emailsEqual,
  emptyCompose,
  formatAddressList,
  hasLabel,
  includesOwner,
  isComposeEmpty,
  isDraftMessage,
  isQuarantined,
  LABEL_COLOR_CYCLE,
  makeSnippet,
  messagesForThreads,
  removeLabel,
  removeLabels,
  removeMessagesById,
  replaceCategory,
  replaceMessages,
  snapshotMessages,
  sortMessages,
  undoCopy,
  uniqueAddresses,
  upsertMessages,
  validateRecipients,
  validateUserLabelName,
} from './labels'
import type {
  Address,
  CategoryLabel,
  ComposeState,
  LabelId,
  Mailbox,
  MailboxUndo,
  Message,
  MutationResult,
  SaveDraftInput,
  SendInput,
  View,
} from './types'

export type MailboxAction =
  | { type: 'wakeSnoozed' }
  | { type: 'archive'; threadIds: string[] }
  | { type: 'trash'; threadIds: string[] }
  | { type: 'deleteForever'; threadIds: string[] }
  | { type: 'spam'; threadIds: string[] }
  | { type: 'notSpam'; threadIds: string[] }
  | { type: 'moveToInbox'; threadIds: string[] }
  | { type: 'star'; threadIds: string[]; starred?: boolean }
  | { type: 'important'; threadIds: string[]; important?: boolean }
  | { type: 'markRead'; threadIds: string[]; read: boolean }
  | { type: 'openThread'; threadId: string; view: View }
  | { type: 'applyLabel'; threadIds: string[]; labelId: string; apply: boolean }
  | { type: 'moveToCategory'; threadIds: string[]; category: CategoryLabel }
  | { type: 'snooze'; threadIds: string[]; until: number }
  | { type: 'unsnooze'; threadIds: string[] }
  | { type: 'createLabel'; name: string; color?: string }
  | { type: 'renameLabel'; labelId: string; name: string; color?: string }
  | { type: 'deleteUserLabel'; labelId: string }
  | { type: 'saveDraft'; input: SaveDraftInput }
  | { type: 'discardDrafts'; threadIds: string[] }
  | { type: 'send'; input: SendInput }
  | { type: 'undo'; undo: MailboxUndo }

function ok(mailbox: Mailbox, extras: Partial<MutationResult> = {}): MutationResult {
  return { mailbox, ...extras }
}

function withUndo(
  mailbox: Mailbox,
  previous: Message[],
  addedIds: string[],
  kind: string,
  count: number,
  extras: Partial<MutationResult> = {},
  until?: number,
): MutationResult {
  return {
    mailbox,
    undo: { previousMessages: snapshotMessages(previous), addedIds },
    undoMessage: undoCopy(kind, count, until),
    ...extras,
  }
}

function mapThreadMessages(
  mailbox: Mailbox,
  threadIds: string[],
  mapper: (message: Message) => Message,
  predicate: (message: Message) => boolean = () => true,
): { mailbox: Mailbox; previous: Message[]; changed: Message[] } {
  const previous = messagesForThreads(mailbox.messages, threadIds)
  const changed: Message[] = []
  const nextMessages = mailbox.messages.map((message) => {
    if (!threadIds.includes(message.threadId) || !predicate(message)) return message
    const updated = mapper(message)
    if (updated !== message) changed.push(updated)
    return updated
  })
  return { mailbox: { ...mailbox, messages: nextMessages }, previous, changed }
}

export function wakeSnoozed(mailbox: Mailbox, now: number): Mailbox {
  let changed = false
  const messages = mailbox.messages.map((message) => {
    if (!hasLabel(message, 'SNOOZED')) return message
    if (typeof message.snoozeUntil !== 'number' || message.snoozeUntil > now) return message
    changed = true
    return {
      ...message,
      labelIds: addLabel(removeLabel(message.labelIds, 'SNOOZED'), 'INBOX'),
      snoozeUntil: undefined,
      internalDate: Math.max(message.internalDate, now),
    }
  })
  return changed ? { ...mailbox, messages } : mailbox
}

function unsnoozeMessage(message: Message, now: number): Message {
  if (!hasLabel(message, 'SNOOZED')) return message
  return {
    ...message,
    labelIds: addLabel(removeLabel(message.labelIds, 'SNOOZED'), 'INBOX'),
    snoozeUntil: undefined,
    internalDate: Math.max(message.internalDate, now),
  }
}

function ensureCategory(ids: LabelId[]): LabelId[] {
  return CATEGORY_SET_HAS(ids) ? ids : addLabel(ids, 'CATEGORY_PERSONAL')
}

function CATEGORY_SET_HAS(ids: LabelId[]): boolean {
  return ids.some((id) =>
    id === 'CATEGORY_PERSONAL' ||
    id === 'CATEGORY_SOCIAL' ||
    id === 'CATEGORY_PROMOTIONS' ||
    id === 'CATEGORY_UPDATES' ||
    id === 'CATEGORY_FORUMS',
  )
}

function threadHadInbox(mailbox: Mailbox, threadId: string): boolean {
  return mailbox.messages.some(
    (message) =>
      message.threadId === threadId &&
      hasLabel(message, 'INBOX') &&
      !isQuarantined(message) &&
      !isDraftMessage(message),
  )
}

function isDraftOnlyThread(mailbox: Mailbox, threadId: string): boolean {
  const messages = mailbox.messages.filter((message) => message.threadId === threadId)
  return messages.length > 0 && messages.every(isDraftMessage)
}

function archiveMessage(message: Message): Message {
  if (!hasLabel(message, 'INBOX') && !hasLabel(message, 'SNOOZED') && message.snoozeUntil == null) return message
  return {
    ...message,
    labelIds: removeLabels(message.labelIds, ['INBOX', 'SNOOZED']),
    snoozeUntil: undefined,
  }
}

function trashMessage(message: Message): Message {
  return {
    ...message,
    labelIds: addLabel(removeLabels(message.labelIds, ['INBOX', 'SNOOZED', 'SPAM']), 'TRASH'),
    snoozeUntil: undefined,
  }
}

function spamMessage(message: Message): Message {
  return {
    ...message,
    labelIds: addLabel(removeLabels(message.labelIds, ['INBOX', 'SNOOZED', 'TRASH']), 'SPAM'),
    snoozeUntil: undefined,
  }
}

function restoreToInboxMessage(message: Message): Message {
  if (isDraftMessage(message)) return message
  return {
    ...message,
    labelIds: ensureCategory(addLabel(removeLabels(message.labelIds, ['SNOOZED', 'SPAM', 'TRASH']), 'INBOX')),
    snoozeUntil: undefined,
  }
}

export function applyMailboxAction(mailbox: Mailbox, action: MailboxAction, now: number): MutationResult {
  switch (action.type) {
    case 'wakeSnoozed':
      return ok(wakeSnoozed(mailbox, now))
    case 'archive': {
      const ids = action.threadIds.filter((id) => !mailbox.messages.filter((m) => m.threadId === id).every(isQuarantined))
      if (!ids.length) return ok(mailbox)
      const result = mapThreadMessages(mailbox, ids, archiveMessage)
      return withUndo(result.mailbox, result.previous, [], 'archive', ids.length)
    }
    case 'trash': {
      if (!action.threadIds.length) return ok(mailbox)
      const result = mapThreadMessages(mailbox, action.threadIds, trashMessage)
      return withUndo(result.mailbox, result.previous, [], 'trash', action.threadIds.length)
    }
    case 'deleteForever': {
      if (!action.threadIds.length) return ok(mailbox)
      const previous = messagesForThreads(mailbox.messages, action.threadIds)
      return withUndo(removeMessagesById(mailbox, previous.map((message) => message.id)), previous, [], 'deleteForever', action.threadIds.length)
    }
    case 'spam': {
      if (!action.threadIds.length) return ok(mailbox)
      const previous = messagesForThreads(mailbox.messages, action.threadIds)
      const draftIds = previous.filter(isDraftMessage).map((message) => message.id)
      const current = draftIds.length ? removeMessagesById(mailbox, draftIds) : mailbox
      const result = mapThreadMessages(current, action.threadIds, spamMessage)
      return withUndo(result.mailbox, previous, [], 'spam', action.threadIds.length)
    }
    case 'notSpam': {
      if (!action.threadIds.length) return ok(mailbox)
      const result = mapThreadMessages(mailbox, action.threadIds, (message) => ({
        ...message,
        labelIds: ensureCategory(addLabel(removeLabel(message.labelIds, 'SPAM'), 'INBOX')),
      }))
      return withUndo(result.mailbox, result.previous, [], 'notSpam', action.threadIds.length)
    }
    case 'moveToInbox': {
      const ids = action.threadIds.filter((id) => !isDraftOnlyThread(mailbox, id))
      if (!ids.length) return ok(mailbox)
      const result = mapThreadMessages(mailbox, ids, restoreToInboxMessage, (message) => !isDraftMessage(message))
      return withUndo(result.mailbox, result.previous, [], 'moveToInbox', ids.length)
    }
    case 'star': {
      if (!action.threadIds.length) return ok(mailbox)
      const current = messagesForThreads(mailbox.messages, action.threadIds)
      const starred = action.starred ?? !current.some((message) => hasLabel(message, 'STARRED'))
      const result = mapThreadMessages(mailbox, action.threadIds, (message) => {
        const next = starred ? addLabel(message.labelIds, 'STARRED') : removeLabel(message.labelIds, 'STARRED')
        return next === message.labelIds ? message : { ...message, labelIds: next }
      })
      return ok(result.mailbox)
    }
    case 'important': {
      if (!action.threadIds.length) return ok(mailbox)
      const current = messagesForThreads(mailbox.messages, action.threadIds)
      const important = action.important ?? !current.some((message) => hasLabel(message, 'IMPORTANT'))
      const result = mapThreadMessages(mailbox, action.threadIds, (message) => {
        const next = important ? addLabel(message.labelIds, 'IMPORTANT') : removeLabel(message.labelIds, 'IMPORTANT')
        return next === message.labelIds ? message : { ...message, labelIds: next }
      })
      return ok(result.mailbox)
    }
    case 'markRead': {
      if (!action.threadIds.length) return ok(mailbox)
      if (action.read) {
        const result = mapThreadMessages(mailbox, action.threadIds, (message) =>
          hasLabel(message, 'UNREAD') ? { ...message, labelIds: removeLabel(message.labelIds, 'UNREAD') } : message,
        )
        return ok(result.mailbox)
      }
      const updated: Message[] = []
      const groups = new Map<string, Message[]>()
      for (const message of mailbox.messages) {
        if (!action.threadIds.includes(message.threadId)) continue
        const list = groups.get(message.threadId) ?? []
        list.push(message)
        groups.set(message.threadId, list)
      }
      for (const list of groups.values()) {
        const candidates = sortMessages(list.filter((message) => !isDraftMessage(message) && !isQuarantined(message)))
        const target = candidates[candidates.length - 1]
        if (!target || hasLabel(target, 'UNREAD')) continue
        updated.push({ ...target, labelIds: addLabel(target.labelIds, 'UNREAD') })
      }
      return ok(replaceMessages(mailbox, updated))
    }
    case 'openThread': {
      const visible = mailbox.messages.filter((message) => {
        if (message.threadId !== action.threadId || isDraftMessage(message)) return false
        if (action.view.type === 'spam') return hasLabel(message, 'SPAM')
        if (action.view.type === 'trash') return hasLabel(message, 'TRASH')
        return !isQuarantined(message)
      })
      const updated = visible
        .filter((message) => hasLabel(message, 'UNREAD'))
        .map((message) => ({ ...message, labelIds: removeLabel(message.labelIds, 'UNREAD') }))
      return ok(replaceMessages(mailbox, updated))
    }
    case 'applyLabel': {
      if (!action.threadIds.length) return ok(mailbox)
      const result = mapThreadMessages(mailbox, action.threadIds, (message) => {
        const next = action.apply ? addLabel(message.labelIds, action.labelId) : removeLabel(message.labelIds, action.labelId)
        return next === message.labelIds ? message : { ...message, labelIds: next }
      })
      return withUndo(
        result.mailbox,
        result.previous,
        [],
        action.apply ? 'applyLabel' : 'removeLabel',
        action.threadIds.length,
      )
    }
    case 'moveToCategory': {
      if (!action.threadIds.length) return ok(mailbox)
      const result = mapThreadMessages(
        mailbox,
        action.threadIds,
        (message) => ({ ...message, labelIds: replaceCategory(message.labelIds, action.category) }),
        (message) => hasLabel(message, 'INBOX'),
      )
      return withUndo(result.mailbox, result.previous, [], 'moveToInbox', action.threadIds.length)
    }
    case 'snooze': {
      if (action.until <= now) return { mailbox, error: 'Pick a time in the future.' }
      const ids = action.threadIds.filter((id) => {
        const messages = mailbox.messages.filter((message) => message.threadId === id)
        return messages.some((message) => !isQuarantined(message) && !isDraftMessage(message))
      })
      if (!ids.length) return ok(mailbox)
      const result = mapThreadMessages(
        mailbox,
        ids,
        (message) => ({
          ...message,
          labelIds: addLabel(removeLabel(message.labelIds, 'INBOX'), 'SNOOZED'),
          snoozeUntil: action.until,
        }),
        (message) => !isDraftMessage(message) && !isQuarantined(message),
      )
      return withUndo(result.mailbox, result.previous, [], 'snooze', ids.length, {}, action.until)
    }
    case 'unsnooze': {
      if (!action.threadIds.length) return ok(mailbox)
      const result = mapThreadMessages(mailbox, action.threadIds, (message) => unsnoozeMessage(message, now))
      return withUndo(result.mailbox, result.previous, [], 'unsnooze', action.threadIds.length)
    }
    case 'createLabel': {
      const error = validateUserLabelName(action.name, mailbox.userLabels)
      if (error) return { mailbox, error }
      const allocated = allocId(mailbox, 'ulbl')
      const color = action.color ?? LABEL_COLOR_CYCLE[mailbox.userLabels.length % LABEL_COLOR_CYCLE.length]
      const label = { id: allocated.id, name: action.name.trim(), color }
      return {
        mailbox: { ...allocated.mailbox, userLabels: [...mailbox.userLabels, label] },
        createdLabelId: allocated.id,
      }
    }
    case 'renameLabel': {
      const error = validateUserLabelName(action.name, mailbox.userLabels, action.labelId)
      if (error) return { mailbox, error }
      return ok({
        ...mailbox,
        userLabels: mailbox.userLabels.map((label) =>
          label.id === action.labelId
            ? { ...label, name: action.name.trim(), color: action.color ?? label.color }
            : label,
        ),
      })
    }
    case 'deleteUserLabel': {
      const previous = snapshotMessages(mailbox.messages.filter((message) => hasLabel(message, action.labelId)))
      const messages = mailbox.messages.map((message) =>
        hasLabel(message, action.labelId) ? { ...message, labelIds: removeLabel(message.labelIds, action.labelId) } : message,
      )
      return {
        mailbox: {
          ...mailbox,
          messages,
          userLabels: mailbox.userLabels.filter((label) => label.id !== action.labelId),
        },
        undo: {
          previousMessages: previous,
          addedIds: [],
          previousUserLabels: mailbox.userLabels.map((label) => ({ ...label })),
        },
        undoMessage: 'Label removed',
      }
    }
    case 'saveDraft':
      return saveDraft(mailbox, action.input, now)
    case 'discardDrafts':
      return discardDrafts(mailbox, action.threadIds)
    case 'send':
      return sendMessage(mailbox, action.input, now)
    case 'undo':
      return ok(applyUndo(mailbox, action.undo))
  }
}

export function applyUndo(mailbox: Mailbox, undo: MailboxUndo): Mailbox {
  const added = new Set(undo.addedIds)
  const map = new Map(
    mailbox.messages.filter((message) => !added.has(message.id)).map((message) => [message.id, message]),
  )
  for (const previous of undo.previousMessages) map.set(previous.id, cloneMessage(previous))
  return {
    ...mailbox,
    messages: [...map.values()],
    userLabels: undo.previousUserLabels ? undo.previousUserLabels.map((label) => ({ ...label })) : mailbox.userLabels,
  }
}

function draftFromInput(
  mailbox: Mailbox,
  input: SaveDraftInput,
  now: number,
  existing?: Message,
): { mailbox: Mailbox; message: Message; added: boolean } {
  const to = parseLoose(input.toRaw)
  const parsedCc = parseLoose(input.ccRaw)
  const parsedBcc = parseLoose(input.bccRaw)
  let current = mailbox
  let messageId = existing?.id
  let threadId = existing?.threadId ?? input.threadId
  let draftId = existing?.draft?.draftId
  let added = false
  if (!threadId) {
    const allocated = allocId(current, 'thr')
    threadId = allocated.id
    current = allocated.mailbox
  }
  if (!messageId) {
    const allocated = allocId(current, 'msg')
    messageId = allocated.id
    current = allocated.mailbox
    added = true
  }
  if (!draftId) {
    const allocated = allocId(current, 'dft')
    draftId = allocated.id
    current = allocated.mailbox
  }
  const message: Message = {
    id: messageId,
    threadId,
    from: { ...current.owner },
    to,
    cc: parsedCc,
    bcc: parsedBcc,
    subject: input.subject,
    bodyText: input.bodyText,
    snippet: makeSnippet(input.bodyText) || makeSnippet(input.subject),
    attachments: input.attachments.map((attachment) => ({ ...attachment })),
    labelIds: ['DRAFT'],
    internalDate: now,
    draft: {
      draftId,
      toRaw: input.toRaw,
      ccRaw: input.ccRaw,
      bccRaw: input.bccRaw,
      savedAt: now,
    },
  }
  return { mailbox: current, message, added }
}

function parseLoose(raw: string): Address[] {
  const parsed = validateRecipients({ toRaw: raw, ccRaw: '', bccRaw: '' })
  return parsed.ok ? parsed.to : []
}

function saveDraft(mailbox: Mailbox, input: SaveDraftInput, now: number): MutationResult {
  if (isComposeEmpty(input)) {
    if (!input.messageId) return ok(mailbox)
    const existing = mailbox.messages.find((message) => message.id === input.messageId)
    if (!existing) return ok(mailbox)
    return discardDrafts(mailbox, [existing.threadId], [existing.id])
  }
  const existing = input.messageId ? mailbox.messages.find((message) => message.id === input.messageId) : undefined
  const previous = existing ? [cloneMessage(existing)] : []
  const drafted = draftFromInput(mailbox, input, now, existing)
  const next = existing
    ? replaceMessages(drafted.mailbox, [drafted.message])
    : upsertMessages(drafted.mailbox, [drafted.message])
  return {
    mailbox: next,
    saved: {
      messageId: drafted.message.id,
      threadId: drafted.message.threadId,
      draftId: drafted.message.draft!.draftId,
    },
    undo: existing ? { previousMessages: previous, addedIds: [] } : { previousMessages: [], addedIds: [drafted.message.id] },
  }
}

function discardDrafts(mailbox: Mailbox, threadIds: string[], onlyIds?: string[]): MutationResult {
  const drafts = mailbox.messages.filter((message) => {
    if (!threadIds.includes(message.threadId) || !isDraftMessage(message)) return false
    if (onlyIds) return onlyIds.includes(message.id)
    return true
  })
  if (!drafts.length) return ok(mailbox)
  const threads = new Set(drafts.map((message) => message.threadId))
  return withUndo(
    removeMessagesById(mailbox, drafts.map((message) => message.id)),
    drafts,
    [],
    'discardDraft',
    threads.size,
  )
}

function findDraftForSend(mailbox: Mailbox, input: SendInput): Message | undefined {
  if (input.messageId) {
    const existing = mailbox.messages.find((message) => message.id === input.messageId)
    if (existing && isDraftMessage(existing)) return existing
  }
  if (input.threadId) {
    return mailbox.messages.find((message) => message.threadId === input.threadId && isDraftMessage(message))
  }
  return undefined
}

function sendMessage(mailbox: Mailbox, input: SendInput, now: number): MutationResult {
  const recipients = validateRecipients(input)
  if (!recipients.ok) return { mailbox, error: recipients.error }
  if (!input.subject.trim() && !input.confirmEmptySubject) {
    return { mailbox, needsSubjectConfirm: true }
  }
  const existing = findDraftForSend(mailbox, input)
  const drafted = existing
    ? { mailbox, message: existing, added: false }
    : draftFromInput(mailbox, input, now)
  const leftoverDrafts = drafted.mailbox.messages.filter(
    (message) =>
      message.threadId === drafted.message.threadId &&
      message.id !== drafted.message.id &&
      isDraftMessage(message),
  )
  const previous = [
    cloneMessage(existing ?? drafted.message),
    ...leftoverDrafts.map(cloneMessage),
  ]
  const addedIds: string[] = drafted.added ? [drafted.message.id] : []
  const siblingCount = drafted.mailbox.messages.filter(
    (message) => message.threadId === drafted.message.threadId && message.id !== drafted.message.id && !isDraftMessage(message),
  ).length
  const reply = input.mode === 'reply' || input.mode === 'replyAll' || siblingCount > 0
  const hadInbox = reply && threadHadInbox(drafted.mailbox, drafted.message.threadId)
  const toSelf = includesOwner([...recipients.to, ...recipients.cc, ...recipients.bcc], drafted.mailbox.owner.email)
  let labels: LabelId[] = addLabel(removeLabels(drafted.message.labelIds, ['DRAFT', 'UNREAD', 'SNOOZED']), 'SENT')
  if (hadInbox || toSelf) {
    labels = ensureCategory(addLabel(labels, 'INBOX'))
  }
  const sent: Message = {
    ...drafted.message,
    from: { ...drafted.mailbox.owner },
    to: recipients.to,
    cc: recipients.cc,
    bcc: recipients.bcc,
    subject: input.subject,
    bodyText: input.bodyText,
    snippet: makeSnippet(input.bodyText) || makeSnippet(input.subject) || '(no subject)',
    attachments: input.attachments.map((attachment) => ({ ...attachment })),
    labelIds: labels,
    internalDate: now,
    snoozeUntil: undefined,
    draft: undefined,
  }
  let next = upsertMessages(drafted.mailbox, [sent])
  if (leftoverDrafts.length) {
    next = removeMessagesById(
      next,
      leftoverDrafts.map((message) => message.id),
    )
  }
  if (reply) {
    const woken = next.messages.map((message) =>
      message.threadId === sent.threadId ? unsnoozeMessage(message, now) : message,
    )
    next = { ...next, messages: woken }
  }
  return withUndo(next, previous, addedIds, 'send', 1, { saved: { messageId: sent.id, threadId: sent.threadId, draftId: existing?.draft?.draftId ?? '' } })
}

export function prepareReply(
  mailbox: Mailbox,
  parent: Message,
  mode: 'reply' | 'replyAll' | 'forward',
  now: number,
): ComposeState {
  void now
  const owner = mailbox.owner
  if (mode === 'forward') {
    const copied = copyAttachments(parent.attachments, mailbox)
    return emptyCompose({
      open: true,
      mode: 'forward',
      subject: parent.subject.match(/^fwd:\s/i) ? parent.subject : `Fwd: ${parent.subject}`,
      bodyText: `\n\n${quoteForwardLocal(parent)}`,
      attachments: copied.attachments,
    })
  }
  const target = parent.replyTo ?? parent.from
  const replyTo = emailsEqual(target.email, owner.email) ? parent.to[0] ?? target : target
  let to = [replyTo]
  let cc: Address[] = []
  if (mode === 'replyAll') {
    const toList = uniqueAddresses([replyTo, ...parent.to].filter((address) => !emailsEqual(address.email, owner.email)))
    to = toList.length ? toList : [parent.from]
    const toKeys = new Set(to.map((address) => address.email.toLowerCase()))
    cc = uniqueAddresses(
      parent.cc.filter((address) => !emailsEqual(address.email, owner.email) && !toKeys.has(address.email.toLowerCase())),
    )
  }
  const subject = parent.subject.match(/^re:\s/i) ? parent.subject : `Re: ${parent.subject}`
  return emptyCompose({
    open: true,
    mode,
    threadId: parent.threadId,
    toRaw: formatAddressList(to),
    ccRaw: formatAddressList(cc),
    showCc: cc.length > 0,
    subject,
    bodyText: `\n\n${quoteReplyLocal(parent)}`,
  })
}

function quoteReplyLocal(message: Message): string {
  const quoted = message.bodyText.split('\n').map((line) => `> ${line}`).join('\n')
  const date = new Date(message.internalDate).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `On ${date}, ${message.from.name} <${message.from.email}> wrote:\n${quoted}`
}

function quoteForwardLocal(message: Message): string {
  return [
    '---------- Forwarded message ---------',
    `From: ${message.from.name} <${message.from.email}>`,
    `Date: ${new Date(message.internalDate).toLocaleString()}`,
    `Subject: ${message.subject}`,
    `To: ${formatAddressList(message.to) || '(none)'}`,
    '',
    message.bodyText,
  ].join('\n')
}

export { composeToSaveInput } from './labels'

export function composeFromDraft(message: Message): ComposeState {
  const draft = message.draft
  return emptyCompose({
    open: true,
    mode: message.subject.match(/^fwd:\s/i) && message.to.length === 0 ? 'forward' : 'new',
    threadId: message.threadId,
    messageId: message.id,
    toRaw: draft?.toRaw ?? formatAddressList(message.to),
    ccRaw: draft?.ccRaw ?? formatAddressList(message.cc),
    bccRaw: draft?.bccRaw ?? formatAddressList(message.bcc),
    subject: message.subject,
    bodyText: message.bodyText,
    attachments: message.attachments.map((attachment) => ({ ...attachment })),
    status: 'saved',
    savedAt: draft?.savedAt,
    showCc: Boolean((draft?.ccRaw ?? '').trim() || message.cc.length),
    showBcc: Boolean((draft?.bccRaw ?? '').trim() || message.bcc.length),
  })
}
