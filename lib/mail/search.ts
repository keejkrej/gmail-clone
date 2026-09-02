import {
  CATEGORY_SET,
  foldLabelName,
  hasLabel,
  IN_OPERATOR_LABEL,
  systemLabelFromName,
  userLabelByName,
} from './labels'
import type { LabelId, Message, SystemLabel, UserLabel } from './types'

export type SearchOperator =
  | { kind: 'from' | 'to' | 'subject'; value: string }
  | { kind: 'label'; value: string }
  | { kind: 'is'; value: 'unread' | 'starred' | 'important' | 'snoozed' }
  | { kind: 'has'; value: 'attachment' }
  | { kind: 'in'; value: string }
  | { kind: 'term'; value: string }

export type ParsedSearch = {
  raw: string
  tokens: SearchOperator[]
}

const KNOWN_KEYS = new Set(['from', 'to', 'subject', 'is', 'has', 'in', 'label'])
const IS_VALUES = new Set(['unread', 'starred', 'important', 'snoozed'])
const HAS_VALUES = new Set(['attachment'])

export function parseSearchQuery(raw: string): ParsedSearch {
  const tokens: SearchOperator[] = []
  let i = 0
  const query = raw.trim()
  while (i < query.length) {
    while (i < query.length && /\s/.test(query[i])) i += 1
    if (i >= query.length) break
    if (query[i] === '"') {
      const end = query.indexOf('"', i + 1)
      const phrase = (end === -1 ? query.slice(i + 1) : query.slice(i + 1, end)).trim()
      if (phrase) tokens.push({ kind: 'term', value: phrase })
      i = end === -1 ? query.length : end + 1
      continue
    }
    const op = readOperator(query, i)
    tokens.push(op.token)
    i = op.next
  }
  return { raw, tokens }
}

function readOperator(query: string, start: number): { token: SearchOperator; next: number } {
  let i = start
  while (i < query.length && !/\s/.test(query[i]) && query[i] !== ':') i += 1
  if (query[i] !== ':') {
    while (i < query.length && !/\s/.test(query[i])) i += 1
    return { token: { kind: 'term', value: query.slice(start, i) }, next: i }
  }
  const key = query.slice(start, i).toLowerCase()
  i += 1
  let value = ''
  if (query[i] === '"') {
    const end = query.indexOf('"', i + 1)
    value = end === -1 ? query.slice(i + 1) : query.slice(i + 1, end)
    i = end === -1 ? query.length : end + 1
  } else {
    const valueStart = i
    while (i < query.length && !/\s/.test(query[i])) i += 1
    value = query.slice(valueStart, i)
  }
  const whole = query.slice(start, i)
  if (!KNOWN_KEYS.has(key) || !value) return { token: { kind: 'term', value: whole }, next: i }
  if (key === 'is') {
    const normalized = value.toLowerCase()
    if (!IS_VALUES.has(normalized)) return { token: { kind: 'term', value: whole }, next: i }
    return { token: { kind: 'is', value: normalized as 'unread' | 'starred' | 'important' | 'snoozed' }, next: i }
  }
  if (key === 'has') {
    if (!HAS_VALUES.has(value.toLowerCase())) return { token: { kind: 'term', value: whole }, next: i }
    return { token: { kind: 'has', value: 'attachment' }, next: i }
  }
  if (key === 'in') {
    const normalized = value.toLowerCase()
    if (!(normalized in IN_OPERATOR_LABEL)) return { token: { kind: 'term', value: whole }, next: i }
    return { token: { kind: 'in', value: normalized }, next: i }
  }
  if (key === 'from' || key === 'to' || key === 'subject' || key === 'label') {
    return { token: { kind: key, value }, next: i }
  }
  return { token: { kind: 'term', value: whole }, next: i }
}

function haystack(message: Message): string {
  const parts = [
    message.from.name,
    message.from.email,
    ...message.to.flatMap((address) => [address.name, address.email]),
    ...message.cc.flatMap((address) => [address.name, address.email]),
    ...message.bcc.flatMap((address) => [address.name, address.email]),
    message.subject,
    message.bodyText,
  ]
  return parts.join(' ').toLowerCase()
}

function substringMatch(hay: string, value: string): boolean {
  return hay.toLowerCase().includes(value.trim().toLowerCase())
}

export function inTokens(tokens: SearchOperator[]): string[] {
  return tokens.filter((token): token is Extract<SearchOperator, { kind: 'in' }> => token.kind === 'in').map((token) => token.value)
}

export function messageInDefaultCorpus(message: Message, tokens: SearchOperator[]): boolean {
  const ins = inTokens(tokens)
  const restrictive = ins.filter((value) => value !== 'anywhere')
  if (restrictive.length === 0 && !ins.includes('anywhere')) {
    return !hasLabel(message, 'SPAM') && !hasLabel(message, 'TRASH')
  }
  return true
}

export function messageMatchesToken(message: Message, token: SearchOperator, userLabels: UserLabel[]): boolean {
  switch (token.kind) {
    case 'from':
      return substringMatch(`${message.from.name} ${message.from.email}`, token.value)
    case 'to': {
      const recipients = [...message.to, ...message.cc, ...message.bcc]
      return recipients.some((address) => substringMatch(`${address.name} ${address.email}`, token.value))
    }
    case 'subject':
      return substringMatch(message.subject, token.value)
    case 'is':
      if (token.value === 'unread') return hasLabel(message, 'UNREAD')
      if (token.value === 'starred') return hasLabel(message, 'STARRED')
      if (token.value === 'important') return hasLabel(message, 'IMPORTANT')
      return hasLabel(message, 'SNOOZED')
    case 'has':
      return message.attachments.length > 0
    case 'in': {
      if (token.value === 'anywhere') return true
      const label = IN_OPERATOR_LABEL[token.value]
      if (!label || label === 'ANYWHERE') return true
      return hasLabel(message, label)
    }
    case 'label': {
      const system = systemLabelFromName(token.value)
      if (system) {
        if (system === 'UNREAD') return hasLabel(message, 'UNREAD')
        if (CATEGORY_SET.has(system)) return hasLabel(message, system as LabelId)
        return hasLabel(message, system)
      }
      const user = userLabelByName(userLabels, token.value)
      if (user) return hasLabel(message, user.id)
      const folded = foldLabelName(token.value)
      return message.labelIds.some((id) => foldLabelName(String(id)) === folded)
    }
    case 'term':
      return substringMatch(haystack(message), token.value)
  }
}

export function messageMatchesSearch(message: Message, parsed: ParsedSearch, userLabels: UserLabel[]): boolean {
  if (!messageInDefaultCorpus(message, parsed.tokens)) return false
  return parsed.tokens.every((token) => messageMatchesToken(message, token, userLabels))
}

export function searchMatchingMessages(messages: Message[], rawQuery: string, userLabels: UserLabel[]): Message[] {
  const parsed = parseSearchQuery(rawQuery)
  if (!parsed.tokens.length) {
    return messages.filter((message) => !hasLabel(message, 'SPAM') && !hasLabel(message, 'TRASH'))
  }
  return messages.filter((message) => messageMatchesSearch(message, parsed, userLabels))
}

export function corpusMessagesForSearch(messages: Message[], rawQuery: string): Message[] {
  const parsed = parseSearchQuery(rawQuery)
  return messages.filter((message) => messageInDefaultCorpus(message, parsed.tokens))
}

export function inLabelFromViewName(name: string): SystemLabel | undefined {
  const mapped = IN_OPERATOR_LABEL[name.toLowerCase()]
  return mapped && mapped !== 'ANYWHERE' ? mapped : undefined
}
