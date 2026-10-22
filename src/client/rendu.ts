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
    const CARD_W = 236
    const CARD_H = 148
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
      panHint: '拖空白或滚轮平移，按住 ⌘/Ctrl 再滚轮才缩放。',
      headerGesture: '拖动移动窗口，双击放大或还原',
      settings: '刷新设置',
      idleRefresh: '空闲间隔（秒）',
      runningRefresh: 'Agent 运行中间隔（秒）',
      refreshHint: '切到别的面板后停止刷新，重新打开时立刻刷新一次。产出在会话写出时写入数据库，不再定时扫描。',
      layout: '整理布局',
      layoutTidy: '一键整理',
      layoutTidyHint: '保持现在的左右，拉开重叠',
      layoutRight: '向右展开',
      layoutDown: '向下展开',
      layoutRadial: '环形展开',
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
      outputs: '产出文档',
      outputsEmpty: '还没有登记的本地文档或 HTML 地址。',
      outputsLoading: '正在查找产出…',
      viewDoc: '查看',
      maximize: '放到最大',
      restore: '还原',
      kind_html: 'HTML',
      kind_markdown: 'Markdown',
      kind_csv: 'CSV',
      outputTruncated: '文件较大，只显示前面一部分。',
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
      panHint: 'Drag empty space or scroll to pan. Hold ⌘ or Ctrl and scroll to zoom.',
      headerGesture: 'Drag to move the window. Double-click to zoom or restore.',
      settings: 'Refresh settings',
      idleRefresh: 'Idle interval (seconds)',
      runningRefresh: 'Interval while an Agent is running',
      refreshHint: 'Refresh stops while another panel is open, and runs once when this panel returns. Outputs are saved when a session writes them.',
      layout: 'Tidy layout',
      layoutTidy: 'Tidy in place',
      layoutTidyHint: 'Keep the current sides and separate overlaps',
      layoutRight: 'Flow to the right',
      layoutDown: 'Flow downward',
      layoutRadial: 'Spread in a ring',
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
      outputs: 'Outputs',
      outputsEmpty: 'No local document or HTML address has been saved yet.',
      outputsLoading: 'Looking for outputs…',
      viewDoc: 'View',
      maximize: 'Maximize',
      restore: 'Restore',
      kind_html: 'HTML',
      kind_markdown: 'Markdown',
      kind_csv: 'CSV',
      outputTruncated: 'The file is large. Only the first part is shown.',
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
.rd-header{display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);-webkit-app-region:drag;app-region:drag;user-select:none}
.rd-header button,.rd-header select,.rd-header input,.rd-header a{-webkit-app-region:no-drag;app-region:no-drag}
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
.rd-button:focus-visible,.rd-icon-button:focus-visible,.rd-input:focus,.rd-textarea:focus,.rd-select:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.rd-icon-button{width:32px;padding:0;display:inline-grid;place-items:center;color:var(--dsw-alias-label-secondary)}
.rd-icon-button:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.rd-select,.rd-input,.rd-textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px}
.rd-select{min-height:32px;max-width:220px}
.rd-textarea{width:100%;min-height:84px;resize:vertical;line-height:1.55}
.rd-input{width:100%}
.rd-body{flex:1;min-height:0;display:flex}
.rd-viewport{position:relative;flex:1;min-width:0;overflow:hidden;touch-action:none;cursor:grab;background:var(--dsw-alias-bg-base);background-image:radial-gradient(var(--dsw-alias-border-l1) 1px,transparent 1px);background-size:22px 22px}
.rd-viewport[data-panning=true]{cursor:grabbing}
.rd-world{position:absolute;left:0;top:0;transform-origin:0 0}
.rd-edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.rd-flow{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:2.6;stroke-linecap:round;stroke-dasharray:1.5 13;animation:rd-flow .85s linear infinite}
@keyframes rd-flow{to{stroke-dashoffset:-29}}
.rd-card{position:absolute;width:236px;height:148px;box-sizing:border-box;padding:10px 12px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);cursor:grab;text-align:left;color:inherit;font:inherit;overflow:hidden}
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
@media(prefers-reduced-motion:reduce){.rd-manage-card{transform:none}.rd-flow{animation:none;stroke-dasharray:none}}
.rd-more{display:inline-flex;margin-top:8px;border:0;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;letter-spacing:.04em;padding:2px 0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.rd-field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.rd-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.rd-banner{margin:8px 14px 0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:13px;line-height:1.45}
.rd-banner.error{border-color:var(--dsw-alias-state-error-primary)}
.rd-banner.warn{border-color:var(--dsw-alias-state-warn-primary)}
.rd-empty{margin:auto;max-width:460px;padding:28px;text-align:left}
.rd-empty h2{margin:8px 0;font-size:22px}
.rd-hint{position:absolute;left:12px;bottom:12px;max-width:min(520px,calc(100% - 24px));padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.4;pointer-events:none}
.rd-overlay{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:color-mix(in srgb,var(--dsw-alias-bg-base) 62%,transparent);padding:20px}
.rd-dialog{width:min(460px,100%);max-height:calc(100% - 24px);overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-top:2px solid var(--dsw-alias-brand-primary);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 72%,var(--dsw-alias-bg-base));padding:16px;box-shadow:0 24px 64px color-mix(in srgb,var(--dsw-alias-bg-base) 72%,transparent)}
.rd-dialog .rd-input,.rd-dialog .rd-textarea,.rd-dialog .rd-select{background:var(--dsw-alias-bg-base)}
.rd-dialog .rd-button:not(.primary){background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}
.rd-dialog.max{width:calc(100% - 24px);height:calc(100% - 24px);max-height:none;display:flex;flex-direction:column}
.rd-fold{display:flex;justify-content:space-between;align-items:center;width:100%;border:0;background:transparent;color:inherit;font:inherit;padding:8px 0;cursor:pointer}
.rd-fold:hover{color:var(--dsw-alias-brand-primary)}
.rd-preview{flex:1;min-height:240px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base)}
.rd-preview iframe{width:100%;height:100%;min-height:420px;border:0;background:var(--dsw-alias-bg-base)}
.rd-dialog.max .rd-preview,.rd-dialog.max .rd-preview iframe{min-height:0;height:100%}
.rd-md{padding:16px 18px;line-height:1.65;font-size:14px}
.rd-md h3{margin:14px 0 6px;font-size:16px}
.rd-md pre{overflow:auto;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;white-space:pre-wrap}
.rd-table{width:100%;border-collapse:collapse;font-size:13px}
.rd-table th,.rd-table td{border:1px solid var(--dsw-alias-border-l1);padding:6px 8px;text-align:left;vertical-align:top}
.rd-table th{background:var(--dsw-alias-bg-layer-1)}
.rd-manage{width:min(720px,100%);max-height:calc(100% - 24px)}
.rd-dialog h2{margin:0;font-size:16px}
.rd-dialog-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:12px}
.rd-menu-backdrop{position:absolute;inset:0;z-index:5}
.rd-menu{position:absolute;z-index:6;min-width:196px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 76%,var(--dsw-alias-bg-base));box-shadow:0 16px 40px color-mix(in srgb,var(--dsw-alias-bg-base) 68%,transparent)}
.rd-menu button{display:flex;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;min-height:32px;padding:0 8px;border-radius:7px;cursor:pointer}
.rd-menu button:hover{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1))}
.rd-menu-label{padding:6px 8px 2px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.rd-link{border:0;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12.5px;padding:0;cursor:pointer}
.rd-zoom{position:absolute;right:12px;top:12px;display:flex;align-items:center;gap:4px;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay)}
.rd-zoom input[type=range]{width:92px;margin:0 2px;accent-color:var(--dsw-alias-brand-primary);cursor:ew-resize}
.rd-zoom-label{min-width:40px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.rd-split{position:relative;display:flex}
.rd-split>.rd-icon-button{border-radius:8px 0 0 8px}
.rd-caret{width:18px;min-height:32px;padding:0;border-radius:0 8px 8px 0;border-left:0}
.rd-layout-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:7;width:232px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 76%,var(--dsw-alias-bg-base));box-shadow:0 16px 40px color-mix(in srgb,var(--dsw-alias-bg-base) 68%,transparent)}
.rd-layout-menu button{display:flex;flex-direction:column;align-items:flex-start;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:7px 8px;border-radius:7px;cursor:pointer}
.rd-layout-menu button:hover{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1))}
.rd-layout-menu small{color:var(--dsw-alias-label-secondary);font-size:11px}
@media(max-width:860px){.rd-body{flex-direction:column}.rd-aside{width:auto;height:46%;border-left:0;border-top:1px solid var(--dsw-alias-border-l1)}}
`

    function formatStamp(value?: string) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      const pad = (part: number) => String(part).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
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
    function GlassIcon(props: { plus: boolean }) {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('circle', { cx: 10, cy: 10, r: 5.5, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', { d: 'M14.2 14.2 18.5 18.5', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('path', { d: 'M8 10h4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
        props.plus ? h('path', { d: 'M10 8v4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }) : null)
    }
    function LayoutIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 4, width: 7, height: 5.5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('rect', { x: 14, y: 4, width: 7, height: 5.5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('rect', { x: 14, y: 14.5, width: 7, height: 5.5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', { d: 'M10 6.8h4M17.5 9.5v5', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
    }
    function FitIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M9 4H5.5A1.5 1.5 0 0 0 4 5.5V9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
    }
    function GearIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('circle', { cx: 12, cy: 12, r: 3, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', { d: 'M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }))
    }
    function OverviewIcon(props: { open: boolean }) {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.2, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', { d: 'M15.2 4.5v15', stroke: 'currentColor', strokeWidth: 1.6 }),
        props.open ? h('rect', { x: 15.8, y: 5.4, width: 4, height: 13.2, rx: 0.8, fill: 'currentColor' }) : null)
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
      const [layoutOpen, setLayoutOpen] = React.useState(false)
      const [pulse, setPulse] = React.useState(0)
      const pageRef = React.useRef<HTMLElement | null>(null)
      const viewportRef = React.useRef<HTMLElement | null>(null)
      const epoch = React.useRef(0)
      const viewRef = React.useRef(view)
      const zoomDrag = React.useRef<{ zoom: number, panX: number, panY: number, cx: number, cy: number } | null>(null)
      const saveTimer = React.useRef(0)
      if (!zoomDrag.current) viewRef.current = view
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
          setPulse((value) => value + 1)
        } catch (err) {
          if (seen !== epoch.current) return
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (seen === epoch.current) setBooting(false)
        }
      }, [])
      const agentLive = nodes.some((node) => node.sessions.some((link) => link.running))
      const idleSeconds = snapshot?.settings.idleRefreshSeconds ?? 30
      const runningSeconds = snapshot?.settings.runningRefreshSeconds ?? 10
      React.useEffect(() => {
        let stop = false
        const wait = Math.min(300, Math.max(5, agentLive ? runningSeconds : idleSeconds)) * 1000
        async function run() {
          if (!stop && !document.hidden) await refresh()
        }
        void run()
        const timer = window.setInterval(() => { void run() }, wait)
        function onVisible() { if (!document.hidden) void run() }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          stop = true
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [refresh, agentLive, idleSeconds, runningSeconds])
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
        function zoomAt(event: WheelEvent) {
          const rect = port.getBoundingClientRect()
          const px = event.clientX - rect.left
          const py = event.clientY - rect.top
          const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * port.clientHeight : event.deltaY
          const factor = Math.abs(pixels) >= 50 ? (pixels > 0 ? 1 / 1.12 : 1.12) : Math.exp(-pixels * 0.01)
          setView((current) => {
            const nextZoom = clamp(current.zoom * factor, 0.4, 1.8)
            const scale = current.zoom === 0 ? 1 : nextZoom / current.zoom
            const next = { zoom: nextZoom, panX: px - (px - current.panX) * scale, panY: py - (py - current.panY) * scale }
            viewRef.current = next
            return next
          })
          scheduleSaveView()
        }
        function onWindowWheel(event: WheelEvent) {
          if (!event.ctrlKey && !event.metaKey) return
          if (!(event.target instanceof Node) || !port.contains(event.target)) return
          event.preventDefault()
          event.stopPropagation()
          zoomAt(event)
        }
        function onWheel(event: WheelEvent) {
          if (event.ctrlKey || event.metaKey) return
          event.preventDefault()
          const pixelsY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * port.clientHeight : event.deltaY
          const pixelsX = event.deltaMode === 1 ? event.deltaX * 16 : event.deltaMode === 2 ? event.deltaX * port.clientWidth : event.deltaX
          setView((current) => {
            const next = { ...current, panX: current.panX - pixelsX, panY: current.panY - pixelsY }
            viewRef.current = next
            return next
          })
          scheduleSaveView()
        }
        window.addEventListener('wheel', onWindowWheel, { capture: true, passive: false })
        port.addEventListener('wheel', onWheel, { passive: false })
        return () => {
          window.removeEventListener('wheel', onWindowWheel, { capture: true })
          port.removeEventListener('wheel', onWheel)
        }
      }, [projectId])
      React.useEffect(() => {
        if (!layoutOpen) return undefined
        function close(event: PointerEvent) {
          if (event.target instanceof Element && event.target.closest('.rd-split')) return
          setLayoutOpen(false)
        }
        window.addEventListener('pointerdown', close)
        return () => window.removeEventListener('pointerdown', close)
      }, [layoutOpen])
      function viewportCenter() {
        const port = viewportRef.current
        return { cx: port ? port.clientWidth / 2 : 0, cy: port ? port.clientHeight / 2 : 0 }
      }
      function beginZoomDrag() {
        if (zoomDrag.current) return
        zoomDrag.current = { ...viewRef.current, ...viewportCenter() }
        window.addEventListener('pointerup', endZoomDrag)
        window.addEventListener('pointercancel', endZoomDrag)
      }
      function zoomFromBase(percent: number) {
        if (!zoomDrag.current) beginZoomDrag()
        const origin = zoomDrag.current
        if (!origin) return
        const zoom = clamp(percent / 100, 0.4, 1.8)
        const scale = origin.zoom === 0 ? 1 : zoom / origin.zoom
        const next = {
          zoom,
          panX: origin.cx - (origin.cx - origin.panX) * scale,
          panY: origin.cy - (origin.cy - origin.panY) * scale,
        }
        viewRef.current = next
        setView(next)
      }
      function endZoomDrag() {
        window.removeEventListener('pointerup', endZoomDrag)
        window.removeEventListener('pointercancel', endZoomDrag)
        if (!zoomDrag.current) return
        zoomDrag.current = null
        scheduleSaveView()
      }
      function zoomBy(factor: number) {
        const current = viewRef.current
        const { cx, cy } = viewportCenter()
        const zoom = clamp(current.zoom * factor, 0.4, 1.8)
        const scale = current.zoom === 0 ? 1 : zoom / current.zoom
        const next = { zoom, panX: cx - (cx - current.panX) * scale, panY: cy - (cy - current.panY) * scale }
        viewRef.current = next
        setView(next)
        scheduleSaveView()
      }
      async function runLayout(mode: string) {
        setLayoutOpen(false)
        const value = await command('layout', { projectId, mode })
        const laid = value.snapshot?.active?.nodes
        if (laid?.length) fit(laid)
      }
      function fit(list: Array<{ x: number, y: number }> = nodes) {
        const port = viewportRef.current
        if (!port || list.length === 0) return
        const minX = Math.min(...list.map((node) => node.x))
        const minY = Math.min(...list.map((node) => node.y))
        const maxX = Math.max(...list.map((node) => node.x + CARD_W))
        const maxY = Math.max(...list.map((node) => node.y + CARD_H))
        const zoom = clamp(Math.min((port.clientWidth - 72) / Math.max(1, maxX - minX), (port.clientHeight - 72) / Math.max(1, maxY - minY), 1), 0.4, 1.8)
        const next = { zoom, panX: (port.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom, panY: (port.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom }
        setView(next)
        viewRef.current = next
        scheduleSaveView()
      }
      async function openOutput(doc: OutputDoc) {
        setBusy(true)
        try {
          const value = await api(`output?nodeId=${encodeURIComponent(selectedId || '')}&path=${encodeURIComponent(doc.path)}`, 'GET') as { kind?: string, name?: string, text?: string, truncated?: boolean, url?: string, location?: string }
          setDialog({ type: 'preview', title: value.name || doc.filename || doc.title, kind: value.kind || doc.kind, text: value.text || '', url: value.url || (doc.location === 'url' ? doc.path : ''), truncated: value.truncated === true, maximized: false })
          setError('')
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
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
        h('header', { className: 'rd-header', title: tr('headerGesture') },
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
          h('button', { className: 'rd-button rd-icon-button', type: 'button', 'aria-label': tr('settings'), title: tr('settings'), onClick: () => setDialog({ type: 'settings' }) }, h(GearIcon)),
          h('button', {
            className: 'rd-button rd-icon-button',
            type: 'button',
            disabled: busy,
            'aria-label': hidden ? tr('showOverview') : tr('hideOverview'),
            'aria-pressed': hidden ? 'false' : 'true',
            title: hidden ? tr('showOverview') : tr('hideOverview'),
            onClick: () => { void command('set_overview', { hidden: !hidden }).catch(() => {}) },
          }, h(OverviewIcon, { open: !hidden }))),
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
                  const d = edgePath(parent, child)
                  const flowing = nodeLive(parent) || nodeLive(child)
                  return h('g', { key: node.id },
                    h('path', { d, fill: 'none', stroke: hot || flowing ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)', strokeWidth: hot || flowing ? 2 : 1.4 }),
                    flowing ? h('path', { className: 'rd-flow', d }) : null)
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
            h('div', { className: 'rd-zoom' },
              h('button', { className: 'rd-button rd-icon-button', type: 'button', 'aria-label': tr('zoomOut'), title: tr('zoomOut'), onClick: () => zoomBy(1 / 1.1) }, h(GlassIcon, { plus: false })),
              h('input', {
                type: 'range',
                min: 40,
                max: 180,
                step: 1,
                value: Math.round(view.zoom * 100),
                'aria-label': tr('zoomIn'),
                onPointerDown: beginZoomDrag,
                onInput: (event: Event) => zoomFromBase(Number((event.target as HTMLInputElement).value)),
                onPointerUp: endZoomDrag,
                onLostPointerCapture: endZoomDrag,
              }),
              h('span', { className: 'rd-zoom-label' }, `${Math.round(view.zoom * 100)}%`),
              h('button', { className: 'rd-button rd-icon-button', type: 'button', 'aria-label': tr('zoomIn'), title: tr('zoomIn'), onClick: () => zoomBy(1.1) }, h(GlassIcon, { plus: true })),
              h('button', { className: 'rd-button rd-icon-button', type: 'button', 'aria-label': tr('fit'), title: tr('fit'), onClick: () => fit() }, h(FitIcon)),
              h('div', { className: 'rd-split' },
                h('button', { className: 'rd-button rd-icon-button', type: 'button', 'aria-label': tr('layoutTidy'), title: tr('layoutTidyHint'), disabled: busy, onClick: () => { void runLayout('tidy') } }, h(LayoutIcon)),
                h('button', { className: 'rd-button rd-caret', type: 'button', 'aria-label': tr('layout'), 'aria-expanded': layoutOpen ? 'true' : 'false', onClick: () => setLayoutOpen(!layoutOpen) }, '▾'),
                layoutOpen ? h('div', { className: 'rd-layout-menu', role: 'menu' },
                  h('button', { type: 'button', onClick: () => { void runLayout('tidy') } }, tr('layoutTidy'), h('small', null, tr('layoutTidyHint'))),
                  h('button', { type: 'button', onClick: () => { void runLayout('right') } }, tr('layoutRight')),
                  h('button', { type: 'button', onClick: () => { void runLayout('down') } }, tr('layoutDown')),
                  h('button', { type: 'button', onClick: () => { void runLayout('radial') } }, tr('layoutRadial'))) : null))),
          hidden ? null : h(Aside, {
            tr, active, selected, recent, currentId: projectId || '', busy, openSession, pulse,
            onSelectProject: (id: string) => { void command('select_project', { projectId: id }).catch(() => {}) },
            onManage: () => setPage('manage'),
            onSelect: (id: string) => { setSelectedId(id); setMenu(null) },
            onEdit: () => selected && setDialog({ type: 'edit', nodeId: selected.id }),
            onAdd: (parentId: string) => setDialog({ type: 'node', parentId }),
            onDelete: () => selected && setDialog({ type: 'confirm-node', nodeId: selected.id }),
            onAgent: () => selected && void openAgent(selected.id),
            onConfirm: () => selected && void command('set_status', { nodeId: selected.id, status: 'done' }).catch(() => {}),
            onUnlink: (linkId: string) => selected && setDialog({ type: 'confirm-unlink', nodeId: selected.id, linkId }),
            onOpenOutput: (doc: OutputDoc) => { void openOutput(doc) },
            onSaveEvaluation: async (evaluation: string) => { await command('update_project', { projectId, evaluation }); setNotice(tr('saved')) },
          })) : null,
        menu ? h('div', { className: 'rd-menu-backdrop', onMouseDown: () => setMenu(null), onContextMenu: (event: MouseEvent) => { event.preventDefault(); setMenu(null) } },
          h(ContextMenu, { tr, menu, node: nodes.find((node) => node.id === menu.nodeId), onAction: (action: string) => {
            const node = nodes.find((item) => item.id === menu.nodeId)
            setMenu(null)
            if (!node) return
            if (action === 'add') setDialog({ type: 'node', parentId: node.id })
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
          onTogglePreview: () => setDialog((current: DialogState | null) => current?.type === 'preview' ? { ...current, maximized: !current.maximized } : current),
          idleSeconds: snapshot?.settings.idleRefreshSeconds ?? 30,
          runningSeconds: snapshot?.settings.runningRefreshSeconds ?? 10,
          onSaveRefresh: async (idleSeconds: number, runningSeconds: number) => { await command('set_refresh', { idleSeconds, runningSeconds }); setDialog(null) },
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
            h(OutputFold, { nodeId: selected.id, pulse: props.pulse, tr, onOpen: props.onOpenOutput }),
            linkError(selected),
            selected.status === 'confirm' ? h('p', { className: 'rd-muted' }, tr('confirmHint')) : null,
            h('div', { className: 'rd-actions' },
              selected.status === 'confirm' ? h('button', { className: 'rd-button primary', type: 'button', onClick: props.onConfirm }, tr('confirmDone')) : null,
              h('button', { className: 'rd-button', type: 'button', onClick: props.onEdit }, tr('edit')),
              h('button', { className: 'rd-button', type: 'button', onClick: () => props.onAdd(selected.id) }, tr('addChild')),
              h('button', { className: 'rd-button primary', type: 'button', onClick: props.onAgent }, tr('assign')),
              selected.parentId ? h('button', { className: 'rd-button danger', type: 'button', onClick: props.onDelete }, tr('delete')) : null)) : h('p', { className: 'rd-muted' }, tr('noSelection'))),
        h('div', { className: 'rd-section' },
          h('h2', null, tr('evaluation')),
          h('textarea', { className: 'rd-textarea', value: evaluation, placeholder: tr('evaluationPlaceholder'), onChange: (event: Event) => { dirty.current = true; setEvaluation((event.target as HTMLTextAreaElement).value) } }),
          h('div', { className: 'rd-actions' }, h('button', { className: 'rd-button', type: 'button', disabled: props.busy, onClick: () => { dirty.current = false; void props.onSaveEvaluation(evaluation).catch(() => {}) } }, tr('save')))))
    }
    function nodeLive(node: NodeView) {
      return node.sessions.some((link) => link.running)
    }
    function sideToward(from: NodeView, to: NodeView) {
      const dx = (to.x + CARD_W / 2) - (from.x + CARD_W / 2)
      const dy = (to.y + CARD_H / 2) - (from.y + CARD_H / 2)
      if (Math.abs(dx) * CARD_H >= Math.abs(dy) * CARD_W) return dx >= 0 ? 'right' : 'left'
      return dy >= 0 ? 'bottom' : 'top'
    }
    function port(node: NodeView, side: string) {
      if (side === 'left') return { x: node.x, y: node.y + CARD_H / 2, nx: -1, ny: 0 }
      if (side === 'right') return { x: node.x + CARD_W, y: node.y + CARD_H / 2, nx: 1, ny: 0 }
      if (side === 'top') return { x: node.x + CARD_W / 2, y: node.y, nx: 0, ny: -1 }
      return { x: node.x + CARD_W / 2, y: node.y + CARD_H, nx: 0, ny: 1 }
    }
    function edgePath(parent: NodeView, child: NodeView) {
      const start = port(parent, sideToward(parent, child))
      const end = port(child, sideToward(child, parent))
      const bend = Math.max(42, Math.hypot(end.x - start.x, end.y - start.y) / 3)
      return `M ${start.x} ${start.y} C ${start.x + start.nx * bend} ${start.y + start.ny * bend}, ${end.x + end.nx * bend} ${end.y + end.ny * bend}, ${end.x} ${end.y}`
    }
    function OutputFold(props: { nodeId: string, pulse: number, tr: Translate, onOpen: (doc: OutputDoc) => void }) {
      const [open, setOpen] = React.useState(false)
      const [docs, setDocs] = React.useState<OutputDoc[]>([])
      const [loading, setLoading] = React.useState(false)
      React.useEffect(() => {
        let stop = false
        async function load() {
          setLoading(true)
          try {
            const value = await api(`outputs?nodeId=${encodeURIComponent(props.nodeId)}`, 'GET') as { outputs?: OutputDoc[] }
            if (!stop) setDocs(value.outputs ?? [])
          } catch {
            if (!stop) setDocs([])
          } finally {
            if (!stop) setLoading(false)
          }
        }
        void load()
        return () => { stop = true }
      }, [props.nodeId, props.pulse])
      return h('div', { className: 'rd-section' },
        h('button', { className: 'rd-fold', type: 'button', 'aria-expanded': open ? 'true' : 'false', onClick: () => setOpen(!open) },
          h('span', { className: 'rd-kicker' }, props.tr('outputs')),
          h('span', null, `${open ? '▾' : '▸'} ${docs.length}`)),
        open ? (loading && docs.length === 0
          ? h('p', { className: 'rd-muted' }, props.tr('outputsLoading'))
          : docs.length === 0
            ? h('p', { className: 'rd-muted' }, props.tr('outputsEmpty'))
            : docs.map((doc) => h('button', {
              key: doc.id || doc.path, className: 'rd-alert', type: 'button', onClick: () => props.onOpen(doc),
            }, h('span', null, doc.filename || doc.title), h('span', null, `${props.tr(`kind_${doc.kind}`)} · ${formatStamp(doc.createdAt)}`)))) : null)
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
        h('button', { type: 'button', onClick: () => props.onAction('add') }, props.tr('addChild')),
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
      if (dialog.type === 'node') return h(FormDialog, { tr, title: tr('newNode'), onClose, busy: props.busy, submitLabel: tr('create'), fields: [['title', tr('titleField'), 'input', ''], ['intent', tr('intentField'), 'textarea', '']], onSubmit: (fields: Record<string, string>) => props.onCreateNode({ parentId: dialog.parentId || '', title: fields.title || '', intent: fields.intent || '' }) })
      if (dialog.type === 'edit' && node) return h(FormDialog, { tr, title: tr('editNode'), onClose, busy: props.busy, fields: [['title', tr('titleField'), 'input', node.title], ['intent', tr('intentField'), 'textarea', node.intent], ['status', tr('statusField'), 'status', node.status], ['progress', tr('progressField'), 'number', node.progress ?? ''], ['dueAt', tr('dueField'), 'date', node.dueAt || ''], ['notes', tr('notesField'), 'textarea', node.notes]], onSubmit: (fields: Record<string, string>) => props.onUpdateNode({ nodeId: node.id, title: fields.title, intent: fields.intent, status: fields.status, progress: fields.progress === '' ? null : Number(fields.progress), dueAt: fields.dueAt || null, notes: fields.notes }) })
      if (dialog.type === 'due' && node) return h(FormDialog, { tr, title: tr('dueTitle'), onClose, busy: props.busy, fields: [['dueAt', tr('dueField'), 'date', dialog.dueAt || '']], extra: h('button', { className: 'rd-button', type: 'button', onClick: () => { void props.onUpdateNode({ nodeId: node.id, dueAt: null }).catch(() => {}) } }, tr('clearDue')), onSubmit: (fields: Record<string, string>) => props.onUpdateNode({ nodeId: node.id, dueAt: fields.dueAt || null }) })
      if (dialog.type === 'confirm-node') return h(ConfirmDialog, { tr, title: tr('confirmDelete'), body: tr('cascadeHint'), busy: props.busy, onClose, onConfirm: () => props.onDeleteNode(dialog.nodeId || '') })
      if (dialog.type === 'confirm-project') return h(ConfirmDialog, { tr, title: tr('confirmDeleteProject'), body: tr('cascadeHint'), busy: props.busy, onClose, onConfirm: () => props.onDeleteProject(dialog.projectId) })
      if (dialog.type === 'confirm-unlink') return h(ConfirmDialog, { tr, title: tr('unlink'), body: tr('confirmUnlink'), busy: props.busy, onClose, onConfirm: () => props.onUnlink(dialog.nodeId || '', dialog.linkId || '') })
      if (dialog.type === 'agent') return h(AgentDialog, { tr, sessions: props.sessions, groups: props.groups, busy: props.busy, onClose, onDispatch: (body: Record<string, unknown>) => props.onDispatch({ nodeId: dialog.nodeId, ...body }) })
      if (dialog.type === 'preview') return h(PreviewDialog, { tr, dialog, onClose, onToggle: () => props.onTogglePreview?.() })
      if (dialog.type === 'settings') return h(SettingsDialog, { tr, idle: props.idleSeconds ?? 30, running: props.runningSeconds ?? 10, busy: props.busy, onClose, onSave: (idleSeconds: number, runningSeconds: number) => props.onSaveRefresh?.(idleSeconds, runningSeconds) })
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
    function SettingsDialog(props: { tr: Translate, idle: number, running: number, busy: boolean, onClose: () => void, onSave: (idleSeconds: number, runningSeconds: number) => Promise<void> | void }) {
      const [idle, setIdle] = React.useState(String(props.idle))
      const [running, setRunning] = React.useState(String(props.running))
      return h(Shell, { tr: props.tr, title: props.tr('settings'), onClose: props.onClose },
        h('p', { className: 'rd-muted' }, props.tr('refreshHint')),
        h('label', { className: 'rd-field' }, props.tr('idleRefresh'), h('input', { className: 'rd-input', type: 'number', min: 5, max: 300, value: idle, onChange: (event: Event) => setIdle((event.target as HTMLInputElement).value) })),
        h('label', { className: 'rd-field' }, props.tr('runningRefresh'), h('input', { className: 'rd-input', type: 'number', min: 5, max: 300, value: running, onChange: (event: Event) => setRunning((event.target as HTMLInputElement).value) })),
        h('div', { className: 'rd-actions' },
          h('button', { className: 'rd-button primary', type: 'button', disabled: props.busy, onClick: () => { void props.onSave(Number(idle), Number(running)) } }, props.tr('save')),
          h('button', { className: 'rd-button', type: 'button', onClick: props.onClose }, props.tr('cancel'))))
    }
    function PreviewDialog(props: { tr: Translate, dialog: DialogState, onClose: () => void, onToggle: () => void }) {
      const { tr, dialog } = props
      const kind = dialog.kind || 'markdown'
      return h('div', { className: 'rd-overlay', onMouseDown: (event: MouseEvent) => { if (event.target === event.currentTarget) props.onClose() } },
        h('div', { className: dialog.maximized ? 'rd-dialog max' : 'rd-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': dialog.title || tr('outputs') },
          h('div', { className: 'rd-dialog-head' },
            h('h2', null, dialog.title || tr('outputs')),
            h('div', { className: 'rd-actions' },
              h('button', { className: 'rd-button', type: 'button', onClick: props.onToggle }, dialog.maximized ? tr('restore') : tr('maximize')),
              h('button', { className: 'rd-button', type: 'button', onClick: props.onClose }, tr('close')))),
          dialog.truncated ? h('p', { className: 'rd-muted' }, tr('outputTruncated')) : null,
          h('div', { className: 'rd-preview' },
            kind === 'html' && dialog.url ? h('iframe', { sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups', src: dialog.url, title: dialog.title || 'HTML' }) : null,
            kind === 'html' && !dialog.url ? h('iframe', { sandbox: 'allow-scripts', srcDoc: dialog.text || '', title: dialog.title || 'HTML' }) : null,
            kind === 'csv' ? h(CsvTable, { text: dialog.text || '' }) : null,
            kind === 'markdown' ? h(MarkdownView, { text: dialog.text || '' }) : null)))
    }
    function MarkdownView(props: { text: string }) {
      return h('div', { className: 'rd-md' }, props.text.split(/\n{2,}/).map((block, index) => {
        if (block.startsWith('```')) return h('pre', { key: index }, block.replace(/^```[^\n]*\n?/, '').replace(/```$/, ''))
        if (block.startsWith('# ')) return h('h3', { key: index }, block.replace(/^#+\s*/, ''))
        return h('p', { key: index }, block)
      }))
    }
    function CsvTable(props: { text: string }) {
      const rows = parseCsv(props.text).slice(0, 200)
      if (!rows.length) return h('p', { className: 'rd-muted' }, props.text)
      const head = rows[0] ?? []
      return h('table', { className: 'rd-table' },
        h('thead', null, h('tr', null, head.map((cell, index) => h('th', { key: index }, cell)))),
        h('tbody', null, rows.slice(1).map((row, index) => h('tr', { key: index }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell))))))
    }
    function parseCsv(text: string): string[][] {
      const rows: string[][] = []
      let row: string[] = []
      let cell = ''
      let quoted = false
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index] ?? ''
        const next = text[index + 1]
        if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; continue }
        if (char === '"') { quoted = !quoted; continue }
        if (!quoted && char === ',') { row.push(cell); cell = ''; continue }
        if (!quoted && (char === '\n' || char === '\r')) {
          if (char === '\r' && next === '\n') index += 1
          row.push(cell); rows.push(row); row = []; cell = ''; continue
        }
        cell += char
      }
      if (cell || row.length) { row.push(cell); rows.push(row) }
      return rows.filter((item) => item.some((value) => value.trim()))
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
interface SessionLink { id: string, sessionId: string, label: string, error: string, createdAt: string, running?: boolean }
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
  settings: { overviewHidden: boolean, activeProjectId: string | null, idleRefreshSeconds?: number, runningRefreshSeconds?: number }
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
interface OutputDoc { id?: string, path: string, title: string, filename?: string, kind: string, location?: string, createdAt?: string }
interface DialogState { type: string, nodeId?: string, parentId?: string, side?: 'left' | 'right', dueAt?: string, projectId?: string, title?: string, linkId?: string, kind?: string, text?: string, url?: string, truncated?: boolean, maximized?: boolean }
interface AsideProps {
  tr: Translate
  active: NonNullable<Snapshot['active']>
  selected: NodeView | null
  recent: ProjectRow[]
  currentId: string
  busy: boolean
  pulse: number
  openSession: (sessionId: string) => void
  onSelectProject: (id: string) => void
  onManage: () => void
  onSelect: (id: string) => void
  onEdit: () => void
  onAdd: (parentId: string) => void
  onDelete: () => void
  onConfirm: () => void
  onAgent: () => void
  onUnlink: (linkId: string) => void
  onOpenOutput: (doc: OutputDoc) => void
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
  onTogglePreview?: () => void
  idleSeconds?: number
  runningSeconds?: number
  onSaveRefresh?: (idleSeconds: number, runningSeconds: number) => Promise<void>
}
