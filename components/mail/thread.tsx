'use client'

import { useState } from 'react'
import {
  AlertOctagon,
  Archive,
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronUp,
  FolderInput,
  Forward,
  Inbox,
  MailOpen,
  MoreVertical,
  Paperclip,
  Printer,
  Reply,
  ReplyAll,
  Star,
  Trash2,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  avatarClassFor,
  canArchiveConversation,
  conversationUserLabels,
  focusedMessage,
  formatAddress,
  formatAddressList,
  formatMessageDate,
  initialsFor,
  isDraftMessage,
  toolbarForView,
  useMail,
  type Message,
} from '@/lib/mail'
import { conversationTargets, LabelChip, LabelMenu, MoveMenu, SnoozeMenu } from './actions'
import { InlineCompose, isInlineCompose } from './compose'
import { EmptyState, formatBytes, MailIconButton } from './shared'

export function ThreadView({ onCreateLabel }: { onCreateLabel: () => void }) {
  const mail = useMail()
  const { openConversation, openMessages, view, actions, userLabels, selectedIds, visibleConversations, compose } = mail
  if (!openConversation) return null
  const conversation = openConversation
  const toolbar = toolbarForView(view)
  const labels = conversationUserLabels(conversation, userLabels)
  const latest = focusedMessage(openMessages.length ? openMessages : conversation.messages)
  const canReply = Boolean(latest && !isDraftMessage(latest))
  const targets = conversationTargets(selectedIds, conversation.id, [conversation, ...visibleConversations])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-0.5 px-2">
        <MailIconButton label="Back to list" shortcut="u" onClick={() => actions.open(null)}>
          <ArrowLeft />
        </MailIconButton>
        {toolbar.archive && canArchiveConversation(conversation) && (
          <MailIconButton label="Archive" shortcut="e" onClick={() => actions.archive([conversation.id])}>
            <Archive />
          </MailIconButton>
        )}
        {toolbar.spam && (
          <MailIconButton label="Report spam" onClick={() => actions.spam([conversation.id])}>
            <AlertOctagon />
          </MailIconButton>
        )}
        {toolbar.notSpam && (
          <MailIconButton label="Not spam" onClick={() => actions.notSpam([conversation.id])}>
            <Inbox />
          </MailIconButton>
        )}
        {(toolbar.trash || toolbar.discardDraft) && (
          <MailIconButton
            label={view.type === 'drafts' ? 'Discard draft' : 'Delete'}
            shortcut="#"
            onClick={() =>
              view.type === 'drafts' ? actions.discardDraft([conversation.id]) : actions.trash([conversation.id])
            }
          >
            <Trash2 />
          </MailIconButton>
        )}
        {toolbar.deleteForever && (
          <MailIconButton label="Delete forever" onClick={() => actions.deleteForever([conversation.id])}>
            <Ban />
          </MailIconButton>
        )}
        {toolbar.unsnooze && (
          <MailIconButton label="Unsnooze" onClick={() => actions.unsnooze([conversation.id])}>
            <Inbox />
          </MailIconButton>
        )}
        {toolbar.moveToInbox && (
          <MailIconButton label="Move to Inbox" onClick={() => actions.moveToInbox([conversation.id])}>
            <FolderInput />
          </MailIconButton>
        )}
        <MailIconButton
          label="Mark as unread"
          onClick={() => {
            actions.markRead(false, [conversation.id])
            actions.open(null)
          }}
        >
          <MailOpen />
        </MailIconButton>
        {toolbar.snooze && <SnoozeMenu ids={[conversation.id]} />}
        <LabelMenu ids={[conversation.id]} conversations={targets} onCreate={onCreateLabel} />
        <MoveMenu ids={[conversation.id]} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label="More message actions" className="text-muted-foreground" />}
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 min-w-48">
            <DropdownMenuItem onClick={() => actions.star([conversation.id])}>
              {conversation.starred ? 'Unstar' : 'Star'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.important([conversation.id])}>
              {conversation.important ? 'Not important' : 'Mark important'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.print()}>Print</DropdownMenuItem>
            {canReply && <DropdownMenuItem onClick={() => actions.reply('reply')}>Reply</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3 py-3">
          <h1 className="text-xl font-normal text-balance md:text-2xl">
            {conversation.latest.subject || '(no subject)'}
          </h1>
          <div className="flex flex-wrap items-center gap-1">
            {labels.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {openMessages.length === 0 ? (
            <EmptyState
              title="No messages in this conversation"
              body="There are no visible messages in the current view."
            />
          ) : (
            openMessages.map((message, index) => (
              <MessageCard
                key={message.id}
                message={message}
                collapsed={openMessages.length > 2 && index < openMessages.length - 1 && !isDraftMessage(message)}
                starred={conversation.starred}
                onStar={() => actions.star([conversation.id])}
                onReply={() => actions.reply('reply', message.id)}
                onReplyAll={() => actions.reply('replyAll', message.id)}
                onForward={() => actions.forward(message.id)}
                onContinueDraft={() => actions.continueDraft(conversation.id)}
              />
            ))
          )}
        </div>

        <InlineCompose />

        {canReply && !isInlineCompose(conversation.id, compose) && (
          <div className="mt-4 flex flex-wrap gap-2 pb-6">
            <Button variant="outline" onClick={() => actions.reply('reply')}>
              <Reply data-icon="inline-start" />
              Reply
            </Button>
            <Button variant="outline" onClick={() => actions.reply('replyAll')}>
              <ReplyAll data-icon="inline-start" />
              Reply all
            </Button>
            <Button variant="outline" onClick={() => actions.forward()}>
              <Forward data-icon="inline-start" />
              Forward
            </Button>
            <MailIconButton label="Print" onClick={() => window.print()}>
              <Printer />
            </MailIconButton>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageCard({
  message,
  collapsed: startCollapsed,
  starred,
  onStar,
  onReply,
  onReplyAll,
  onForward,
  onContinueDraft,
}: {
  message: Message
  collapsed: boolean
  starred: boolean
  onStar: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onContinueDraft: () => void
}) {
  const draft = isDraftMessage(message)
  const [open, setOpen] = useState(!startCollapsed || draft)
  const [details, setDetails] = useState(false)
  const seed = message.from.email
  const to = formatAddressList(message.to) || 'me'

  return (
    <article
      className={cn(
        'rounded-xl border bg-card p-4 shadow-xs',
        draft && 'border-dashed',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar>
          <AvatarFallback className={cn('text-xs font-semibold', avatarClassFor(seed))}>
            {initialsFor(message.from.name || message.from.email)}
          </AvatarFallback>
        </Avatar>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start px-0 text-left font-normal hover:bg-transparent"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{draft ? 'Draft' : message.from.name || message.from.email}</span>
            {!draft && (
              <span className="text-xs text-muted-foreground">&lt;{message.from.email}&gt;</span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{formatMessageDate(message.internalDate)}</span>
          </div>
          {open ? (
            <p className="text-xs font-normal text-muted-foreground">to {to}</p>
          ) : (
            <p className="truncate text-sm font-normal text-muted-foreground">{message.snippet}</p>
          )}
        </Button>
        <div className="flex items-center">
          <MailIconButton label={starred ? 'Unstar' : 'Star'} size="icon-sm" onClick={onStar}>
            <Star className={cn(starred && 'fill-amber-400 text-amber-400')} />
          </MailIconButton>
          <MailIconButton label={open ? 'Collapse message' : 'Expand message'} size="icon-sm" onClick={() => setOpen((value) => !value)}>
            {open ? <ChevronUp /> : <ChevronDown />}
          </MailIconButton>
        </div>
      </div>

      {open && (
        <div className="mt-4 md:pl-12">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mb-3 h-auto px-0 text-xs text-muted-foreground"
            onClick={() => setDetails((value) => !value)}
          >
            {details ? 'Hide details' : 'Show details'}
          </Button>
          {details && (
            <dl className="mb-4 grid max-w-xl grid-cols-[4.5rem_1fr] gap-1 text-xs text-muted-foreground">
              <dt>From</dt>
              <dd>{formatAddress(message.from)}</dd>
              <dt>To</dt>
              <dd>{to}</dd>
              {message.cc.length > 0 && (
                <>
                  <dt>Cc</dt>
                  <dd>{formatAddressList(message.cc)}</dd>
                </>
              )}
              <dt>Date</dt>
              <dd>{formatMessageDate(message.internalDate)}</dd>
              <dt>Subject</dt>
              <dd>{message.subject || '(no subject)'}</dd>
            </dl>
          )}
          <p className="max-w-2xl whitespace-pre-wrap text-sm leading-7">{message.bodyText}</p>
          {message.attachments.length > 0 && (
            <>
              <Separator className="my-4" />
              <ul className="flex flex-col gap-2">
                {message.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="size-4" />
                    <span className="truncate">{attachment.filename}</span>
                    <span className="text-xs">{formatBytes(attachment.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {draft && (
            <Button variant="outline" className="mt-4" onClick={onContinueDraft}>
              Continue draft
            </Button>
          )}
          {!draft && (
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={onReply}>
                <Reply data-icon="inline-start" />
                Reply
              </Button>
              <Button variant="outline" size="sm" onClick={onReplyAll}>
                <ReplyAll data-icon="inline-start" />
                Reply all
              </Button>
              <Button variant="outline" size="sm" onClick={onForward}>
                <Forward data-icon="inline-start" />
                Forward
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
