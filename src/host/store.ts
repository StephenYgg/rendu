/**
 * SQLite store for Rendu. The database lives under ~/.dsh/rendu and is not
 * part of the source tree.
 */
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { emptyState, normalizeState, type AtlasState, type NodeRecord, type ProjectRecord, type SessionLink, type Settings } from './model.js'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  evaluation TEXT NOT NULL,
  view_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  intent TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER,
  due_at TEXT,
  notes TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS node_sessions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  error TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS output_watches (
  session_id TEXT PRIMARY KEY,
  scanned_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`

export function defaultDatabasePath(): string {
  return join(homedir(), '.dsh', 'rendu', 'rendu.sqlite')
}

export class RenduStore {
  constructor(private readonly db: DatabaseSync) {}

  static open(path = defaultDatabasePath()): RenduStore {
    mkdirSync(dirname(path), { recursive: true })
    const db = new DatabaseSync(path)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec(SCHEMA)
    ensureOutputColumns(db)
    return new RenduStore(db)
  }

  close(): void {
    this.db.close()
  }

  read(): AtlasState {
    const settings = { ...emptyState().settings }
    for (const row of this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string, value: string }>) {
      if (row.key === 'warningDays') settings.warningDays = Number(row.value)
      if (row.key === 'maxDepth') settings.maxDepth = Number(row.value)
      if (row.key === 'activeProjectId') settings.activeProjectId = row.value || null
      if (row.key === 'overviewHidden') settings.overviewHidden = row.value === '1'
      if (row.key === 'idleRefreshSeconds') settings.idleRefreshSeconds = Number(row.value)
      if (row.key === 'runningRefreshSeconds') settings.runningRefreshSeconds = Number(row.value)
      if (row.key === 'nodeStyle' && (row.value === 'ink' || row.value === 'spine' || row.value === 'scale' || row.value === 'cycle' || row.value === 'cycle2' || row.value === 'karma')) settings.nodeStyle = row.value
    }
    const projects: Record<string, ProjectRecord> = {}
    for (const row of this.db.prepare('SELECT * FROM projects').all() as Array<Record<string, unknown>>) {
      const id = String(row.id)
      projects[id] = {
        id,
        title: String(row.title),
        evaluation: String(row.evaluation ?? ''),
        view: parseJson(row.view_json, { panX: 48, panY: 36, zoom: 1 }),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    }
    const sessions = new Map<string, SessionLink[]>()
    for (const row of this.db.prepare('SELECT * FROM node_sessions').all() as Array<Record<string, unknown>>) {
      const nodeId = String(row.node_id)
      const list = sessions.get(nodeId) ?? []
      list.push({
        id: String(row.id),
        sessionId: String(row.session_id),
        label: String(row.label ?? ''),
        createdAt: String(row.created_at),
        error: String(row.error ?? ''),
      })
      sessions.set(nodeId, list)
    }
    const nodes: Record<string, NodeRecord> = {}
    for (const row of this.db.prepare('SELECT * FROM nodes').all() as Array<Record<string, unknown>>) {
      const id = String(row.id)
      nodes[id] = {
        id,
        projectId: String(row.project_id),
        parentId: row.parent_id == null ? null : String(row.parent_id),
        title: String(row.title),
        intent: String(row.intent ?? ''),
        status: String(row.status) as NodeRecord['status'],
        progress: row.progress == null ? null : Number(row.progress),
        dueAt: row.due_at == null ? null : String(row.due_at),
        notes: String(row.notes ?? ''),
        x: Number(row.x),
        y: Number(row.y),
        order: Number(row.sort_order),
        sessions: sessions.get(id) ?? [],
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    }
    return normalizeState({ settings, projects, nodes })
  }

  write(before: AtlasState, after: AtlasState): void {
    this.transaction(() => {
      if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) this.writeSettings(after.settings)
      const projects = this.db.prepare('DELETE FROM projects WHERE id = ?')
      for (const id of Object.keys(before.projects)) {
        if (!after.projects[id]) projects.run(id)
      }
      for (const project of Object.values(after.projects)) {
        if (JSON.stringify(before.projects[project.id]) !== JSON.stringify(project)) this.putProject(project)
      }
      const deleteNode = this.db.prepare('DELETE FROM nodes WHERE id = ?')
      const deleteLinks = this.db.prepare('DELETE FROM node_sessions WHERE node_id = ?')
      for (const id of Object.keys(before.nodes)) {
        if (!after.nodes[id]) {
          deleteLinks.run(id)
          deleteNode.run(id)
        }
      }
      for (const node of Object.values(after.nodes)) {
        if (JSON.stringify(before.nodes[node.id]) !== JSON.stringify(node)) this.putNode(node)
      }
    })
  }

  private writeSettings(settings: Settings): void {
    const put = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    put.run('warningDays', String(settings.warningDays))
    put.run('maxDepth', String(settings.maxDepth))
    put.run('activeProjectId', settings.activeProjectId ?? '')
    put.run('overviewHidden', settings.overviewHidden ? '1' : '0')
    put.run('idleRefreshSeconds', String(settings.idleRefreshSeconds))
    put.run('runningRefreshSeconds', String(settings.runningRefreshSeconds))
    put.run('nodeStyle', settings.nodeStyle)
  }

  private putProject(project: ProjectRecord): void {
    this.db.prepare(`
      INSERT INTO projects (id, title, evaluation, view_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        evaluation = excluded.evaluation,
        view_json = excluded.view_json,
        updated_at = excluded.updated_at
    `).run(project.id, project.title, project.evaluation, JSON.stringify(project.view), project.createdAt, project.updatedAt)
  }

  private putNode(node: NodeRecord): void {
    this.db.prepare(`
      INSERT INTO nodes (
        id, project_id, parent_id, title, intent, status, progress, due_at, notes, x, y, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        parent_id = excluded.parent_id,
        title = excluded.title,
        intent = excluded.intent,
        status = excluded.status,
        progress = excluded.progress,
        due_at = excluded.due_at,
        notes = excluded.notes,
        x = excluded.x,
        y = excluded.y,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).run(
      node.id, node.projectId, node.parentId, node.title, node.intent, node.status,
      node.progress, node.dueAt, node.notes, node.x, node.y, node.order, node.createdAt, node.updatedAt,
    )
    this.db.prepare('DELETE FROM node_sessions WHERE node_id = ?').run(node.id)
    const insert = this.db.prepare(`
      INSERT INTO node_sessions (id, node_id, session_id, label, created_at, error)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const link of node.sessions) insert.run(link.id, node.id, link.sessionId, link.label, link.createdAt, link.error)
  }

  linkedSessionIds(): string[] {
    return (this.db.prepare('SELECT DISTINCT session_id FROM node_sessions').all() as Array<{ session_id: string }>).map((row) => row.session_id)
  }

  hasWatch(sessionId: string): boolean {
    return Boolean(this.db.prepare('SELECT 1 AS ok FROM output_watches WHERE session_id = ?').get(sessionId))
  }

  markWatch(sessionId: string): void {
    this.db.prepare('INSERT INTO output_watches (session_id, scanned_at) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET scanned_at = excluded.scanned_at')
      .run(sessionId, new Date().toISOString())
  }

  listOutputs(nodeId: string): OutputRow[] {
    return this.db.prepare('SELECT * FROM outputs WHERE node_id = ? ORDER BY created_at DESC').all(nodeId) as OutputRow[]
  }

  addOutput(row: OutputRow): OutputRow {
    const existing = this.db.prepare('SELECT * FROM outputs WHERE node_id = ? AND path = ?').get(row.node_id, row.path) as OutputRow | undefined
    if (existing) {
      if (!existing.session_id && row.session_id) {
        this.db.prepare('UPDATE outputs SET session_id = ? WHERE id = ?').run(row.session_id, existing.id)
        existing.session_id = row.session_id
      }
      return existing
    }
    this.db.prepare(`
      INSERT INTO outputs (id, node_id, path, title, kind, created_at, filename, session_id, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.node_id, row.path, row.title, row.kind, row.created_at, row.filename, row.session_id, row.location)
    return row
  }

  private transaction(work: () => void): void {
    this.db.exec('BEGIN')
    try {
      work()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}

export interface OutputRow {
  id: string
  node_id: string
  path: string
  title: string
  kind: string
  created_at: string
  filename: string
  session_id: string
  location: string
}

function ensureOutputColumns(db: DatabaseSync): void {
  const names = new Set((db.prepare('PRAGMA table_info(outputs)').all() as Array<{ name: string }>).map((column) => column.name))
  if (!names.has('filename')) db.exec("ALTER TABLE outputs ADD COLUMN filename TEXT NOT NULL DEFAULT ''")
  if (!names.has('session_id')) db.exec("ALTER TABLE outputs ADD COLUMN session_id TEXT NOT NULL DEFAULT ''")
  if (!names.has('location')) db.exec("ALTER TABLE outputs ADD COLUMN location TEXT NOT NULL DEFAULT 'file'")
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS outputs_node_path ON outputs(node_id, path)')
  } catch {
    // A legacy duplicate must not stop the database from opening.
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
