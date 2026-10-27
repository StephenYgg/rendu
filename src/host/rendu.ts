/**
 * Rendu host half. The page and the agent tool call the same operations.
 * Graph state lives in SQLite, not in the browser.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brief, emptyState, normalizeState, reduce, snapshot, type AtlasState } from './model.js'
import { associateProduced, importSessionHistory, producedFromText, producedFromToolCall, readStoredOutput, rememberOutput, storedOutputs, type FoundOutput } from './outputs.js'
import { RenduStore } from './store.js'

export const inject = ['webServer', 'tools', 'systemPrompt', 'sessionController']
export const ROUTE_PREFIX = '/api/rendu'

const PROMPT = [
  'Rendu (`rendu`) stores a hierarchical vision. Each project has one root vision.',
  'Before executing, splitting, or judging a node, call action "brief" and use the core vision, the ancestor requirements, the sibling branches, and the linked sessions.',
  'Write status, progress, notes, and deadlines back with update_node or set_status. Progress is your judgment. Reaching 100 marks the node 完成待确认; do not mark it done, a person confirms that. Link extra conversations with link_session. When you create an HTML, Markdown, or CSV file, or get an HTML address, call add_output with its path. The node link, filename, and creation time are stored in Rendu. Do not delete the root vision node.',
].join(' ')

export function apply(ctx: RenduContext): void {
  const store = RenduStore.open()
  const service = new RenduService(store, () => runningSessionIds(ctx), (sessionId) => readSession(ctx, sessionId))
  ctx.effect(() => {
    let disposed = false
    const disposeRoute = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: (req, res) => handle(ctx, service, req, res),
    })
    const disposeTool = ctx.tools.register(toolDefinition(service))
    const disposeEvents = ctx.on('session/event', (session, event) => noteSessionEvent(service, session, event))
    void backfillUnwatched(service, () => disposed)
    const disposePrompt = ctx.systemPrompt.section({
      name: 'rendu',
      order: 860,
      interpolate: false,
      text: PROMPT,
    })
    return () => {
      disposed = true
      disposeEvents()
      disposeRoute()
      disposeTool()
      disposePrompt()
      store.close()
    }
  }, 'rendu')
}

interface SessionEventSource {
  id?: string
  header?: { id?: string, cwd?: string }
}

interface SessionLogEvent {
  type?: string
  time?: number
  data?: unknown
}

const pendingOutputs = new Map<string, { cwd: string, refs: FoundOutput[] }>()

function noteSessionEvent(service: RenduService, session: SessionEventSource, event: SessionLogEvent) {
  const sessionId = String(session.header?.id || session.id || '')
  if (!sessionId) return
  const cwd = session.header?.cwd || ''
  const createdAt = typeof event.time === 'number' ? new Date(event.time).toISOString() : new Date().toISOString()
  const data = asRecord(event.data)
  if (event.type === 'tool/call') {
    const callId = String(data?.callId ?? '')
    const refs = producedFromToolCall(String(data?.name ?? ''), String(data?.arguments ?? ''), createdAt)
    if (!callId || refs.length === 0) return
    if (pendingOutputs.size > 300) pendingOutputs.clear()
    pendingOutputs.set(`${sessionId}:${callId}`, { cwd, refs })
    return
  }
  if (event.type === 'tool/result') {
    const callId = toolResultCallId(data)
    const saved = pendingOutputs.get(`${sessionId}:${callId}`)
    pendingOutputs.delete(`${sessionId}:${callId}`)
    if (!saved || data?.error) return
    void service.noteProduced(sessionId, saved.cwd || cwd, saved.refs)
    return
  }
  if (event.type === 'assistant/message') {
    const refs = producedFromText(eventText(data), createdAt)
    if (refs.length) void service.noteProduced(sessionId, cwd, refs)
  }
}

async function backfillUnwatched(service: RenduService, stopped: () => boolean) {
  for (const sessionId of service.unwatchedLinks()) {
    if (stopped()) return
    await service.importLinkedSession(sessionId)
  }
}

function toolResultCallId(data: Record<string, unknown> | null): string {
  const message = asRecord(data?.message)
  const source = asRecord(message?.source)
  return String(message?.toolCallId ?? source?.callId ?? '')
}

function eventText(data: Record<string, unknown> | null): string {
  const message = asRecord(data?.message) ?? data
  if (!message) return ''
  if (typeof message.text === 'string') return message.text
  if (typeof message.content === 'string') return message.content
  if (!Array.isArray(message.content)) return ''
  return message.content.map((part) => {
    const item = asRecord(part)
    return item && typeof item.text === 'string' ? item.text : ''
  }).join('\n')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

interface RenduContext {
  effect(callback: () => void | (() => void) | Promise<void>, label?: string): () => void
  on(name: 'session/event', listener: (session: SessionEventSource, event: SessionLogEvent) => void): () => void
  get(name: string): unknown
  webServer: { register(route: { kind: 'prefix', path: string, handler: (req: IncomingRequest, res: ServerResponse) => void | Promise<void> }): () => void }
  tools: { register(definition: unknown): () => void }
  systemPrompt: { section(section: { name: string, order: number, interpolate?: boolean, text: string }): () => void }
  sessionController: {
    create(request: { workspaceId?: string, cwd?: string }): Promise<{ sessionId?: string }>
    prompt(request: { requestId: string, sessionId: string, mode: 'queue', content: Array<{ type: 'text', text: string }>, clientTimeZone?: string }, signal: AbortSignal): Promise<unknown>
    rename(request: { sessionId: string, title: string }): Promise<unknown>
    list(request: Record<string, never>, signal: AbortSignal): Promise<{ items?: SessionSummary[] }>
    inspect?(sessionId: string, signal?: AbortSignal): Promise<{ meta?: { cwd?: string }, events?: unknown[] }>
    follow?(request: { address: { kind: 'session', sessionId: string }, maxMessages?: number }, signal: AbortSignal): AsyncIterable<{ type?: string, header?: { cwd?: string }, records?: Array<{ event?: unknown }>, cursor?: number, hasMore?: boolean }>
    page?(request: { address: { kind: 'session', sessionId: string }, throughSeq: number, beforeSeq?: number, maxMessages?: number }, signal: AbortSignal): Promise<{ records?: Array<{ event?: unknown }>, hasMore?: boolean }>
  }
  logger?: { warn?: (message: string) => void }
}

interface IncomingRequest extends AsyncIterable<Uint8Array | string> {
  url?: string
  method?: string
}

interface ServerResponse {
  writeHead(status: number, headers: Record<string, string | number>): void
  end(body?: string | Uint8Array): void
}

interface SessionSummary {
  sessionId?: string
  origin?: string
  running?: boolean
  blank?: boolean
  updatedAt?: number
  projections?: { values?: Record<string, unknown> }
}

interface WorkspaceRecord {
  id: string
  title?: string
  path?: string
  sessionIds: readonly string[]
  attachSession(sessionId: string): Promise<void>
}

class RenduService {
  private chain: Promise<void> = Promise.resolve()

  constructor(
    private readonly store: RenduStore,
    private readonly runningIds: () => Promise<Set<string>>,
    private readonly sessionReader: (sessionId: string) => Promise<{ cwd?: string, events: unknown[] }>,
  ) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.chain.then(fn)
    this.chain = job.then(() => {}, () => {})
    return job
  }

  snapshot() {
    return this.run(async () => this.present())
  }

  outputs(nodeId: string) {
    return this.run(async () => {
      if (!this.store.read().nodes[nodeId]) throw new Error('找不到这个节点')
      return storedOutputs(this.store, nodeId)
    })
  }

  noteProduced(sessionId: string, cwd: string, refs: FoundOutput[]) {
    return this.run(async () => associateProduced(this.store, sessionId, cwd, refs))
  }

  async importLinkedSession(sessionId: string) {
    if (!sessionId) return
    let session: { cwd?: string, events: unknown[] }
    try {
      session = await this.sessionReader(sessionId)
    } catch {
      return
    }
    await this.run(async () => {
      await importSessionHistory(this.store, sessionId, session.cwd || '', session.events)
      this.store.markWatch(sessionId)
    })
  }

  unwatchedLinks() {
    return this.store.linkedSessionIds().filter((sessionId) => !this.store.hasWatch(sessionId))
  }

  registerOutput(nodeId: string, filePath: string, title: string) {
    return this.run(async () => {
      const state = this.store.read()
      if (!state.nodes[nodeId]) throw new Error('找不到这个节点')
      return rememberOutput(this.store, nodeId, filePath, title)
    })
  }

  textBrief(nodeId: string) {
    return this.run(async () => brief(this.store.read(), nodeId))
  }

  mutate(command: Record<string, unknown>) {
    return this.run(async () => {
      const before = this.store.read()
      const reduced = reduce(before, command, new Date())
      this.store.write(before, reduced.state)
      return { snapshot: await this.present(reduced.state), result: reduced.result }
    })
  }

  private async present(state?: AtlasState) {
    const value = snapshot(state ?? this.store.read())
    const ids = await this.runningIds().catch(() => new Set<string>())
    for (const node of value.active?.nodes ?? []) {
      for (const link of node.sessions) {
        ;(link as { running?: boolean }).running = ids.has(link.sessionId)
      }
    }
    return value
  }

  importLegacy(raw: unknown) {
    return this.run(async () => {
      const current = this.store.read()
      if (Object.keys(current.projects).length > 0) throw new Error('已经有项目，不再导入旧数据')
      const imported = normalizeState(raw)
      if (Object.keys(imported.projects).length === 0) return { snapshot: await this.present(current), result: { imported: 0 } }
      this.store.write(emptyState(), imported)
      return { snapshot: await this.present(imported), result: { imported: Object.keys(imported.projects).length } }
    })
  }
}

function toolDefinition(service: RenduService) {
  return {
    name: 'rendu',
    description: '读取或更新任督二脉愿景图。执行、拆分或判断节点前，先用 action=brief 看核心宗旨、上级链路、兄弟分支和已关联会话。进度由你判断，用 update_node 写入；到 100 会变成完成待确认，不要直接标完成。用 link_session 关联已有会话。不能删除主节点。',
    parameters: {
      type: 'object',
      additionalProperties: true,
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'brief', 'create_project', 'create_node', 'update_node', 'set_status', 'delete_node', 'evaluate', 'link_session', 'unlink_session', 'add_output', 'list_outputs', 'set_refresh'],
          description: 'list 列出项目；brief 读取一个节点的宗旨、链路、兄弟分支和关联会话；其余为写入。',
        },
        projectId: { type: 'string', description: '项目 id。evaluate 时必填。' },
        nodeId: { type: 'string', description: '节点 id。brief、update_node、set_status、delete_node、link_session、unlink_session 时必填。' },
        parentId: { type: 'string', description: '父节点 id。create_node 时必填。' },
        side: { type: 'string', enum: ['left', 'right'], description: '新节点放在父节点左侧还是右侧。默认 right。' },
        title: { type: 'string', description: '项目名称或节点标题，最多 80 字。' },
        vision: { type: 'string', description: '创建项目时的核心宗旨。' },
        intent: { type: 'string', description: '这个节点要完成什么，必须服务于宗旨。' },
        status: {
          type: 'string',
          enum: ['backlog', 'doing', 'blocked', 'review', 'confirm', 'dropped'],
          description: '未开始 backlog，进行中 doing，受阻 blocked，待验收 review，完成待确认 confirm，放弃 dropped。不要传 done，进度到 100 会自动变成 confirm，等人确认。',
        },
        progress: { type: 'integer', description: '你判断的进度，0 到 100。到 100 会把状态改成完成待确认，不能直接完成。有子节点时图上的百分比仍由子节点汇总。' },
        dueAt: { type: 'string', description: '截止日期 YYYY-MM-DD。空字符串表示清除。' },
        notes: { type: 'string', description: '给后来的人和 Agent 看的笔记。' },
        evaluation: { type: 'string', description: '项目级评价，会替换当前评价。' },
        sessionId: { type: 'string', description: '要关联的会话 id。link_session 时必填。' },
        linkId: { type: 'string', description: '关联 id。unlink_session 时必填。' },
        label: { type: 'string', description: '会话显示名。' },
        path: { type: 'string', description: '产出位置。add_output 时必填。可以是本地 HTML、Markdown、CSV 路径，或一个 http(s) HTML 地址。关联、文件名和创建时间会写入任督的数据库。' },
        idleSeconds: { type: 'integer', description: '面板空闲时的刷新间隔，秒。set_refresh 时使用，5 到 300，默认 30。' },
        runningSeconds: { type: 'integer', description: '有 Agent 运行时的刷新间隔，秒。set_refresh 时使用，5 到 300，默认 10。' },
        nodeStyle: { type: 'string', enum: ['classic', 'ink', 'spine', 'scale', 'cycle', 'cycle2', 'karma'], description: '节点样式。classic 经典，ink 墨阶，spine 脊线，scale 刻度，cycle 轮回，cycle2 轮回二，karma 因果。默认 classic。' },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render(_args: unknown, value: unknown) {
        const record = value !== null && typeof value === 'object' ? value as { text?: unknown } : {}
        const text = typeof record.text === 'string' ? record.text : JSON.stringify(value)
        return [{ type: 'text', text: text.length > 12000 ? `${text.slice(0, 11999)}…` : text }]
      },
    },
    isConcurrencySafe(args: unknown) {
      const action = args && typeof args === 'object' ? (args as { action?: unknown }).action : ''
      return action === 'list' || action === 'brief'
    },
    async execute(args: unknown) {
      return runTool(service, args && typeof args === 'object' ? args as Record<string, unknown> : {})
    },
  }
}

async function runTool(service: RenduService, args: Record<string, unknown>) {
  const action = typeof args.action === 'string' ? args.action : ''
  if (action === 'list') {
    const view = await service.snapshot()
    const text = view.projects.length
      ? view.projects.map((project) => `${project.id}｜${project.title}｜${project.progressLabel}`).join('\n')
      : '还没有项目。'
    return { ok: true, text, projects: view.projects }
  }
  if (action === 'brief') return { ok: true, text: await service.textBrief(String(args.nodeId ?? '')) }
  if (action === 'list_outputs') {
    const outputs = await service.outputs(String(args.nodeId ?? ''))
    return { ok: true, text: outputs.length ? outputs.map((doc) => `${doc.kind}｜${doc.title}｜${doc.path}`).join('\n') : '这个节点还没有 HTML、Markdown 或 CSV 产出。', outputs }
  }
  if (action === 'add_output') {
    const saved = await service.registerOutput(String(args.nodeId ?? ''), String(args.path ?? ''), typeof args.title === 'string' ? args.title : '')
    return { ok: true, text: `已登记产出：${saved.title}`, result: saved }
  }
  if (action === 'evaluate') {
    const saved = await service.mutate({ action: 'update_project', projectId: args.projectId, evaluation: args.evaluation ?? '' })
    return { ok: true, text: '项目评价已更新。', result: saved.result }
  }
  const fromAgent = action === 'update_node' || action === 'set_status'
  const saved = await service.mutate({ ...args, action, ...(fromAgent ? { source: 'agent' } : {}) })
  if (action === 'link_session') {
    const linked = String(saved.result.sessionId || args.sessionId || '')
    if (linked) void service.importLinkedSession(linked)
  }
  if (action === 'delete_node' || action === 'delete_project' || action === 'unlink_session' || action === 'link_session') {
    const text = action === 'delete_node'
      ? `已删除节点及其 ${String(saved.result.removed ?? 1)} 个后代。`
      : action === 'delete_project'
        ? '项目已删除。'
        : action === 'unlink_session'
          ? '已取消会话关联，对话本身还在。'
          : '已关联会话。'
    return { ok: true, text, result: saved.result }
  }
  const nodeId = String(saved.result.rootId || saved.result.nodeId || '')
  const text = nodeId ? await service.textBrief(nodeId) : JSON.stringify(saved.result)
  return { ok: true, text, result: saved.result }
}

async function handle(ctx: RenduContext, service: RenduService, req: IncomingRequest, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const action = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+|\/+$/g, '')
  const method = String(req.method ?? 'GET').toUpperCase()
  try {
    if (method === 'GET' && action.startsWith('asset/')) return sendFigure(res, action.slice('asset/'.length))
    if (method === 'GET' && (action === '' || action === 'state')) return sendJson(res, 200, await service.snapshot())
    if (method === 'GET' && action === 'sessions') return sendJson(res, 200, { sessions: await listSessions(ctx) })
    if (method === 'GET' && action === 'workspaces') return sendJson(res, 200, { workspaces: listWorkspaces(ctx) })
    if (method === 'GET' && action === 'outputs') {
      return sendJson(res, 200, { outputs: await service.outputs(url.searchParams.get('nodeId') ?? '') })
    }
    if (method === 'GET' && action === 'output') {
      const nodeId = url.searchParams.get('nodeId') ?? ''
      const filePath = url.searchParams.get('path') ?? ''
      const allowed = await service.outputs(nodeId)
      const doc = allowed.find((item) => item.path === filePath)
      if (!doc) throw new Error('这个节点没有这份产出')
      return sendJson(res, 200, await readStoredOutput(doc))
    }
    if (method === 'POST' && action === 'command') {
      const body = await readJson(req)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求格式不正确')
      const command = body as Record<string, unknown>
      if (command.action === 'dispatch') return sendJson(res, 200, await dispatchNode(ctx, service, command))
      if (command.action === 'import_legacy') return sendJson(res, 200, await service.importLegacy(command.state))
      const saved = await service.mutate(command)
      if (command.action === 'link_session') {
        const linked = String(saved.result.sessionId || command.sessionId || '')
        if (linked) void service.importLinkedSession(linked)
      }
      return sendJson(res, 200, saved)
    }
    return sendJson(res, 404, { error: `未知接口：${action || method}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return sendJson(res, message.includes('存储') ? 503 : 400, { error: message })
  }
}

async function dispatchNode(ctx: RenduContext, service: RenduService, body: Record<string, unknown>) {
  const nodeId = String(body.nodeId ?? '')
  const text = await service.textBrief(nodeId)
  const view = await service.snapshot()
  const node = view.active?.nodes?.find((item) => item.id === nodeId)
  let sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  let label = typeof body.label === 'string' ? body.label.trim() : ''
  if (body.create === true || !sessionId) {
    const created = await createGroupedSession(ctx, body.workspaceId)
    sessionId = created.sessionId
    label = label || created.label
  }
  const title = node?.title || '节点'
  const prompt = [
    `你被指定执行任督二脉节点「${title}」。`,
    '先根据下面的简报理解核心宗旨、上级要求、兄弟分支和已经关联的会话，再决定怎么做。',
    '需要刷新时调用 rendu，action 用 brief。进度由你判断并用 update_node 写入。到 100 会变成完成待确认，不要直接标成完成。写出 HTML、Markdown、CSV，或得到 HTML 地址后，调用 add_output 登记。',
    '不要偏离宗旨，也不要改掉其他链路正在做的事，除非它们和宗旨冲突。',
    '',
    text,
  ].join('\n')
  try {
    await ctx.sessionController.prompt({
      requestId: randomUUID(),
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text: prompt }],
      clientTimeZone: 'Asia/Shanghai',
    }, AbortSignal.timeout(20000))
    try {
      await ctx.sessionController.rename({ sessionId, title: `任督二脉 · ${title}`.slice(0, 80) })
    } catch {
      // Renaming is a convenience. The handoff already succeeded.
    }
    const saved = await service.mutate({ action: 'link_session', nodeId, sessionId, label, error: '' })
    void service.importLinkedSession(sessionId)
    return { ...saved, result: { ...saved.result, accepted: true } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await service.mutate({ action: 'link_session', nodeId, sessionId, label, error: message }).catch(() => {})
    throw new Error(message)
  }
}

function listWorkspaces(ctx: RenduContext) {
  const registry = ctx.get('workspaceRegistry') as { list?: () => WorkspaceRecord[] } | undefined
  if (!registry?.list) return []
  return registry.list().map((workspace) => ({
    id: String(workspace.id),
    title: String(workspace.title || workspace.path || workspace.id),
    path: String(workspace.path || ''),
  }))
}

async function createGroupedSession(ctx: RenduContext, workspaceId: unknown) {
  const requested = typeof workspaceId === 'string' ? workspaceId.trim() : ''
  if (!requested) {
    const directory = ctx.get('workingDirectory') as { defaultDirectory?: string } | undefined
    const cwd = typeof directory?.defaultDirectory === 'string' ? directory.defaultDirectory : undefined
    const created = await ctx.sessionController.create(cwd ? { cwd } : {})
    const sessionId = String(created?.sessionId ?? '')
    if (!sessionId) throw new Error('没有创建出会话')
    return { sessionId, label: '新会话' }
  }
  const registry = ctx.get('workspaceRegistry') as { get?: (id: string) => WorkspaceRecord | undefined } | undefined
  const workspace = registry?.get?.(requested)
  if (!workspace) throw new Error('找不到这个会话分组')
  const created = await ctx.sessionController.create({ workspaceId: workspace.id, cwd: workspace.path })
  const sessionId = String(created?.sessionId ?? '')
  if (!sessionId) throw new Error('没有创建出会话')
  const live = registry?.get?.(workspace.id) ?? workspace
  if (!live.sessionIds.map(String).includes(sessionId)) await live.attachSession(sessionId)
  const after = registry?.get?.(workspace.id) ?? live
  if (!after.sessionIds.map(String).includes(sessionId)) {
    throw new Error('会话已创建，但没有进入所选分组。分组跟着会话的工作目录走。')
  }
  return { sessionId, label: String(workspace.title || '新会话') }
}

async function readSession(ctx: RenduContext, sessionId: string): Promise<{ cwd?: string, events: unknown[] }> {
  const controller = ctx.sessionController
  if (controller.follow) {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 6000)
    try {
      const iterator = controller.follow({ address: { kind: 'session', sessionId }, maxMessages: 120 }, abort.signal)[Symbol.asyncIterator]()
      const first = await iterator.next()
      const frame = first.value
      if (frame?.type === 'snapshot') {
        const events = (frame.records ?? []).map((record: { event?: unknown }) => record.event).filter((event: unknown) => event != null)
        let hasMore = frame.hasMore === true
        let guard = 0
        while (hasMore && controller.page && guard < 4) {
          guard += 1
          const oldest = events.reduce((min: number, event: unknown) => {
            const seq = eventSeq(event)
            return seq != null && seq < min ? seq : min
          }, Number.POSITIVE_INFINITY)
          if (!Number.isFinite(oldest)) break
          const page = await controller.page({
            address: { kind: 'session', sessionId },
            throughSeq: frame.cursor ?? oldest,
            beforeSeq: oldest,
            maxMessages: 120,
          }, AbortSignal.timeout(6000))
          const older = (page.records ?? []).map((record: { event?: unknown }) => record.event).filter((event: unknown) => event != null)
          if (!older.length) break
          events.unshift(...older)
          hasMore = page.hasMore === true
        }
        return { cwd: frame.header?.cwd, events }
      }
    } catch {
      // A cold session can still be read through inspect.
    } finally {
      clearTimeout(timer)
      abort.abort()
    }
  }
  const inspection = await controller.inspect?.(sessionId, AbortSignal.timeout(8000))
  return { cwd: inspection?.meta?.cwd, events: inspection?.events ?? [] }
}

function eventSeq(event: unknown): number | null {
  if (!event || typeof event !== 'object') return null
  const seq = (event as { seq?: unknown }).seq
  return typeof seq === 'number' ? seq : null
}

async function runningSessionIds(ctx: RenduContext): Promise<Set<string>> {
  const value = await ctx.sessionController.list({}, AbortSignal.timeout(8000))
  return new Set((value.items ?? []).filter((item) => item.running && item.sessionId).map((item) => String(item.sessionId)))
}

async function listSessions(ctx: RenduContext) {
  const value = await ctx.sessionController.list({}, AbortSignal.timeout(8000))
  return (value.items ?? [])
    .filter((item) => item?.sessionId && item.origin !== 'subagent')
    .map((item) => ({
      sessionId: String(item.sessionId),
      title: sessionTitle(item),
      running: Boolean(item.running),
      blank: Boolean(item.blank),
      updatedAt: Number(item.updatedAt) || 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40)
}

function sessionTitle(item: SessionSummary): string {
  const values = item.projections?.values
  if (values) {
    for (const key of ['title', 'sessionTitle', 'name']) {
      const value = values[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  const id = String(item.sessionId)
  return id.length > 8 ? id.slice(0, 8) : id
}

async function readJson(req: IncomingRequest): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error('请求体过大')
    chunks.push(buffer)
  }
  if (!chunks.length) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('请求不是有效的 JSON')
  }
}

const FIGURES: Record<string, string[]> = {
  origin: ['origin.png', 'origin.jpg'],
  echo: ['echo.png', 'echo.jpg'],
}

function sendFigure(res: ServerResponse, name: string): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
  for (const file of FIGURES[name] ?? []) {
    try {
      const body = readFileSync(join(root, file))
      const type = file.endsWith('.png') ? 'image/png' : 'image/jpeg'
      res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=3600', 'content-length': body.length })
      res.end(body)
      return
    } catch {
      // Try the next candidate.
    }
  }
  sendJson(res, 404, { error: '没有这张图' })
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = `${JSON.stringify(value)}\n`
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

export type { AtlasState }
