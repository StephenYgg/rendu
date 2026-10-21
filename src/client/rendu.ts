/**
 * Rendu client half. A graph page in the sidebar. It reads and writes through
 * the host API and never keeps the tree only in the browser.
 */
interface ReactNs {
  useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void]
  useEffect(effect: () => void | (() => void), deps?: unknown[]): void
  useCallback<T>(fn: T, deps?: unknown[]): T
  useRef<T>(initial: T): { current: T }
  createElement(type: unknown, props?: unknown, ...children: unknown[]): unknown
}
interface LocaleFace {
  subscribe(fn: () => void): () => void
  bind(ns: string): (key: string) => string
  register(ns: string, locale: string, dict: Record<string, string>): () => void
}
interface SlotCtx {
  effect(callback: () => void | (() => void), label?: string): void
  locale: LocaleFace
  slots: {
    inject(name: string, callback: () => () => void): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  uiWorkspace?: { openSession(sessionId: string): void }
}

const loader = (window as unknown as { __ModuleLoader__: { load(def: { id: string, factory(require: (id: string) => ReactNs): unknown }): void } }).__ModuleLoader__

loader.load({
  id: '@local/rendu',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL = 'rendu'
    const API = '/api/rendu'
    const STATUSES = ['backlog', 'doing', 'blocked', 'review', 'confirm', 'done', 'dropped']
    const COLOR: Record<string, string> = {
      backlog: 'var(--dsw-alias-state-idle-primary)',
      doing: 'var(--dsw-alias-brand-primary)',
      blocked: 'var(--dsw-alias-state-error-primary)',
      review: 'var(--dsw-alias-state-warn-primary)',
      confirm: 'var(--dsw-alias-state-warn-primary)',
      done: 'var(--dsw-alias-state-success-primary)',
      dropped: 'var(--dsw-alias-label-secondary)',
    }
    const ZH: Record<string, string> = {
      nav: '任督二脉',
      subtitle: '宗旨是任脉，拆下去的分支是督脉。Agent 开工前能看见整条链路。',
      newProject: '新建项目',
      sample: '载入示例',
      emptyTitle: '从一个宗旨开始',
      emptyBody: '每个项目只有一个主节点，就是核心宗旨。子节点都为了完成它而存在。',
      recommended: '建议拆四层：宗旨、目标、举措、任务。最多六层，再深图面就难读。',
      loading: '正在读取任督二脉…',
      retry: '重试',
      overview: '总览',
      hideOverview: '隐藏总览',
      showOverview: '显示总览',
      progress: '进度',
      evaluation: '评价',
      evaluationPlaceholder: '哪里顺、哪里卡住、下一步该改什么。',
      save: '保存',
      saved: '评价已保存',
      addChild: '添加子节点',
      addLeft: '在左侧添加',
      addRight: '在右侧添加',
      edit: '编辑',
      delete: '删除',
      deleteProject: '删除项目',
      cancel: '取消',
      create: '创建',
      close: '关闭',
      titleField: '标题',
      nameField: '项目名称',
      visionField: '核心宗旨',
      intentField: '要求',
      notesField: '笔记',
      dueField: '截止日期',
      clearDue: '清除截止日期',
      statusField: '状态',
      progressField: '手动进度',
      progressAuto: '留空则按状态估算；有子节点时以子节点汇总为准。',
      assign: '交给 Agent',
      dispatchExisting: '交给这个会话',
      dispatchNew: '新建会话并执行',
      noSessions: '还没有可选用的会话。可以直接新建一个来执行。',
      sessionRunning: '进行中',
      sessionBlank: '空白',
      dispatched: '已交给会话，关联已保留。',
      agentHint: 'Agent 会收到核心宗旨、上级要求、兄弟分支，以及这个节点已经关联的会话。',
      zoomIn: '放大',
      zoomOut: '缩小',
      fit: '适配',
      refresh: '刷新',
      panHint: '拖空白平移，滚轮缩放，拖卡片改位置，右键管理。',
      rootBadge: '宗旨',
      children: '子节点',
      ancestors: '链路',
      noSelection: '在图上点一个节点，或右键它。',
      alerts: '期限提醒',
      noAlerts: '近期没有到期节点。',
      dueSoon: '还剩 {n} 天',
      dueToday: '今天到期',
      overdue: '逾期 {n} 天',
      deleteRoot: '主节点是核心宗旨，不能删除。',
      cascadeHint: '会一并删除它下面的所有节点。',
      confirmDelete: '删除这个分支？',
      confirmDeleteProject: '删除这个项目和全部节点？',
      depthNow: '已用 {used} / {max} 级',
      verdict_empty: '还没往下拆',
      verdict_clear: '推进中',
      verdict_risk: '有期限风险',
      verdict_blocked: '有节点受阻',
      verdict_confirm: '待确认',
      verdict_confirm_detail: '工作已经做完，还等你确认。',
      verdict_done: '已完成',
      verdict_done_detail: '未放弃的叶子都完成了。',
      verdict_clear_detail: '没有受阻，也没有临期。',
      blockedCount: '{n} 个受阻',
      alertCount: '{n} 个期限提醒',
      status_backlog: '未开始',
      status_doing: '进行中',
      status_blocked: '受阻',
      status_review: '待验收',
      status_confirm: '完成待确认',
      status_done: '完成',
      confirmDone: '确认完成',
      confirmHint: '进度到 100% 后停在这里。你确认后才会变成完成；手工改状态可以直接标完成。',
      status_dropped: '放弃',
      level1: '宗旨',
      level2: '目标',
      level3: '举措',
      level4: '任务',
      levelN: '第 {n} 级',
      intentPlaceholder: '这一节点要为宗旨完成什么？',
      visionPlaceholder: '所有子节点都是为了完成这句话。',
      created: '项目已创建',
      exampleLoaded: '示例已载入。可以拖拽、右键，并看黄色临期和红色到期。',
      copyId: '复制编号',
      pickSession: '选择一个会话',
      sending: '正在交给 Agent…',
      ownStatus: '自身状态',
      childRollup: '子节点汇总',
      visionQuote: '核心宗旨',
      dismiss: '知道了',
      groupField: '会话分组',
      groupNone: '不分组',
      groupHint: '只作用于新建会话。选一个侧栏里的分组，新会话就会出现在那一组。',
      noGroups: '还没有分组。可以先在侧栏新建工作区，或选择不分组。',
      recentBadge: '最近',
      recentProjects: '最近项目',
      viewMore: '查看更多',
      manageTitle: '项目管理',
      manageHint: '最近更新的 5 个显示在总览里。这里管理全部项目。',
      back: '返回图',
      rename: '改名',
      select: '打开',
      linkedSessions: '关联会话',
      openSession: '打开对话',
      unlink: '取消关联',
      noLinks: '还没有关联会话。交给 Agent 之后，对话会留在这里。',
      confirmUnlink: '只取消关联，不删除对话。',
      nodeCount: '{n} 个节点',
      selectProject: '项目',
      editNode: '编辑节点',
      newNode: '新的子节点',
      newProjectTitle: '新项目',
      dueTitle: '设置截止日期',
      agentTitle: '交给 Agent',
      updated: '更新于',
    }
    const EN: Record<string, string> = {
      nav: 'Rendu',
      subtitle: 'The vision is one channel. The branches are the other. An Agent sees the whole circuit.',
      newProject: 'New project',
      sample: 'Load example',
      emptyTitle: 'Start from one vision',
      emptyBody: 'Each project has one root: the vision everything else exists to serve.',
      recommended: 'Four levels work best: vision, outcome, initiative, task. Six is the limit.',
      loading: 'Loading Rendu…',
      retry: 'Retry',
      overview: 'Overview',
      hideOverview: 'Hide overview',
      showOverview: 'Show overview',
      progress: 'Progress',
      evaluation: 'Review',
      evaluationPlaceholder: 'What is moving, what is stuck, and what should change.',
      save: 'Save',
      saved: 'Review saved',
      addChild: 'Add child',
      addLeft: 'Add on the left',
      addRight: 'Add on the right',
      edit: 'Edit',
      delete: 'Delete',
      deleteProject: 'Delete project',
      cancel: 'Cancel',
      create: 'Create',
      close: 'Close',
      titleField: 'Title',
      nameField: 'Project name',
      visionField: 'Core vision',
      intentField: 'Requirement',
      notesField: 'Notes',
      dueField: 'Deadline',
      clearDue: 'Clear deadline',
      statusField: 'Status',
      progressField: 'Manual progress',
      progressAuto: 'Leave empty to derive it. Children override a parent percentage.',
      assign: 'Hand to Agent',
      dispatchExisting: 'Send to this session',
      dispatchNew: 'New session and run',
      noSessions: 'No session to choose. Create one and run it.',
      sessionRunning: 'running',
      sessionBlank: 'blank',
      dispatched: 'Handed off. The conversation stays linked.',
      agentHint: 'The Agent receives the vision, the chain, the sibling branches, and sessions already linked to this node.',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      fit: 'Fit',
      refresh: 'Refresh',
      panHint: 'Drag empty space to pan, scroll to zoom, drag a card to move it, right-click to manage.',
      rootBadge: 'Vision',
      children: 'Children',
      ancestors: 'Chain',
      noSelection: 'Select a node, or right-click it.',
      alerts: 'Deadlines',
      noAlerts: 'Nothing is due soon.',
      dueSoon: '{n} days left',
      dueToday: 'Due today',
      overdue: '{n} days overdue',
      deleteRoot: 'The vision root cannot be deleted.',
      cascadeHint: 'Descendants are deleted with it.',
      confirmDelete: 'Delete this branch?',
      confirmDeleteProject: 'Delete this project and every node?',
      depthNow: '{used} / {max} levels used',
      verdict_empty: 'Not split yet',
      verdict_clear: 'Moving',
      verdict_risk: 'Deadline risk',
      verdict_blocked: 'Blocked',
      verdict_confirm: 'Awaiting confirmation',
      verdict_confirm_detail: 'The work is finished and waiting for you.',
      verdict_done: 'Complete',
      verdict_done_detail: 'Every active leaf is complete.',
      verdict_clear_detail: 'Nothing is blocked or close to a deadline.',
      blockedCount: '{n} blocked',
      alertCount: '{n} deadline reminders',
      status_backlog: 'Not started',
      status_doing: 'In progress',
      status_blocked: 'Blocked',
      status_review: 'In review',
      status_confirm: 'Done, awaiting confirmation',
      status_done: 'Done',
      confirmDone: 'Confirm done',
      confirmHint: '100% stops here. Confirm it to mark done. A manual status change can mark done directly.',
      status_dropped: 'Dropped',
      level1: 'Vision',
      level2: 'Outcome',
      level3: 'Initiative',
      level4: 'Task',
      levelN: 'Level {n}',
      intentPlaceholder: 'What must this node accomplish for the vision?',
      visionPlaceholder: 'Every child exists to make this true.',
      created: 'Project created',
      exampleLoaded: 'Example loaded. Drag, right-click, and check the yellow and red deadlines.',
      copyId: 'Copy id',
      pickSession: 'Choose a session',
      sending: 'Handing this to an Agent…',
      ownStatus: 'Own status',
      childRollup: 'Child rollup',
      visionQuote: 'Core vision',
      dismiss: 'Dismiss',
      groupField: 'Session group',
      groupNone: 'Ungrouped',
      groupHint: 'Applies only to a new session. Pick a sidebar group and the session appears there.',
      noGroups: 'No groups yet. Add a workspace in the sidebar, or leave this ungrouped.',
      recentBadge: 'Recent',
      recentProjects: 'Recent projects',
      viewMore: 'View more',
      manageTitle: 'Projects',
      manageHint: 'The five most recently updated projects stay in the overview. Manage all of them here.',
      back: 'Back to graph',
      rename: 'Rename',
      select: 'Open',
      linkedSessions: 'Linked sessions',
      openSession: 'Open conversation',
      unlink: 'Unlink',
      noLinks: 'No linked session yet. A handoff keeps the conversation here.',
      confirmUnlink: 'This only unlinks the conversation. It does not delete it.',
      nodeCount: '{n} nodes',
      selectProject: 'Project',
      editNode: 'Edit node',
      newNode: 'New child',
      newProjectTitle: 'New project',
      dueTitle: 'Set deadline',
      agentTitle: 'Hand to an Agent',
      updated: 'Updated',
    }
    const CSS = `
.rd-page{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit}
.rd-header{display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.rd-mark{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);flex:none}
.rd-title{font-size:15px;font-weight:600;line-height:1.2}
.rd-subtitle{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4;max-width:420px}
.rd-grow{flex:1}
.rd-row{display:flex;align-items:center;gap:8px;min-width:0}
.rd-button{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);min-height:32px;padding:0 10px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer}
.rd-button:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
.rd-button:disabled{opacity:.45;cursor:not-allowed}
.rd-button.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.rd-button.danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.rd-button:focus-visible,.rd-input:focus,.rd-textarea:focus,.rd-select:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.rd-select,.rd-input,.rd-textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px}
.rd-select{min-height:32px;max-width:220px}
.rd-textarea{width:100%;min-height:84px;resize:vertical;line-height:1.55}
.rd-input{width:100%}
.rd-body{flex:1;min-height:0;display:flex}
.rd-viewport{position:relative;flex:1;min-width:0;overflow:hidden;touch-action:none;cursor:grab;background:var(--dsw-alias-bg-base);background-image:radial-gradient(var(--dsw-alias-border-l1) 1px,transparent 1px);background-size:22px 22px}
.rd-viewport[data-panning=true]{cursor:grabbing}
.rd-world{position:absolute;left:0;top:0;transform-origin:0 0}
.rd-edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.rd-card{position:absolute;width:236px;box-sizing:border-box;padding:10px 12px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);cursor:grab;text-align:left;color:inherit;font:inherit}
.rd-card[data-selected=true]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.rd-card[data-due=soon]{border-color:var(--dsw-alias-state-warn-primary)}
.rd-card[data-due=due],.rd-card[data-due=overdue]{border-color:var(--dsw-alias-state-error-primary)}
.rd-card-top{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:4px}
.rd-kicker{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}
.rd-card strong{display:block;font-size:14px;line-height:1.35;font-weight:600}
.rd-intent{margin:4px 0 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rd-meta{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12px;margin-bottom:8px}
.rd-pill{display:inline-flex;align-items:center;gap:5px;min-width:0}
.rd-dot{display:inline-block;width:8px;height:8px;border-radius:99px;flex:none}
.rd-progress{font-variant-numeric:tabular-nums;font-weight:600}
.rd-due{font-size:11px;font-weight:650;white-space:nowrap}
.rd-due[data-due=soon]{color:var(--dsw-alias-state-warn-primary)}
.rd-due[data-due=due],.rd-due[data-due=overdue]{color:var(--dsw-alias-state-error-primary)}
.rd-mosaic{display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}
.rd-mosaic span{min-width:4px;height:100%}
.rd-mosaic-wide{height:12px;margin:8px 0 12px}
.rd-aside{width:352px;flex:none;overflow:auto;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);padding:16px 16px 28px}
.rd-aside h2{font-size:13px;margin:0 0 8px}
.rd-metric{font-size:28px;font-weight:650;letter-spacing:-.03em;line-height:1.1}
.rd-muted{color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.55}
.rd-quote{margin:10px 0;padding:8px 10px;border-left:3px solid var(--dsw-alias-brand-primary);font-size:13px;line-height:1.55}
.rd-section{margin-top:16px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}
.rd-counts{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:8px}
.rd-count{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rd-alert,.rd-project{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;padding:8px 6px;cursor:pointer}
.rd-project:hover{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}
.rd-project[data-active=true]{color:var(--dsw-alias-brand-primary);font-weight:650}
.rd-manage-page{flex:1;min-height:0;overflow:auto;padding:28px 32px 56px}
.rd-manage-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:22px}
.rd-manage-title{margin:4px 0 8px;font-size:28px;line-height:1.15;font-weight:650;letter-spacing:-.03em}
.rd-manage-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.rd-manage-card{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:18px;min-height:168px;transition:border-color .16s ease,transform .16s ease,background .16s ease}
.rd-manage-card:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));transform:translateY(-2px)}
.rd-manage-card h3{margin:0;font-size:18px;line-height:1.35;font-weight:650}
.rd-badge{align-self:flex-start;font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-brand-primary);border:1px solid var(--dsw-alias-brand-primary);border-radius:99px;padding:2px 8px}
.rd-bar{height:8px;border-radius:99px;overflow:hidden;background:var(--dsw-alias-bg-base)}
.rd-bar span{display:block;height:100%;background:var(--dsw-alias-brand-primary)}
.rd-manage-card .rd-actions{margin-top:auto}
@media(prefers-reduced-motion:reduce){.rd-manage-card{transform:none}}
.rd-more{display:inline-flex;margin-top:8px;border:0;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;letter-spacing:.04em;padding:2px 0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.rd-field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rd-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.rd-banner{margin:8px 14px 0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:13px;line-height:1.45}
.rd-banner.error{border-color:var(--dsw-alias-state-error-primary)}
.rd-banner.warn{border-color:var(--dsw-alias-state-warn-primary)}
.rd-empty{margin:auto;max-width:460px;padding:28px;text-align:left}
.rd-empty h2{margin:8px 0;font-size:22px}
.rd-hint{position:absolute;left:12px;bottom:12px;max-width:min(520px,calc(100% - 24px));padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.4;pointer-events:none}
.rd-overlay{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:color-mix(in srgb,var(--dsw-alias-bg-base) 28%,transparent);padding:20px}
.rd-dialog{width:min(460px,100%);max-height:calc(100% - 24px);overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);padding:16px}
.rd-manage{width:min(720px,100%);max-height:calc(100% - 24px)}
.rd-dialog h2{margin:0;font-size:16px}
.rd-dialog-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:12px}
.rd-menu-backdrop{position:absolute;inset:0;z-index:5}
.rd-menu{position:absolute;z-index:6;min-width:196px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay)}
.rd-menu button{display:flex;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;min-height:32px;padding:0 8px;border-radius:7px;cursor:pointer}
.rd-menu button:hover{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1))}
.rd-menu-label{padding:6px 8px 2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.rd-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12.5px;padding:0;cursor:pointer}
.rd-rail{width:36px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);display:flex;align-items:flex-start;justify-content:center;padding-top:12px}
.rd-rail button{writing-mode:vertical-rl;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
@media(max-width:860px){.rd-body{flex-direction:column}.rd-aside{width:auto;height:46%;border-left:0;border-top:1px solid var(--dsw-alias-border-l1)}}
`

    function text(translate: (key: string) => string, key: string, vars?: Record<string, string | number>) {
      let value = translate(key)
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) value = value.replaceAll(`{${name}}`, String(replacement))
      }
      return value
    }
    function clamp(value: number, min: number, max: number) {
      return Math.min(max, Math.max(min, value))
    }
    function depthLabel(translate: (key: string) => string, depth: number) {
      if (depth >= 1 && depth <= 4) return text(translate, `level${depth}`)
      return text(translate, 'levelN', { n: depth })
    }
    function dueText(translate: (key: string) => string, node: NodeView) {
      const due = node.rolled?.due
      if (!due || due.state === 'none' || due.state === 'ok') return ''
      if (due.state === 'soon') return text(translate, 'dueSoon', { n: due.offset ?? 0 })
      if (due.state === 'due') return text(translate, 'dueToday')
      return text(translate, 'overdue', { n: Math.abs(due.offset ?? 0) })
    }
    async function api(path: string, method: string, body?: unknown) {
      const response = await fetch(path ? `${API}/${path}` : API, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const raw = await response.text()
      let value: { error?: string } | null = null
      try { value = raw ? JSON.parse(raw) as { error?: string } : null } catch { value = { error: raw } }
      if (!response.ok) throw new Error(value?.error || `HTTP ${response.status}`)
      return value as Snapshot & { sessions?: SessionRow[], workspaces?: GroupRow[], snapshot?: Snapshot, result?: { rootId?: string, nodeId?: string, warning?: string } }
    }
    function PanelIcon(props: { size?: number, active?: boolean }) {
      const size = Number(props.size) || 24
      return h('span', {
        'aria-hidden': 'true',
        style: { display: 'grid', placeItems: 'center', width: size, height: size, color: props.active ? 'var(--dsw-alias-brand-primary)' : 'currentColor' },
      }, h('svg', { width: Math.round(size * 0.82), height: Math.round(size * 0.82), viewBox: '0 0 24 24', fill: 'none' },
        h('path', { d: 'M7 4v16M17 4v16', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
        h('path', { d: 'M7 12h10', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
        h('circle', { cx: 7, cy: 12, r: 1.6, fill: 'currentColor' }),
        h('circle', { cx: 17, cy: 12, r: 1.6, fill: 'currentColor' })))
    }

    function App(props: { locale: LocaleFace, translate: (key: string) => string, openSession: (sessionId: string) => void }) {
      const { locale, translate, openSession } = props
      const [revision, setRevision] = React.useState(0)
      const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [booting, setBooting] = React.useState(true)
      const [busy, setBusy] = React.useState(false)
      const [selectedId, setSelectedId] = React.useState<string | null>(null)
      const [menu, setMenu] = React.useState<{ nodeId: string, x: number, y: number } | null>(null)
      const [dialog, setDialog] = React.useState<DialogState | null>(null)
      const [sessions, setSessions] = React.useState<SessionRow[]>([])
      const [groups, setGroups] = React.useState<GroupRow[]>([])
      const [page, setPage] = React.useState<'board' | 'manage'>('board')
      const [view, setView] = React.useState({ panX: 48, panY: 36, zoom: 1 })
      const [draft, setDraft] = React.useState<{ id: string, x: number, y: number } | null>(null)
      const [panning, setPanning] = React.useState(false)
      const pageRef = React.useRef<HTMLElement | null>(null)
      const viewportRef = React.useRef<HTMLElement | null>(null)
      const epoch = React.useRef(0)
      const viewRef = React.useRef(view)
      const saveTimer = React.useRef(0)
      viewRef.current = view
      React.useEffect(() => locale.subscribe(() => setRevision((value) => value + 1)), [locale])
      const tr = (key: string, vars?: Record<string, string | number>) => text(translate, key, vars)
      void revision
      const active = snapshot?.active ?? null
      const nodes = active?.nodes ?? []
      const selected = nodes.find((node) => node.id === selectedId) ?? null
      const projectId = active?.project?.id
      const hidden = snapshot?.settings.overviewHidden === true

      const refresh = React.useCallback(async () => {
        const seen = epoch.current
        try {
          const value = await api('state', 'GET')
          if (seen !== epoch.current) return
          setSnapshot(value)
        } catch (err) {
          if (seen !== epoch.current) return
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (seen === epoch.current) setBooting(false)
        }
      }, [])
      React.useEffect(() => {
        const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 2500)
        void refresh()
        return () => window.clearInterval(timer)
      }, [refresh])
      React.useEffect(() => {
        if (!projectId) return
        const next = snapshot?.active?.project?.view
        if (next) setView(next)
        setMenu(null)
      }, [projectId])

      async function command(action: string, fields: Record<string, unknown> = {}) {
        setBusy(true)
        try {
          const value = await api('command', 'POST', { action, ...fields })
          epoch.current += 1
          if (value.snapshot) setSnapshot(value.snapshot)
          setError('')
          if (value.result?.warning) setNotice(value.result.warning)
          return value
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
          throw err
        } finally {
          setBusy(false)
        }
      }
      function scheduleSaveView() {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          const id = snapshot?.active?.project?.id
          if (!id) return
          void api('command', 'POST', { action: 'update_project', projectId: id, view: viewRef.current })
            .then((value) => { epoch.current += 1; if (value.snapshot) setSnapshot(value.snapshot) })
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        }, 450)
      }
      function positioned(node: NodeView) {
        return draft && draft.id === node.id ? { ...node, x: draft.x, y: draft.y } : node
      }
      function startDrag(node: NodeView, event: PointerEvent) {
        const origin = { x: event.clientX, y: event.clientY, nx: node.x, ny: node.y, moved: false }
        setSelectedId(node.id)
        function move(e: PointerEvent) {
          const dx = (e.clientX - origin.x) / viewRef.current.zoom
          const dy = (e.clientY - origin.y) / viewRef.current.zoom
          if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 4) origin.moved = true
          setDraft({ id: node.id, x: origin.nx + dx, y: origin.ny + dy })
        }
        function up(e: PointerEvent) {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          setDraft(null)
          if (!origin.moved) return
          void api('command', 'POST', {
            action: 'move_node',
            nodeId: node.id,
            x: origin.nx + (e.clientX - origin.x) / viewRef.current.zoom,
            y: origin.ny + (e.clientY - origin.y) / viewRef.current.zoom,
          }).then((value) => { epoch.current += 1; if (value.snapshot) setSnapshot(value.snapshot) })
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }
      function startPan(event: PointerEvent) {
        if (event.button !== 0 || (event.target as HTMLElement).closest('[data-node]')) return
        setMenu(null)
        setPanning(true)
        const origin = { x: event.clientX, y: event.clientY, panX: viewRef.current.panX, panY: viewRef.current.panY }
        function move(e: PointerEvent) {
          setView((current) => ({ ...current, panX: origin.panX + e.clientX - origin.x, panY: origin.panY + e.clientY - origin.y }))
        }
        function up() {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          setPanning(false)
          scheduleSaveView()
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }
      React.useEffect(() => {
        const node = viewportRef.current
        if (!node) return undefined
        const port = node
        function onWheel(event: WheelEvent) {
          event.preventDefault()
          const rect = port.getBoundingClientRect()
          const px = event.clientX - rect.left
          const py = event.clientY - rect.top
          setView((current) => {
            const nextZoom = clamp(current.zoom * (event.deltaY < 0 ? 1.08 : 0.92), 0.4, 1.8)
            const scale = nextZoom / current.zoom
            return { zoom: nextZoom, panX: px - (px - current.panX) * scale, panY: py - (py - current.panY) * scale }
          })
          scheduleSaveView()
        }
        port.addEventListener('wheel', onWheel, { passive: false })
        return () => port.removeEventListener('wheel', onWheel)
      }, [projectId])
      function fit() {
        const port = viewportRef.current
        if (!port || nodes.length === 0) return
        const minX = Math.min(...nodes.map((node) => node.x))
        const minY = Math.min(...nodes.map((node) => node.y))
        const maxX = Math.max(...nodes.map((node) => node.x + 236))
        const maxY = Math.max(...nodes.map((node) => node.y + 132))
        const zoom = clamp(Math.min((port.clientWidth - 72) / Math.max(1, maxX - minX), (port.clientHeight - 72) / Math.max(1, maxY - minY), 1), 0.4, 1.8)
        const next = { zoom, panX: (port.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom, panY: (port.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom }
        setView(next)
        viewRef.current = next
        scheduleSaveView()
      }
      async function openAgent(nodeId: string) {
        setMenu(null)
        setDialog({ type: 'agent', nodeId })
        const [sessionResult, groupResult] = await Promise.allSettled([api('sessions', 'GET'), api('workspaces', 'GET')])
        if (sessionResult.status === 'fulfilled') setSessions(sessionResult.value.sessions ?? [])
        else setError(sessionResult.reason instanceof Error ? sessionResult.reason.message : String(sessionResult.reason))
        if (groupResult.status === 'fulfilled') setGroups(groupResult.value.workspaces ?? [])
        else setError(groupResult.reason instanceof Error ? groupResult.reason.message : String(groupResult.reason))
      }
      async function dispatch(body: Record<string, unknown>) {
        setBusy(true)
        setNotice(tr('sending'))
        try {
          const value = await api('command', 'POST', { action: 'dispatch', ...body })
          epoch.current += 1
          if (value.snapshot) setSnapshot(value.snapshot)
          setError('')
          setNotice(tr('dispatched'))
          setDialog(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
          setNotice('')
        } finally {
          setBusy(false)
        }
      }

      const recent = snapshot?.recentProjects ?? snapshot?.projects.slice(0, 5) ?? []
      const world = nodes.reduce((box, node) => ({
        width: Math.max(box.width, positioned(node).x + 280),
        height: Math.max(box.height, positioned(node).y + 190),
      }), { width: 960, height: 640 })
      const byId = new Map(nodes.map((node) => [node.id, positioned(node)]))

      return h('div', { className: 'rd-page', ref: pageRef },
        h('style', null, CSS),
        h('header', { className: 'rd-header' },
          h('span', { className: 'rd-mark', 'aria-hidden': 'true' }, h(PanelIcon, { size: 22 })),
          h('div', { className: 'rd-row', style: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 } },
            h('div', { className: 'rd-title' }, tr('nav')),
            h('div', { className: 'rd-subtitle' }, tr('subtitle'))),
          h('div', { className: 'rd-grow' }),
          snapshot?.projects.length ? h('select', {
            className: 'rd-select',
            'aria-label': tr('selectProject'),
            value: projectId || '',
            onChange: (event: Event) => { void command('select_project', { projectId: (event.target as HTMLSelectElement).value }).catch(() => {}) },
          }, snapshot.projects.map((project) => h('option', { key: project.id, value: project.id }, `${project.title} · ${project.progressLabel}`))) : null,
          h('button', { className: 'rd-button', type: 'button', onClick: () => setDialog({ type: 'project' }) }, tr('newProject')),
          h('button', { className: 'rd-button', type: 'button', onClick: () => setPage('manage') }, tr('viewMore')),
          h('button', { className: 'rd-button', type: 'button', disabled: busy, onClick: () => { void command('set_overview', { hidden: !hidden }).catch(() => {}) } }, hidden ? tr('showOverview') : tr('hideOverview'))),
        error ? h('div', { className: 'rd-banner error', role: 'alert' }, error, ' ', h('button', { className: 'rd-link', type: 'button', onClick: () => setError('') }, tr('dismiss'))) : null,
        notice ? h('div', { className: 'rd-banner warn', role: 'status' }, notice, ' ', h('button', { className: 'rd-link', type: 'button', onClick: () => setNotice('') }, tr('dismiss'))) : null,
        !snapshot && booting ? h('div', { className: 'rd-empty' }, h('p', { className: 'rd-muted' }, tr('loading'))) : null,
        snapshot && !active && page === 'board' ? h('div', { className: 'rd-empty' },
          h('div', { className: 'rd-kicker' }, tr('rootBadge')),
          h('h2', null, tr('emptyTitle')),
          h('p', { className: 'rd-muted' }, tr('emptyBody')),
          h('p', { className: 'rd-muted' }, tr('recommended')),
          h('div', { className: 'rd-actions' },
            h('button', { className: 'rd-button primary', type: 'button', onClick: () => setDialog({ type: 'project' }) }, tr('newProject')),
            h('button', { className: 'rd-button', type: 'button', disabled: busy, onClick: () => { void command('create_sample', { activate: true }).then(() => setNotice(tr('exampleLoaded'))).catch(() => {}) } }, tr('sample')))) : null,
        page === 'manage' && snapshot ? h(ManagePage, {
          tr, snapshot, busy,
          onBack: () => setPage('board'),
          onSelect: (id: string) => { void command('select_project', { projectId: id }).then(() => setPage('board')).catch(() => {}) },
          onRename: (id: string, title: string) => setDialog({ type: 'rename-project', projectId: id, title }),
          onDelete: (id: string) => setDialog({ type: 'confirm-project', projectId: id }),
          onCreate: () => setDialog({ type: 'project' }),
        }) : null,
        page === 'board' && active ? h('div', { className: 'rd-body' },
          h('div', { className: 'rd-viewport', ref: viewportRef, 'data-panning': panning ? 'true' : 'false', onPointerDown: startPan },
            h('div', { className: 'rd-world', style: { width: world.width, height: world.height, transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` } },
              h('svg', { className: 'rd-edges', width: world.width, height: world.height },
                nodes.filter((node) => node.parentId && byId.has(node.parentId)).map((node) => {
                  const parent = byId.get(node.parentId as string)
                  const child = byId.get(node.id)
                  if (!parent || !child) return null
                  const hot = node.id === selectedId || parent.id === selectedId
                  return h('path', { key: node.id, d: edgePath(parent, child), fill: 'none', stroke: hot ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)', strokeWidth: hot ? 2 : 1.4 })
                })),
              nodes.map((node) => h(NodeCard, {
                key: node.id, node: positioned(node), selected: node.id === selectedId, tr,
                onPointerDown: (event: PointerEvent) => { if (event.button !== 0) return; event.stopPropagation(); startDrag(node, event) },
                onContextMenu: (event: MouseEvent) => {
                  event.preventDefault()
                  const rect = pageRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 800, height: 600 }
                  setSelectedId(node.id)
                  setMenu({ nodeId: node.id, x: clamp(event.clientX - rect.left, 8, Math.max(8, rect.width - 220)), y: clamp(event.clientY - rect.top, 8, Math.max(8, rect.height - 340)) })
                },
                onDoubleClick: (event: MouseEvent) => { event.stopPropagation(); setDialog({ type: 'edit', nodeId: node.id }) },
              }))),
            h('div', { className: 'rd-hint' }, tr('panHint')),
            h('div', { style: { position: 'absolute', right: 12, top: 12, display: 'flex', gap: 6 } },
              h('button', { className: 'rd-button', type: 'button', onClick: () => { setView((current) => ({ ...current, zoom: clamp(current.zoom * 1.1, 0.4, 1.8) })); scheduleSaveView() } }, tr('zoomIn')),
              h('button', { className: 'rd-button', type: 'button', onClick: () => { setView((current) => ({ ...current, zoom: clamp(current.zoom / 1.1, 0.4, 1.8) })); scheduleSaveView() } }, tr('zoomOut')),
              h('button', { className: 'rd-button', type: 'button', onClick: fit }, tr('fit')))),
          hidden ? h('div', { className: 'rd-rail' }, h('button', { type: 'button', onClick: () => { void command('set_overview', { hidden: false }).catch(() => {}) } }, tr('showOverview'))) : h(Aside, {
            tr, active, selected, recent, currentId: projectId || '', busy, openSession,
            onSelectProject: (id: string) => { void command('select_project', { projectId: id }).catch(() => {}) },
            onManage: () => setPage('manage'),
            onSelect: (id: string) => { setSelectedId(id); setMenu(null) },
            onEdit: () => selected && setDialog({ type: 'edit', nodeId: selected.id }),
            onAdd: (parentId: string, side: 'left' | 'right') => setDialog({ type: 'node', parentId, side }),
            onDelete: () => selected && setDialog({ type: 'confirm-node', nodeId: selected.id }),
            onAgent: () => selected && void openAgent(selected.id),
            onConfirm: () => selected && void command('set_status', { nodeId: selected.id, status: 'done' }).catch(() => {}),
            onUnlink: (linkId: string) => selected && setDialog({ type: 'confirm-unlink', nodeId: selected.id, linkId }),
            onSaveEvaluation: async (evaluation: string) => { await command('update_project', { projectId, evaluation }); setNotice(tr('saved')) },
          })) : null,
        menu ? h('div', { className: 'rd-menu-backdrop', onMouseDown: () => setMenu(null), onContextMenu: (event: MouseEvent) => { event.preventDefault(); setMenu(null) } },
          h(ContextMenu, { tr, menu, node: nodes.find((node) => node.id === menu.nodeId), onAction: (action: string) => {
            const node = nodes.find((item) => item.id === menu.nodeId)
            setMenu(null)
            if (!node) return
            if (action === 'add-left' || action === 'add-right') setDialog({ type: 'node', parentId: node.id, side: action === 'add-left' ? 'left' : 'right' })
            if (action === 'edit') setDialog({ type: 'edit', nodeId: node.id })
            if (action === 'due') setDialog({ type: 'due', nodeId: node.id, dueAt: node.dueAt || '' })
            if (action === 'agent') void openAgent(node.id)
            if (action === 'delete') setDialog({ type: 'confirm-node', nodeId: node.id })
            if (action.startsWith('status:')) void command('set_status', { nodeId: node.id, status: action.slice(7) }).catch(() => {})
          } })) : null,
        dialog ? h(Dialogs, {
          tr, dialog, nodes, sessions, groups, busy, onClose: () => setDialog(null),
          onCreateProject: async (fields: Record<string, string>) => {
            const value = await command('create_project', { ...fields, activate: true })
            setSelectedId(value.result?.rootId ?? null)
            setNotice(tr('created'))
            setPage('board')
            setDialog(null)
          },
          onCreateNode: async (fields: Record<string, string>) => {
            const value = await command('create_node', fields)
            setSelectedId(value.result?.nodeId ?? null)
            setDialog(null)
          },
          onUpdateNode: async (fields: Record<string, unknown>) => { await command('update_node', fields); setDialog(null) },
          onRenameProject: async (projectIdToRename: string, title: string) => { await command('update_project', { projectId: projectIdToRename, title }); setDialog(null) },
          onDeleteNode: async (nodeId: string) => { await command('delete_node', { nodeId }); setSelectedId(null); setDialog(null) },
          onDeleteProject: async (id?: string) => { await command('delete_project', { projectId: id || projectId }); setSelectedId(null); setDialog(null) },
          onUnlink: async (nodeId: string, linkId: string) => { await command('unlink_session', { nodeId, linkId }); setDialog(null) },
          onDispatch: dispatch,
        }) : null)
    }

    function NodeCard(props: { node: NodeView, selected: boolean, tr: Translate, onPointerDown: (event: PointerEvent) => void, onContextMenu: (event: MouseEvent) => void, onDoubleClick: (event: MouseEvent) => void }) {
      const { node, selected, tr } = props
      const due = node.rolled?.due?.state || 'none'
      const blocks = node.rolled?.childStatuses?.length ? node.rolled.childStatuses : [node.status]
      return h('article', {
        'data-node': node.id, 'data-selected': selected ? 'true' : 'false', 'data-due': due, className: 'rd-card',
        style: { left: node.x, top: node.y, zIndex: selected ? 2 : 1 },
        onPointerDown: props.onPointerDown, onContextMenu: props.onContextMenu, onDoubleClick: props.onDoubleClick,
      },
        h('div', { className: 'rd-card-top' }, h('span', { className: 'rd-kicker' }, depthLabel(tr, node.depth)), dueText(tr, node) ? h('span', { className: 'rd-due', 'data-due': due }, dueText(tr, node)) : null),
        h('strong', null, node.title),
        h('p', { className: 'rd-intent' }, node.intent || ' '),
        h('div', { className: 'rd-meta' },
          h('span', { className: 'rd-pill' }, h('i', { className: 'rd-dot', style: { background: COLOR[node.status] } }), tr(`status_${node.status}`)),
          h('span', { className: 'rd-progress' }, node.sessions.length ? `${node.rolled?.label || '0%'} · ${node.sessions.length}` : node.rolled?.label || '0%')),
        h('div', { className: 'rd-mosaic' }, blocks.map((status, index) => h('span', { key: `${status}-${index}`, style: { flex: 1, background: COLOR[status] || COLOR.backlog } }))))
    }

    function Aside(props: AsideProps) {
      const { tr, active, selected, recent, currentId, openSession } = props
      const overview = active.overview
      const root = active.nodes.find((node) => !node.parentId)
      const [evaluation, setEvaluation] = React.useState(active.project.evaluation || '')
      const dirty = React.useRef(false)
      React.useEffect(() => { dirty.current = false; setEvaluation(active.project.evaluation || '') }, [active.project.id])
      React.useEffect(() => { if (!dirty.current) setEvaluation(active.project.evaluation || '') }, [active.project.evaluation])
      const chain = selected ? ancestorsOf(active.nodes, selected) : []
      const children = selected ? active.nodes.filter((node) => node.parentId === selected.id) : []
      const detail = overview.verdict === 'done' ? tr('verdict_done_detail') : overview.verdict === 'confirm' ? tr('verdict_confirm_detail') : overview.verdict === 'empty' ? tr('recommended') : [overview.counts.blocked ? tr('blockedCount', { n: overview.counts.blocked }) : '', overview.alerts.length ? tr('alertCount', { n: overview.alerts.length }) : ''].filter(Boolean).join(' · ') || tr('verdict_clear_detail')
      return h('aside', { className: 'rd-aside' },
        h('div', { className: 'rd-kicker' }, tr('recentProjects')),
        recent.map((project) => h('button', {
          key: project.id, type: 'button', className: 'rd-project', 'data-active': project.id === currentId ? 'true' : 'false',
          onClick: () => props.onSelectProject(project.id),
        }, h('span', null, project.title), h('span', null, project.progressLabel))),
        h('button', { className: 'rd-more', type: 'button', onClick: props.onManage }, tr('viewMore')),
        h('div', { className: 'rd-section' },
          h('div', { className: 'rd-kicker' }, tr('overview')),
          h('div', { className: 'rd-metric' }, overview.label),
          h('div', { className: 'rd-muted' }, tr(`verdict_${overview.verdict}`), ' · ', detail),
          h('div', { className: 'rd-muted' }, tr('depthNow', { used: overview.depthUsed, max: 6 }), ' · ', tr('nodeCount', { n: overview.nodeCount })),
          h(Distribution, { counts: overview.counts, tr }),
          root ? h('div', { className: 'rd-quote' }, root.intent || root.title) : null),
        h('div', { className: 'rd-section' },
          h('h2', null, tr('alerts')),
          overview.alerts.length === 0 ? h('p', { className: 'rd-muted' }, tr('noAlerts')) : overview.alerts.map((alert) => h('button', {
            key: alert.nodeId, className: 'rd-alert', type: 'button', onClick: () => props.onSelect(alert.nodeId),
          }, h('span', null, alert.title), h('span', { className: 'rd-due', 'data-due': alert.state }, alert.state === 'soon' ? tr('dueSoon', { n: alert.offset ?? 0 }) : alert.state === 'due' ? tr('dueToday') : tr('overdue', { n: Math.abs(alert.offset ?? 0) }))))),
        h('div', { className: 'rd-section' },
          selected ? h('div', null,
            h('div', { className: 'rd-kicker' }, depthLabel(tr, selected.depth)),
            h('h2', { style: { fontSize: 16 } }, selected.title),
            selected.intent ? h('p', { className: 'rd-muted' }, selected.intent) : null,
            h('p', { className: 'rd-muted' }, `${tr('ownStatus')} · ${tr(`status_${selected.status}`)} · ${tr('childRollup')} ${selected.rolled?.label || ''}`),
            h('div', null, tr('ancestors'), ' ', chain.map((node, index) => h('button', { key: node.id, className: 'rd-link', type: 'button', onClick: () => props.onSelect(node.id) }, `${index ? ' / ' : ''}${node.title}`))),
            children.map((node) => h('button', { key: node.id, className: 'rd-alert', type: 'button', onClick: () => props.onSelect(node.id) }, h('span', null, node.title), h('span', null, node.rolled?.label))),
            h('div', { className: 'rd-kicker', style: { marginTop: 12 } }, tr('linkedSessions')),
            selected.sessions.length === 0 ? h('p', { className: 'rd-muted' }, tr('noLinks')) : selected.sessions.map((link) => h('div', { key: link.id, className: 'rd-alert' },
              h('span', null, link.label || link.sessionId.slice(0, 8)),
              h('span', null,
                h('button', { className: 'rd-link', type: 'button', onClick: () => openSession(link.sessionId) }, tr('openSession')),
                ' ',
                h('button', { className: 'rd-link', type: 'button', onClick: () => props.onUnlink(link.id) }, tr('unlink'))))),
            linkError(selected),
            selected.status === 'confirm' ? h('p', { className: 'rd-muted' }, tr('confirmHint')) : null,
            h('div', { className: 'rd-actions' },
              selected.status === 'confirm' ? h('button', { className: 'rd-button primary', type: 'button', onClick: props.onConfirm }, tr('confirmDone')) : null,
              h('button', { className: 'rd-button', type: 'button', onClick: props.onEdit }, tr('edit')),
              h('button', { className: 'rd-button', type: 'button', onClick: () => props.onAdd(selected.id, 'left') }, tr('addLeft')),
              h('button', { className: 'rd-button', type: 'button', onClick: () => props.onAdd(selected.id, 'right') }, tr('addRight')),
              h('button', { className: 'rd-button primary', type: 'button', onClick: props.onAgent }, tr('assign')),
              selected.parentId ? h('button', { className: 'rd-button danger', type: 'button', onClick: props.onDelete }, tr('delete')) : null)) : h('p', { className: 'rd-muted' }, tr('noSelection'))),
        h('div', { className: 'rd-section' },
          h('h2', null, tr('evaluation')),
          h('textarea', { className: 'rd-textarea', value: evaluation, placeholder: tr('evaluationPlaceholder'), onChange: (event: Event) => { dirty.current = true; setEvaluation((event.target as HTMLTextAreaElement).value) } }),
          h('div', { className: 'rd-actions' }, h('button', { className: 'rd-button', type: 'button', disabled: props.busy, onClick: () => { dirty.current = false; void props.onSaveEvaluation(evaluation).catch(() => {}) } }, tr('save')))))
    }
    function edgePath(parent: NodeView, child: NodeView) {
      const parentCenter = parent.x + 118
      const childCenter = child.x + 118
      const parentSide = Math.abs(childCenter - parent.x) < Math.abs(childCenter - (parent.x + 236)) ? 'left' : 'right'
      const childSide = Math.abs(parentCenter - child.x) <= Math.abs(parentCenter - (child.x + 236)) ? 'left' : 'right'
      const x1 = parentSide === 'left' ? parent.x : parent.x + 236
      const x2 = childSide === 'left' ? child.x : child.x + 236
      const y1 = parent.y + 64
      const y2 = child.y + 64
      const dir1 = parentSide === 'left' ? -1 : 1
      const dir2 = childSide === 'left' ? -1 : 1
      const bend = Math.max(36, Math.abs(x2 - x1) / 2)
      return `M ${x1} ${y1} C ${x1 + dir1 * bend} ${y1}, ${x2 + dir2 * bend} ${y2}, ${x2} ${y2}`
    }
    function linkError(node: NodeView) {
      const failed = node.sessions.find((link) => link.error)
      return failed ? h('p', { className: 'rd-muted' }, failed.error) : null
    }
    function Distribution(props: { counts: Record<string, number>, tr: Translate }) {
      const total = STATUSES.reduce((sum, status) => sum + (props.counts[status] || 0), 0)
      if (!total) return null
      return h('div', { className: 'rd-mosaic rd-mosaic-wide', 'aria-hidden': 'true' },
        STATUSES.filter((status) => props.counts[status]).map((status) => h('span', { key: status, style: { flex: props.counts[status], background: COLOR[status] } })))
    }
    function ancestorsOf(nodes: NodeView[], node: NodeView) {
      const chain = []
      const byId = new Map(nodes.map((item) => [item.id, item]))
      let cursor: NodeView | undefined = node
      const seen = new Set<string>()
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id)
        chain.push(cursor)
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
      }
      return chain.reverse()
    }
    function ManagePage(props: { tr: Translate, snapshot: Snapshot, busy: boolean, onBack: () => void, onSelect: (id: string) => void, onRename: (id: string, title: string) => void, onDelete: (id: string) => void, onCreate: () => void }) {
      const { tr, snapshot } = props
      return h('div', { className: 'rd-manage-page' },
        h('div', { className: 'rd-manage-head' },
          h('div', null,
            h('div', { className: 'rd-kicker' }, tr('nav')),
            h('h2', { className: 'rd-manage-title' }, tr('manageTitle')),
            h('p', { className: 'rd-muted' }, tr('manageHint'))),
          h('div', { className: 'rd-actions' },
            h('button', { className: 'rd-button', type: 'button', onClick: props.onBack }, tr('back')),
            h('button', { className: 'rd-button primary', type: 'button', onClick: props.onCreate }, tr('newProject')))),
        h('div', { className: 'rd-manage-grid' }, snapshot.projects.map((project, index) => h('article', { key: project.id, className: 'rd-manage-card' },
          index < 5 ? h('span', { className: 'rd-badge' }, tr('recentBadge')) : h('span', { className: 'rd-kicker' }, tr('updated')),
          h('h3', null, project.title),
          h('div', { className: 'rd-progress' }, project.progressLabel),
          h('div', { className: 'rd-bar', 'aria-hidden': 'true' }, h('span', { style: { width: `${project.progress ?? 0}%` } })),
          h('div', { className: 'rd-muted' }, project.updatedAt.slice(0, 10)),
          h('div', { className: 'rd-actions' },
            h('button', { className: 'rd-button primary', type: 'button', onClick: () => props.onSelect(project.id) }, tr('select')),
            h('button', { className: 'rd-button', type: 'button', onClick: () => props.onRename(project.id, project.title) }, tr('rename')),
            h('button', { className: 'rd-button danger', type: 'button', onClick: () => props.onDelete(project.id) }, tr('delete')))))))
    }
    function ContextMenu(props: { tr: Translate, menu: { x: number, y: number }, node?: NodeView, onAction: (action: string) => void }) {
      const node = props.node
      if (!node) return null
      return h('div', { className: 'rd-menu', role: 'menu', style: { left: props.menu.x, top: props.menu.y }, onMouseDown: (event: MouseEvent) => event.stopPropagation() },
        h('button', { type: 'button', onClick: () => props.onAction('add-left') }, props.tr('addLeft')),
        h('button', { type: 'button', onClick: () => props.onAction('add-right') }, props.tr('addRight')),
        h('button', { type: 'button', onClick: () => props.onAction('edit') }, props.tr('edit')),
        h('button', { type: 'button', onClick: () => props.onAction('due') }, props.tr('dueField')),
        h('button', { type: 'button', onClick: () => props.onAction('agent') }, props.tr('assign')),
        h('div', { className: 'rd-menu-label' }, props.tr('statusField')),
        STATUSES.map((status) => h('button', { type: 'button', key: status, onClick: () => props.onAction(`status:${status}`) }, props.tr(`status_${status}`))),
        node.parentId ? h('button', { type: 'button', onClick: () => props.onAction('delete') }, props.tr('delete')) : h('div', { className: 'rd-menu-label' }, props.tr('deleteRoot')))
    }
    function Dialogs(props: DialogProps) {
      const { tr, dialog, nodes, onClose } = props
      const node = nodes.find((item) => item.id === dialog.nodeId)
      if (dialog.type === 'project') return h(FormDialog, { tr, title: tr('newProjectTitle'), onClose, busy: props.busy, submitLabel: tr('create'), fields: [['title', tr('nameField'), 'input', ''], ['vision', tr('visionField'), 'textarea', '']], onSubmit: (fields: Record<string, string>) => props.onCreateProject(fields) })
      if (dialog.type === 'rename-project') return h(FormDialog, { tr, title: tr('rename'), onClose, busy: props.busy, fields: [['title', tr('nameField'), 'input', dialog.title || '']], onSubmit: (fields: Record<string, string>) => props.onRenameProject(dialog.projectId || '', fields.title || '') })
      if (dialog.type === 'node') return h(FormDialog, { tr, title: dialog.side === 'left' ? tr('addLeft') : tr('addRight'), onClose, busy: props.busy, submitLabel: tr('create'), fields: [['title', tr('titleField'), 'input', ''], ['intent', tr('intentField'), 'textarea', '']], onSubmit: (fields: Record<string, string>) => props.onCreateNode({ ...fields, parentId: dialog.parentId || '', side: dialog.side || 'right' }) })
      if (dialog.type === 'edit' && node) return h(FormDialog, { tr, title: tr('editNode'), onClose, busy: props.busy, fields: [['title', tr('titleField'), 'input', node.title], ['intent', tr('intentField'), 'textarea', node.intent], ['status', tr('statusField'), 'status', node.status], ['progress', tr('progressField'), 'number', node.progress ?? ''], ['dueAt', tr('dueField'), 'date', node.dueAt || ''], ['notes', tr('notesField'), 'textarea', node.notes]], onSubmit: (fields: Record<string, string>) => props.onUpdateNode({ nodeId: node.id, title: fields.title, intent: fields.intent, status: fields.status, progress: fields.progress === '' ? null : Number(fields.progress), dueAt: fields.dueAt || null, notes: fields.notes }) })
      if (dialog.type === 'due' && node) return h(FormDialog, { tr, title: tr('dueTitle'), onClose, busy: props.busy, fields: [['dueAt', tr('dueField'), 'date', dialog.dueAt || '']], extra: h('button', { className: 'rd-button', type: 'button', onClick: () => { void props.onUpdateNode({ nodeId: node.id, dueAt: null }).catch(() => {}) } }, tr('clearDue')), onSubmit: (fields: Record<string, string>) => props.onUpdateNode({ nodeId: node.id, dueAt: fields.dueAt || null }) })
      if (dialog.type === 'confirm-node') return h(ConfirmDialog, { tr, title: tr('confirmDelete'), body: tr('cascadeHint'), busy: props.busy, onClose, onConfirm: () => props.onDeleteNode(dialog.nodeId || '') })
      if (dialog.type === 'confirm-project') return h(ConfirmDialog, { tr, title: tr('confirmDeleteProject'), body: tr('cascadeHint'), busy: props.busy, onClose, onConfirm: () => props.onDeleteProject(dialog.projectId) })
      if (dialog.type === 'confirm-unlink') return h(ConfirmDialog, { tr, title: tr('unlink'), body: tr('confirmUnlink'), busy: props.busy, onClose, onConfirm: () => props.onUnlink(dialog.nodeId || '', dialog.linkId || '') })
      if (dialog.type === 'agent') return h(AgentDialog, { tr, sessions: props.sessions, groups: props.groups, busy: props.busy, onClose, onDispatch: (body: Record<string, unknown>) => props.onDispatch({ nodeId: dialog.nodeId, ...body }) })
      return null
    }
    function FormDialog(props: { tr: Translate, title: string, fields: string[][], onClose: () => void, onSubmit: (fields: Record<string, string>) => Promise<unknown>, busy: boolean, extra?: unknown, submitLabel?: string }) {
      const initial: Record<string, string> = {}
      for (const field of props.fields) initial[field[0] ?? ''] = field[3] ?? ''
      const [values, setValues] = React.useState(initial)
      return h(Shell, { tr: props.tr, title: props.title, onClose: props.onClose },
        h('form', { onSubmit: (event: Event) => { event.preventDefault(); void props.onSubmit(values).catch(() => {}) } },
          props.fields.map((field) => {
            const name = field[0] ?? ''
            const label = field[1] ?? ''
            const kind = field[2] ?? 'input'
            return h('label', { className: 'rd-field', key: name }, label,
              kind === 'textarea' ? h('textarea', { className: 'rd-textarea', value: values[name] ?? '', required: name === 'vision', onChange: (event: Event) => setValues({ ...values, [name]: (event.target as HTMLTextAreaElement).value }) }) : null,
              kind === 'input' ? h('input', { className: 'rd-input', value: values[name] ?? '', required: name === 'title', onChange: (event: Event) => setValues({ ...values, [name]: (event.target as HTMLInputElement).value }) }) : null,
              kind === 'date' ? h('input', { className: 'rd-input', type: 'date', value: values[name] ?? '', onChange: (event: Event) => setValues({ ...values, [name]: (event.target as HTMLInputElement).value }) }) : null,
              kind === 'number' ? h('input', { className: 'rd-input', type: 'number', min: 0, max: 100, value: values[name] ?? '', onChange: (event: Event) => setValues({ ...values, [name]: (event.target as HTMLInputElement).value }) }) : null,
              kind === 'status' ? h('select', { className: 'rd-select', style: { maxWidth: '100%' }, value: values[name] ?? 'backlog', onChange: (event: Event) => setValues({ ...values, [name]: (event.target as HTMLSelectElement).value }) }, STATUSES.map((status) => h('option', { key: status, value: status }, props.tr(`status_${status}`)))) : null)
          }),
          props.extra || null,
          h('div', { className: 'rd-actions' },
            h('button', { className: 'rd-button primary', type: 'submit', disabled: props.busy }, props.submitLabel || props.tr('save')),
            h('button', { className: 'rd-button', type: 'button', onClick: props.onClose }, props.tr('cancel')))))
    }
    function ConfirmDialog(props: { tr: Translate, title: string, body: string, onClose: () => void, onConfirm: () => Promise<unknown>, busy: boolean }) {
      return h(Shell, { tr: props.tr, title: props.title, onClose: props.onClose },
        h('p', { className: 'rd-muted' }, props.body),
        h('div', { className: 'rd-actions' },
          h('button', { className: 'rd-button danger', type: 'button', disabled: props.busy, onClick: () => { void props.onConfirm().catch(() => {}) } }, props.tr('delete')),
          h('button', { className: 'rd-button', type: 'button', onClick: props.onClose }, props.tr('cancel'))))
    }
    function AgentDialog(props: { tr: Translate, sessions: SessionRow[], groups: GroupRow[], busy: boolean, onClose: () => void, onDispatch: (body: Record<string, unknown>) => void }) {
      const { tr, sessions, groups, busy } = props
      const [sessionId, setSessionId] = React.useState(sessions[0]?.sessionId || '')
      const [workspaceId, setWorkspaceId] = React.useState('')
      React.useEffect(() => { if (!sessionId && sessions[0]) setSessionId(sessions[0].sessionId) }, [sessions, sessionId])
      const chosen = groups.find((group) => group.id === workspaceId)
      return h(Shell, { tr, title: tr('agentTitle'), onClose: props.onClose },
        h('p', { className: 'rd-muted' }, tr('agentHint')),
        sessions.length ? h('label', { className: 'rd-field' }, tr('pickSession'),
          h('select', { className: 'rd-select', style: { maxWidth: '100%' }, value: sessionId, onChange: (event: Event) => setSessionId((event.target as HTMLSelectElement).value) },
            sessions.map((session) => h('option', { key: session.sessionId, value: session.sessionId }, session.title)))) : h('p', { className: 'rd-muted' }, tr('noSessions')),
        h('div', { className: 'rd-actions' }, h('button', { className: 'rd-button primary', type: 'button', disabled: busy || !sessionId, onClick: () => props.onDispatch({ sessionId, label: sessions.find((item) => item.sessionId === sessionId)?.title || '' }) }, tr('dispatchExisting'))),
        h('div', { className: 'rd-section' },
          h('label', { className: 'rd-field' }, tr('groupField'),
            h('select', { className: 'rd-select', style: { maxWidth: '100%' }, value: workspaceId, onChange: (event: Event) => setWorkspaceId((event.target as HTMLSelectElement).value) },
              h('option', { value: '' }, tr('groupNone')),
              groups.map((group) => h('option', { key: group.id, value: group.id }, group.title)))),
          h('p', { className: 'rd-muted' }, chosen?.path || tr('groupHint')),
          h('div', { className: 'rd-actions' },
            h('button', { className: 'rd-button', type: 'button', disabled: busy, onClick: () => props.onDispatch({ create: true, workspaceId, label: chosen?.title || '' }) }, tr('dispatchNew')),
            h('button', { className: 'rd-button', type: 'button', onClick: props.onClose }, tr('cancel')))))
    }
    function Shell(props: { tr: Translate, title: string, onClose: () => void, children?: unknown }) {
      React.useEffect(() => {
        function onKey(event: KeyboardEvent) { if (event.key === 'Escape') props.onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [props.onClose])
      return h('div', { className: 'rd-overlay', onMouseDown: (event: MouseEvent) => { if (event.target === event.currentTarget) props.onClose() } },
        h('div', { className: 'rd-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title },
          h('div', { className: 'rd-dialog-head' }, h('h2', null, props.title), h('button', { className: 'rd-button', type: 'button', onClick: props.onClose }, props.tr('close'))),
          props.children))
    }

    return {
      inject: ['slots', 'locale', 'uiWorkspace'],
      apply(ctx: SlotCtx) {
        const translate = ctx.locale.bind('rendu')
        ctx.effect(() => {
          const disposeZh = ctx.locale.register('rendu', 'zh', ZH)
          const disposeEn = ctx.locale.register('rendu', 'en', EN)
          return () => { disposeZh(); disposeEn() }
        }, 'rendu: locale')
        const openSession = (sessionId: string) => ctx.uiWorkspace?.openSession(sessionId)
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, () => h(App, { locale: ctx.locale, translate, openSession })))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL, order: 18, label: () => translate('nav'),
        }, PanelIcon))
      },
    }
  },
})

type Translate = (key: string, vars?: Record<string, string | number>) => string
interface SessionLink { id: string, sessionId: string, label: string, error: string, createdAt: string }
interface NodeView {
  id: string
  parentId: string | null
  title: string
  intent: string
  status: string
  progress: number | null
  dueAt: string | null
  notes: string
  x: number
  y: number
  depth: number
  sessions: SessionLink[]
  rolled?: { label: string, due?: { state: string, offset: number | null }, childStatuses: string[] }
}
interface ProjectRow { id: string, title: string, progress?: number, progressLabel: string, updatedAt: string }
interface Snapshot {
  settings: { overviewHidden: boolean, activeProjectId: string | null }
  projects: ProjectRow[]
  recentProjects?: ProjectRow[]
  active: {
    project: { id: string, title: string, evaluation: string, view: { panX: number, panY: number, zoom: number } }
    nodes: NodeView[]
    overview: { label: string, verdict: string, depthUsed: number, nodeCount: number, counts: Record<string, number>, alerts: Array<{ nodeId: string, title: string, state: string, offset: number | null }> }
  } | null
}
interface SessionRow { sessionId: string, title: string }
interface GroupRow { id: string, title: string, path: string }
interface DialogState { type: string, nodeId?: string, parentId?: string, side?: 'left' | 'right', dueAt?: string, projectId?: string, title?: string, linkId?: string }
interface AsideProps {
  tr: Translate
  active: NonNullable<Snapshot['active']>
  selected: NodeView | null
  recent: ProjectRow[]
  currentId: string
  busy: boolean
  openSession: (sessionId: string) => void
  onSelectProject: (id: string) => void
  onManage: () => void
  onSelect: (id: string) => void
  onEdit: () => void
  onAdd: (parentId: string, side: 'left' | 'right') => void
  onDelete: () => void
  onConfirm: () => void
  onAgent: () => void
  onUnlink: (linkId: string) => void
  onSaveEvaluation: (evaluation: string) => Promise<void>
}
interface DialogProps {
  tr: Translate
  dialog: DialogState
  nodes: NodeView[]
  sessions: SessionRow[]
  groups: GroupRow[]
  busy: boolean
  onClose: () => void
  onCreateProject: (fields: Record<string, string>) => Promise<void>
  onCreateNode: (fields: Record<string, string>) => Promise<void>
  onUpdateNode: (fields: Record<string, unknown>) => Promise<void>
  onRenameProject: (projectId: string, title: string) => Promise<void>
  onDeleteNode: (nodeId: string) => Promise<void>
  onDeleteProject: (projectId?: string) => Promise<void>
  onUnlink: (nodeId: string, linkId: string) => Promise<void>
  onDispatch: (body: Record<string, unknown>) => void
}
