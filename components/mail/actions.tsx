'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Calendar,
  Clock3,
  FileText,
  FolderInput,
  HardDrive,
  Map,
  Presentation,
  Sheet as SheetIcon,
  SlidersHorizontal,
  Tag,
  Video,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import {
  CATEGORY_TAB_META,
  formatSnoozeUntil,
  snoozePresets,
  useMail,
  type Conversation,
  type UserLabel,
} from '@/lib/mail'
import { EmptyState, LABEL_COLORS, useDensity, type Density } from './shared'

export function SnoozeMenu({ ids }: { ids?: string[] }) {
  const { actions } = useMail()
  const [custom, setCustom] = useState('')
  const [open, setOpen] = useState(false)
  const presets = useMemo(() => snoozePresets(Date.now()), [])

  const pick = (until: number) => {
    actions.snooze(until, ids)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Snooze" className="text-muted-foreground" />}
      >
        <Clock3 />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 min-w-72"
        onKeyDown={(event) => {
          const num = Number(event.key)
          if (num >= 1 && num <= presets.length) {
            event.preventDefault()
            pick(presets[num - 1].until)
          }
        }}
      >
        <DropdownMenuLabel>Snooze until</DropdownMenuLabel>
        {presets.map((preset, index) => (
          <DropdownMenuItem
            key={preset.id}
            className="justify-between gap-4"
            onClick={() => pick(preset.until)}
          >
            <span>{preset.label}</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs">{formatSnoozeUntil(preset.until)}</span>
              <Kbd>{index + 1}</Kbd>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-2 px-1.5 py-1.5" onClick={(event) => event.stopPropagation()}>
          <Label htmlFor="snooze-custom" className="text-xs text-muted-foreground">
            Pick date & time
          </Label>
          <Input
            id="snooze-custom"
            type="datetime-local"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
          <Button
            size="sm"
            disabled={!custom}
            onClick={() => {
              const until = new Date(custom).getTime()
              if (!Number.isNaN(until) && until > Date.now()) pick(until)
            }}
          >
            Snooze
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LabelMenu({
  ids,
  conversations,
  onCreate,
}: {
  ids?: string[]
  conversations: Conversation[]
  onCreate?: () => void
}) {
  const { actions, userLabels } = useMail()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Labels" className="text-muted-foreground" />}
      >
        <Tag />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 min-w-64 p-0">
        <DropdownMenuLabel className="px-3 pt-2">Label as</DropdownMenuLabel>
        {userLabels.length === 0 ? (
          <EmptyState
            title="No labels yet"
            body="Create a label to organize conversations."
            className="min-h-0 px-4 py-6"
          />
        ) : (
          <Command className="rounded-none bg-transparent p-0">
            <CommandInput placeholder="Search labels" />
            <CommandList>
              <CommandEmpty>No labels match.</CommandEmpty>
              <CommandGroup>
                {userLabels.map((label) => {
                  const applied =
                    conversations.length > 0 &&
                    conversations.every((conversation) => conversation.labelIds.includes(label.id))
                  return (
                    <CommandItem
                      key={label.id}
                      value={label.name}
                      onSelect={() => actions.applyLabel(label.id, !applied, ids)}
                    >
                      <Checkbox checked={applied} className="pointer-events-none" />
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: label.color ?? LABEL_COLORS[0] }}
                      />
                      <span className="flex-1 truncate">{label.name}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
        <Separator />
        <div className="p-1">
          <DropdownMenuItem onClick={onCreate}>Create new</DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MoveMenu({ ids }: { ids?: string[] }) {
  const { actions, view } = useMail()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Move to" className="text-muted-foreground" />}
      >
        <FolderInput />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 min-w-52">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {view.type !== 'inbox' && (
          <DropdownMenuItem
            onClick={() => (view.type === 'snoozed' ? actions.unsnooze(ids) : actions.moveToInbox(ids))}
          >
            Inbox
          </DropdownMenuItem>
        )}
        {CATEGORY_TAB_META.map((tab) => (
          <DropdownMenuItem key={tab.id} onClick={() => actions.moveToCategory(tab.id, ids)}>
            {tab.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LabelColorPicker({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  return (
    <ToggleGroup
      value={[color]}
      onValueChange={(value) => {
        const next = value[0]
        if (next) onChange(next)
      }}
      spacing={2}
      className="flex flex-wrap"
    >
      {LABEL_COLORS.map((swatch) => (
        <ToggleGroupItem
          key={swatch}
          value={swatch}
          aria-label={`Color ${swatch}`}
          className={cn(
            'size-6 min-w-6 rounded-full p-0 hover:bg-transparent',
            color === swatch && 'ring-2 ring-ring ring-offset-2',
          )}
          style={{ background: swatch }}
        />
      ))}
    </ToggleGroup>
  )
}

export function CreateLabelDialog({
  open,
  onOpenChange,
  applyTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applyTo?: string[]
}) {
  const { actions } = useMail()
  const [name, setName] = useState('')
  const [color, setColor] = useState(LABEL_COLORS[0])
  const [apply, setApply] = useState(Boolean(applyTo?.length))
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setColor(LABEL_COLORS[0])
    setError('')
    setApply(Boolean(applyTo?.length))
  }

  const submit = () => {
    const result = actions.createLabel(name, color)
    if (typeof result === 'object' && result.error) {
      setError(result.error)
      return
    }
    if (typeof result === 'string' && apply && applyTo?.length) {
      actions.applyLabel(result, true, applyTo)
    }
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create label</DialogTitle>
          <DialogDescription>Name a label and pick a color. You can apply it to the current conversation.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label-name">Label name</Label>
            <Input
              id="label-name"
              value={name}
              autoFocus
              placeholder="e.g. Waiting"
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <LabelColorPicker color={color} onChange={setColor} />
          </div>
          {applyTo && applyTo.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={apply} onCheckedChange={setApply} />
              Apply to current conversation
            </label>
          )}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditLabelDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: UserLabel | null
}) {
  const { actions } = useMail()
  const [name, setName] = useState(label?.name ?? '')
  const [color, setColor] = useState(label?.color ?? LABEL_COLORS[0])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !label) return
    setName(label.name)
    setColor(label.color ?? LABEL_COLORS[0])
    setError('')
  }, [open, label])

  const submit = () => {
    if (!label) return
    const result = actions.renameLabel(label.id, name, color)
    if (result) {
      setError(result)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename label</DialogTitle>
          <DialogDescription>Update the name or color. Conversations keep this label.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-label-name">Label name</Label>
            <Input
              id="edit-label-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <LabelColorPicker color={color} onChange={setColor} />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteLabelDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: UserLabel | null
}) {
  const { actions } = useMail()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete label{label ? ` “${label.name}”` : ''}?</DialogTitle>
          <DialogDescription>
            The label is removed from every conversation. Messages themselves are not deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (label) actions.deleteLabel(label.id)
              onOpenChange(false)
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmSubjectDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send this message without a subject?</DialogTitle>
          <DialogDescription>The subject line is empty. You can still send, or go back and add one.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            Send anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SearchOptions({
  onApply,
}: {
  onApply: (query: string) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [hasAttachment, setHasAttachment] = useState(false)
  const [scope, setScope] = useState('all')
  const [open, setOpen] = useState(false)

  const apply = () => {
    const parts: string[] = []
    if (from.trim()) parts.push(`from:${from.trim()}`)
    if (to.trim()) parts.push(`to:${to.trim()}`)
    if (subject.trim()) parts.push(`subject:${quoteIfNeeded(subject.trim())}`)
    if (hasAttachment) parts.push('has:attachment')
    if (scope === 'inbox') parts.push('in:inbox')
    if (scope === 'spam') parts.push('in:spam')
    if (scope === 'trash') parts.push('in:trash')
    if (scope === 'anywhere') parts.push('in:anywhere')
    onApply(parts.join(' '))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label="Search options" className="text-muted-foreground" />}
      >
        <SlidersHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <p className="font-medium">Search options</p>
          <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
            <Label htmlFor="search-from">From</Label>
            <Input id="search-from" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Label htmlFor="search-to">To</Label>
            <Input id="search-to" value={to} onChange={(event) => setTo(event.target.value)} />
            <Label htmlFor="search-subject">Subject</Label>
            <Input id="search-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <Label htmlFor="search-in">Search in</Label>
            <Select
              value={scope}
              onValueChange={(value) => value && setScope(value)}
              items={{
                all: 'All Mail',
                inbox: 'Inbox',
                spam: 'Spam',
                trash: 'Trash',
                anywhere: 'Anywhere',
              }}
            >
              <SelectTrigger id="search-in" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mail</SelectItem>
                <SelectItem value="inbox">Inbox</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="trash">Trash</SelectItem>
                <SelectItem value="anywhere">Anywhere</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hasAttachment} onCheckedChange={(checked) => setHasAttachment(Boolean(checked))} />
            Has attachment
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={apply}>
              Search
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function quoteIfNeeded(value: string) {
  return /\s/.test(value) ? `"${value}"` : value
}

export function SettingsPopover({ children }: { children: ReactNode }) {
  const { density, setDensity } = useDensity()
  const { actions } = useMail()

  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={<span className="inline-flex" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="font-medium">Quick settings</p>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Density</p>
          <ToggleGroup
            value={[density]}
            onValueChange={(value) => {
              const next = value[0] as Density | undefined
              if (next) setDensity(next)
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <ToggleGroupItem value="comfortable" className="flex-1">
              Comfortable
            </ToggleGroupItem>
            <ToggleGroupItem value="default" className="flex-1">
              Default
            </ToggleGroupItem>
            <ToggleGroupItem value="compact" className="flex-1">
              Compact
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">Uses shadcn spacing tokens only — row padding changes, colors do not.</p>
        </div>
        <Separator />
        <Button variant="outline" className="w-full" onClick={() => actions.resetToSeed()}>
          Reset mailbox to seed
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function HelpPopover({ children }: { children: ReactNode }) {
  const shortcuts = [
    ['c', 'Compose'],
    ['/', 'Search'],
    ['e', 'Archive'],
    ['#', 'Delete'],
    ['s', 'Star'],
    ['r', 'Reply'],
    ['f', 'Forward'],
    ['u', 'Back to list'],
    ['j / k', 'Next / previous'],
    ['Esc', 'Close'],
  ]
  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={<span className="inline-flex" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="font-medium">Help & keyboard</p>
        <p className="text-xs text-muted-foreground">
          Search operators: from:, to:, subject:, is:unread, is:starred, has:attachment, in:inbox, label:Work
        </p>
        <Separator />
        <ul className="flex flex-col gap-1.5 text-sm">
          {shortcuts.map(([key, label]) => (
            <li key={label} className="flex items-center justify-between gap-3">
              <span>{label}</span>
              <Kbd>{key}</Kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

const APPS = [
  { name: 'Calendar', icon: Calendar },
  { name: 'Meet', icon: Video },
  { name: 'Drive', icon: HardDrive },
  { name: 'Docs', icon: FileText },
  { name: 'Sheets', icon: SheetIcon },
  { name: 'Slides', icon: Presentation },
  { name: 'Maps', icon: Map },
]

export function AppsPopover({ children }: { children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={<span className="inline-flex" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="font-medium">Google apps</p>
        <div className="grid grid-cols-3 gap-1">
          {APPS.map((app) => (
            <Button
              key={app.name}
              type="button"
              variant="ghost"
              className="h-auto flex-col gap-1 rounded-lg p-3 text-xs text-muted-foreground"
            >
              <app.icon className="size-6" />
              {app.name}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ProfilePopover({ children }: { children: ReactNode }) {
  const { owner } = useMail()
  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={<span className="inline-flex" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="font-medium">{owner.name}</p>
        <p className="text-sm text-muted-foreground">{owner.email}</p>
        <Separator />
        <p className="text-xs text-muted-foreground">Local mailbox · stored in this browser · no server account</p>
      </PopoverContent>
    </Popover>
  )
}

export function conversationTargets(
  selectedIds: string[],
  openId: string | null,
  visible: Conversation[],
): Conversation[] {
  const ids = selectedIds.length ? selectedIds : openId ? [openId] : []
  return visible.filter((conversation) => ids.includes(conversation.id))
}

export function LabelChip({ label }: { label: UserLabel }) {
  return (
    <Badge
      variant="secondary"
      className="max-w-24 truncate rounded-sm"
      style={{ boxShadow: `inset 3px 0 0 ${label.color ?? LABEL_COLORS[0]}` }}
    >
      {label.name}
    </Badge>
  )
}
