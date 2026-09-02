'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { UNDO_WINDOW_MS, useMail } from '@/lib/mail'
import { CreateLabelDialog } from './actions'
import { ComposeWindow } from './compose'
import { MailHeader } from './header'
import { MailList } from './list'
import { MailSidebar } from './sidebar'
import { isEditableTarget, useCollapsedSidebar, useDensity } from './shared'
import { ThreadView } from './thread'

export function GmailApp() {
  const mail = useMail()
  const { view, selectedIds, openId, visibleConversations, compose, undo, actions, hydrated } = mail
  const { collapsed, toggle } = useCollapsedSidebar()
  const { density } = useDensity()
  const [mobileNav, setMobileNav] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [labelOpen, setLabelOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const inboxCategory = view.type === 'inbox' ? view.category : 'CATEGORY_PERSONAL'

  const labelTargets = useMemo(() => {
    if (selectedIds.length) return selectedIds
    if (openId) return [openId]
    return []
  }, [openId, selectedIds])

  useEffect(() => {
    if (!visibleConversations.some((conversation) => conversation.id === focusedId)) {
      setFocusedId(visibleConversations[0]?.id ?? null)
    }
  }, [focusedId, visibleConversations])

  useEffect(() => {
    if (!undo) {
      toast.dismiss('mail-undo')
      return
    }
    const remaining = Math.max(800, undo.expiresAt - Date.now())
    toast(undo.message.replace(/\. Undo$/i, ''), {
      id: 'mail-undo',
      duration: Math.min(remaining, UNDO_WINDOW_MS),
      action: {
        label: 'Undo',
        onClick: () => actions.undo(),
      },
    })
  }, [actions, undo])

  const openCreateLabel = useCallback(() => setLabelOpen(true), [])

  const onMenu = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) toggle()
    else setMobileNav(true)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const editable = isEditableTarget(event.target)
      const key = event.key

      if (key === 'Escape') {
        if (compose.open) {
          actions.closeCompose()
          return
        }
        if (openId) {
          actions.open(null)
          return
        }
        if (selectedIds.length) {
          actions.clearSelection()
          return
        }
        if (mail.query) {
          actions.clearSearch()
        }
        return
      }

      if (editable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (key === 'c') {
        event.preventDefault()
        if (!compose.open) actions.openCompose()
        return
      }
      if (key === '/') {
        event.preventDefault()
        const node = searchRef.current
        node?.focus()
        if (node && node.tagName !== 'INPUT') node.querySelector('input')?.focus()
        return
      }
      if (key === 'e') {
        event.preventDefault()
        if (selectedIds.length || openId) actions.archive()
        return
      }
      if (key === '#' || (event.shiftKey && key === '3')) {
        event.preventDefault()
        if (selectedIds.length || openId) actions.trash()
        return
      }
      if (key === 's') {
        event.preventDefault()
        if (selectedIds.length || openId) actions.star()
        return
      }
      if (key === 'r') {
        event.preventDefault()
        if (openId) actions.reply('reply')
        return
      }
      if (key === 'f') {
        event.preventDefault()
        if (openId) actions.forward()
        return
      }
      if (key === 'u') {
        event.preventDefault()
        if (openId) actions.open(null)
        return
      }
      if (key === 'Enter' && focusedId && !openId) {
        event.preventDefault()
        actions.open(focusedId)
        return
      }
      if (key === 'j' || key === 'k') {
        event.preventDefault()
        const ids = visibleConversations.map((conversation) => conversation.id)
        if (!ids.length) return
        const current = openId ?? focusedId ?? ids[0]
        const index = Math.max(0, ids.indexOf(current))
        const nextIndex = key === 'j' ? Math.min(ids.length - 1, index + 1) : Math.max(0, index - 1)
        const next = ids[nextIndex]
        setFocusedId(next)
        if (openId) actions.open(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, compose.open, focusedId, mail.query, openId, selectedIds.length, visibleConversations])

  if (!hydrated) {
    return <main className="min-h-svh bg-muted" />
  }

  return (
    <div className="flex h-svh flex-col bg-muted" data-density={density}>
      <MailHeader searchRef={searchRef} onMenu={onMenu} />
      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block">
          <MailSidebar
            collapsed={collapsed}
            inboxCategory={inboxCategory}
            onCreateLabel={openCreateLabel}
          />
        </div>
        <Sheet open={mobileNav} onOpenChange={setMobileNav}>
          <SheetContent side="left" className="w-64 bg-muted p-0 sm:max-w-64" showCloseButton={false}>
            <SheetTitle className="sr-only">Mail navigation</SheetTitle>
            <MailSidebar
              collapsed={false}
              inboxCategory={inboxCategory}
              onNavigate={() => setMobileNav(false)}
              onCreateLabel={() => {
                setMobileNav(false)
                openCreateLabel()
              }}
            />
          </SheetContent>
        </Sheet>
        <section className="mr-2 mb-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
          {mail.openConversation ? (
            <ThreadView onCreateLabel={openCreateLabel} />
          ) : (
            <MailList
              focusedId={focusedId}
              onFocusedId={setFocusedId}
              onCreateLabel={openCreateLabel}
            />
          )}
        </section>
      </div>
      <ComposeWindow />
      <CreateLabelDialog open={labelOpen} onOpenChange={setLabelOpen} applyTo={labelTargets} />
      <div role="status" aria-live="polite" className="sr-only">
        {undo?.message ?? ''}
      </div>
    </div>
  )
}
