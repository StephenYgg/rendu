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
const tidy = reduce(leftNode.state, { action: 'layout', mode: 'tidy' }, now)
const tidyRoot = tidy.state.nodes[rootId]
const tidyLeft = tidy.state.nodes[leftNode.result.nodeId]
assert.ok(tidyLeft.x + 236 <= tidyRoot.x, 'tidy keeps a left branch on the left')
assert.equal(cardsOverlap(tidy.state), false)
const overlapped = reduce(leftNode.state, { action: 'move_node', nodeId: leftNode.result.nodeId, x: leftNode.state.nodes[rootId].x, y: leftNode.state.nodes[rootId].y }, now)
assert.equal(cardsOverlap(reduce(overlapped.state, { action: 'layout', mode: 'tidy' }, now).state), false)
const flowed = reduce(overlapped.state, { action: 'layout', mode: 'right' }, now)
assert.ok(flowed.state.nodes[leftNode.result.nodeId].x > flowed.state.nodes[rootId].x)
const down = reduce(overlapped.state, { action: 'layout', mode: 'down' }, now)
assert.ok(down.state.nodes[leftNode.result.nodeId].y > down.state.nodes[rootId].y)
assert.equal(cardsOverlap(down.state), false)
const withGrand = reduce(leftNode.state, { action: 'create_node', parentId: leftNode.result.nodeId, title: '外圈' }, now)
const radial = reduce(withGrand.state, { action: 'layout', mode: 'radial' }, now)
assert.equal(cardsOverlap(radial.state), false)
const ringRoot = radial.state.nodes[rootId]
const ringChild = radial.state.nodes[leftNode.result.nodeId]
assert.ok(Math.hypot((ringChild.x + 118) - (ringRoot.x + 118), (ringChild.y + 74) - (ringRoot.y + 74)) > 240)
const refresh = reduce(state, { action: 'set_refresh', idleSeconds: 45, runningSeconds: 1 }, now)
assert.equal(refresh.state.settings.idleRefreshSeconds, 45)
assert.equal(refresh.state.settings.runningRefreshSeconds, 5)
const hidden = reduce(refresh.state, { action: 'set_overview', hidden: true }, now)
assert.equal(hidden.state.settings.overviewHidden, true)
const sample = snapshot(reduce(emptyState(), { action: 'create_sample' }, now).state, now)
assert.equal(sample.recentProjects.length <= 5, true)
assert.equal(sample.active.overview.alerts.some((alert) => alert.state === 'overdue'), true)
console.log('rendu model ok')

function cardsOverlap(state) {
  const cards = Object.values(state.nodes)
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const a = cards[i]
      const b = cards[j]
      if (a.x < b.x + 236 && a.x + 236 > b.x && a.y < b.y + 148 && a.y + 148 > b.y) return true
    }
  }
  return false
}
