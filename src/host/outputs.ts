/**
 * Documents produced for a node. A deliverable is either a local HTML,
 * Markdown, or CSV file, or an HTML address. The node link, filename, and
 * creation time are stored in Rendu's SQLite database.
 */
import { realpath, readFile, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, resolve } from 'node:path'
import { RenduStore, type OutputRow } from './store.js'

export type OutputKind = 'html' | 'markdown' | 'csv'
export type OutputLocation = 'file' | 'url'

export interface OutputDoc {
  id: string
  path: string
  title: string
  filename: string
  kind: OutputKind
  location: OutputLocation
  sessionId: string
  createdAt: string
}

interface FoundOutput {
  path: string
  filename: string
  kind: OutputKind
  location: OutputLocation
  createdAt: string
}

const MAX_BYTES = 1_200_000
const EXTENSIONS: Record<string, OutputKind> = {
  '.html': 'html',
  '.htm': 'html',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.csv': 'csv',
}

export function kindOf(filePath: string): OutputKind | null {
  return EXTENSIONS[extname(stripQuery(filePath)).toLowerCase()] ?? null
}

export function pathsFromToolCall(name: string, argsText: string): string[] {
  return refsFromToolCall(name, argsText, '').map((item) => item.path)
}

export async function syncNodeOutputs(
  store: RenduStore,
  nodeId: string,
  sessionIds: string[],
  readSession: (sessionId: string) => Promise<{ cwd?: string, events: unknown[] }>,
): Promise<OutputDoc[]> {
  for (const sessionId of sessionIds.slice(0, 8)) {
    let session: { cwd?: string, events: unknown[] }
    try {
      session = await readSession(sessionId)
    } catch {
      continue
    }
    const cwd = session.cwd || process.cwd()
    for (const found of await refsFromSession(session.events, cwd)) {
      store.addOutput(outputRow(nodeId, found, sessionId))
    }
  }
  return store.listOutputs(nodeId).map(toDoc)
}

export async function rememberOutput(store: RenduStore, nodeId: string, rawPath: string, title: string, sessionId = ''): Promise<OutputDoc> {
  const found = await normalizeLocation(rawPath, process.cwd(), new Date().toISOString(), true)
  if (!found) throw new Error('只能登记本地 HTML、Markdown、CSV，或一个 HTML 地址')
  if (found.location === 'file') await readOutput(found.path)
  const row = outputRow(nodeId, found, sessionId)
  if (title.trim()) row.title = title.trim()
  return toDoc(store.addOutput(row))
}

export async function readStoredOutput(doc: OutputDoc): Promise<{ kind: OutputKind, name: string, location: OutputLocation, url: string, text: string, truncated: boolean }> {
  if (doc.location === 'url') {
    return { kind: 'html', name: doc.filename || doc.title, location: 'url', url: doc.path, text: '', truncated: false }
  }
  const file = await readOutput(doc.path)
  return { ...file, location: 'file', url: '' }
}

export async function readOutput(filePath: string): Promise<{ kind: OutputKind, name: string, text: string, truncated: boolean, bytes: number }> {
  const kind = kindOf(filePath)
  if (!kind) throw new Error('只能查看 HTML、Markdown 或 CSV')
  const resolved = await realpath(filePath)
  if (kindOf(resolved) !== kind) throw new Error('只能查看 HTML、Markdown 或 CSV')
  const info = await stat(resolved)
  if (!info.isFile()) throw new Error('这不是文件')
  const raw = await readFile(resolved)
  return {
    kind,
    name: basename(resolved),
    text: raw.subarray(0, MAX_BYTES).toString('utf8'),
    truncated: raw.byteLength > MAX_BYTES,
    bytes: info.size,
  }
}

export function outputId(nodeId: string, location: string): string {
  return `out:${nodeId}:${location}`
}

export function refsFromToolCall(name: string, argsText: string, createdAt: string): FoundOutput[] {
  const tool = name.toLowerCase()
  const parsed = parseArgs(argsText)
  const refs: string[] = []
  if (tool === 'write' || tool === 'edit' || tool === 'add_output') refs.push(...fields(parsed, ['file_path', 'path', 'file', 'url', 'href', 'address']))
  if (tool === 'bash') refs.push(...redirectedPaths(fields(parsed, ['command'])[0] || argsText))
  if (tool === 'present') {
    const files = Array.isArray(parsed.files) ? parsed.files : []
    for (const file of files) {
      const record = asRecord(file)
      if (record) refs.push(...fields(record, ['path', 'file_path', 'url', 'href']))
    }
  }
  if (tool === 'add_output' || tool === 'present') refs.push(...htmlAddresses(argsText))
  return uniqueRefs(refs, createdAt, tool === 'add_output' || tool === 'present')
}

async function refsFromSession(events: unknown[], cwd: string): Promise<FoundOutput[]> {
  const found: FoundOutput[] = []
  const seen = new Set<string>()
  for (const event of events) {
    const record = asRecord(event)
    if (!record) continue
    const nested = asRecord(record.event) ?? record
    const type = typeof nested.type === 'string' ? nested.type : ''
    const data = asRecord(nested.data) ?? nested
    const createdAt = eventTime(record, nested)
    const candidates = type === 'tool/call' || data.type === 'tool-call'
      ? refsFromToolCall(typeof data.name === 'string' ? data.name : '', typeof data.arguments === 'string' ? data.arguments : '', createdAt)
      : type === 'assistant/message'
        ? uniqueRefs(htmlAddresses(messageText(data)), createdAt, false)
        : []
    for (const candidate of candidates) {
      const normalized = await normalizeLocation(candidate.path, cwd, candidate.createdAt, candidate.location === 'url')
      if (!normalized || seen.has(normalized.path)) continue
      seen.add(normalized.path)
      found.push(normalized)
    }
  }
  return found
}

async function normalizeLocation(raw: string, cwd: string, createdAt: string, allowPageUrl: boolean): Promise<FoundOutput | null> {
  const url = canonicalUrl(raw)
  if (url) {
    if (!allowPageUrl && !/\.html?($|\?)/i.test(url)) return null
    return { path: url, filename: filenameFromUrl(url), kind: 'html', location: 'url', createdAt }
  }
  const kind = kindOf(raw)
  if (!kind) return null
  const absolute = isAbsolute(raw) ? raw : resolve(cwd, raw)
  let path = absolute
  try { path = await realpath(absolute) } catch { path = absolute }
  return { path, filename: basename(stripQuery(path)), kind, location: 'file', createdAt }
}

function uniqueRefs(rawPaths: string[], createdAt: string, allowPageUrl: boolean): FoundOutput[] {
  const found: FoundOutput[] = []
  const seen = new Set<string>()
  for (const raw of rawPaths) {
    const url = canonicalUrl(raw)
    if (url) {
      if ((!allowPageUrl && !/\.html?($|\?)/i.test(url)) || seen.has(url)) continue
      seen.add(url)
      found.push({ path: url, filename: filenameFromUrl(url), kind: 'html', location: 'url', createdAt })
      continue
    }
    if (!kindOf(raw) || seen.has(raw)) continue
    seen.add(raw)
    found.push({ path: raw, filename: basename(stripQuery(raw)), kind: kindOf(raw) as OutputKind, location: 'file', createdAt })
  }
  return found
}

function outputRow(nodeId: string, found: FoundOutput, sessionId: string): OutputRow {
  return {
    id: outputId(nodeId, found.path),
    node_id: nodeId,
    path: found.path,
    title: found.filename,
    filename: found.filename,
    kind: found.kind,
    location: found.location,
    session_id: sessionId,
    created_at: found.createdAt,
  }
}

function toDoc(row: OutputRow): OutputDoc {
  return {
    id: row.id,
    path: row.path,
    title: row.title || row.filename,
    filename: row.filename || row.title,
    kind: row.kind === 'markdown' || row.kind === 'csv' ? row.kind : 'html',
    location: row.location === 'url' ? 'url' : 'file',
    sessionId: row.session_id || '',
    createdAt: row.created_at,
  }
}

function canonicalUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/[.,;]+$/, '')
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function filenameFromUrl(value: string): string {
  try {
    const url = new URL(value)
    const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '')
    return name || url.hostname
  } catch {
    return 'page.html'
  }
}

function htmlAddresses(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"')]+/g)].map((match) => match[0] || '').filter((value) => /\.html?($|\?)/i.test(value))
}

function redirectedPaths(command: string): string[] {
  const found = new Set<string>()
  const pattern = /(?:>>?)\s*(?:"([^"]+)"|'([^']+)'|(\S+))/g
  for (const match of command.matchAll(pattern)) {
    const filePath = match[1] || match[2] || match[3] || ''
    if (kindOf(filePath)) found.add(filePath)
  }
  return [...found]
}

function eventTime(record: Record<string, unknown>, nested: Record<string, unknown>): string {
  const value = record.time ?? nested.time ?? record.createdAt ?? nested.createdAt
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString()
  if (typeof value === 'string' && value) return value
  return new Date().toISOString()
}

function messageText(data: Record<string, unknown>): string {
  if (typeof data.text === 'string') return data.text
  if (typeof data.content === 'string') return data.content
  if (!Array.isArray(data.content)) return ''
  return data.content.map((part) => {
    const record = asRecord(part)
    return record && typeof record.text === 'string' ? record.text : ''
  }).join('\n')
}

function parseArgs(argsText: string): Record<string, unknown> {
  try {
    const value = JSON.parse(argsText)
    return asRecord(value) ?? {}
  } catch {
    return {}
  }
}

function fields(record: Record<string, unknown>, names: string[]): string[] {
  const values: string[] = []
  for (const name of names) {
    const value = record[name]
    if (typeof value === 'string' && value.trim()) values.push(value.trim())
  }
  return values
}

function stripQuery(value: string): string {
  return value.split('?')[0] || value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
