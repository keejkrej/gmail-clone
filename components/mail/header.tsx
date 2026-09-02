'use client'

import { type RefObject } from 'react'
import { CircleHelp, Grid3x3, Menu, Search, Settings, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { initialsFor, useMail } from '@/lib/mail'
import { cn } from '@/lib/utils'
import { AppsPopover, HelpPopover, ProfilePopover, SearchOptions, SettingsPopover } from './actions'
import { GmailWordmark, MailIconButton } from './shared'

export function MailHeader({
  searchRef,
  onMenu,
}: {
  searchRef: RefObject<HTMLInputElement | null>
  onMenu: () => void
}) {
  const { query, actions, owner } = useMail()
  const initials = initialsFor(owner.name)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-2 md:px-3">
      <MailIconButton label="Main menu" onClick={onMenu}>
        <Menu />
      </MailIconButton>
      <GmailWordmark />

      <div className="mx-auto flex min-w-0 max-w-3xl flex-1 items-center">
        <InputGroup
          className={cn(
            'h-12 w-full rounded-full border-transparent bg-background/80 shadow-none',
            'has-[[data-slot=input-group-control]:focus-visible]:border-border has-[[data-slot=input-group-control]:focus-visible]:bg-card has-[[data-slot=input-group-control]:focus-visible]:shadow-md has-[[data-slot=input-group-control]:focus-visible]:ring-0',
          )}
        >
          <InputGroupAddon>
            <Search className="size-5 text-muted-foreground" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value={query}
            onChange={(event) => actions.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                actions.submitSearch()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                actions.clearSearch()
                searchRef.current?.blur()
              }
            }}
            placeholder="Search mail"
            aria-label="Search mail"
            className="h-12"
          />
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton size="icon-sm" aria-label="Clear search" onClick={() => actions.clearSearch()}>
                <X />
              </InputGroupButton>
            ) : null}
            <SearchOptions
              onApply={(next) => {
                actions.setQuery(next)
                if (next.trim()) actions.setView({ type: 'search', query: next.trim() })
              }}
            />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="flex items-center gap-0.5">
        <HelpPopover>
          <MailIconButton label="Support">
            <CircleHelp />
          </MailIconButton>
        </HelpPopover>
        <SettingsPopover>
          <MailIconButton label="Settings">
            <Settings />
          </MailIconButton>
        </SettingsPopover>
        <AppsPopover>
          <MailIconButton label="Google apps">
            <Grid3x3 />
          </MailIconButton>
        </AppsPopover>
        <ProfilePopover>
          <Button type="button" variant="ghost" size="icon" aria-label="Google Account" className="mx-1 rounded-full">
            <Avatar size="default">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </ProfilePopover>
      </div>
    </header>
  )
}
