import { fetchDiffBatch } from "./api";

export { fetchDiffBatch };

// 合并窗口：窗口内所有 requestDiff 会被合成一次 fetchDiffBatch 调用。
// 取 20ms 的理由：界面一次性展开 50 个 commit 时，50 个 useQuery 是在同一个任务里
// 一起 enabled 的，20ms 足以覆盖这一整批（还留了点调度抖动的余量），
// 同时又短到用户完全感知不到延迟；再大就只是白等，再小则可能被拆成多次批量。
const BATCH_WINDOW_MS = 20;

type Waiter = {
  resolve: (diff: string) => void;
  reject: (error: unknown) => void;
};

// hash -> 等这批结果的调用方；同一个 hash 在同一个窗口内只会被请求一次
let pending = new Map<string, Waiter[]>();
let timer: number | null = null;

const flush = async (): Promise<void> => {
  timer = null;

  // 先整批摘走，再发请求：请求期间新来的 hash 会落进下一批
  const batch = pending;
  pending = new Map();
  const hashes = [...batch.keys()];
  if (hashes.length === 0) {
    return;
  }

  try {
    const diffs = await fetchDiffBatch(hashes);
    for (const [hash, waiters] of batch) {
      const diff = diffs[hash];
      if (diff === undefined) {
        const error = new Error(`批量接口没有返回 ${hash} 的 diff`);
        waiters.forEach((waiter) => waiter.reject(error));
      } else {
        waiters.forEach((waiter) => waiter.resolve(diff));
      }
    }
  } catch (error) {
    for (const waiters of batch.values()) {
      waiters.forEach((waiter) => waiter.reject(error));
    }
  }
};

// 取 diff 的唯一入口：不是一个 hash 一个请求，而是先入队、再由 flush 合并成一次批量请求。
// 返回值按 hash 一一对应，调用方（每个 commit 的 useQuery）拿到的还是「自己那一个 hash 的 diff」，
// 只是底层请求被合并掉了。
export const requestDiff = (hash: string): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();

  const waiters = pending.get(hash);
  if (waiters) {
    waiters.push({ resolve, reject });
  } else {
    pending.set(hash, [{ resolve, reject }]);
  }

  if (timer === null) {
    timer = setTimeout(() => {
      void flush();
    }, BATCH_WINDOW_MS);
  }

  return promise;
};
