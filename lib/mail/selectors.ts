import {
  categoryOf,
  emailsEqual,
  hasLabel,
  isDraftMessage,
  isQuarantined,
  sortMessages,
} from './labels'
import { corpusMessagesForSearch, messageMatchesSearch, parseSearchQuery } from './search'
import type {
  CategoryLabel,
  Conversation,
  EmptyStateCopy,
  FolderCounts,
  Mailbox,
  MailboxOwner,
  Message,
  ToolbarAvailability,
  UserLabel,
  View,
} from './types'

export function groupByThread(messages: Message[]): Map<string, Message[]> {
  const groups = new Map<string, Message[]>()
  for (const message of messages) {
    const list = groups.get(message.threadId)
    if (list) list.push(message)
    else groups.set(message.threadId, [message])
  }
  for (const [threadId, list] of groups) {
    groups.set(threadId, sortMessages(list))
  }
  return groups
}

export function latestInboxMessage(messages: Message[]): Message | undefined {
  const inbox = sortMessages(messages.filter((message) => !isQuarantined(message) && hasLabel(message, 'INBOX')))
  return inbox[inbox.length - 1]
}

export function visibleMessages(messages: Message[], view: View, userLabels: UserLabel[]): Message[] {
  const sorted = sortMessages(messages)
  if (view.type === 'spam') return sorted.filter((message) => hasLabel(message, 'SPAM'))
  if (view.type === 'trash') return sorted.filter((message) => hasLabel(message, 'TRASH'))
  if (view.type === 'search') {
    return corpusMessagesForSearch(sorted, view.query)
  }
  const unquarantined = sorted.filter((message) => !isQuarantined(message))
  return unquarantined.filter((message) => messageMatchesView(message, view, unquarantined))
}

function messageMatchesView(message: Message, view: View, threadUnquarantined: Message[]): boolean {
  switch (view.type) {
    case 'inbox': {
      if (!hasLabel(message, 'INBOX')) return false
      const latest = latestInboxMessage(threadUnquarantined)
      const category = latest ? categoryOf(latest) : categoryOf(message)
      return category === view.category
    }
    case 'starred':
      return hasLabel(message, 'STARRED')
    case 'snoozed':
      return hasLabel(message, 'SNOOZED')
    case 'sent':
      return hasLabel(message, 'SENT')
    case 'drafts':
      return hasLabel(message, 'DRAFT')
    case 'important':
      return hasLabel(message, 'IMPORTANT')
    case 'all':
      return true
    case 'label':
      return hasLabel(message, view.labelId)
    case 'spam':
      return hasLabel(message, 'SPAM')
    case 'trash':
      return hasLabel(message, 'TRASH')
    case 'search':
      return true
  }
}

export function conversationIsInView(messages: Message[], view: View, userLabels: UserLabel[]): boolean {
  if (view.type === 'search') {
    const parsed = parseSearchQuery(view.query)
    return messages.some((message) => messageMatchesSearch(message, parsed, userLabels))
  }
  if (view.type === 'inbox') {
    const visible = visibleMessages(messages, view, userLabels)
    return visible.length > 0
  }
  return visibleMessages(messages, view, userLabels).length > 0
}

export function buildConversation(messages: Message[], view: View, userLabels: UserLabel[]): Conversation {
  const all = sortMessages(messages)
  const visible = visibleMessages(all, view, userLabels)
  const latest = visible[visible.length - 1] ?? all[all.length - 1]
  const draftMessage = all.find((message) => {
    if (!isDraftMessage(message)) return false
    if (view.type === 'spam' || view.type === 'trash') return true
    return !isQuarantined(message)
  })
  const snoozeValues = all
    .filter((message) => hasLabel(message, 'SNOOZED') && typeof message.snoozeUntil === 'number')
    .map((message) => message.snoozeUntil as number)
  const labelIds = [...new Set(all.flatMap((message) => message.labelIds))]
  let sortKey = latest?.internalDate ?? 0
  if (view.type === 'drafts' && draftMessage?.draft) {
    sortKey = Math.max(draftMessage.internalDate, draftMessage.draft.savedAt)
  }
  const hidden = (message: Message) => isQuarantined(message) && view.type !== 'spam' && view.type !== 'trash'
  return {
    id: all[0]?.threadId ?? '',
    messages: all,
    visibleMessages: visible,
    labelIds,
    unread: all.some((message) => hasLabel(message, 'UNREAD') && !isDraftMessage(message)),
    starred: all.some((message) => hasLabel(message, 'STARRED')),
    important: all.some((message) => hasLabel(message, 'IMPORTANT')),
    hasAttachment: all.some((message) => !hidden(message) && message.attachments.length > 0),
    hasDraft: Boolean(draftMessage),
    latest,
    sortKey,
    snoozeUntil: snoozeValues.length ? Math.min(...snoozeValues) : undefined,
    draftMessage,
  }
}

export function listConversations(mailbox: Mailbox, view: View): Conversation[] {
  const groups = groupByThread(mailbox.messages)
  const conversations: Conversation[] = []
  for (const messages of groups.values()) {
    if (!conversationIsInView(messages, view, mailbox.userLabels)) continue
    conversations.push(buildConversation(messages, view, mailbox.userLabels))
  }
  conversations.sort((a, b) => b.sortKey - a.sortKey || a.id.localeCompare(b.id))
  return conversations
}

export function conversationById(mailbox: Mailbox, threadId: string, view: View): Conversation | null {
  const messages = mailbox.messages.filter((message) => message.threadId === threadId)
  if (!messages.length) return null
  return buildConversation(messages, view, mailbox.userLabels)
}

export function threadViewMessages(messages: Message[], view: View): Message[] {
  const sorted = sortMessages(messages)
  if (view.type === 'spam') return sorted.filter((message) => hasLabel(message, 'SPAM'))
  if (view.type === 'trash') return sorted.filter((message) => hasLabel(message, 'TRASH'))
  if (view.type === 'search') return corpusMessagesForSearch(sorted, view.query)
  return sorted.filter((message) => !isQuarantined(message))
}

export function folderCounts(mailbox: Mailbox): FolderCounts {
  const inboxUnreadByCategory: Record<CategoryLabel, number> = {
    CATEGORY_PERSONAL: 0,
    CATEGORY_SOCIAL: 0,
    CATEGORY_PROMOTIONS: 0,
    CATEGORY_UPDATES: 0,
    CATEGORY_FORUMS: 0,
  }
  const userLabelUnread: Record<string, number> = {}
  const userLabelTotal: Record<string, number> = {}
  for (const label of mailbox.userLabels) {
    userLabelUnread[label.id] = 0
    userLabelTotal[label.id] = 0
  }

  let drafts = 0
  let snoozed = 0
  let sent = 0
  let spam = 0
  let trash = 0
  let starred = 0
  let important = 0
  let all = 0

  for (const messages of groupByThread(mailbox.messages).values()) {
    const unread = messages.some((message) => hasLabel(message, 'UNREAD') && !isDraftMessage(message))
    const quarantinedAll = messages.every(isQuarantined)
    const hasNonQuarantine = messages.some((message) => !isQuarantined(message))
    if (hasNonQuarantine) all += 1
    if (messages.some((message) => !isQuarantined(message) && hasLabel(message, 'DRAFT'))) drafts += 1
    if (messages.some((message) => !isQuarantined(message) && hasLabel(message, 'SNOOZED'))) snoozed += 1
    if (messages.some((message) => !isQuarantined(message) && hasLabel(message, 'SENT'))) sent += 1
    if (messages.some((message) => hasLabel(message, 'SPAM'))) spam += 1
    if (messages.some((message) => hasLabel(message, 'TRASH'))) trash += 1
    if (messages.some((message) => !isQuarantined(message) && hasLabel(message, 'STARRED'))) starred += 1
    if (messages.some((message) => !isQuarantined(message) && hasLabel(message, 'IMPORTANT'))) important += 1

    const latestInbox = latestInboxMessage(messages)
    if (latestInbox && unread) {
      inboxUnreadByCategory[categoryOf(latestInbox)] += 1
    }

    if (!quarantinedAll) {
      for (const label of mailbox.userLabels) {
        if (messages.some((message) => !isQuarantined(message) && hasLabel(message, label.id))) {
          userLabelTotal[label.id] += 1
          if (unread && latestInbox && hasLabel(latestInbox, label.id)) {
            userLabelUnread[label.id] += 1
          } else if (unread && messages.some((message) => !isQuarantined(message) && hasLabel(message, 'INBOX') && hasLabel(message, label.id))) {
            userLabelUnread[label.id] += 1
          }
        }
      }
    }
  }

  return {
    inboxPrimaryUnread: inboxUnreadByCategory.CATEGORY_PERSONAL,
    inboxUnreadByCategory,
    drafts,
    snoozed,
    sent,
    spam,
    trash,
    starred,
    important,
    all,
    userLabelUnread,
    userLabelTotal,
  }
}

export function isInboxTabsVisible(view: View, _query?: string): boolean {
  return view.type === 'inbox'
}

export function viewTitle(view: View, userLabels: UserLabel[]): string {
  switch (view.type) {
    case 'inbox':
      return 'Inbox'
    case 'starred':
      return 'Starred'
    case 'snoozed':
      return 'Snoozed'
    case 'sent':
      return 'Sent'
    case 'drafts':
      return 'Drafts'
    case 'spam':
      return 'Spam'
    case 'trash':
      return 'Trash'
    case 'all':
      return 'All Mail'
    case 'important':
      return 'Important'
    case 'label':
      return userLabels.find((label) => label.id === view.labelId)?.name ?? 'Label'
    case 'search':
      return 'Search results'
  }
}

export function emptyStateFor(view: View, userLabels: UserLabel[]): EmptyStateCopy {
  if (view.type === 'inbox') {
    switch (view.category) {
      case 'CATEGORY_PERSONAL':
        return { title: 'Your Primary tab is empty', body: 'Mail from people you know will show up here.' }
      case 'CATEGORY_SOCIAL':
        return { title: 'No conversations in Social', body: 'Social updates will appear here.' }
      case 'CATEGORY_PROMOTIONS':
        return { title: 'No conversations in Promotions', body: 'Offers, deals, and marketing mail will appear here.' }
      case 'CATEGORY_UPDATES':
        return { title: 'No conversations in Updates', body: 'Receipts, alerts, and other updates will appear here.' }
      case 'CATEGORY_FORUMS':
        return { title: 'No conversations in Forums', body: 'Mailing lists and forums will appear here.' }
    }
  }
  if (view.type === 'starred') {
    return {
      title: 'No starred conversations',
      body: 'Star conversations you want to find later. They stay starred after you archive them.',
    }
  }
  if (view.type === 'snoozed') {
    return {
      title: 'No snoozed conversations',
      body: 'Snooze a conversation to hide it from Inbox until a time you choose.',
    }
  }
  if (view.type === 'sent') {
    return { title: 'No sent messages', body: 'Messages you send will appear here.', action: 'compose' }
  }
  if (view.type === 'drafts') {
    return { title: 'No drafts', body: 'A draft is saved automatically when you start writing.', action: 'compose' }
  }
  if (view.type === 'spam') {
    return { title: 'Hooray, no spam here!', body: 'Messages reported as spam will appear here for 30 days.' }
  }
  if (view.type === 'trash') {
    return {
      title: 'No conversations in Trash',
      body: 'Deleted conversations stay here for 30 days, then are removed forever.',
    }
  }
  if (view.type === 'all') {
    return { title: 'No messages', body: 'All Mail contains everything except Spam and Trash.', action: 'compose' }
  }
  if (view.type === 'important') {
    return { title: 'No important conversations', body: 'Mark conversations as important to find them later.' }
  }
  if (view.type === 'label') {
    const name = userLabels.find((label) => label.id === view.labelId)?.name ?? 'this label'
    return {
      title: `No conversations with the label “${name}”`,
      body: 'Apply this label from the list or thread view. Archiving does not remove it.',
    }
  }
  return {
    title: 'No messages matched your search',
    body: 'Try different keywords. Search spam and trash with `in:anywhere`.',
  }
}

export function toolbarForView(view: View): ToolbarAvailability {
  switch (view.type) {
    case 'inbox':
      return {
        archive: true,
        trash: true,
        spam: true,
        notSpam: false,
        moveToInbox: false,
        unsnooze: false,
        deleteForever: false,
        discardDraft: false,
        snooze: true,
      }
    case 'drafts':
      return {
        archive: false,
        trash: false,
        spam: false,
        notSpam: false,
        moveToInbox: false,
        unsnooze: false,
        deleteForever: false,
        discardDraft: true,
        snooze: false,
      }
    case 'spam':
      return {
        archive: false,
        trash: true,
        spam: false,
        notSpam: true,
        moveToInbox: false,
        unsnooze: false,
        deleteForever: true,
        discardDraft: false,
        snooze: false,
      }
    case 'trash':
      return {
        archive: false,
        trash: false,
        spam: false,
        notSpam: false,
        moveToInbox: true,
        unsnooze: false,
        deleteForever: true,
        discardDraft: false,
        snooze: false,
      }
    case 'snoozed':
      return {
        archive: true,
        trash: true,
        spam: true,
        notSpam: false,
        moveToInbox: false,
        unsnooze: true,
        deleteForever: false,
        discardDraft: false,
        snooze: true,
      }
    case 'search':
    case 'starred':
    case 'sent':
    case 'all':
    case 'important':
    case 'label':
      return {
        archive: true,
        trash: true,
        spam: true,
        notSpam: false,
        moveToInbox: true,
        unsnooze: false,
        deleteForever: false,
        discardDraft: false,
        snooze: true,
      }
  }
}

export function canArchiveConversation(conversation: Conversation): boolean {
  const exclusivelyQuarantined = conversation.messages.every(isQuarantined)
  if (exclusivelyQuarantined) return false
  return conversation.messages.some((message) => hasLabel(message, 'INBOX') || hasLabel(message, 'SNOOZED'))
}

export function participantString(conversation: Conversation, owner: MailboxOwner, view: View): string {
  const source = conversation.visibleMessages.length ? conversation.visibleMessages : threadViewMessages(conversation.messages, view)
  const names: string[] = []
  const seen = new Set<string>()
  for (const message of source) {
    const key = message.from.email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(emailsEqual(message.from.email, owner.email) ? 'me' : message.from.name || message.from.email)
  }
  if (conversation.hasDraft && view.type === 'drafts') {
    const draft = conversation.draftMessage
    const to = draft?.to[0]?.name || draft?.draft?.toRaw || 'Draft'
    return names.includes('me') ? `me, ${to}` : to
  }
  return names.join(', ') || owner.name
}

export function conversationUserLabels(conversation: Conversation, userLabels: UserLabel[]): UserLabel[] {
  return userLabels.filter((label) => conversation.labelIds.includes(label.id))
}

export function mailboxByteSize(mailbox: Mailbox): number {
  let bytes = 0
  for (const message of mailbox.messages) {
    bytes += message.bodyText.length + message.subject.length
    for (const attachment of message.attachments) bytes += attachment.sizeBytes
  }
  return bytes
}

export function formatStorage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B of 15 GB`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB of 15 GB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB of 15 GB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB of 15 GB`
}

export function initialsFor(nameOrEmail: string): string {
  const name = nameOrEmail.trim()
  if (!name) return '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    const token = parts[0]
    if (token.includes('@')) return token.slice(0, 2).toUpperCase()
    return token.slice(0, 2).toUpperCase()
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

const AVATAR_COLORS = [
  'bg-rose-200 text-rose-800',
  'bg-sky-200 text-sky-800',
  'bg-amber-200 text-amber-800',
  'bg-slate-200 text-slate-800',
  'bg-violet-200 text-violet-800',
  'bg-pink-200 text-pink-800',
  'bg-emerald-200 text-emerald-800',
  'bg-orange-200 text-orange-800',
  'bg-indigo-200 text-indigo-800',
  'bg-teal-200 text-teal-800',
]

export function avatarClassFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
