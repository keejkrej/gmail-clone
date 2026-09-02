'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  checkInvariants,
  composeToSaveInput,
  emptyCompose,
  formatAddressList,
  isComposeEmpty,
  isDraftMessage,
} from './labels'
import { applyMailboxAction, composeFromDraft, prepareReply, wakeSnoozed } from './reducer'
import {
  conversationById,
  folderCounts,
  listConversations,
  threadViewMessages,
} from './selectors'
import { createSeedMailbox } from './seed'
import {
  DRAFT_AUTOSAVE_MS,
  MAILBOX_STORAGE_KEY,
  SNOOZE_WAKE_INTERVAL_MS,
  UNDO_WINDOW_MS,
  type CategoryLabel,
  type ComposeState,
  type Conversation,
  type FolderCounts,
  type Mailbox,
  type MailboxOwner,
  type Message,
  type SendResult,
  type UndoState,
  type UserLabel,
  type View,
} from './types'

export type MailActions = {
  select: (id: string, opts?: { shift?: boolean }) => void
  selectAll: () => void
  clearSelection: () => void
  star: (ids?: string[]) => void
  important: (ids?: string[]) => void
  archive: (ids?: string[]) => void
  trash: (ids?: string[]) => void
  deleteForever: (ids?: string[]) => void
  spam: (ids?: string[]) => void
  notSpam: (ids?: string[]) => void
  moveToInbox: (ids?: string[]) => void
  snooze: (until: number, ids?: string[]) => void
  unsnooze: (ids?: string[]) => void
  markRead: (read: boolean, ids?: string[]) => void
  applyLabel: (labelId: string, apply: boolean, ids?: string[]) => void
  moveToCategory: (category: CategoryLabel, ids?: string[]) => void
  createLabel: (name: string, color?: string) => string | { error: string }
  renameLabel: (labelId: string, name: string, color?: string) => string | null
  deleteLabel: (labelId: string) => void
  send: (opts?: { confirmEmptySubject?: boolean }) => SendResult
  saveDraft: () => void
  discardDraft: (ids?: string[]) => void
  refresh: () => void
  reply: (mode: 'reply' | 'replyAll', messageId?: string) => void
  forward: (messageId?: string) => void
  openCompose: () => void
  closeCompose: () => void
  setComposeField: (field: Partial<ComposeState>) => void
  toggleComposeMinimized: () => void
  addAttachments: (files: { filename: string; mimeType: string; sizeBytes: number }[]) => void
  removeAttachment: (id: string) => void
  continueDraft: (threadId?: string) => void
  undo: () => void
  dismissUndo: () => void
  open: (threadId: string | null) => void
  setView: (view: View) => void
  setQuery: (query: string) => void
  submitSearch: () => void
  clearSearch: () => void
  resetToSeed: () => void
}

export type MailContextValue = {
  owner: MailboxOwner
  mailbox: Mailbox
  view: View
  category: CategoryLabel | null
  query: string
  selectedIds: string[]
  openId: string | null
  openConversation: Conversation | null
  openMessages: Message[]
  compose: ComposeState
  visibleConversations: Conversation[]
  folderCounts: FolderCounts
  userLabels: UserLabel[]
  undo: UndoState | null
  hydrated: boolean
  actions: MailActions
}

const MailContext = createContext<MailContextValue | null>(null)

function loadMailbox(): Mailbox {
  if (typeof window === 'undefined') return createSeedMailbox()
  try {
    const raw = window.localStorage.getItem(MAILBOX_STORAGE_KEY)
    if (!raw) return createSeedMailbox()
    const parsed = JSON.parse(raw) as Mailbox
    if (!parsed?.owner?.email || !Array.isArray(parsed.messages) || !Array.isArray(parsed.userLabels)) {
      return createSeedMailbox()
    }
    return wakeSnoozed({ ...parsed, nextId: parsed.nextId ?? 1000 }, Date.now())
  } catch {
    return createSeedMailbox()
  }
}

function persistMailbox(mailbox: Mailbox) {
  try {
    window.localStorage.setItem(MAILBOX_STORAGE_KEY, JSON.stringify(mailbox))
  } catch {
    // Ignore quota errors; mailbox still works in memory.
  }
}

function commitInvariants(mailbox: Mailbox) {
  if (process.env.NODE_ENV === 'production') return
  const errors = checkInvariants(mailbox)
  if (errors.length) console.error('[mail] invariants', errors)
}

export function MailProvider({ children }: { children: ReactNode }) {
  const [mailbox, setMailbox] = useState<Mailbox>(() => createSeedMailbox())
  const [view, setViewState] = useState<View>({ type: 'inbox', category: 'CATEGORY_PERSONAL' })
  const [lastNonSearchView, setLastNonSearchView] = useState<View>({ type: 'inbox', category: 'CATEGORY_PERSONAL' })
  const [inboxCategory, setInboxCategory] = useState<CategoryLabel>('CATEGORY_PERSONAL')
  const [query, setQueryState] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lastToggledId, setLastToggledId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [compose, setCompose] = useState<ComposeState>(() => emptyCompose())
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const mailboxRef = useRef(mailbox)
  const composeRef = useRef(compose)
  const viewRef = useRef(view)
  const undoRef = useRef(undo)
  const saveTimerRef = useRef<number | null>(null)
  const undoTimerRef = useRef<number | null>(null)
  mailboxRef.current = mailbox
  composeRef.current = compose
  viewRef.current = view
  undoRef.current = undo

  const visibleConversations = useMemo(() => listConversations(mailbox, view), [mailbox, view])
  const visibleIds = useMemo(() => visibleConversations.map((conversation) => conversation.id), [visibleConversations])
  const counts = useMemo(() => folderCounts(mailbox), [mailbox])
  const openConversation = useMemo(
    () => (openId ? conversationById(mailbox, openId, view) : null),
    [mailbox, openId, view],
  )
  const openMessages = useMemo(
    () => (openConversation ? threadViewMessages(openConversation.messages, view) : []),
    [openConversation, view],
  )

  const replaceMailbox = useCallback((next: Mailbox) => {
    commitInvariants(next)
    mailboxRef.current = next
    setMailbox(next)
    if (typeof window !== 'undefined') persistMailbox(next)
  }, [])

  useEffect(() => {
    const loaded = loadMailbox()
    commitInvariants(loaded)
    mailboxRef.current = loaded
    setMailbox(loaded)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const wake = () => {
      const next = wakeSnoozed(mailboxRef.current, Date.now())
      if (next !== mailboxRef.current) replaceMailbox(next)
    }
    wake()
    const interval = window.setInterval(wake, SNOOZE_WAKE_INTERVAL_MS)
    window.addEventListener('focus', wake)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', wake)
    }
  }, [hydrated, replaceMailbox])

  const pruneSelection = useCallback((ids: string[], listed: string[]) => {
    const allowed = new Set(listed)
    setSelectedIds(ids.filter((id) => allowed.has(id)))
  }, [])

  useEffect(() => {
    pruneSelection(selectedIds, visibleIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds.join('|')])

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }, [])

  const queueUndo = useCallback(
    (next: UndoState | null) => {
      clearUndoTimer()
      setUndo(next)
      if (!next) return
      undoTimerRef.current = window.setTimeout(() => {
        setUndo(null)
        undoTimerRef.current = null
      }, UNDO_WINDOW_MS)
    },
    [clearUndoTimer],
  )

  const targets = useCallback(
    (ids?: string[]) => {
      if (ids?.length) return ids
      if (selectedIds.length) return selectedIds
      if (openId) return [openId]
      return []
    },
    [openId, selectedIds],
  )

  const mutate = useCallback(
    (action: Parameters<typeof applyMailboxAction>[1], options?: { composeRestore?: ComposeState; closeOpen?: boolean }) => {
      const result = applyMailboxAction(mailboxRef.current, action, Date.now())
      if (result.error) {
        setCompose((current) => ({ ...current, error: result.error }))
        return result
      }
      if (result.needsSubjectConfirm) return result
      replaceMailbox(result.mailbox)
      if (result.undo && result.undoMessage) {
        queueUndo({
          mailboxUndo: result.undo,
          message: result.undoMessage,
          composeRestore: options?.composeRestore,
          expiresAt: Date.now() + UNDO_WINDOW_MS,
        })
      } else if (result.undoMessage === undefined && action.type !== 'saveDraft') {
        // non-undoable mutation leaves the previous snackbar until timeout
      }
      if (options?.closeOpen) setOpenId(null)
      return result
    },
    [queueUndo, replaceMailbox],
  )

  const flushDraft = useCallback((): ComposeState => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const current = composeRef.current
    if (!current.open) return current
    if (isComposeEmpty(current) && !current.messageId) {
      const idle = { ...current, status: 'idle' as const, error: undefined }
      composeRef.current = idle
      setCompose(idle)
      return idle
    }
    const result = applyMailboxAction(
      mailboxRef.current,
      { type: 'saveDraft', input: composeToSaveInput(current) },
      Date.now(),
    )
    if (result.error) {
      const failed = { ...current, status: 'idle' as const, error: result.error }
      composeRef.current = failed
      setCompose(failed)
      return failed
    }
    replaceMailbox(result.mailbox)
    if (result.saved) {
      const saved: ComposeState = {
        ...current,
        messageId: result.saved.messageId,
        threadId: result.saved.threadId,
        status: 'saved',
        savedAt: Date.now(),
        error: undefined,
      }
      composeRef.current = saved
      setCompose(saved)
      return saved
    }
    const idle = { ...current, status: 'idle' as const, error: undefined }
    composeRef.current = idle
    setCompose(idle)
    return idle
  }, [replaceMailbox])

  const scheduleDraftSave = useCallback(() => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    setCompose((item) => ({ ...item, status: item.open ? 'saving' : item.status }))
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      flushDraft()
    }, DRAFT_AUTOSAVE_MS)
  }, [flushDraft])

  const changeView = useCallback((next: View) => {
    setViewState(next)
    viewRef.current = next
    if (next.type !== 'search') {
      setLastNonSearchView(next)
      if (next.type === 'inbox') setInboxCategory(next.category)
    }
    setSelectedIds([])
    setLastToggledId(null)
    setOpenId(null)
  }, [])

  const actions: MailActions = useMemo(() => ({
    select: (id, opts) => {
      const listed = listConversations(mailboxRef.current, viewRef.current).map((conversation) => conversation.id)
      if (opts?.shift && lastToggledId) {
        const from = listed.indexOf(lastToggledId)
        const to = listed.indexOf(id)
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from]
          const range = listed.slice(start, end + 1)
          setSelectedIds(Array.from(new Set([...selectedIds, ...range])))
          setLastToggledId(id)
          return
        }
      }
      setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
      setLastToggledId(id)
    },
    selectAll: () => {
      const listed = listConversations(mailboxRef.current, viewRef.current).map((conversation) => conversation.id)
      setSelectedIds((current) => (current.length === listed.length ? [] : listed))
    },
    clearSelection: () => setSelectedIds([]),
    star: (ids) => {
      mutate({ type: 'star', threadIds: targets(ids) })
    },
    important: (ids) => {
      mutate({ type: 'important', threadIds: targets(ids) })
    },
    archive: (ids) => {
      mutate({ type: 'archive', threadIds: targets(ids) }, { closeOpen: true })
    },
    trash: (ids) => {
      const threadIds = targets(ids)
      if (viewRef.current.type === 'drafts') {
        mutate({ type: 'discardDrafts', threadIds }, { closeOpen: true })
        return
      }
      if (viewRef.current.type === 'trash') {
        mutate({ type: 'deleteForever', threadIds }, { closeOpen: true })
        return
      }
      mutate({ type: 'trash', threadIds }, { closeOpen: true })
    },
    deleteForever: (ids) => {
      mutate({ type: 'deleteForever', threadIds: targets(ids) }, { closeOpen: true })
    },
    spam: (ids) => {
      mutate({ type: 'spam', threadIds: targets(ids) }, { closeOpen: true })
    },
    notSpam: (ids) => {
      mutate({ type: 'notSpam', threadIds: targets(ids) }, { closeOpen: true })
    },
    moveToInbox: (ids) => {
      if (viewRef.current.type === 'spam') {
        mutate({ type: 'notSpam', threadIds: targets(ids) }, { closeOpen: true })
        return
      }
      mutate({ type: 'moveToInbox', threadIds: targets(ids) }, { closeOpen: true })
    },
    snooze: (until, ids) => {
      mutate({ type: 'snooze', threadIds: targets(ids), until }, { closeOpen: true })
    },
    unsnooze: (ids) => {
      mutate({ type: 'unsnooze', threadIds: targets(ids) }, { closeOpen: true })
    },
    markRead: (read, ids) => {
      mutate({ type: 'markRead', threadIds: targets(ids), read })
    },
    applyLabel: (labelId, apply, ids) => {
      mutate({ type: 'applyLabel', threadIds: targets(ids), labelId, apply })
    },
    moveToCategory: (category, ids) => {
      mutate({ type: 'moveToCategory', threadIds: targets(ids), category })
    },
    createLabel: (name, color) => {
      const result = mutate({ type: 'createLabel', name, color })
      if (result.error) return { error: result.error }
      return result.createdLabelId ?? { error: 'Could not create label.' }
    },
    renameLabel: (labelId, name, color) => {
      const result = mutate({ type: 'renameLabel', labelId, name, color })
      return result.error ?? null
    },
    deleteLabel: (labelId) => {
      mutate({ type: 'deleteUserLabel', labelId })
      if (viewRef.current.type === 'label' && viewRef.current.labelId === labelId) {
        changeView({ type: 'inbox', category: inboxCategory })
      }
    },
    send: (opts) => {
      const current = flushDraft()
      const composeRestore = { ...current }
      const result = applyMailboxAction(
        mailboxRef.current,
        { type: 'send', input: { ...composeToSaveInput(current), confirmEmptySubject: opts?.confirmEmptySubject } },
        Date.now(),
      )
      if (result.needsSubjectConfirm) return { ok: false, needsSubjectConfirm: true }
      if (result.error) {
        setCompose((item) => ({ ...item, error: result.error }))
        return { ok: false, error: result.error }
      }
      replaceMailbox(result.mailbox)
      if (result.undo && result.undoMessage) {
        queueUndo({
          mailboxUndo: result.undo,
          message: result.undoMessage,
          composeRestore,
          expiresAt: Date.now() + UNDO_WINDOW_MS,
        })
      }
      setCompose(emptyCompose())
      return { ok: true }
    },
    saveDraft: () => {
      flushDraft()
    },
    refresh: () => {
      const next = wakeSnoozed(mailboxRef.current, Date.now())
      replaceMailbox(next)
    },
    discardDraft: (ids) => {
      const threadIds = ids?.length ? ids : compose.messageId ? [compose.threadId ?? ''] : targets()
      const filtered = threadIds.filter(Boolean)
      if (compose.open && (!ids || (compose.threadId && filtered.includes(compose.threadId)))) {
        if (saveTimerRef.current != null) {
          window.clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        const current = composeRef.current
        if (current.messageId) {
          mutate({ type: 'discardDrafts', threadIds: [current.threadId ?? ''] })
        }
        setCompose(emptyCompose())
        return
      }
      mutate({ type: 'discardDrafts', threadIds: filtered }, { closeOpen: true })
    },
    reply: (mode, messageId) => {
      const conversation = openConversation
      if (!conversation) return
      const parent =
        conversation.messages.find((message) => message.id === messageId) ??
        [...threadViewMessages(conversation.messages, viewRef.current)].reverse().find((message) => !isDraftMessage(message))
      if (!parent) return
      flushDraft()
      setCompose(prepareReply(mailboxRef.current, parent, mode, Date.now()))
      scheduleDraftSave()
    },
    forward: (messageId) => {
      const conversation = openConversation
      if (!conversation) return
      const parent =
        conversation.messages.find((message) => message.id === messageId) ??
        [...threadViewMessages(conversation.messages, viewRef.current)].reverse().find((message) => !isDraftMessage(message))
      if (!parent) return
      flushDraft()
      setCompose(prepareReply(mailboxRef.current, parent, 'forward', Date.now()))
      scheduleDraftSave()
    },
    openCompose: () => {
      flushDraft()
      setCompose(emptyCompose({ open: true }))
    },
    closeCompose: () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const current = composeRef.current
      if (isComposeEmpty(current)) {
        if (current.messageId && current.threadId) {
          const result = applyMailboxAction(
            mailboxRef.current,
            { type: 'discardDrafts', threadIds: [current.threadId] },
            Date.now(),
          )
          replaceMailbox(result.mailbox)
        }
        setCompose(emptyCompose())
        return
      }
      const result = applyMailboxAction(
        mailboxRef.current,
        { type: 'saveDraft', input: composeToSaveInput(current) },
        Date.now(),
      )
      replaceMailbox(result.mailbox)
      setCompose(emptyCompose())
    },
    setComposeField: (field) => {
      setCompose((current) => ({ ...current, ...field, error: undefined, open: true }))
      scheduleDraftSave()
    },
    toggleComposeMinimized: () => {
      setCompose((current) => ({ ...current, minimized: !current.minimized }))
    },
    addAttachments: (files) => {
      setCompose((current) => ({
        ...current,
        attachments: [
          ...current.attachments,
          ...files.map((file, index) => ({
            id: `att_local_${Date.now()}_${index}`,
            ...file,
          })),
        ],
        error: undefined,
      }))
      scheduleDraftSave()
    },
    removeAttachment: (id) => {
      setCompose((current) => ({
        ...current,
        attachments: current.attachments.filter((attachment) => attachment.id !== id),
      }))
      scheduleDraftSave()
    },
    undo: () => {
      const pending = undoRef.current
      if (!pending) return
      clearUndoTimer()
      const restored = applyMailboxAction(mailboxRef.current, { type: 'undo', undo: pending.mailboxUndo }, Date.now())
      replaceMailbox(restored.mailbox)
      if (pending.composeRestore) setCompose({ ...pending.composeRestore, open: true, minimized: false, error: undefined })
      setUndo(null)
    },
    dismissUndo: () => {
      clearUndoTimer()
      setUndo(null)
    },
    continueDraft: (threadId) => {
      const id = threadId ?? openId
      if (!id) return
      const conversation = conversationById(mailboxRef.current, id, viewRef.current)
      if (conversation?.draftMessage) setCompose(composeFromDraft(conversation.draftMessage))
    },
    open: (threadId) => {
      if (!threadId) {
        setOpenId(null)
        return
      }
      mutate({ type: 'openThread', threadId, view: viewRef.current })
      setSelectedIds([])
      const conversation = conversationById(mailboxRef.current, threadId, viewRef.current)
      const draft = conversation?.draftMessage
      if (draft && conversation?.messages.every(isDraftMessage)) {
        setCompose(composeFromDraft(draft))
        setOpenId(null)
        return
      }
      setOpenId(threadId)
    },
    setView: (next) => {
      if (next.type === 'inbox') setQueryState('')
      changeView(next)
    },
    setQuery: (value) => {
      setQueryState(value)
      if (!value.trim() && viewRef.current.type === 'search') changeView(lastNonSearchView)
    },
    submitSearch: () => {
      const trimmed = query.trim()
      if (!trimmed) {
        if (viewRef.current.type === 'search') changeView(lastNonSearchView)
        return
      }
      changeView({ type: 'search', query: trimmed })
    },
    clearSearch: () => {
      setQueryState('')
      if (viewRef.current.type === 'search') changeView(lastNonSearchView)
    },
    resetToSeed: () => {
      const seeded = createSeedMailbox()
      replaceMailbox(seeded)
      setViewState({ type: 'inbox', category: 'CATEGORY_PERSONAL' })
      setLastNonSearchView({ type: 'inbox', category: 'CATEGORY_PERSONAL' })
      setInboxCategory('CATEGORY_PERSONAL')
      setQueryState('')
      setSelectedIds([])
      setOpenId(null)
      setCompose(emptyCompose())
      queueUndo(null)
    },
  }), [
    changeView,
    clearUndoTimer,
    compose.messageId,
    compose.open,
    compose.threadId,
    flushDraft,
    inboxCategory,
    lastNonSearchView,
    lastToggledId,
    mutate,
    openConversation,
    openId,
    query,
    queueUndo,
    replaceMailbox,
    scheduleDraftSave,
    selectedIds,
    targets,
  ])

  const value: MailContextValue = {
    owner: mailbox.owner,
    mailbox,
    view,
    category: view.type === 'inbox' ? view.category : null,
    query,
    selectedIds,
    openId,
    openConversation,
    openMessages,
    compose,
    visibleConversations,
    folderCounts: counts,
    userLabels: mailbox.userLabels,
    undo,
    hydrated,
    actions,
  }

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>
}

export function useMail(): MailContextValue {
  const value = useContext(MailContext)
  if (!value) throw new Error('useMail must be used within MailProvider')
  return value
}

export function focusedMessage(messages: Message[]): Message | undefined {
  return [...messages].reverse().find((message) => !isDraftMessage(message)) ?? messages[messages.length - 1]
}

export function recipientPreview(message: Message): string {
  return formatAddressList(message.to) || message.draft?.toRaw || '(no recipient)'
}
