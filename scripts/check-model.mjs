import assert from 'node:assert/strict'
import { addDays, brief, calendarDay, emptyState, reduce, rollup, snapshot } from '../lib/model.js'

const now = new Date('2026-10-21T12:00:00+08:00')
const today = calendarDay(now)
let state = emptyState()
const created = reduce(state, { action: 'create_project', title: '出海', vision: '让产品被对的人用上', activate: true }, now)
state = created.state
const rootId = created.result.rootId
const left = reduce(state, { action: 'create_node', parentId: rootId, title: '找到用户', intent: '先证明有人需要' }, now)
state = left.state
const right = reduce(state, { action: 'create_node', parentId: rootId, title: '做出入口', intent: '一条能被访问的路径' }, now)
state = right.state
state = reduce(state, { action: 'set_status', nodeId: left.result.nodeId, status: 'done' }, now).state
const view = snapshot(state, now)
const root = view.active.nodes.find((node) => node.id === rootId)
assert.equal(root.rolled.label, '1/2 50%')
state = reduce(state, { action: 'link_session', nodeId: left.result.nodeId, sessionId: 'session-a', label: '甲' }, now).state
state = reduce(state, { action: 'link_session', nodeId: left.result.nodeId, sessionId: 'session-b', label: '乙' }, now).state
assert.equal(state.nodes[left.result.nodeId].sessions.length, 2)
state = reduce(state, { action: 'link_session', nodeId: left.result.nodeId, sessionId: 'session-a', label: '甲二' }, now).state
assert.equal(state.nodes[left.result.nodeId].sessions.length, 2)
assert.match(brief(state, right.result.nodeId, now), /核心宗旨：出海/)
assert.equal(rollup(state, left.result.nodeId, addDays(today, 0)).due.state, 'none')
const due = reduce(state, { action: 'update_node', nodeId: left.result.nodeId, dueAt: today }, now)
assert.equal(rollup(due.state, left.result.nodeId, today).due.state, 'due')
const agentDone = reduce(state, { action: 'set_status', nodeId: right.result.nodeId, status: 'done', source: 'agent' }, now)
assert.equal(agentDone.state.nodes[right.result.nodeId].status, 'confirm')
const agentProgress = reduce(state, { action: 'update_node', nodeId: right.result.nodeId, progress: 100, source: 'agent' }, now)
assert.equal(agentProgress.state.nodes[right.result.nodeId].status, 'confirm')
const humanDone = reduce(agentProgress.state, { action: 'set_status', nodeId: right.result.nodeId, status: 'done' }, now)
assert.equal(humanDone.state.nodes[right.result.nodeId].status, 'done')
const leftNode = reduce(state, { action: 'create_node', parentId: rootId, title: '左侧', side: 'left' }, now)
assert.ok(leftNode.state.nodes[leftNode.result.nodeId].x < state.nodes[rootId].x)
const hidden = reduce(state, { action: 'set_overview', hidden: true }, now)
assert.equal(hidden.state.settings.overviewHidden, true)
const sample = snapshot(reduce(emptyState(), { action: 'create_sample' }, now).state, now)
assert.equal(sample.recentProjects.length <= 5, true)
assert.equal(sample.active.overview.alerts.some((alert) => alert.state === 'overdue'), true)
console.log('rendu model ok')
