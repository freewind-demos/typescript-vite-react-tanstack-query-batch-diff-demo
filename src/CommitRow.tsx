import { useQuery } from "@tanstack/react-query";
import { Alert, Button, List, Space, Spin, Tag, Typography } from "antd";
import type { Commit } from "./api";
import { requestDiff } from "./diffBatch";

// diff 只由 hash 决定，一旦拿到就永远有效；gcTime 留个有限值，没人看的 diff 最终会被回收
const DIFF_STALE_TIME = Infinity;
const DIFF_GC_TIME = 10 * 60 * 1000;

type Props = {
  commit: Commit;
  isExpanded: boolean;
  onToggle: (hash: string) => void;
};

export const CommitRow = ({ commit, isExpanded, onToggle }: Props) => {
  // 每个 hash 一个独立的缓存槽，互不影响；列表 key 是 ["commits"]，两者词根不重叠
  const diffKey: [string, string] = ["commit-diff", commit.hash];

  const { data: diff, isPending, isError, error, refetch } = useQuery({
    queryKey: diffKey,
    queryFn: () => requestDiff(commit.hash),
    // 折叠时不挂载请求，展开才拉：这就是「同时展开 50 个」能凑成一批的前提
    enabled: isExpanded,
    staleTime: DIFF_STALE_TIME,
    gcTime: DIFF_GC_TIME,
  });

  return (
    <List.Item>
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Space wrap>
          <Tag color="blue">{commit.hash}</Tag>
          <Typography.Text strong>{commit.title}</Typography.Text>
          <Typography.Text type="secondary">{commit.date}</Typography.Text>
          <Button size="small" onClick={() => onToggle(commit.hash)}>
            {isExpanded ? "收起 diff" : "展开 diff"}
          </Button>
        </Space>

        {isExpanded && (
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            {isPending && <Spin size="small" />}
            {isError && (
              <Alert
                type="error"
                showIcon
                message={`加载 diff 失败：${String(error)}`}
                action={
                  <Button size="small" onClick={() => refetch()}>
                    重试
                  </Button>
                }
              />
            )}
            {diff !== undefined && (
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  background: "#f6f6f6",
                  borderRadius: 4,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                }}
              >
                {diff}
              </pre>
            )}
          </Space>
        )}
      </Space>
    </List.Item>
  );
};
