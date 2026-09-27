# TypeScript + Vite + React + TanStack Query：按 hash 批量拉取 diff Demo

## 这个 Demo 演示什么

四个事实放在一起，看请求次数怎么掉下来：

1. **commit 列表是可变的** —— 每次都要拿最新的列表（`queryKey: ["commits"]`，不设 `staleTime`，随时可以 `invalidateQueries` 重拉）。
2. **每个 commit 的 diff 是不可变的** —— diff 由 hash 唯一决定，一旦拿到就永不再请求（`queryKey: ["commit-diff", hash]` + `staleTime: Infinity`）。
3. **多个 diff 请求会合并成一次批量请求** —— 同时展开 50 个 commit，底层只发 **1 次** `fetchDiffBatch(50 个 hash)`，而不是 50 次单请求。
4. **缓存的 hash 再展开零请求** —— 折叠再展开、或第二次点「加载全部 diff」，批量请求次数不再增长。

合并发生在 `src/diffBatch.ts` 里：`requestDiff(hash)` 只把请求压进队列，20ms 后 `flush` 把队列里所有 hash 一次交给 `fetchDiffBatch(hashes)`，再把 `Record<hash, diff>` 拆开、按 hash resolve 给各自的调用方。

## 和上一个 demo（typescript-vite-react-tanstack-query-demo）的区别

| | 上一个 demo | 本 demo |
| --- | --- | --- |
| 主题 | 状态按归属分三类（server state / local state / 共享 UI state） | 请求合并：N 个 diff 请求 → 1 次批量请求 |
| queryKey | 只有一个 `["items"]` | 列表 `["commits"]` + 每个 hash 一个 `["commit-diff", hash]` |
| 请求 | 每次 `fetchItems` 一次 | 非 React 的微批调度器 `diffBatch.ts` 决定何时、按几个 hash 发请求 |
| 缓存 | 没设 `staleTime` | diff 设 `staleTime: Infinity`（不可变数据）+ `gcTime` 10 分钟（有上限地回收） |
| 观察点 | Console 里 `fetchItems` 只有 1 次 | 统计面板里的批量请求次数 / 每次包含的 hash 数 / 缓存命中次数 |

## 运行

```bash
cd /Users/peng.li/workspace/freewind-demos/typescript-vite-react-tanstack-query-batch-diff-demo
pnpm install
pnpm dev          # 固定 5188 端口
```

## 打开页面后在 Console 里应当看到什么

1. 首屏只有一条列表日志：`[api] fetchCommits 第 1 次调用`。
2. 点 **「加载全部 diff」**：`[batch] fetchDiffBatch 收到 50 个 hash [...]` —— **只有 1 条**。
3. 再点一次「加载全部 diff」：**没有新的 `[batch]` 日志**（50 个 hash 都命中缓存，`staleTime: Infinity`）。
4. 点 **「新增提交」**（服务端新增 1~3 个新 hash）后再点「加载全部 diff」：新增一条 `[batch] fetchDiffBatch 收到 1~3 个 hash`，只含新增的那些 hash。
5. 全过程 **不存在** `[api] fetchDiff` 单 hash 请求日志，统计面板里「单 hash 直接请求次数」恒为 0。
6. 单独展开某个 commit、收起、再展开：Console 无任何请求日志，统计面板「展开时命中缓存的 hash 数」+1。

> 命中统计的口径：在「点展开」的那一刻用 `queryClient.getQueryData(["commit-diff", hash])` 判断这个 hash 是否已在缓存里，在的就算一次零请求命中。统计放在展开的决策点（`App.tsx` 的 `expand`），而不是挂在渲染里，这样「diff 到达后的重渲染」「列表刷新引起的重渲染」都不会把命中数算多。所以「折叠全部 → 加载全部 diff」会一次 +50（50 个都命中缓存、零请求）。

## 为什么这样能减少请求（三句话）

1. 列表和 diff 用两套不同的 `queryKey` 词根，所以刷新列表只失效 `["commits"]`，不会误伤 `["commit-diff", hash]` 里已经拿到的 diff。
2. diff 的不可变性用 `staleTime: Infinity` 表达，Query 自己就知道「这份数据永远不会过期」，同一个 hash 绝不会再发第二次请求。
3. 同一时间窗口里的多个 diff 请求先在 `diffBatch.ts` 里排队、再合并成一次 `fetchDiffBatch`，把 N 次请求压成 1 次。

## 代码结构

- `src/api.ts` —— 全部 mock 数据：`fetchCommits`（可变列表）、`addNewCommits`（服务端新增）、`fetchDiffBatch`（批量，600ms）、`fetchDiff`（单 hash，故意留空不用）
- `src/diffBatch.ts` —— 不依赖 React 的微批调度器：`requestDiff` / `fetchDiffBatch` / 20ms 合并窗口
- `src/stats.ts` —— 计数（批量次数、单请求次数、缓存命中次数）+ 订阅，供统计面板展示
- `src/App.tsx` —— 列表 query、展开态、各按钮
- `src/CommitRow.tsx` —— 每个 commit 一行；`["commit-diff", hash]` 在这里（`staleTime: Infinity`、`gcTime` 10 分钟、`enabled: isExpanded`）
- `src/StatsPanel.tsx` —— antd 统计面板，`useSyncExternalStore` 订阅计数

没引任何状态管理库（redux / zustand / jotai / valtio 都没有），组件里也没有手写缓存 Map —— diff 缓存全部交给 Query 按 `queryKey` 管。
