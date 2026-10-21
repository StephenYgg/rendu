# Rendu

任督二脉。把一个宗旨拆成可拖拽的目标树，状态和进度从叶子汇总到主节点。交给 Agent 的对话会留在节点上，一个节点可以关联多段会话。

英文名是 **Rendu**，不直译穴位。中文界面标题是「任督二脉」。

## 数据

运行时数据在 SQLite，不进这个仓库：

`~/.dsh/rendu/rendu.sqlite`

## 开发

```bash
npm install
npm run build
```

Harness 加载编译后的 `lib/rendu.js` 和 `client.js`。改 TypeScript 之后要重新 build，再安装这个目录。
