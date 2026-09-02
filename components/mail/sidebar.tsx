'use client'

import { useState } from 'react'
import { ChevronDown, MoreVertical, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useMail, type CategoryLabel, type UserLabel, type View } from '@/lib/mail'
import { DeleteLabelDialog, EditLabelDialog } from './actions'
import { MORE_FOLDERS, PRIMARY_FOLDERS, folderView, isViewActive } from './shared'

export function MailSidebar({
  collapsed,
  onNavigate,
  onCreateLabel,
  inboxCategory,
}: {
  collapsed: boolean
  onNavigate?: () => void
  onCreateLabel?: () => void
  inboxCategory: CategoryLabel
}) {
  const { view, folderCounts, userLabels, actions } = useMail()
  const [editLabel, setEditLabel] = useState<UserLabel | null>(null)
  const [deleteLabel, setDeleteLabel] = useState<UserLabel | null>(null)

  const go = (next: View) => {
    actions.setView(next)
    onNavigate?.()
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-muted pt-2 transition-[width] duration-200',
        collapsed ? 'w-[72px] px-2' : 'w-64 px-3',
      )}
    >
      <div className={cn('px-1 pb-4', collapsed && 'flex justify-center px-0')}>
        <Button
          onClick={() => {
            actions.openCompose()
            onNavigate?.()
          }}
          variant="secondary"
          className={cn(
            'h-14 gap-3 rounded-2xl bg-card text-foreground shadow-sm hover:bg-card hover:shadow-md',
            collapsed ? 'size-14 px-0' : 'w-fit px-6',
          )}
          aria-label="Compose"
        >
          <Pencil data-icon="inline-start" className="size-5" />
          {!collapsed && <span className="pr-2">Compose</span>}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-0.5 pr-1" aria-label="Mail folders">
          {PRIMARY_FOLDERS.map((folder) => {
            const badge =
              folder.type === 'inbox'
                ? folderCounts.inboxPrimaryUnread
                : folder.type === 'drafts'
                  ? folderCounts.drafts
                  : 0
            return (
              <FolderRow
                key={folder.type}
                icon={folder.icon}
                label={folder.label}
                collapsed={collapsed}
                active={isViewActive(view, folder.type)}
                badge={badge || undefined}
                onClick={() => go(folderView(folder.type, inboxCategory))}
              />
            )
          })}

          <Separator className="my-3" />

          {!collapsed && (
            <div className="flex items-center justify-between px-3 pb-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Labels</p>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Create label"
                onClick={onCreateLabel}
                className="text-muted-foreground"
              >
                <Plus />
              </Button>
            </div>
          )}
          {userLabels.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              collapsed={collapsed}
              active={isViewActive(view, 'label', label.id)}
              badge={folderCounts.userLabelUnread[label.id] || undefined}
              onClick={() => go({ type: 'label', labelId: label.id })}
              onRename={() => setEditLabel(label)}
              onDelete={() => setDeleteLabel(label)}
            />
          ))}

          <Collapsible defaultOpen className="group/more mt-2">
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  className={cn(
                    'h-auto w-full justify-start gap-3 rounded-r-full px-3 py-1.5 text-sm font-normal text-foreground hover:bg-sidebar-accent',
                    collapsed && 'justify-center px-0',
                  )}
                />
              }
            >
              <ChevronDown className="size-4 transition group-data-closed/more:-rotate-90" />
              {!collapsed && 'More'}
            </CollapsibleTrigger>
            <CollapsibleContent>
              {MORE_FOLDERS.map((folder) => (
                <FolderRow
                  key={folder.type}
                  icon={folder.icon}
                  label={folder.label}
                  collapsed={collapsed}
                  active={isViewActive(view, folder.type)}
                  onClick={() => go(folderView(folder.type, inboxCategory))}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </nav>
      </ScrollArea>
      <EditLabelDialog label={editLabel} open={Boolean(editLabel)} onOpenChange={(open) => !open && setEditLabel(null)} />
      <DeleteLabelDialog
        label={deleteLabel}
        open={Boolean(deleteLabel)}
        onOpenChange={(open) => !open && setDeleteLabel(null)}
      />
    </div>
  )
}

function LabelRow({
  label,
  active,
  badge,
  collapsed,
  onClick,
  onRename,
  onDelete,
}: {
  label: UserLabel
  active: boolean
  badge?: number
  collapsed: boolean
  onClick: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="group/label relative flex items-center">
        <FolderRow
          swatch={label.color}
          label={label.name}
          collapsed={collapsed}
          active={active}
          badge={badge}
          onClick={onClick}
        />
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${label.name} label options`}
                  className="absolute right-1 text-muted-foreground opacity-0 group-hover/label:opacity-100 group-focus-within/label:opacity-100"
                />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 min-w-40">
              <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        <ContextMenuItem onClick={onClick}>Open</ContextMenuItem>
        <ContextMenuItem onClick={onRename}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FolderRow({
  icon: Icon,
  swatch,
  label,
  active,
  badge,
  collapsed,
  onClick,
}: {
  icon?: (typeof PRIMARY_FOLDERS)[number]['icon']
  swatch?: string
  label: string
  active: boolean
  badge?: number
  collapsed: boolean
  onClick: () => void
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'h-auto w-full justify-start gap-3 rounded-r-full px-3 py-1.5 text-sm font-normal hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent font-bold',
        collapsed && 'justify-center px-0',
      )}
    >
      {Icon ? (
        <Icon className="size-4 shrink-0" />
      ) : (
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: swatch ?? 'var(--primary)' }} />
      )}
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && badge ? <span className="text-xs font-bold group-hover/label:opacity-0">{badge}</span> : null}
    </Button>
  )

  if (!collapsed) return button
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">
        {label}
        {badge ? ` (${badge})` : ''}
      </TooltipContent>
    </Tooltip>
  )
}
