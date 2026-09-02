'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import {
  Ban,
  Bookmark,
  Clock3,
  Inbox,
  Mail,
  MailPlus,
  Send,
  Star,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { type CategoryLabel, type View } from '@/lib/mail'

export type Density = 'comfortable' | 'default' | 'compact'

const DENSITY_KEY = 'gmail-clone.density'
const SIDEBAR_KEY = 'gmail-clone.sidebar-collapsed'

type DensityContextValue = {
  density: Density
  setDensity: (density: Density) => void
}

const DensityContext = createContext<DensityContextValue>({
  density: 'default',
  setDensity: () => {},
})

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>('default')

  useEffect(() => {
    const stored = window.localStorage.getItem(DENSITY_KEY)
    if (stored === 'comfortable' || stored === 'default' || stored === 'compact') {
      setDensityState(stored)
    }
  }, [])

  const setDensity = useCallback((next: Density) => {
    setDensityState(next)
    window.localStorage.setItem(DENSITY_KEY, next)
  }, [])

  return <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>
}

export function useDensity() {
  return useContext(DensityContext)
}

export function useCollapsedSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1')
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  return { collapsed, toggle, setCollapsed }
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export const LABEL_COLORS = [
  '#1a73e8',
  '#188038',
  '#e37400',
  '#d93025',
  '#a142f4',
  '#c5221f',
  '#1967d2',
  '#0d9488',
  '#db2777',
  '#ca8a04',
]

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function shiftFromDetails(details: { event?: Event }) {
  const event = details.event
  return Boolean(event && 'shiftKey' in event && (event as MouseEvent).shiftKey)
}

export type FolderDef = {
  type: Exclude<View['type'], 'label' | 'search'>
  label: string
  icon: LucideIcon
  section: 'primary' | 'more'
}

export const PRIMARY_FOLDERS: FolderDef[] = [
  { type: 'inbox', label: 'Inbox', icon: Inbox, section: 'primary' },
  { type: 'starred', label: 'Starred', icon: Star, section: 'primary' },
  { type: 'snoozed', label: 'Snoozed', icon: Clock3, section: 'primary' },
  { type: 'sent', label: 'Sent', icon: Send, section: 'primary' },
  { type: 'drafts', label: 'Drafts', icon: Mail, section: 'primary' },
]

export const MORE_FOLDERS: FolderDef[] = [
  { type: 'important', label: 'Important', icon: Bookmark, section: 'more' },
  { type: 'spam', label: 'Spam', icon: Ban, section: 'more' },
  { type: 'trash', label: 'Trash', icon: Trash2, section: 'more' },
  { type: 'all', label: 'All Mail', icon: MailPlus, section: 'more' },
]

export const CATEGORY_TAB_UI: Record<
  CategoryLabel,
  { icon: LucideIcon; active: string; dot: string }
> = {
  CATEGORY_PERSONAL: {
    icon: Inbox,
    active: 'text-amber-700 dark:text-amber-400 after:bg-amber-500',
    dot: 'bg-amber-500',
  },
  CATEGORY_SOCIAL: {
    icon: Users,
    active: 'text-sky-700 dark:text-sky-400 after:bg-sky-500',
    dot: 'bg-sky-500',
  },
  CATEGORY_PROMOTIONS: {
    icon: Tag,
    active: 'text-emerald-700 dark:text-emerald-400 after:bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  CATEGORY_UPDATES: {
    icon: Mail,
    active: 'text-orange-700 dark:text-orange-400 after:bg-orange-500',
    dot: 'bg-orange-500',
  },
  CATEGORY_FORUMS: {
    icon: Users,
    active: 'text-violet-700 dark:text-violet-400 after:bg-violet-500',
    dot: 'bg-violet-500',
  },
}

export function isViewActive(view: View, type: View['type'], labelId?: string) {
  if (type === 'inbox') return view.type === 'inbox'
  if (type === 'label') return view.type === 'label' && view.labelId === labelId
  return view.type === type
}

export function folderView(type: FolderDef['type'], inboxCategory: CategoryLabel): View {
  if (type === 'inbox') return { type: 'inbox', category: inboxCategory }
  return { type }
}

export function GmailMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="52 42 88 66"
      className={cn('size-8 shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6z" />
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15z" />
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2z" />
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92z" />
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2z" />
    </svg>
  )
}

export function GmailWordmark() {
  return (
    <div className="flex items-center gap-1 pr-4">
      <GmailMark />
      <span className="font-sans text-[22px] leading-none tracking-tight text-muted-foreground">Gmail</span>
    </div>
  )
}

export function MailIconButton({
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  children,
  className,
  size = 'icon',
}: {
  label: string
  shortcut?: string
  onClick?: ComponentProps<typeof Button>['onClick']
  disabled?: boolean
  pressed?: boolean
  children: ReactNode
  className?: string
  size?: 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="ghost"
            size={size}
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className={cn('text-muted-foreground', pressed && 'bg-muted text-foreground', className)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="gap-2">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function rowDensityClass(density: Density) {
  if (density === 'comfortable') return 'min-h-16 py-3'
  if (density === 'compact') return 'min-h-8 py-1 text-[13px]'
  return 'min-h-12 py-2'
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full min-h-48 flex-col items-center justify-center gap-2 px-6 py-16 text-center', className)}>
      <p className="font-medium">{title}</p>
      {body ? <p className="max-w-md text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  )
}
