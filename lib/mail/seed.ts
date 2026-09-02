import { makeSnippet } from './labels'
import type { Address, Attachment, LabelId, Mailbox, Message } from './types'

export const MAILBOX_OWNER: Address = { name: 'Jordan Davis', email: 'jordan@studio.co' }

const HOUR = 3_600_000
const DAY = 86_400_000

type SeedSpec = {
  id: string
  threadId: string
  from: Address
  to?: Address[]
  cc?: Address[]
  subject: string
  body: string
  labels: LabelId[]
  ageMs: number
  attachments?: Attachment[]
  snoozeUntil?: number
  draft?: Message['draft']
}

function messageFromSpec(spec: SeedSpec, now: number): Message {
  return {
    id: spec.id,
    threadId: spec.threadId,
    from: spec.from,
    to: spec.to ?? [MAILBOX_OWNER],
    cc: spec.cc ?? [],
    bcc: [],
    subject: spec.subject,
    bodyText: spec.body,
    snippet: makeSnippet(spec.body),
    attachments: spec.attachments ?? [],
    labelIds: spec.labels,
    internalDate: now - spec.ageMs,
    snoozeUntil: spec.snoozeUntil,
    draft: spec.draft,
  }
}

export function createSeedMailbox(now = Date.now()): Mailbox {
  const alex: Address = { name: 'Alex Morgan', email: 'alex.morgan@northwind.co' }
  const jamie: Address = { name: 'Jamie Patel', email: 'jamie@productstudio.io' }
  const taylor: Address = { name: 'Taylor Kim', email: 'taylor.kim@studio.co' }
  const priya: Address = { name: 'Priya Shah', email: 'priya.shah@northwind.co' }

  const msg = (spec: SeedSpec) => messageFromSpec(spec, now)
  const messages = [
    msg({
      id: 'msg_q4_1',
      threadId: 'thr_q4',
      from: alex,
      subject: 'Q4 planning notes',
      labels: ['INBOX', 'CATEGORY_PERSONAL', 'ulbl_work'],
      ageMs: 3 * DAY,
      body: `Jordan — I dropped the Q4 planning doc in Drive. Headcount, launch windows, and the design-system rewrite are the three threads I want us to lock before Friday.

Can you skim the staffing tab and mark anything that still feels optimistic? I left comments next to the illustration hire and the motion-design contractor.

Talk tomorrow,
Alex`,
    }),
    msg({
      id: 'msg_q4_2',
      threadId: 'thr_q4',
      from: MAILBOX_OWNER,
      to: [alex],
      subject: 'Re: Q4 planning notes',
      labels: ['SENT', 'INBOX', 'CATEGORY_PERSONAL', 'ulbl_work'],
      ageMs: 2 * DAY + 4 * HOUR,
      body: `Thanks for pulling this together. I added a few thoughts to the doc for our review — mainly that the design-system rewrite should slip a sprint if the illustration hire is delayed.

I also flagged the contractor budget on row 18. Let's keep the Friday review.

Jordan`,
    }),
    msg({
      id: 'msg_q4_3',
      threadId: 'thr_q4',
      from: alex,
      subject: 'Re: Q4 planning notes',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL', 'ulbl_work'],
      ageMs: 4 * HOUR + 12 * 60_000,
      body: `Perfect, that slip is the right call. I moved the system rewrite to sprint 3 and left a note for Priya on the contractor line.

If you have 20 minutes after standup we can walk the staffing tab live. I want a single source of truth before the exec review.

Alex`,
    }),
    msg({
      id: 'msg_figma_1',
      threadId: 'thr_figma',
      from: { name: 'Figma', email: 'noreply@figma.com' },
      subject: 'Your team is growing',
      labels: ['INBOX', 'UNREAD', 'STARRED', 'CATEGORY_UPDATES'],
      ageMs: 2 * HOUR + 18 * 60_000,
      body: `A quick update on your Figma workspace and the latest collaboration features.

Jordan, three people joined Product Studio this week. Review seats, libraries, and branching so the new editors land on the right files.

You can manage members from the workspace settings page.`,
    }),
    msg({
      id: 'msg_taylor_1',
      threadId: 'thr_lunch',
      from: taylor,
      subject: 'Lunch next week?',
      labels: ['INBOX', 'UNREAD', 'IMPORTANT', 'CATEGORY_PERSONAL'],
      ageMs: 3 * HOUR,
      body: `Are you free Tuesday or Wednesday? There is a new spot near the studio that does the spicy noodle situation we keep talking about.

I can do 12:30 either day. No agenda — just a break from the Q4 deck.

Taylor`,
    }),
    msg({
      id: 'msg_notion_1',
      threadId: 'thr_notion',
      from: { name: 'Notion', email: 'team@mail.notion.so' },
      subject: 'You have been invited to a workspace',
      labels: ['INBOX', 'CATEGORY_SOCIAL'],
      ageMs: DAY + 2 * HOUR,
      body: `Jamie invited you to join the Product Studio workspace.

Accept the invite to see the launch wiki, research library, and the shared brand kit. This invitation expires in 14 days.`,
    }),
    msg({
      id: 'msg_dribbble_1',
      threadId: 'thr_dribbble',
      from: { name: 'Dribbble', email: 'digest@dribbble.com' },
      subject: 'Fresh inspiration for your inbox',
      labels: ['INBOX', 'CATEGORY_PROMOTIONS'],
      ageMs: 5 * DAY,
      body: `A collection of delightful product details from the design community.

This week: tactile settings toggles, quieter empty states, and a run of travel apps that finally treat maps as content.

Browse the digest or unsubscribe in a click.`,
    }),
    msg({
      id: 'msg_github_1',
      threadId: 'thr_github',
      from: { name: 'GitHub', email: 'noreply@github.com' },
      subject: 'Security alert for your account',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_UPDATES'],
      ageMs: 6 * DAY + 3 * HOUR,
      body: `A new sign-in was detected on your GitHub account.

Device: Mac, Chrome
Location: San Francisco, US
Time: Monday 7:41 PM

If this was you, you can ignore this message. If not, reset your password and review active sessions.`,
    }),
    msg({
      id: 'msg_loom_1',
      threadId: 'thr_loom',
      from: { name: 'Loom', email: 'hello@loom.com' },
      subject: 'Your weekly workspace recap',
      labels: ['INBOX', 'CATEGORY_UPDATES'],
      ageMs: DAY + 6 * HOUR,
      body: `See what your team has been watching and sharing this week.

12 videos viewed · 4 comments left on the prototype walkthrough · Priya's onboarding tour is the most replayed clip.

Open the recap to catch up in under five minutes.`,
    }),
    msg({
      id: 'msg_morning_1',
      threadId: 'thr_morning',
      from: { name: 'The Morning', email: 'morning@nytimes.com' },
      subject: 'The stories shaping your day',
      labels: ['INBOX', 'CATEGORY_PROMOTIONS'],
      ageMs: 10 * HOUR,
      body: `Good morning. Here are today’s top stories, selected for you.

A quieter week in markets, a new housing brief, and a long read on how design teams ship on-call rotations without burning out.`,
    }),
    msg({
      id: 'msg_forum_1',
      threadId: 'thr_forum',
      from: { name: 'Design Systems Forum', email: 'list@design-systems.forum' },
      subject: '[ds-forum] Token aliases vs. raw values in production',
      labels: ['INBOX', 'CATEGORY_FORUMS'],
      ageMs: 3 * DAY + 5 * HOUR,
      body: `On 12 June, Maya Chen wrote:
We've been flattening token aliases at build time and keeping the source nested. Curious how other teams debug computed values in Storybook without leaking internal names.

Reply to the thread or view it on the forum.`,
    }),
    msg({
      id: 'msg_snooze_1',
      threadId: 'thr_visa',
      from: { name: 'Consular Services', email: 'appointments@travel.state.example' },
      subject: 'Visa appointment reminder — bring these documents',
      labels: ['SNOOZED', 'CATEGORY_PERSONAL', 'ulbl_travel'],
      ageMs: DAY,
      snoozeUntil: now + 7 * DAY,
      body: `Your appointment is on file. Please bring your confirmation page, current passport, and the printed DS-160.

We recommend arriving 15 minutes early. This reminder is set aside until next week.`,
    }),
    msg({
      id: 'msg_draft_1',
      threadId: 'thr_draft_printer',
      from: MAILBOX_OWNER,
      to: [{ name: 'Ink & Paper Co', email: 'hello@inkandpaper.co' }],
      subject: 'Print specs for the Q4 leave-behind',
      labels: ['DRAFT'],
      ageMs: 2 * HOUR,
      draft: {
        draftId: 'dft_printer',
        toRaw: 'Ink & Paper Co <hello@inkandpaper.co>',
        ccRaw: '',
        bccRaw: '',
        savedAt: now - 2 * HOUR,
      },
      body: `Hi — we need 40 copies of the Q4 leave-behind on uncoated stock, 11x17 folded.

I'll attach the PDF once the cover type is locked. Timing is next Thursday.

Jordan`,
    }),
    msg({
      id: 'msg_sent_1',
      threadId: 'thr_sent_proposal',
      from: MAILBOX_OWNER,
      to: [priya],
      subject: 'Proposal: Northwind onboarding refresh',
      labels: ['SENT', 'CATEGORY_PERSONAL', 'ulbl_work'],
      ageMs: 5 * HOUR,
      body: `Priya — attaching the outline we discussed. Three phases, six weeks, with a research week up front so we are not guessing at the empty states.

Happy to walk the deck tomorrow.

Jordan`,
    }),
    msg({
      id: 'msg_spam_1',
      threadId: 'thr_spam',
      from: { name: 'Prize Desk', email: 'winner@account-secure-alert.example' },
      subject: 'You have unclaimed loyalty points',
      labels: ['SPAM', 'UNREAD', 'CATEGORY_PROMOTIONS'],
      ageMs: DAY + 8 * HOUR,
      body: `Congratulations. Your account has 84,000 unclaimed points. Confirm your password on this page immediately to avoid forfeiture.

This is not a message you asked for.`,
    }),
    msg({
      id: 'msg_trash_1',
      threadId: 'thr_trash',
      from: { name: 'Calendar', email: 'calendar-notification@google.com' },
      subject: 'Updated invitation: Studio all-hands',
      labels: ['TRASH', 'CATEGORY_UPDATES'],
      ageMs: 8 * DAY,
      body: `This event was updated and then cancelled. The all-hands moved to next month.

You deleted this conversation; it will be removed forever after 30 days.`,
    }),
    msg({
      id: 'msg_invoice_1',
      threadId: 'thr_invoice',
      from: { name: 'Figma Billing', email: 'billing@figma.com' },
      subject: 'Your Figma invoice for August',
      labels: ['INBOX', 'CATEGORY_UPDATES', 'ulbl_receipts'],
      ageMs: 2 * DAY + HOUR,
      attachments: [
        { id: 'att_invoice_aug', filename: 'figma-invoice-august.pdf', mimeType: 'application/pdf', sizeBytes: 84_320 },
      ],
      body: `Thanks for being a Figma customer. Your August invoice is attached.

Amount due: $135.00
Payment method: Visa ending 4242

The receipt is also available in billing settings.`,
    }),
    msg({
      id: 'msg_archive_1',
      threadId: 'thr_brand',
      from: jamie,
      subject: 'Brand guidelines v3 — final',
      labels: ['STARRED', 'CATEGORY_PERSONAL', 'ulbl_work', 'IMPORTANT'],
      ageMs: 10 * DAY,
      attachments: [
        { id: 'att_brand_pdf', filename: 'brand-guidelines-v3.pdf', mimeType: 'application/pdf', sizeBytes: 1_280_430 },
      ],
      body: `Locking v3. Type ramp, color tokens, and the new logomark clear space are all in the PDF.

This can live outside the inbox — star it so we can find it during the website pass.`,
    }),
    msg({
      id: 'msg_flight_1',
      threadId: 'thr_flight',
      from: { name: 'United Airlines', email: 'united@email.united.com' },
      subject: 'Your trip confirmation: SFO → SEA',
      labels: ['INBOX', 'CATEGORY_UPDATES', 'ulbl_travel'],
      ageMs: 12 * HOUR,
      attachments: [
        { id: 'att_boarding', filename: 'boarding-pass-sfo-sea.pdf', mimeType: 'application/pdf', sizeBytes: 52_110 },
      ],
      body: `You're booked. Flight 1882 leaves SFO at 7:15 AM and arrives SEA at 9:22 AM.

Check in opens 24 hours before departure. Seat 12A is confirmed.`,
    }),
    msg({
      id: 'msg_social_2',
      threadId: 'thr_linkedin',
      from: { name: 'LinkedIn', email: 'messages-noreply@linkedin.com' },
      subject: 'Alex Morgan accepted your invitation',
      labels: ['INBOX', 'UNREAD', 'CATEGORY_SOCIAL'],
      ageMs: 6 * HOUR,
      body: `You are now connected with Alex Morgan, Design Manager at Northwind.

Start a conversation or see what others in your network are sharing this week.`,
    }),
  ]

  return {
    owner: { ...MAILBOX_OWNER },
    messages,
    userLabels: [
      { id: 'ulbl_work', name: 'Work', color: '#1a73e8' },
      { id: 'ulbl_travel', name: 'Travel', color: '#188038' },
      { id: 'ulbl_receipts', name: 'Receipts', color: '#e37400' },
    ],
    nextId: 1000,
  }
}
