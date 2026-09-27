export type BatchRecord = {
  size: number;
  at: string;
};

export type Stats = {
  batchCallCount: number;
  batchHashesTotal: number;
  batchRecords: BatchRecord[];
  singleFetchCount: number;
  cacheHitCount: number;
};

// 统计面板只展示最近这些次批量，避免长会话里这个数组无上限增长
const MAX_BATCH_RECORDS = 20;

const EMPTY_STATS: Stats = {
  batchCallCount: 0,
  batchHashesTotal: 0,
  batchRecords: [],
  singleFetchCount: 0,
  cacheHitCount: 0,
};

let state: Stats = EMPTY_STATS;

const listeners = new Set<() => void>();

const emit = (next: Stats): void => {
  state = next;
  listeners.forEach((listener) => listener());
};

// 给 useSyncExternalStore 用：订阅 + 读快照，快照只在计数变化时换新对象
export const subscribeStats = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getStats = (): Stats => state;

// 每次 fetchDiffBatch 被调用时记一次：批量请求次数 + 本次装了多少个 hash
export const recordBatch = (hashes: string[]): void => {
  emit({
    ...state,
    batchCallCount: state.batchCallCount + 1,
    batchHashesTotal: state.batchHashesTotal + hashes.length,
    batchRecords: [
      { size: hashes.length, at: new Date().toLocaleTimeString() },
      ...state.batchRecords,
    ].slice(0, MAX_BATCH_RECORDS),
  });
};

export const recordSingleFetch = (): void => {
  emit({ ...state, singleFetchCount: state.singleFetchCount + 1 });
};

export const recordCacheHits = (count: number): void => {
  emit({ ...state, cacheHitCount: state.cacheHitCount + count });
};

export const resetStats = (): void => {
  emit(EMPTY_STATS);
};
