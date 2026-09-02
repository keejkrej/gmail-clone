export type SystemLabel =
  | 'INBOX'
  | 'STARRED'
  | 'SNOOZED'
  | 'SENT'
  | 'DRAFT'
  | 'SPAM'
  | 'TRASH'
  | 'IMPORTANT'
  | 'UNREAD'
  | 'CATEGORY_PERSONAL'
  | 'CATEGORY_SOCIAL'
  | 'CATEGORY_PROMOTIONS'
  | 'CATEGORY_UPDATES'
  | 'CATEGORY_FORUMS'

export type CategoryLabel =
  | 'CATEGORY_PERSONAL'
  | 'CATEGORY_SOCIAL'
  | 'CATEGORY_PROMOTIONS'
  | 'CATEGORY_UPDATES'
  | 'CATEGORY_FORUMS'

export type LabelId = SystemLabel | string

export type MessageId = string
export type ThreadId = string
export type DraftId = string

export type Address = {
  name: string
  email: string
}

export type Attachment = {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export type DraftMeta = {
  draftId: DraftId
  toRaw: string
  ccRaw: string
  bccRaw: string
  savedAt: number
}

export type Message = {
  id: MessageId
  threadId: ThreadId
  from: Address
  to: Address[]
  cc: Address[]
  bcc: Address[]
  replyTo?: Address
  subject: string
  bodyText: string
  snippet: string
  attachments: Attachment[]
  labelIds: LabelId[]
  internalDate: number
  snoozeUntil?: number
  draft?: DraftMeta
}

export type UserLabel = {
  id: LabelId
  name: string
  color?: string
}

export type MailboxOwner = {
  name: string
  email: string
}

export type Mailbox = {
  owner: MailboxOwner
  messages: Message[]
  userLabels: UserLabel[]
  nextId: number
}

export type Conversation = {
  id: ThreadId
  messages: Message[]
  visibleMessages: Message[]
  labelIds: LabelId[]
  unread: boolean
  starred: boolean
  important: boolean
  hasAttachment: boolean
  hasDraft: boolean
  latest: Message
  sortKey: number
  snoozeUntil?: number
  draftMessage?: Message
}

export type SystemViewType =
  | 'inbox'
  | 'starred'
  | 'snoozed'
  | 'sent'
  | 'drafts'
  | 'spam'
  | 'trash'
  | 'all'
  | 'important'

export type View =
  | { type: 'inbox'; category: CategoryLabel }
  | { type: 'starred' | 'snoozed' | 'sent' | 'drafts' | 'spam' | 'trash' | 'all' | 'important' }
  | { type: 'label'; labelId: string }
  | { type: 'search'; query: string }

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward'

export type ComposeState = {
  open: boolean
  minimized: boolean
  mode: ComposeMode
  threadId?: ThreadId
  messageId?: MessageId
  toRaw: string
  ccRaw: string
  bccRaw: string
  subject: string
  bodyText: string
  attachments: Attachment[]
  status: 'idle' | 'saving' | 'saved'
  savedAt?: number
  showCc: boolean
  showBcc: boolean
  error?: string
}

export type MailboxUndo = {
  previousMessages: Message[]
  addedIds: MessageId[]
  previousUserLabels?: UserLabel[]
}

export type UndoState = {
  mailboxUndo: MailboxUndo
  message: string
  composeRestore?: ComposeState
  expiresAt: number
}

export type FolderCounts = {
  inboxPrimaryUnread: number
  inboxUnreadByCategory: Record<CategoryLabel, number>
  drafts: number
  snoozed: number
  sent: number
  spam: number
  trash: number
  starred: number
  important: number
  all: number
  userLabelUnread: Record<string, number>
  userLabelTotal: Record<string, number>
}

export type EmptyStateCopy = {
  title: string
  body: string
  action?: 'compose'
}

export type ToolbarAvailability = {
  archive: boolean
  trash: boolean
  spam: boolean
  notSpam: boolean
  moveToInbox: boolean
  unsnooze: boolean
  deleteForever: boolean
  discardDraft: boolean
  snooze: boolean
}

export type SaveDraftInput = {
  messageId?: MessageId
  threadId?: ThreadId
  mode: ComposeMode
  toRaw: string
  ccRaw: string
  bccRaw: string
  subject: string
  bodyText: string
  attachments: Attachment[]
}

export type SendInput = SaveDraftInput & {
  confirmEmptySubject?: boolean
}

export type SendResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; needsSubjectConfirm: true }

export type MutationResult = {
  mailbox: Mailbox
  undo?: MailboxUndo
  undoMessage?: string
  error?: string
  needsSubjectConfirm?: boolean
  saved?: { messageId: MessageId; threadId: ThreadId; draftId: DraftId }
  createdLabelId?: string
}

export const MAILBOX_STORAGE_KEY = 'gmail-clone.mailbox.v1'
export const UNDO_WINDOW_MS = 5_000
export const DRAFT_AUTOSAVE_MS = 1_000
export const SNOOZE_WAKE_INTERVAL_MS = 15_000
