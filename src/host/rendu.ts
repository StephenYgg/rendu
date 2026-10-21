/**
 * Rendu host half. The page and the agent tool call the same operations.
 * Graph state lives in SQLite, not in the browser.
 */
import { randomUUID } from 'node:crypto'
import { brief, emptyState, normalizeState, reduce, snapshot, type AtlasState } from './model.js'
import { RenduStore } from './store.js'

export const inject = ['webServer', 'tools', 'systemPrompt', 'sessionController']
export const ROUTE_PREFIX = '/api/rendu'

const PROMPT = [
  'Rendu (`rendu`) stores a hierarchical vision. Each project has one root vision.',
  'Before executing, splitting, or judging a node, call action "brief" and use the core vision, the ancestor requirements, the sibling branches, and the linked sessions.',
  'Write status, progress, notes, and deadlines back with update_node or set_status. Progress is your judgment. Reaching 100 marks the node 完成待确认; do not mark it done, a person confirms that. Link extra conversations with link_session. Do not delete the root vision node.',
].join(' ')

export function apply(ctx: RenduContext): void {
  const store = RenduStore.open()
  const service = new RenduService(store)
  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: (req, res) => handle(ctx, service, req, res),
    })
    const disposeTool = ctx.tools.register(toolDefinition(service))
    const disposePrompt = ctx.systemPrompt.section({
      name: 'rendu',
      order: 860,
      interpolate: false,
      text: PROMPT,
    })
    return () => {
      disposeRoute()
      disposeTool()
      disposePrompt()
      store.close()
    }
  }, 'rendu')
}

interface RenduContext {
  effect(callback: () => void | (() => void) | Promise<void>, label?: string): () => void
  get(name: string): unknown
  webServer: { register(route: { kind: 'prefix', path: string, handler: (req: IncomingRequest, res: ServerResponse) => void | Promise<void> }): () => void }
  tools: { register(definition: unknown): () => void }
  systemPrompt: { section(section: { name: string, order: number, interpolate?: boolean, text: string }): () => void }
  sessionController: {
    create(request: { workspaceId?: string, cwd?: string }): Promise<{ sessionId?: string }>
    prompt(request: { requestId: string, sessionId: string, mode: 'queue', content: Array<{ type: 'text', text: string }>, clientTimeZone?: string }, signal: AbortSignal): Promise<unknown>
    rename(request: { sessionId: string, title: string }): Promise<unknown>
    list(request: Record<string, never>, signal: AbortSignal): Promise<{ items?: SessionSummary[] }>
  }
  logger?: { warn?: (message: string) => void }
}

interface IncomingRequest extends AsyncIterable<Uint8Array | string> {
  url?: string
  method?: string
}

interface ServerResponse {
  writeHead(status: number, headers: Record<string, string | number>): void
  end(body?: string): void
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

  constructor(private readonly store: RenduStore) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const job = this.chain.then(fn)
    this.chain = job.then(() => {}, () => {})
    return job
  }

  snapshot() {
    return this.run(async () => snapshot(this.store.read()))
  }

  textBrief(nodeId: string) {
    return this.run(async () => brief(this.store.read(), nodeId))
  }

  mutate(command: Record<string, unknown>) {
    return this.run(async () => {
      const before = this.store.read()
      const reduced = reduce(before, command, new Date())
      this.store.write(before, reduced.state)
      return { snapshot: snapshot(reduced.state), result: reduced.result }
    })
  }

  importLegacy(raw: unknown) {
    return this.run(async () => {
      const current = this.store.read()
      if (Object.keys(current.projects).length > 0) throw new Error('已经有项目，不再导入旧数据')
      const imported = normalizeState(raw)
      if (Object.keys(imported.projects).length === 0) return { snapshot: snapshot(current), result: { imported: 0 } }
      this.store.write(emptyState(), imported)
      return { snapshot: snapshot(imported), result: { imported: Object.keys(imported.projects).length } }
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
          enum: ['list', 'brief', 'create_project', 'create_node', 'update_node', 'set_status', 'delete_node', 'evaluate', 'link_session', 'unlink_session'],
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
  if (action === 'evaluate') {
    const saved = await service.mutate({ action: 'update_project', projectId: args.projectId, evaluation: args.evaluation ?? '' })
    return { ok: true, text: '项目评价已更新。', result: saved.result }
  }
  const fromAgent = action === 'update_node' || action === 'set_status'
  const saved = await service.mutate({ ...args, action, ...(fromAgent ? { source: 'agent' } : {}) })
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
    if (method === 'GET' && (action === '' || action === 'state')) return sendJson(res, 200, await service.snapshot())
    if (method === 'GET' && action === 'sessions') return sendJson(res, 200, { sessions: await listSessions(ctx) })
    if (method === 'GET' && action === 'workspaces') return sendJson(res, 200, { workspaces: listWorkspaces(ctx) })
    if (method === 'POST' && action === 'command') {
      const body = await readJson(req)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('请求格式不正确')
      const command = body as Record<string, unknown>
      if (command.action === 'dispatch') return sendJson(res, 200, await dispatchNode(ctx, service, command))
      if (command.action === 'import_legacy') return sendJson(res, 200, await service.importLegacy(command.state))
      return sendJson(res, 200, await service.mutate(command))
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
    '需要刷新时调用 rendu，action 用 brief。进度由你判断并用 update_node 写入。到 100 会变成完成待确认，不要直接标成完成。',
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
