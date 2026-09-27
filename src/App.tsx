import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Layout, List, Space, Tag, Typography } from "antd";
import { addNewCommits, fetchCommits } from "./api";
import { CommitRow } from "./CommitRow";
import { recordCacheHits } from "./stats";
import { StatsPanel } from "./StatsPanel";

export const App = () => {
  const queryClient = useQueryClient();

  // 展开态：只存 hash，不存 diff —— diff 归 Query 的缓存管
  const [expandedHashes, setExpandedHashes] = useState<Set<string>>(new Set());

  // 列表 query：列表是可变的，所以这里不设 staleTime，且刷新列表用不上 diff 的缓存
  const { data: commits, isPending, isFetching } = useQuery({
    queryKey: ["commits"],
    queryFn: fetchCommits,
  });

  // 展开一个或多个 hash。展开这一刻缓存里已经有 diff 的，就是「零请求」命中，记进统计再挂载请求
  const expand = (hashes: string[]) => {
    const cachedCount = hashes.filter(
      (hash) => queryClient.getQueryData(["commit-diff", hash]) !== undefined,
    ).length;
    if (cachedCount > 0) {
      recordCacheHits(cachedCount);
    }
    setExpandedHashes((prev) => new Set([...prev, ...hashes]));
  };

  const toggle = (hash: string) => {
    if (expandedHashes.has(hash)) {
      setExpandedHashes((prev) => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
    } else {
      expand([hash]);
    }
  };

  // 展开全部：只把「还没展开的」交给 expand，已缓存的 hash 不会发请求，只有新 hash 会进下一批
  const expandAll = () => {
    expand((commits ?? []).filter((commit) => !expandedHashes.has(commit.hash)).map((commit) => commit.hash));
  };

  const collapseAll = () => {
    setExpandedHashes(new Set());
  };

  const reloadCommits = () => {
    // exact: true：只失效 ["commits"] 自己，绝不去碰 ["commit-diff", hash]
    queryClient.invalidateQueries({ queryKey: ["commits"], exact: true });
  };

  const addCommits = async () => {
    await addNewCommits();
    reloadCommits();
  };

  return (
    <Layout style={{ minHeight: "100vh", padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          按 hash 批量拉取 diff + 每个 hash 永久缓存
        </Typography.Title>

        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          commit 列表是可变的（每次都拿最新）；每个 commit 的 diff 由 hash 唯一决定（拿到就不再请求）；
          同时展开 N 个 commit 只会发 1 次批量请求。
        </Typography.Paragraph>

        <Space wrap>
          <Button type="primary" onClick={expandAll}>
            加载全部 diff
          </Button>
          <Button onClick={collapseAll}>折叠全部</Button>
          <Button loading={isFetching} onClick={reloadCommits}>
            重新拉取列表
          </Button>
          <Button onClick={addCommits}>新增提交</Button>
          <Tag color={isPending ? "orange" : "green"}>
            {isPending ? "loading" : `commit 列表 ${commits?.length ?? 0} 条`}
          </Tag>
        </Space>

        <StatsPanel />

        {isPending ? (
          <Typography.Text>列表加载中…</Typography.Text>
        ) : (
          <List
            bordered
            rowKey={(commit) => commit.hash}
            dataSource={commits}
            renderItem={(commit) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                isExpanded={expandedHashes.has(commit.hash)}
                onToggle={toggle}
              />
            )}
          />
        )}
      </Space>
    </Layout>
  );
};
