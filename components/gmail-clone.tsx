'use client'

import { useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HelpCircle,
  Inbox,
  Label,
  Menu,
  MoreVertical,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Settings,
  Star,
  Tag,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Mail = {
  id: number
  sender: string
  initials: string
  subject: string
  preview: string
  time: string
  label?: string
  unread?: boolean
  starred?: boolean
  avatar: string
}

const seedMail: Mail[] = [
  { id: 1, sender: 'Figma', initials: 'F', subject: 'Your team is growing', preview: 'A quick update on your Figma workspace and the latest collaboration features.', time: '10:42 AM', label: 'Updates', unread: true, starred: true, avatar: 'bg-rose-200 text-rose-800' },
  { id: 2, sender: 'Alex Morgan', initials: 'AM', subject: 'Re: Q4 planning notes', preview: 'Thanks for pulling this together. I added a few thoughts to the doc for our review.', time: '9:18 AM', unread: true, avatar: 'bg-sky-200 text-sky-800' },
  { id: 3, sender: 'The Morning', initials: 'TM', subject: 'The stories shaping your day', preview: 'Good morning. Here are today’s top stories, selected for you.', time: '8:05 AM', label: 'Newsletters', avatar: 'bg-amber-200 text-amber-800' },
  { id: 4, sender: 'Notion', initials: 'N', subject: 'You have been invited to a workspace', preview: 'Jamie invited you to join the Product Studio workspace.', time: 'Yesterday', label: 'Social', avatar: 'bg-slate-200 text-slate-800' },
  { id: 5, sender: 'Loom', initials: 'L', subject: 'Your weekly workspace recap', preview: 'See what your team has been watching and sharing this week.', time: 'Yesterday', avatar: 'bg-violet-200 text-violet-800' },
  { id: 6, sender: 'Dribbble', initials: 'D', subject: 'Fresh inspiration for your inbox', preview: 'A collection of delightful product details from the design community.', time: 'Jun 10', label: 'Promotions', avatar: 'bg-pink-200 text-pink-800' },
  { id: 7, sender: 'Taylor Kim', initials: 'TK', subject: 'Lunch next week?', preview: 'Are you free Tuesday or Wednesday? There is a new spot near the studio.', time: 'Jun 10', unread: true, avatar: 'bg-emerald-200 text-emerald-800' },
  { id: 8, sender: 'GitHub', initials: 'GH', subject: 'Security alert for your account', preview: 'A new sign-in was detected on your GitHub account.', time: 'Jun 9', label: 'Updates', avatar: 'bg-orange-200 text-orange-800' },
]

const navItems = [
  { icon: Inbox, label: 'Inbox', count: 6, active: true },
  { icon: Star, label: 'Starred' },
  { icon: Clock3, label: 'Snoozed' },
  { icon: Send, label: 'Sent' },
  { icon: FileTextIcon, label: 'Drafts', count: 2 },
]

function FileTextIcon(props: { className?: string }) {
  return <Tag {...props} />
}

export function GmailClone() {
  const [mail, setMail] = useState(seedMail)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [activeFolder, setActiveFolder] = useState('Inbox')

  const filteredMail = useMemo(
    () => mail.filter((item) => `${item.sender} ${item.subject} ${item.preview}`.toLowerCase().includes(query.toLowerCase())),
    [mail, query],
  )

  const toggleSelected = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const toggleStar = (id: number) => setMail((current) => current.map((item) => item.id === id ? { ...item, starred: !item.starred } : item))

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className={cn('fixed inset-y-0 left-0 z-20 flex w-64 -translate-x-full flex-col border-r bg-sidebar p-3 transition-transform lg:static lg:translate-x-0', sidebarOpen && 'translate-x-0')}>
        <div className="flex h-16 items-center gap-3 px-3 text-xl font-medium tracking-tight">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><span className="text-lg font-bold">M</span></div>
          <span>Mail</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X /></Button>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="mb-5 h-14 w-fit gap-3 rounded-2xl px-5 shadow-sm"><Pencil data-icon="inline-start" />Compose</Button>
        <nav className="flex flex-col gap-1" aria-label="Mail folders">
          {navItems.map(({ icon: Icon, label, count, active }) => <button key={label} onClick={() => { setActiveFolder(label); setSidebarOpen(false) }} className={cn('flex items-center gap-4 rounded-full px-4 py-2 text-sm transition-colors hover:bg-sidebar-accent', activeFolder === label && active && 'bg-sidebar-accent font-semibold')}><Icon className="size-4" /><span>{label}</span>{count && <span className="ml-auto text-xs font-semibold">{count}</span>}</button>)}
        </nav>
        <div className="mt-6 flex flex-col gap-1 border-t pt-4">
          <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Labels</p>
          <button className="flex items-center gap-4 rounded-full px-4 py-2 text-sm hover:bg-sidebar-accent"><Tag className="size-4" />Work</button>
          <button className="flex items-center gap-4 rounded-full px-4 py-2 text-sm hover:bg-sidebar-accent"><Tag className="size-4" />Travel</button>
          <button className="flex items-center gap-4 rounded-full px-4 py-2 text-sm hover:bg-sidebar-accent"><Tag className="size-4" />Receipts</button>
        </div>
        <div className="mt-auto flex items-center gap-3 rounded-xl border bg-card p-3"><div className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">JD</div><div className="min-w-0"><p className="truncate text-sm font-medium">Jordan Davis</p><p className="truncate text-xs text-muted-foreground">jordan@studio.co</p></div><MoreVertical className="ml-auto size-4 text-muted-foreground" /></div>
      </aside>

      {sidebarOpen && <button className="fixed inset-0 z-10 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center gap-3 border-b px-4 md:px-6">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="lg:hidden" aria-label="Open navigation"><Menu /></Button>
          <div className="relative flex min-w-0 max-w-2xl flex-1 items-center"><Search className="absolute left-4 size-5 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" className="h-12 w-full rounded-full bg-muted pl-12 pr-4 text-sm outline-none ring-ring transition focus:ring-2" /></div>
          <div className="hidden items-center gap-1 sm:flex"><Button variant="ghost" size="icon" aria-label="Help"><HelpCircle /></Button><Button variant="ghost" size="icon" aria-label="Settings"><Settings /></Button><Button variant="ghost" size="icon" aria-label="Apps"><Users /></Button></div>
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">JD</div>
        </header>
        <div className="flex items-center justify-between px-4 py-4 md:px-8"><div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Select all" onClick={() => setSelected(selected.length === filteredMail.length ? [] : filteredMail.map((item) => item.id))}><span className={cn('size-4 rounded-sm border-2', selected.length === filteredMail.length && 'bg-primary')} /></Button><Button variant="ghost" size="icon" aria-label="Refresh"><RefreshCw /></Button><Button variant="ghost" size="icon" aria-label="More actions"><MoreVertical /></Button></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>1–{filteredMail.length} of 1,248</span><Button variant="ghost" size="icon" aria-label="Previous page"><ChevronLeft /></Button><Button variant="ghost" size="icon" aria-label="Next page"><ChevronRight /></Button></div></div>
        <div className="mx-3 overflow-hidden rounded-xl border bg-card md:mx-8"><div className="flex items-center gap-8 border-b px-5 py-3 text-sm font-medium"><span className="flex items-center gap-2 border-b-2 border-primary pb-3 text-primary"><Inbox className="size-4" />Primary</span><span className="hidden items-center gap-2 text-muted-foreground sm:flex"><Users className="size-4" />Social</span><span className="hidden items-center gap-2 text-muted-foreground sm:flex"><Tag className="size-4" />Promotions</span></div><div>{filteredMail.map((item) => <div key={item.id} className={cn('group flex min-h-16 items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/60', item.unread && 'bg-muted/30 font-semibold')}><button onClick={() => toggleSelected(item.id)} className="grid size-5 shrink-0 place-items-center" aria-label={`Select ${item.subject}`}><span className={cn('size-4 rounded-sm border', selected.includes(item.id) && 'border-primary bg-primary')} /></button><button onClick={() => toggleStar(item.id)} aria-label={`${item.starred ? 'Unstar' : 'Star'} ${item.subject}`}><Star className={cn('size-5 text-muted-foreground', item.starred && 'fill-amber-400 text-amber-400')} /></button><div className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold', item.avatar)}>{item.initials}</div><div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-4"><span className="w-32 shrink-0 truncate text-sm">{item.sender}</span><span className="min-w-0 truncate text-sm"><span>{item.subject}</span><span className="font-normal text-muted-foreground"> — {item.preview}</span></span></div>{item.label && <span className="hidden rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground sm:inline-flex">{item.label}</span>}<span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{item.time}</span><div className="hidden gap-1 group-hover:flex"><Button variant="ghost" size="icon" className="size-8" aria-label="Archive"><Archive /></Button><Button variant="ghost" size="icon" className="size-8" aria-label="Delete"><Trash2 /></Button></div></div>)}</div></div>
        <footer className="flex items-center justify-between px-4 py-5 text-xs text-muted-foreground md:px-8"><span>Storage used: 4.2 GB of 15 GB</span><span className="hidden items-center gap-2 sm:flex"><Video className="size-4" />Meet is ready when you are</span></footer>
      </section>

      {composeOpen && <div className="fixed bottom-0 right-4 z-30 w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-t-xl border bg-card shadow-2xl"><div className="flex items-center justify-between bg-muted px-4 py-3 text-sm font-semibold"><span>New Message</span><Button variant="ghost" size="icon" className="size-7" onClick={() => setComposeOpen(false)} aria-label="Close compose"><X /></Button></div><div className="flex flex-col"><input className="border-b bg-transparent px-4 py-3 text-sm outline-none" placeholder="Recipients" /><input className="border-b bg-transparent px-4 py-3 text-sm outline-none" placeholder="Subject" /><textarea className="min-h-40 resize-none bg-transparent px-4 py-3 text-sm outline-none" placeholder="Write your message..." /><div className="flex items-center justify-between border-t p-3"><Button onClick={() => setComposeOpen(false)}>Send</Button><Button variant="ghost" size="icon" aria-label="Discard draft"><Trash2 /></Button></div></div></div>}
    </main>
  )
}
