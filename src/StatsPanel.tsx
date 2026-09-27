import { useSyncExternalStore } from "react";
import { Button, Descriptions, Space, Tag, Typography } from "antd";
import { getStats, resetStats, subscribeStats } from "./stats";

export const StatsPanel = () => {
  // 计数在 React 之外（fetchDiffBatch 里就在涨），用 useSyncExternalStore 订阅它
  const stats = useSyncExternalStore(subscribeStats, getStats);

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      <Space wrap>
        <Typography.Text strong>请求统计</Typography.Text>
        <Button size="small" onClick={resetStats}>
          清空统计
        </Button>
      </Space>

      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="批量请求次数（fetchDiffBatch）">
          <Tag color={stats.batchCallCount > 0 ? "green" : "default"}>{stats.batchCallCount}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="批量累计包含 hash 数">{stats.batchHashesTotal}</Descriptions.Item>
        <Descriptions.Item label="单 hash 直接请求次数（fetchDiff）">
          <Tag color={stats.singleFetchCount > 0 ? "red" : "green"}>
            {stats.singleFetchCount}（应为 0）
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="展开时命中缓存的 hash 数（零请求）">
          <Tag color="blue">{stats.cacheHitCount}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="每次批量包含的 hash 数" span={2}>
          {stats.batchRecords.length === 0 ? (
            <Typography.Text type="secondary">还没有批量请求</Typography.Text>
          ) : (
            <Space wrap>
              {stats.batchRecords.map((record, index) => (
                <Tag key={`${record.at}-${index}`}>
                  第 {stats.batchRecords.length - index} 次：{record.size} 个 hash @ {record.at}
                </Tag>
              ))}
            </Space>
          )}
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );
};
