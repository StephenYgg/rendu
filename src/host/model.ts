/**
 * Rendu domain logic. The root of a project is the vision. Recommended depth
 * is 4. Parents roll children into a progress fraction and a status mosaic.
 */
import { randomUUID } from 'node:crypto'

export const STATUSES = ['backlog', 'doing', 'blocked', 'review', 'confirm', 'done', 'dropped'] as const
export type Status = (typeof STATUSES)[number]
export const RECOMMENDED_DEPTH = 4
export const MAX_DEPTH = 6
export const DEFAULT_WARNING_DAYS = 3
export const RECENT_PROJECTS = 5
export const TIME_ZONE = 'Asia/Shanghai'

const STATUS_PROGRESS: Record<Status, number> = {
  backlog: 0,
  doing: 45,
  blocked: 20,
  review: 80,
  confirm: 100,
  done: 100,
  dropped: 0,
}

export interface ViewState {
  panX: number
  panY: number
  zoom: number
}

export interface SessionLink {
  id: string
  sessionId: string
  label: string
  createdAt: string
  error: string
}

export interface Settings {
  warningDays: number
  maxDepth: number
  activeProjectId: string | null
  overviewHidden: boolean
}

export interface ProjectRecord {
  id: string
  title: string
  evaluation: string
  view: ViewState
  createdAt: string
  updatedAt: string
}

export interface NodeRecord {
  id: string
  projectId: string
  parentId: string | null
  title: string
  intent: string
  status: Status
  progress: number | null
  dueAt: string | null
  notes: string
  x: number
  y: number
  order: number
  sessions: SessionLink[]
  createdAt: string
  updatedAt: string
}

export interface AtlasState {
  settings: Settings
  projects: Record<string, ProjectRecord>
  nodes: Record<string, NodeRecord>
}

export interface DueInfo {
  state: 'none' | 'ok' | 'soon' | 'due' | 'overdue'
  offset: number | null
}

export interface Rollup {
  progress: number
  done: number
  total: number
  dropped: number
  label: string
  childStatuses: Status[]
  due: DueInfo
}

export function emptyState(): AtlasState {
  return { settings: settingsRecord({}), projects: {}, nodes: {} }
}

export function calendarDay(date = new Date(), timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parseDay(value: unknown): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = Date.UTC(year, month - 1, day)
  const check = new Date(utc)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return utc
}

export function dayOffset(dueAt: string | null, today: string): number | null {
  const due = parseDay(dueAt)
  const now = parseDay(today)
  if (due == null || now == null) return null
  return Math.round((due - now) / 86400000)
}

export function addDays(today: string, days: number): string {
  const base = parseDay(today)
  if (base == null) return today
  return new Date(base + days * 86400000).toISOString().slice(0, 10)
}

export function dueInfo(dueAt: string | null, today: string, warningDays = DEFAULT_WARNING_DAYS): DueInfo {
  const offset = dayOffset(dueAt, today)
  if (offset == null) return { state: 'none', offset: null }
  if (offset < 0) return { state: 'overdue', offset }
  if (offset === 0) return { state: 'due', offset }
  if (offset <= warningDays) return { state: 'soon', offset }
  return { state: 'ok', offset }
}

function settingsRecord(input: Partial<Settings>): Settings {
  return {
    warningDays: clampInt(input.warningDays, 1, 30, DEFAULT_WARNING_DAYS),
    maxDepth: clampInt(input.maxDepth, RECOMMENDED_DEPTH, 8, MAX_DEPTH),
    activeProjectId: typeof input.activeProjectId === 'string' ? input.activeProjectId : null,
    overviewHidden: input.overviewHidden === true,
  }
}

function viewRecord(input: Partial<ViewState> = {}): ViewState {
  return {
    panX: finite(input.panX, 48),
    panY: finite(input.panY, 36),
    zoom: clamp(finite(input.zoom, 1), 0.4, 1.8),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function sessionLink(input: unknown, fallbackAt: string): SessionLink | null {
  const record = asRecord(input)
  if (!record) return null
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId.trim() : ''
  if (!sessionId) return null
  return {
    id: typeof record.id === 'string' && record.id ? record.id : `link:${sessionId}`,
    sessionId,
    label: clip(typeof record.label === 'string' ? record.label : '', 80),
    createdAt: typeof record.createdAt === 'string' && record.createdAt ? record.createdAt : fallbackAt,
    error: clip(typeof record.error === 'string' ? record.error : '', 500),
  }
}

export function normalizeState(raw: unknown): AtlasState {
  const state = emptyState()
  const root = asRecord(raw) ?? {}
  const settings = asRecord(root.settings) ?? {}
  state.settings = settingsRecord(settings as Partial<Settings>)
  const projects = asRecord(root.projects) ?? {}
  for (const [key, value] of Object.entries(projects)) {
    const record = asRecord(value)
    if (!record) continue
    const id = typeof record.id === 'string' ? record.id : key
    const title = clip(typeof record.title === 'string' ? record.title : '未命名项目', 80) || '未命名项目'
    state.projects[id] = {
      id,
      title,
      evaluation: clip(typeof record.evaluation === 'string' ? record.evaluation : '', 8000),
      view: viewRecord((asRecord(record.view) as Partial<ViewState> | null) ?? {}),
      createdAt: stampOr(record.createdAt),
      updatedAt: stampOr(record.updatedAt),
    }
  }
  const nodes = asRecord(root.nodes) ?? {}
  for (const [key, value] of Object.entries(nodes)) {
    const record = asRecord(value)
    if (!record) continue
    const id = typeof record.id === 'string' ? record.id : key
    const projectId = typeof record.projectId === 'string' ? record.projectId : ''
    if (!state.projects[projectId]) continue
    const createdAt = stampOr(record.createdAt)
    const sessions = Array.isArray(record.sessions)
      ? record.sessions.map((item) => sessionLink(item, createdAt)).filter((item): item is SessionLink => item !== null)
      : []
    if (sessions.length === 0 && typeof record.assigneeSessionId === 'string' && record.assigneeSessionId) {
      const legacy = sessionLink({
        id: `legacy:${record.assigneeSessionId}`,
        sessionId: record.assigneeSessionId,
        label: record.assigneeLabel,
        createdAt: record.lastDispatchAt,
        error: record.lastDispatchError,
      }, createdAt)
      if (legacy) sessions.push(legacy)
    }
    const title = clip(typeof record.title === 'string' ? record.title : '未命名节点', 80) || '未命名节点'
    state.nodes[id] = {
      id,
      projectId,
      parentId: typeof record.parentId === 'string' ? record.parentId : null,
      title,
      intent: clip(typeof record.intent === 'string' ? record.intent : '', 4000),
      status: STATUSES.includes(record.status as Status) ? record.status as Status : 'backlog',
      progress: progressOrNull(record.progress),
      dueAt: parseDay(record.dueAt) == null ? null : String(record.dueAt),
      notes: clip(typeof record.notes === 'string' ? record.notes : '', 8000),
      x: clamp(finite(record.x, 72), -4000, 12000),
      y: clamp(finite(record.y, 160), -4000, 12000),
      order: clampInt(record.order, 0, 100000, 0),
      sessions,
      createdAt,
      updatedAt: stampOr(record.updatedAt),
    }
  }
  if (state.settings.activeProjectId && !state.projects[state.settings.activeProjectId]) {
    state.settings.activeProjectId = firstProjectId(state)
  }
  return state
}

export function reduce(input: AtlasState, command: Record<string, unknown>, now = new Date()): { state: AtlasState, result: Record<string, unknown> } {
  const state = normalizeState(structuredClone(input))
  const stamp = now.toISOString()
  const action = command.action
  if (action === 'create_project') return createProject(state, command, stamp)
  if (action === 'create_sample') return createSample(state, stamp, now)
  if (action === 'select_project') return selectProject(state, command)
  if (action === 'update_project') return updateProject(state, command, stamp)
  if (action === 'delete_project') return deleteProject(state, command)
  if (action === 'create_node') return createNode(state, command, stamp)
  if (action === 'update_node' || action === 'set_status') return updateNode(state, command, stamp)
  if (action === 'delete_node') return deleteNode(state, command, stamp)
  if (action === 'move_node') return moveNode(state, command, stamp)
  if (action === 'layout') return layoutNodes(state, command, stamp)
  if (action === 'link_session') return linkSession(state, command, stamp)
  if (action === 'unlink_session') return unlinkSession(state, command, stamp)
  if (action === 'set_overview') return setOverview(state, command)
  throw new Error(`不支持的操作：${typeof action === 'string' ? action : '空'}`)
}

export function snapshot(input: AtlasState, now = new Date()) {
  const state = normalizeState(input)
  const today = calendarDay(now)
  const projects = Object.values(state.projects)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map((project) => {
      const root = projectRoot(state, project.id)
      const rolled = root ? rollup(state, root.id, today) : null
      return {
        id: project.id,
        title: project.title,
        updatedAt: project.updatedAt,
        progress: rolled?.progress ?? 0,
        progressLabel: rolled?.label ?? '0%',
      }
    })
  const activeId = state.settings.activeProjectId
  const project = activeId ? state.projects[activeId] : null
  return {
    settings: {
      warningDays: state.settings.warningDays,
      maxDepth: state.settings.maxDepth,
      recommendedDepth: RECOMMENDED_DEPTH,
      recentLimit: RECENT_PROJECTS,
      activeProjectId: activeId,
      overviewHidden: state.settings.overviewHidden,
      timeZone: TIME_ZONE,
      today,
    },
    projects,
    recentProjects: projects.slice(0, RECENT_PROJECTS),
    active: project ? projectView(state, project, today) : null,
  }
}

export function brief(input: AtlasState, nodeId: string, now = new Date()): string {
  const state = normalizeState(input)
  const today = calendarDay(now)
  const node = mustNode(state, nodeId)
  const project = mustProject(state, node.projectId)
  const chain = ancestors(state, node)
  const root = chain[0]
  if (!root) throw new Error('找不到核心宗旨')
  const siblings = node.parentId
    ? childrenOf(state, node.parentId).filter((item) => item.id !== node.id)
    : []
  const children = childrenOf(state, node.id)
  const lines = [
    `项目：${project.title}`,
    `核心宗旨：${root.title}`,
  ]
  if (root.intent) lines.push(`宗旨说明：${clip(root.intent, 800)}`)
  lines.push('链路（从宗旨到当前节点，越靠下越具体）：')
  for (const item of chain) {
    const rolled = rollup(state, item.id, today)
    const due = item.dueAt ? `｜截止 ${item.dueAt}` : ''
    lines.push(`- [L${depthOf(state, item)}] ${item.title}｜${item.status}｜${rolled.label}${due}`)
    if (item.intent) lines.push(`  要求：${clip(item.intent, 400)}`)
    if (item.notes) lines.push(`  笔记：${clip(item.notes, 240)}`)
  }
  lines.push('兄弟分支（其他链路；分析时要看见它们，不要拆掉或顶替）：')
  if (siblings.length === 0) lines.push('- 无')
  for (const item of siblings.slice(0, 12)) {
    const rolled = rollup(state, item.id, today)
    const hint = item.intent ? `｜${clip(item.intent, 160)}` : ''
    lines.push(`- ${item.title}｜${item.status}｜${rolled.label}${hint}`)
  }
  if (siblings.length > 12) lines.push(`- 其余 ${siblings.length - 12} 条兄弟分支已省略`)
  lines.push('直接子节点：')
  if (children.length === 0) lines.push('- 无。这是叶子，可以直接执行。')
  for (const item of children.slice(0, 16)) {
    const rolled = rollup(state, item.id, today)
    lines.push(`- ${item.id}｜${item.title}｜${item.status}｜${rolled.label}`)
  }
  if (children.length > 16) lines.push(`- 其余 ${children.length - 16} 个子节点已省略`)
  lines.push('已关联会话（对话记录在这些会话里，不要另开重复的）：')
  if (node.sessions.length === 0) lines.push('- 无')
  for (const link of [...node.sessions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8)) {
    lines.push(`- ${link.sessionId}｜${link.label || '未命名会话'}${link.error ? `｜失败：${link.error}` : ''}`)
  }
  if (project.evaluation) lines.push(`项目评价：${clip(project.evaluation, 800)}`)
  lines.push('约束：一切拆分和执行都要服务于核心宗旨；先看整条链路和兄弟分支，再改本节点。进度由你判断并用 update_node 写入。进度到 100 会变成完成待确认，不能由你直接标成完成，要等人确认。')
  lines.push(`nodeId：${node.id}`)
  lines.push(`projectId：${project.id}`)
  return lines.join('\n')
}

export function rollup(state: AtlasState, nodeId: string, today: string, seen = new Set<string>()): Rollup {
  const empty: Rollup = { progress: 0, done: 0, total: 0, dropped: 0, label: '0%', childStatuses: [], due: { state: 'none', offset: null } }
  if (seen.has(nodeId)) return empty
  const node = state.nodes[nodeId]
  if (!node) return empty
  const nextSeen = new Set(seen)
  nextSeen.add(nodeId)
  const children = childrenOf(state, nodeId)
  const active = children.filter((child) => child.status !== 'dropped')
  let progress = 0
  let done = 0
  let total = 0
  if (children.length === 0) {
    progress = node.status === 'dropped' ? 0 : leafProgress(node)
    done = node.status === 'done' ? 1 : 0
    total = node.status === 'dropped' ? 0 : 1
  } else {
    const childRolls = active.map((child) => rollup(state, child.id, today, nextSeen))
    total = active.length
    done = childRolls.filter((item) => item.total > 0 && item.done === item.total).length
    progress = total === 0 ? 0 : Math.round(childRolls.reduce((sum, item) => sum + item.progress, 0) / total)
  }
  const due = dueInfo(node.dueAt, today, state.settings.warningDays)
  return {
    progress,
    done,
    total,
    dropped: children.length - active.length,
    label: children.length === 0 ? `${progress}%` : `${done}/${total} ${progress}%`,
    childStatuses: children.map((child) => child.status),
    due,
  }
}

function projectView(state: AtlasState, project: ProjectRecord, today: string) {
  return {
    project: {
      id: project.id,
      title: project.title,
      evaluation: project.evaluation,
      view: project.view,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    nodes: projectNodes(state, project.id).map((node) => decorate(state, node, today)),
    overview: overview(state, project.id, today),
  }
}

function decorate(state: AtlasState, node: NodeRecord, today: string) {
  return {
    ...node,
    depth: depthOf(state, node),
    childCount: childrenOf(state, node.id).length,
    rolled: rollup(state, node.id, today),
    sessions: [...node.sessions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  }
}

function overview(state: AtlasState, projectId: string, today: string) {
  const nodes = projectNodes(state, projectId)
  const root = nodes.find((node) => node.parentId == null)
  const rolled = root ? rollup(state, root.id, today) : { progress: 0, done: 0, total: 0, label: '0%', childStatuses: [] as Status[] }
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Status, number>
  const alerts: Array<{ nodeId: string, title: string, state: DueInfo['state'], offset: number | null, dueAt: string | null }> = []
  let depthUsed = root ? 1 : 0
  for (const node of nodes) {
    counts[node.status] += 1
    depthUsed = Math.max(depthUsed, depthOf(state, node))
    const due = dueInfo(node.dueAt, today, state.settings.warningDays)
    if (due.state === 'soon' || due.state === 'due' || due.state === 'overdue') {
      alerts.push({ nodeId: node.id, title: node.title, state: due.state, offset: due.offset, dueAt: node.dueAt })
    }
  }
  alerts.sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0))
  const leaves = nodes.filter((node) => childrenOf(state, node.id).length === 0 && node.status !== 'dropped')
  const allDone = leaves.length > 0 && leaves.every((node) => node.status === 'done')
  const awaiting = leaves.some((node) => node.status === 'confirm')
  const childCount = root ? childrenOf(state, root.id).length : 0
  let verdict = 'clear'
  if (!root || childCount === 0) verdict = 'empty'
  else if (allDone) verdict = 'done'
  else if (awaiting && leaves.every((node) => node.status === 'done' || node.status === 'confirm')) verdict = 'confirm'
  else if (counts.blocked > 0) verdict = 'blocked'
  else if (alerts.length > 0) verdict = 'risk'
  return {
    progress: rolled.progress,
    done: rolled.done,
    total: rolled.total,
    label: root && childCount > 0 ? rolled.label : `${rolled.progress}%`,
    counts,
    alerts,
    depthUsed,
    verdict,
    childStatuses: rolled.childStatuses,
    nodeCount: nodes.length,
    sessionCount: nodes.reduce((sum, node) => sum + node.sessions.length, 0),
  }
}

function createProject(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const title = requiredText(command.title, 80, '项目名称')
  const vision = requiredText(command.vision, 4000, '宗旨')
  assertRoom(state)
  const projectId = randomUUID()
  const rootId = randomUUID()
  state.projects[projectId] = {
    id: projectId, title, evaluation: '', view: viewRecord(), createdAt: stamp, updatedAt: stamp,
  }
  state.nodes[rootId] = blankNode({
    id: rootId, projectId, parentId: null, title, intent: vision, x: 72, y: 168, order: 0, createdAt: stamp, updatedAt: stamp,
  })
  if (!state.settings.activeProjectId || command.activate === true) state.settings.activeProjectId = projectId
  return { state, result: { projectId, rootId } }
}

function createSample(state: AtlasState, stamp: string, now: Date) {
  assertRoom(state)
  const today = calendarDay(now)
  const projectId = randomUUID()
  const ids = Array.from({ length: 10 }, () => randomUUID())
  const rootId = ids[0] ?? randomUUID()
  state.projects[projectId] = {
    id: projectId,
    title: '示例：把大事拆成可执行的图',
    evaluation: '这是一条可点击的示例。宗旨在最左，往右越来越具体。黄边是临期，红边是到期或逾期。',
    view: viewRecord({ panX: 36, panY: 28, zoom: 0.92 }),
    createdAt: stamp,
    updatedAt: stamp,
  }
  const vision = '用一张能看全局的图，把宗旨拆到可执行的节点，并让 Agent 按整条链路和兄弟分支来干活，而不是只看一条孤立待办。'
  const rows: Array<[string, string | null, string, string, Status, number | null, string | null, number, number, number, string]> = [
    [rootId, null, '把大事拆成可执行的图', vision, 'backlog', null, null, 72, 250, 0, ''],
    [ids[1] ?? randomUUID(), rootId, '看清全局', '图上要能一眼看出谁在做、谁卡住、谁快到期。', 'doing', null, null, 360, 40, 0, ''],
    [ids[2] ?? randomUUID(), ids[1] ?? rootId, '图式浏览', '节点可拖拽、可点开、可右键管理。', 'done', 100, null, 660, 8, 0, '拖拽只改位置，还不改父子关系。'],
    [ids[3] ?? randomUUID(), ids[1] ?? rootId, '状态色块汇总', '父节点用子节点的状态色拼成一条色带，并显示完成数和百分比。', 'doing', null, addDays(today, 2), 660, 156, 1, ''],
    [ids[4] ?? randomUUID(), rootId, '拆得动', '围绕宗旨继续往下拆，而不是另起一套无关任务。', 'backlog', null, null, 360, 300, 1, ''],
    [ids[5] ?? randomUUID(), ids[4] ?? rootId, '多级子节点', '建议停在四层：宗旨、目标、举措、任务。最多六层。', 'backlog', null, null, 660, 280, 0, ''],
    [ids[6] ?? randomUUID(), ids[4] ?? rootId, '右键管理', '添加、编辑、改状态、设截止日期、交给 Agent。', 'review', 80, today, 660, 430, 1, '今天到期，卡片应为红色提醒。'],
    [ids[7] ?? randomUUID(), rootId, '交给 Agent', '执行者要看见宗旨、上级要求和旁边的其他链路。', 'blocked', null, null, 360, 560, 2, '关联过的会话会留在节点上，可以打开原对话。'],
    [ids[8] ?? randomUUID(), ids[7] ?? rootId, '链路简报', 'Agent 开工前先读整条链路，而不是只读当前节点。', 'backlog', null, addDays(today, -2), 660, 540, 0, '这条已逾期，用来检查红色提醒。'],
    [ids[9] ?? randomUUID(), ids[7] ?? rootId, '看见兄弟分支', '分析时能看到其他链路，避免局部最优。', 'doing', 30, null, 660, 690, 1, ''],
  ]
  for (const row of rows) {
    const [id, parentId, title, intent, status, progress, dueAt, x, y, order, notes] = row
    state.nodes[id] = blankNode({
      id, projectId, parentId, title, intent, status, progress, dueAt, notes, x, y, order, createdAt: stamp, updatedAt: stamp,
    })
  }
  state.settings.activeProjectId = projectId
  return { state, result: { projectId, rootId } }
}

function selectProject(state: AtlasState, command: Record<string, unknown>) {
  const project = mustProject(state, command.projectId)
  state.settings.activeProjectId = project.id
  return { state, result: { projectId: project.id } }
}

function updateProject(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const project = mustProject(state, command.projectId)
  if (command.title != null) project.title = requiredText(command.title, 80, '项目名称')
  if (command.evaluation != null) project.evaluation = optionalText(command.evaluation, 8000, '评价')
  if (command.view != null) project.view = viewRecord((asRecord(command.view) as Partial<ViewState> | null) ?? {})
  project.updatedAt = stamp
  if (command.title != null) {
    const root = projectRoot(state, project.id)
    if (root) {
      root.title = project.title
      root.updatedAt = stamp
    }
  }
  return { state, result: { projectId: project.id } }
}

function deleteProject(state: AtlasState, command: Record<string, unknown>) {
  const project = mustProject(state, command.projectId)
  for (const node of projectNodes(state, project.id)) delete state.nodes[node.id]
  delete state.projects[project.id]
  if (state.settings.activeProjectId === project.id) state.settings.activeProjectId = firstProjectId(state)
  return { state, result: { projectId: project.id } }
}

function createNode(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const parent = mustNode(state, command.parentId)
  const depth = depthOf(state, parent)
  if (depth >= state.settings.maxDepth) {
    throw new Error(`最多 ${state.settings.maxDepth} 级。建议停在 ${RECOMMENDED_DEPTH} 级：宗旨、目标、举措、任务。`)
  }
  assertRoom(state, parent.projectId)
  const siblings = childrenOf(state, parent.id)
  const side = command.side === 'left' ? 'left' : 'right'
  const onSide = siblings.filter((item) => (side === 'left' ? item.x + 118 < parent.x + 118 : item.x + 118 >= parent.x + 118))
  const nodeId = randomUUID()
  state.nodes[nodeId] = blankNode({
    id: nodeId,
    projectId: parent.projectId,
    parentId: parent.id,
    title: requiredText(command.title, 80, '节点标题'),
    intent: optionalText(command.intent, 4000, '要求'),
    x: side === 'left' ? parent.x - 300 : parent.x + 300,
    y: parent.y + onSide.length * 148,
    order: siblings.length,
    createdAt: stamp,
    updatedAt: stamp,
  })
  touchProject(state, parent.projectId, stamp)
  return {
    state,
    result: {
      nodeId,
      warning: depth >= RECOMMENDED_DEPTH
        ? `这一层已经超过建议的 ${RECOMMENDED_DEPTH} 级。还可以继续拆，但最多到 ${state.settings.maxDepth} 级。`
        : null,
    },
  }
}

function updateNode(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const node = mustNode(state, command.nodeId)
  const fromAgent = command.source === 'agent'
  if (command.title != null) node.title = requiredText(command.title, 80, '节点标题')
  if (command.intent != null) node.intent = optionalText(command.intent, 4000, '要求')
  if (command.notes != null) node.notes = optionalText(command.notes, 8000, '笔记')
  if (command.status != null) {
    if (!STATUSES.includes(command.status as Status)) throw new Error('状态不正确')
    node.status = fromAgent && command.status === 'done' ? 'confirm' : command.status as Status
  }
  if (Object.prototype.hasOwnProperty.call(command, 'progress')) node.progress = progressOrNull(command.progress, true)
  if (fromAgent && node.progress === 100 && node.status !== 'dropped' && node.status !== 'done') node.status = 'confirm'
  if (fromAgent && node.progress != null && node.progress < 100 && node.status === 'confirm' && command.status == null) node.status = 'doing'
  if (Object.prototype.hasOwnProperty.call(command, 'dueAt')) {
    if (command.dueAt == null || command.dueAt === '') node.dueAt = null
    else {
      if (parseDay(command.dueAt) == null) throw new Error('截止日期要用 YYYY-MM-DD')
      node.dueAt = String(command.dueAt)
    }
  }
  node.updatedAt = stamp
  if (node.parentId == null && command.title != null) {
    const project = state.projects[node.projectId]
    if (project) {
      project.title = node.title
      project.updatedAt = stamp
    }
  } else {
    touchProject(state, node.projectId, stamp)
  }
  return { state, result: { nodeId: node.id } }
}

function deleteNode(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const node = mustNode(state, command.nodeId)
  if (node.parentId == null) throw new Error('主节点是核心宗旨，不能删除。可以删除整个项目。')
  const removed = collectDescendants(state, node.id).map((item) => item.id)
  for (const id of removed) delete state.nodes[id]
  touchProject(state, node.projectId, stamp)
  return { state, result: { nodeId: node.id, removed: removed.length } }
}

function moveNode(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const node = mustNode(state, command.nodeId)
  if (typeof command.x !== 'number' || typeof command.y !== 'number' || !Number.isFinite(command.x) || !Number.isFinite(command.y)) {
    throw new Error('位置不正确')
  }
  node.x = clamp(command.x, -4000, 12000)
  node.y = clamp(command.y, -4000, 12000)
  node.updatedAt = stamp
  return { state, result: { nodeId: node.id, x: node.x, y: node.y } }
}

const CARD_W = 236
const CARD_H = 148
const GAP_X = 88
const GAP_Y = 36

function layoutNodes(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const projectId = typeof command.projectId === 'string' && command.projectId
    ? command.projectId
    : state.settings.activeProjectId
  const project = mustProject(state, projectId)
  const mode = command.mode === 'right' || command.mode === 'down' || command.mode === 'radial' ? command.mode : 'tidy'
  const nodes = projectNodes(state, project.id)
  const positions = arrangeNodes(nodes, mode)
  for (const node of nodes) {
    const pos = positions.get(node.id)
    if (!pos) continue
    node.x = clamp(Math.round(pos.x), -4000, 12000)
    node.y = clamp(Math.round(pos.y), -4000, 12000)
    node.updatedAt = stamp
  }
  touchProject(state, project.id, stamp)
  return { state, result: { projectId: project.id, mode, count: nodes.length } }
}

function arrangeNodes(nodes: NodeRecord[], mode: 'tidy' | 'right' | 'down' | 'radial'): Map<string, { x: number, y: number }> {
  const known = new Set(nodes.map((node) => node.id))
  const children = new Map<string, NodeRecord[]>()
  for (const node of nodes) {
    if (!node.parentId || !known.has(node.parentId)) continue
    const list = children.get(node.parentId) ?? []
    list.push(node)
    children.set(node.parentId, list)
  }
  for (const list of children.values()) {
    list.sort((a, b) => mode === 'down' ? a.x - b.x || a.order - b.order : a.y - b.y || a.order - b.order)
  }
  const roots = nodes
    .filter((node) => !node.parentId || !known.has(node.parentId))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const positions = new Map<string, { x: number, y: number }>()
  if (mode === 'radial') return arrangeRadial(roots, children)
  let top = 48
  for (const root of roots) {
    if (mode === 'down') {
      placeDown(root, 72, top, children, positions)
      top += downSpan(root, children) + 96
    } else if (mode === 'right') {
      placeOutward(root, 72, top, 'right', children, positions)
      top += outwardSpan(root, children) + 96
    } else {
      placeTidy(root, 480, top, children, positions)
      top += tidySpan(root, children) + 96
    }
  }
  return positions
}

function placeTidy(
  node: NodeRecord,
  centerX: number,
  top: number,
  children: Map<string, NodeRecord[]>,
  positions: Map<string, { x: number, y: number }>,
) {
  const { left, right } = splitSides(node, children.get(node.id) ?? [])
  const leftSpan = listSpan(left, children)
  const rightSpan = listSpan(right, children)
  const height = Math.max(CARD_H, leftSpan, rightSpan)
  positions.set(node.id, { x: centerX - CARD_W / 2, y: top + (height - CARD_H) / 2 })
  placeOutwardList(left, centerX - CARD_W / 2 - GAP_X - CARD_W, top + (height - leftSpan) / 2, 'left', children, positions)
  placeOutwardList(right, centerX + CARD_W / 2 + GAP_X, top + (height - rightSpan) / 2, 'right', children, positions)
}

function placeOutwardList(
  list: NodeRecord[],
  x: number,
  top: number,
  direction: 'left' | 'right',
  children: Map<string, NodeRecord[]>,
  positions: Map<string, { x: number, y: number }>,
) {
  let cursor = top
  for (const child of list) {
    const span = outwardSpan(child, children)
    placeOutward(child, x, cursor, direction, children, positions)
    cursor += span + GAP_Y
  }
}

function placeOutward(
  node: NodeRecord,
  x: number,
  top: number,
  direction: 'left' | 'right',
  children: Map<string, NodeRecord[]>,
  positions: Map<string, { x: number, y: number }>,
) {
  const list = children.get(node.id) ?? []
  const span = outwardSpan(node, children)
  positions.set(node.id, { x, y: top + (span - CARD_H) / 2 })
  const childX = direction === 'right' ? x + CARD_W + GAP_X : x - GAP_X - CARD_W
  placeOutwardList(list, childX, top, direction, children, positions)
}

function placeDown(
  node: NodeRecord,
  left: number,
  y: number,
  children: Map<string, NodeRecord[]>,
  positions: Map<string, { x: number, y: number }>,
) {
  const list = children.get(node.id) ?? []
  const width = downSpan(node, children)
  positions.set(node.id, { x: left + (width - CARD_W) / 2, y })
  let cursor = left
  for (const child of list) {
    const childWidth = downSpan(child, children)
    placeDown(child, cursor, y + CARD_H + GAP_Y, children, positions)
    cursor += childWidth + GAP_X
  }
}

function splitSides(node: NodeRecord, list: NodeRecord[]) {
  const left: NodeRecord[] = []
  const right: NodeRecord[] = []
  for (const child of list) {
    if (child.x + CARD_W / 2 < node.x + CARD_W / 2) left.push(child)
    else right.push(child)
  }
  return { left, right }
}

function outwardSpan(node: NodeRecord, children: Map<string, NodeRecord[]>): number {
  return listSpan(children.get(node.id) ?? [], children)
}

function listSpan(list: NodeRecord[], children: Map<string, NodeRecord[]>): number {
  if (list.length === 0) return CARD_H
  return list.reduce((sum, child) => sum + outwardSpan(child, children), 0) + GAP_Y * (list.length - 1)
}

function tidySpan(node: NodeRecord, children: Map<string, NodeRecord[]>): number {
  const { left, right } = splitSides(node, children.get(node.id) ?? [])
  return Math.max(CARD_H, listSpan(left, children), listSpan(right, children))
}

function downSpan(node: NodeRecord, children: Map<string, NodeRecord[]>): number {
  const list = children.get(node.id) ?? []
  if (list.length === 0) return CARD_W
  return list.reduce((sum, child) => sum + downSpan(child, children), 0) + GAP_X * (list.length - 1)
}

function arrangeRadial(roots: NodeRecord[], children: Map<string, NodeRecord[]>): Map<string, { x: number, y: number }> {
  const positions = new Map<string, { x: number, y: number }>()
  let cursor = 80
  for (const root of roots) {
    const local = layoutRing(root, children)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    for (const pos of local.values()) {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x)
    }
    if (!Number.isFinite(minX)) continue
    const dx = cursor - minX
    const dy = 80 - minY
    for (const [id, pos] of local) positions.set(id, { x: pos.x + dx, y: pos.y + dy })
    cursor += maxX - minX + CARD_W + 160
  }
  return positions
}

function layoutRing(root: NodeRecord, children: Map<string, NodeRecord[]>): Map<string, { x: number, y: number }> {
  const angles = new Map<string, number>()
  const depth = new Map<string, number>()
  const leaves = new Map<string, number>()
  function leafCount(id: string): number {
    const cached = leaves.get(id)
    if (cached != null) return cached
    const kids = children.get(id) ?? []
    const count = kids.length === 0 ? 1 : kids.reduce((sum, kid) => sum + leafCount(kid.id), 0)
    leaves.set(id, count)
    return count
  }
  function assign(id: string, start: number, end: number, level: number) {
    depth.set(id, level)
    angles.set(id, (start + end) / 2)
    const kids = children.get(id) ?? []
    if (kids.length === 0) return
    const total = kids.reduce((sum, kid) => sum + leafCount(kid.id), 0)
    let cursor = start
    for (const kid of kids) {
      const share = (end - start) * (leafCount(kid.id) / total)
      assign(kid.id, cursor, cursor + share, level + 1)
      cursor += share
    }
  }
  assign(root.id, -Math.PI / 2, Math.PI * 1.5, 0)
  const maxDepth = Math.max(...depth.values())
  const radiusAt = [0]
  for (let level = 1; level <= maxDepth; level += 1) {
    const ring = [...depth.entries()].filter((entry) => entry[1] === level).map((entry) => angles.get(entry[0]) ?? 0).sort((a, b) => a - b)
    let minGap = Math.PI * 2
    if (ring.length > 1) {
      minGap = Infinity
      for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index] ?? 0
        const next = index + 1 < ring.length ? ring[index + 1] ?? 0 : (ring[0] ?? 0) + Math.PI * 2
        minGap = Math.min(minGap, next - current)
      }
    }
    const separation = Math.hypot(CARD_W, CARD_H) + 28
    const chord = minGap >= Math.PI ? 0 : (separation / 2) / Math.sin(minGap / 2)
    radiusAt[level] = Math.max((radiusAt[level - 1] ?? 0) + separation, chord)
  }
  const positions = new Map<string, { x: number, y: number }>()
  for (const [id, level] of depth) {
    const radius = radiusAt[level] ?? 0
    const angle = angles.get(id) ?? 0
    positions.set(id, {
      x: Math.cos(angle) * radius - CARD_W / 2,
      y: Math.sin(angle) * radius - CARD_H / 2,
    })
  }
  return positions
}

function linkSession(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const node = mustNode(state, command.nodeId)
  const sessionId = requiredText(command.sessionId, 120, '会话')
  const existing = node.sessions.find((item) => item.sessionId === sessionId)
  const link: SessionLink = {
    id: existing?.id ?? randomUUID(),
    sessionId,
    label: optionalText(command.label, 80, '会话名称'),
    createdAt: stamp,
    error: optionalText(command.error, 500, '错误'),
  }
  node.sessions = [link, ...node.sessions.filter((item) => item.sessionId !== sessionId)]
  node.updatedAt = stamp
  touchProject(state, node.projectId, stamp)
  return { state, result: { nodeId: node.id, linkId: link.id, sessionId } }
}

function unlinkSession(state: AtlasState, command: Record<string, unknown>, stamp: string) {
  const node = mustNode(state, command.nodeId)
  const linkId = requiredText(command.linkId, 80, '关联')
  const before = node.sessions.length
  node.sessions = node.sessions.filter((item) => item.id !== linkId)
  if (node.sessions.length === before) throw new Error('找不到这条会话关联')
  node.updatedAt = stamp
  touchProject(state, node.projectId, stamp)
  return { state, result: { nodeId: node.id, linkId } }
}

function setOverview(state: AtlasState, command: Record<string, unknown>) {
  state.settings.overviewHidden = command.hidden === true
  return { state, result: { overviewHidden: state.settings.overviewHidden } }
}

function blankNode(input: Partial<NodeRecord> & Pick<NodeRecord, 'id' | 'projectId' | 'title' | 'createdAt' | 'updatedAt'>): NodeRecord {
  return {
    parentId: null,
    intent: '',
    status: 'backlog',
    progress: null,
    dueAt: null,
    notes: '',
    x: 72,
    y: 160,
    order: 0,
    sessions: [],
    ...input,
  }
}

function childrenOf(state: AtlasState, parentId: string): NodeRecord[] {
  const parent = state.nodes[parentId]
  if (!parent) return []
  return Object.values(state.nodes)
    .filter((node) => node.parentId === parentId && node.projectId === parent.projectId)
    .sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1))
}

function projectNodes(state: AtlasState, projectId: string): NodeRecord[] {
  return Object.values(state.nodes)
    .filter((node) => node.projectId === projectId)
    .sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1))
}

function projectRoot(state: AtlasState, projectId: string): NodeRecord | null {
  return projectNodes(state, projectId).find((node) => node.parentId == null) ?? null
}

function ancestors(state: AtlasState, node: NodeRecord): NodeRecord[] {
  const chain = [node]
  const seen = new Set([node.id])
  let cursor = node
  while (cursor.parentId && !seen.has(cursor.parentId)) {
    const parent = state.nodes[cursor.parentId]
    if (!parent) break
    seen.add(parent.id)
    chain.push(parent)
    cursor = parent
  }
  return chain.reverse()
}

function depthOf(state: AtlasState, node: NodeRecord): number {
  return ancestors(state, node).length
}

function collectDescendants(state: AtlasState, nodeId: string): NodeRecord[] {
  const node = state.nodes[nodeId]
  if (!node) return []
  return [node, ...childrenOf(state, nodeId).flatMap((child) => collectDescendants(state, child.id))]
}

function leafProgress(node: NodeRecord): number {
  if (node.status === 'dropped') return 0
  if (typeof node.progress === 'number') return clamp(Math.round(node.progress), 0, 100)
  return STATUS_PROGRESS[node.status] ?? 0
}

function mustProject(state: AtlasState, projectId: unknown): ProjectRecord {
  const project = typeof projectId === 'string' ? state.projects[projectId] : undefined
  if (!project) throw new Error('找不到这个项目')
  return project
}

function mustNode(state: AtlasState, nodeId: unknown): NodeRecord {
  const node = typeof nodeId === 'string' ? state.nodes[nodeId] : undefined
  if (!node) throw new Error('找不到这个节点')
  return node
}

function touchProject(state: AtlasState, projectId: string, stamp: string): void {
  const project = state.projects[projectId]
  if (project) project.updatedAt = stamp
}

function firstProjectId(state: AtlasState): string | null {
  const projects = Object.values(state.projects).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return projects[0]?.id ?? null
}

function assertRoom(state: AtlasState, projectId?: string): void {
  if (Object.keys(state.projects).length >= 40 && !projectId) throw new Error('项目太多了，先删掉不用的再创建')
  const count = projectId ? projectNodes(state, projectId).length : Object.keys(state.nodes).length
  if (count >= 400) throw new Error('节点太多了，先收敛再继续拆')
}

function requiredText(value: unknown, max: number, field: string): string {
  const text = optionalText(value, max, field)
  if (!text) throw new Error(`请填写${field}`)
  return text
}

function optionalText(value: unknown, max: number, field: string): string {
  if (value == null) return ''
  if (typeof value !== 'string') throw new Error(`${field}必须是文字`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new Error(`${field}不能超过 ${max} 字`)
  return trimmed
}

function progressOrNull(value: unknown, strict = false): number | null {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    if (strict) throw new Error('进度要填 0 到 100 的整数，或留空自动计算')
    return null
  }
  return clamp(Math.round(number), 0, 100)
}

function finite(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number)) return fallback
  return clamp(number, min, max)
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function stampOr(value: unknown): string {
  return typeof value === 'string' && value ? value : new Date(0).toISOString()
}
