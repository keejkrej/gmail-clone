'use client'

import { useEffect, useRef } from 'react'
import {
  AlertOctagon,
  Archive,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  Inbox,
  Mail,
  MailOpen,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  CATEGORY_TAB_META,
  canArchiveConversation,
  conversationUserLabels,
  emptyStateFor,
  formatListTime,
  formatSnoozeUntil,
  isDraftMessage,
  isInboxTabsVisible,
  participantString,
  toolbarForView,
  useMail,
  viewTitle,
  type CategoryLabel,
  type Conversation,
} from '@/lib/mail'
import { conversationTargets, LabelChip, LabelMenu, MoveMenu, SnoozeMenu } from './actions'
import { CATEGORY_TAB_UI, EmptyState, MailIconButton, rowDensityClass, shiftFromDetails, useDensity } from './shared'

export function MailList({
  focusedId,
  onFocusedId,
  onCreateLabel,
}: {
  focusedId: string | null
  onFocusedId: (id: string | null) => void
  onCreateLabel: () => void
}) {
  const mail = useMail()
  const { view, selectedIds, visibleConversations, folderCounts, userLabels, actions } = mail
  const toolbar = toolbarForView(view)
  const showTabs = isInboxTabsVisible(view)
  const empty = emptyStateFor(view, userLabels)
  const allSelected = visibleConversations.length > 0 && selectedIds.length === visibleConversations.length
  const someSelected = selectedIds.length > 0 && !allSelected
  const showBulk = selectedIds.length > 0
  const title = viewTitle(view, userLabels)
  const selectedConversations = conversationTargets(selectedIds, null, visibleConversations)
  const { density } = useDensity()

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 px-2">
        <div className="flex items-center pl-2">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            aria-label="Select all conversations"
            onCheckedChange={() => actions.selectAll()}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" aria-label="Selection options" className="text-muted-foreground" />}
            >
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 min-w-36">
              <DropdownMenuItem onClick={() => actions.selectAll()}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.clearSelection()}>None</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showBulk ? (
          <>
            {toolbar.archive && (
              <MailIconButton label="Archive" shortcut="e" onClick={() => actions.archive()}>
                <Archive />
              </MailIconButton>
            )}
            {toolbar.spam && (
              <MailIconButton label="Report spam" onClick={() => actions.spam()}>
                <AlertOctagon />
              </MailIconButton>
            )}
            {toolbar.notSpam && (
              <MailIconButton label="Not spam" onClick={() => actions.notSpam()}>
                <Inbox />
              </MailIconButton>
            )}
            {toolbar.trash && (
              <MailIconButton label="Delete" shortcut="#" onClick={() => actions.trash()}>
                <Trash2 />
              </MailIconButton>
            )}
            {toolbar.discardDraft && (
              <MailIconButton label="Discard drafts" onClick={() => actions.discardDraft(selectedIds)}>
                <Trash2 />
              </MailIconButton>
            )}
            {toolbar.deleteForever && (
              <MailIconButton label="Delete forever" onClick={() => actions.deleteForever()}>
                <Ban />
              </MailIconButton>
            )}
            {toolbar.unsnooze && (
              <MailIconButton label="Unsnooze" onClick={() => actions.unsnooze()}>
                <Inbox />
              </MailIconButton>
            )}
            {toolbar.moveToInbox && (
              <MailIconButton label="Move to Inbox" onClick={() => actions.moveToInbox()}>
                <FolderInput />
              </MailIconButton>
            )}
            <MailIconButton label="Mark as read" onClick={() => actions.markRead(true)}>
              <Mail />
            </MailIconButton>
            <MailIconButton label="Mark as unread" onClick={() => actions.markRead(false)}>
              <MailOpen />
            </MailIconButton>
            {toolbar.snooze && <SnoozeMenu />}
            <LabelMenu conversations={selectedConversations} onCreate={onCreateLabel} />
            <MoveMenu />
          </>
        ) : (
          <MailIconButton label="Refresh" onClick={() => actions.refresh()}>
            <RefreshCw />
          </MailIconButton>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label="More email actions" className="text-muted-foreground" />}
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 min-w-48">
            <DropdownMenuItem onClick={() => actions.markRead(true)} disabled={!showBulk}>
              Mark as read
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.markRead(false)} disabled={!showBulk}>
              Mark as unread
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.important()} disabled={!showBulk}>
              Toggle important
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.star()} disabled={!showBulk}>
              Star
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1 pr-2 text-xs text-muted-foreground">
          {visibleConversations.length ? (
            <>
              <span>
                1–{visibleConversations.length} of {visibleConversations.length}
              </span>
              <MailIconButton label="Newer" disabled>
                <ChevronLeft />
              </MailIconButton>
              <MailIconButton label="Older" disabled>
                <ChevronRight />
              </MailIconButton>
            </>
          ) : (
            <span>{title}</span>
          )}
        </div>
      </div>

      {showTabs && (
        <Tabs
          value={view.type === 'inbox' ? view.category : 'CATEGORY_PERSONAL'}
          onValueChange={(value) => actions.setView({ type: 'inbox', category: value as CategoryLabel })}
          className="gap-0"
        >
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
          >
            {CATEGORY_TAB_META.map((tab) => {
              const unread = folderCounts.inboxUnreadByCategory[tab.id]
              const Icon = CATEGORY_TAB_UI[tab.id].icon
              const active = view.type === 'inbox' && view.category === tab.id
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'relative h-12 min-w-32 flex-none justify-start gap-2 rounded-none px-4 text-muted-foreground after:bottom-0 after:h-[3px]',
                    active && CATEGORY_TAB_UI[tab.id].active,
                  )}
                >
                  <Icon className="size-4" />
                  {tab.name}
                  {unread > 0 && (
                    <Badge variant="secondary" className="h-5 rounded-full px-1.5 font-semibold">
                      <span className={cn('mr-1 size-1.5 rounded-full', CATEGORY_TAB_UI[tab.id].dot)} />
                      {unread}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      )}

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleConversations.length ? (
          visibleConversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              selected={selectedIds.includes(conversation.id)}
              focused={focusedId === conversation.id}
              densityClass={rowDensityClass(density)}
              onFocus={() => onFocusedId(conversation.id)}
              onCreateLabel={onCreateLabel}
            />
          ))
        ) : (
          <EmptyState
            title={empty.title}
            body={empty.body}
            action={
              empty.action === 'compose' ? (
                <Button variant="outline" onClick={() => actions.openCompose()}>
                  Compose
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  )
}

function ConversationRow({
  conversation,
  selected,
  focused,
  densityClass,
  onFocus,
  onCreateLabel,
}: {
  conversation: Conversation
  selected: boolean
  focused: boolean
  densityClass: string
  onFocus: () => void
  onCreateLabel: () => void
}) {
  const { owner, view, userLabels, actions } = useMail()
  const latest = conversation.latest
  const participants = participantString(conversation, owner, view)
  const labels = conversationUserLabels(conversation, userLabels)
  const draft = view.type === 'drafts' || conversation.messages.every(isDraftMessage)
  const toolbar = toolbarForView(view)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  const open = () => {
    onFocus()
    actions.open(conversation.id)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={rowRef}
        data-thread-id={conversation.id}
        className={cn(
          'group relative flex cursor-pointer items-center gap-2 border-b px-2 hover:z-10 hover:shadow-sm',
          densityClass,
          conversation.unread ? 'bg-card font-semibold' : 'bg-muted/20 font-normal',
          selected && 'bg-accent',
          focused && 'bg-accent/70 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary',
        )}
        onClick={open}
        onFocus={onFocus}
      >
        <div
          className="flex items-center"
          onClick={(event) => {
            event.stopPropagation()
          }}
        >
          <Checkbox
            checked={selected}
            aria-label={`Select ${latest.subject || 'conversation'}`}
            onCheckedChange={(_checked, details) => {
              actions.select(conversation.id, { shift: shiftFromDetails(details) })
            }}
          />
        </div>
        <MailIconButton
          label={conversation.starred ? 'Unstar' : 'Star'}
          size="icon-xs"
          pressed={conversation.starred}
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation()
            actions.star([conversation.id])
          }}
        >
          <Star className={cn(conversation.starred && 'fill-amber-400 text-amber-400')} />
        </MailIconButton>
        <MailIconButton
          label={conversation.important ? 'Mark not important' : 'Mark important'}
          size="icon-xs"
          pressed={conversation.important}
          className="hidden shrink-0 sm:inline-flex"
          onClick={(event) => {
            event.stopPropagation()
            actions.important([conversation.id])
          }}
        >
          <svg viewBox="0 0 24 24" className={cn(conversation.important && 'fill-amber-400 text-amber-400')} aria-hidden>
            <path d="M4 4.5 14.5 12 4 19.5z" fill="currentColor" />
          </svg>
        </MailIconButton>
        <span className={cn('w-36 shrink-0 truncate text-sm sm:w-44', conversation.unread && 'font-bold')}>
          {draft ? (
            <span>
              <span className="text-destructive">Draft</span>
              {latest.to[0] ? <span className="font-normal text-muted-foreground">, {participants}</span> : null}
            </span>
          ) : (
            participants
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {conversation.hasDraft && view.type !== 'drafts' && (
            <span className="mr-2 text-destructive">Draft</span>
          )}
          <span className={conversation.unread ? 'font-bold' : 'font-medium'}>
            {latest.subject || '(no subject)'}
          </span>
          <span className="font-normal text-muted-foreground"> – {latest.snippet}</span>
        </span>
        <span className="hidden items-center gap-1 md:flex">
          {labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </span>
        {conversation.hasAttachment && <Paperclip className="hidden size-4 shrink-0 text-muted-foreground sm:block" />}
        <span
          className={cn(
            'w-[4.5rem] shrink-0 text-right text-xs group-hover:invisible group-focus-within:invisible',
            conversation.unread && 'font-bold',
          )}
        >
          {conversation.snoozeUntil && view.type === 'snoozed'
            ? formatSnoozeUntil(conversation.snoozeUntil)
            : formatListTime(conversation.sortKey)}
        </span>
        <div
          className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-md bg-inherit px-0.5 opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {toolbar.archive && canArchiveConversation(conversation) && (
            <MailIconButton
              label="Archive"
              size="icon-sm"
              onClick={() => actions.archive([conversation.id])}
            >
              <Archive />
            </MailIconButton>
          )}
          {(toolbar.trash || toolbar.discardDraft) && (
            <MailIconButton
              label={view.type === 'drafts' ? 'Discard draft' : 'Delete'}
              size="icon-sm"
              onClick={() =>
                view.type === 'drafts' ? actions.discardDraft([conversation.id]) : actions.trash([conversation.id])
              }
            >
              <Trash2 />
            </MailIconButton>
          )}
          <MailIconButton
            label={conversation.unread ? 'Mark as read' : 'Mark as unread'}
            size="icon-sm"
            onClick={() => actions.markRead(!conversation.unread, [conversation.id])}
          >
            {conversation.unread ? <Mail /> : <MailOpen />}
          </MailIconButton>
          {toolbar.snooze && <SnoozeMenu ids={[conversation.id]} />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {toolbar.archive && canArchiveConversation(conversation) && (
          <ContextMenuItem onClick={() => actions.archive([conversation.id])}>Archive</ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() =>
            view.type === 'drafts' ? actions.discardDraft([conversation.id]) : actions.trash([conversation.id])
          }
        >
          {view.type === 'drafts' ? 'Discard draft' : 'Delete'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actions.markRead(!conversation.unread, [conversation.id])}>
          {conversation.unread ? 'Mark as read' : 'Mark as unread'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actions.star([conversation.id])}>
          {conversation.starred ? 'Unstar' : 'Star'}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actions.important([conversation.id])}>
          {conversation.important ? 'Not important' : 'Important'}
        </ContextMenuItem>
        {toolbar.spam && <ContextMenuItem onClick={() => actions.spam([conversation.id])}>Report spam</ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCreateLabel}>Create label</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
