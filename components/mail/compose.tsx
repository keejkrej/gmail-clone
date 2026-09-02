'use client'

import { useRef, useState, type RefObject } from 'react'
import {
  Maximize2,
  Minimize2,
  Paperclip,
  Smile,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useMail } from '@/lib/mail'
import { ConfirmSubjectDialog } from './actions'
import { formatBytes, MailIconButton } from './shared'

export function isInlineCompose(openId: string | null, compose: { open: boolean; threadId?: string; mode: string }) {
  return (
    compose.open &&
    Boolean(openId) &&
    compose.threadId === openId &&
    (compose.mode === 'reply' || compose.mode === 'replyAll')
  )
}

export function ComposeWindow() {
  const { compose, openId } = useMail()
  if (!compose.open) return null
  if (isInlineCompose(openId, compose)) return null
  return <ComposeCard docked />
}

export function InlineCompose() {
  const { compose, openId } = useMail()
  if (!isInlineCompose(openId, compose)) return null
  return (
    <div className="px-4 pb-6 md:px-8">
      <ComposeCard />
    </div>
  )
}

function ComposeCard({ docked = false }: { docked?: boolean }) {
  const { compose, actions } = useMail()
  const [expanded, setExpanded] = useState(false)
  const [confirmSubject, setConfirmSubject] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const send = () => {
    const result = actions.send()
    if ('needsSubjectConfirm' in result && result.needsSubjectConfirm) {
      setConfirmSubject(true)
    }
  }

  const title =
    compose.subject.trim() ||
    (compose.mode === 'new' ? 'New Message' : compose.mode === 'forward' ? 'Forward' : 'Reply')

  const status =
    compose.status === 'saving' ? 'Saving…' : compose.status === 'saved' ? 'Draft saved' : ''

  return (
    <>
      <div
        className={cn(
          'z-50 flex flex-col overflow-hidden border bg-card shadow-2xl',
          !docked
            ? 'relative rounded-xl'
            : expanded
              ? 'fixed inset-3 md:inset-8'
              : compose.minimized
                ? 'fixed right-4 bottom-0 w-72 rounded-t-xl'
                : 'fixed right-4 bottom-0 w-[min(100%-1.5rem,34rem)] rounded-t-xl max-md:inset-x-0 max-md:bottom-0 max-md:w-full max-md:rounded-none',
        )}
      >
        <div className="flex items-center gap-1 bg-foreground px-2 py-1 text-sm font-medium text-background">
          <span className="min-w-0 flex-1 truncate px-1">{title}</span>
          <span className="hidden text-[11px] font-normal text-background/70 sm:inline">{status}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-background hover:bg-background/10 hover:text-background"
            aria-label={compose.minimized ? 'Restore compose' : 'Minimize compose'}
            onClick={() => {
              if (expanded) setExpanded(false)
              actions.toggleComposeMinimized()
            }}
          >
            <Minimize2 />
          </Button>
          {docked && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-background hover:bg-background/10 hover:text-background"
              aria-label={expanded ? 'Exit full screen' : 'Full screen'}
              onClick={() => {
                if (compose.minimized) actions.toggleComposeMinimized()
                setExpanded((value) => !value)
              }}
            >
              {expanded ? <Square /> : <Maximize2 />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-background hover:bg-background/10 hover:text-background"
            aria-label="Close compose"
            onClick={() => {
              setExpanded(false)
              actions.closeCompose()
            }}
          >
            <X />
          </Button>
        </div>

        {!compose.minimized && (
          <ComposeFields
            tall={expanded || !docked}
            fileRef={fileRef}
            onSend={send}
            onAttach={() => fileRef.current?.click()}
          />
        )}
      </div>
      <ConfirmSubjectDialog
        open={confirmSubject}
        onOpenChange={setConfirmSubject}
        onConfirm={() => actions.send({ confirmEmptySubject: true })}
      />
    </>
  )
}

function ComposeFields({
  tall,
  fileRef,
  onSend,
  onAttach,
}: {
  tall: boolean
  fileRef: RefObject<HTMLInputElement | null>
  onSend: () => void
  onAttach: () => void
}) {
  const { compose, actions } = useMail()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InputGroup className="h-10 rounded-none border-0 border-b shadow-none dark:bg-transparent">
        <InputGroupAddon>
          <span className="w-8 text-xs">To</span>
        </InputGroupAddon>
        <InputGroupInput
          value={compose.toRaw}
          onChange={(event) => actions.setComposeField({ toRaw: event.target.value })}
          placeholder="Recipients"
          aria-label="To"
        />
        <InputGroupAddon align="inline-end">
          {!compose.showCc && (
            <InputGroupButton onClick={() => actions.setComposeField({ showCc: true })}>Cc</InputGroupButton>
          )}
          {!compose.showBcc && (
            <InputGroupButton onClick={() => actions.setComposeField({ showBcc: true })}>Bcc</InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      {(compose.showCc || compose.ccRaw) && (
        <InputGroup className="h-10 rounded-none border-0 border-b shadow-none dark:bg-transparent">
          <InputGroupAddon>
            <span className="w-8 text-xs">Cc</span>
          </InputGroupAddon>
          <InputGroupInput
            value={compose.ccRaw}
            onChange={(event) => actions.setComposeField({ ccRaw: event.target.value })}
            aria-label="Cc"
          />
        </InputGroup>
      )}
      {(compose.showBcc || compose.bccRaw) && (
        <InputGroup className="h-10 rounded-none border-0 border-b shadow-none dark:bg-transparent">
          <InputGroupAddon>
            <span className="w-8 text-xs">Bcc</span>
          </InputGroupAddon>
          <InputGroupInput
            value={compose.bccRaw}
            onChange={(event) => actions.setComposeField({ bccRaw: event.target.value })}
            aria-label="Bcc"
          />
        </InputGroup>
      )}
      <InputGroup className="h-10 rounded-none border-0 border-b shadow-none dark:bg-transparent">
        <InputGroupInput
          value={compose.subject}
          onChange={(event) => actions.setComposeField({ subject: event.target.value })}
          placeholder="Subject"
          aria-label="Subject"
        />
      </InputGroup>
      <Textarea
        value={compose.bodyText}
        onChange={(event) => actions.setComposeField({ bodyText: event.target.value })}
        placeholder="Write your message"
        aria-label="Message body"
        className={cn(
          'min-h-40 flex-1 resize-none rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 dark:bg-transparent',
          tall && 'min-h-72',
        )}
      />
      {compose.attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-3 pb-2 text-xs">
          {compose.attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Paperclip className="size-3" />
              <span className="max-w-40 truncate">{attachment.filename}</span>
              <span className="text-muted-foreground">{formatBytes(attachment.sizeBytes)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${attachment.filename}`}
                onClick={() => actions.removeAttachment(attachment.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {compose.error && <p className="px-3 pb-2 text-xs text-destructive">{compose.error}</p>}
      <div className="flex items-center justify-between gap-2 border-t p-2">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])].map((file) => ({
                filename: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
              }))
              if (files.length) actions.addAttachments(files)
              event.target.value = ''
            }}
          />
          <Button onClick={onSend} className="rounded-full px-6">
            Send
          </Button>
          <MailIconButton label="Attach file" onClick={onAttach}>
            <Paperclip />
          </MailIconButton>
          <MailIconButton
            label="Add emoji"
            onClick={() => actions.setComposeField({ bodyText: `${compose.bodyText}😊` })}
          >
            <Smile />
          </MailIconButton>
        </div>
        <MailIconButton label="Discard draft" onClick={() => actions.discardDraft()}>
          <Trash2 />
        </MailIconButton>
      </div>
    </div>
  )
}
