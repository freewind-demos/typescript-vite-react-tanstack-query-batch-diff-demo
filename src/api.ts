import { recordBatch, recordSingleFetch } from "./stats";

export type Commit = {
  hash: string;
  title: string;
  date: string;
};

const INITIAL_COMMIT_COUNT = 50;
const LIST_DELAY_MS = 300;
const BATCH_DIFF_DELAY_MS = 600;

let commitSeq = 0;
let commitFetchCount = 0;

// 假 hex hash：递增序号 + 随机后缀，保证同一个列表内不重复
const createHash = (): string => {
  const prefix = commitSeq.toString(16).padStart(4, "0");
  const suffix = Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  return prefix + suffix;
};

const BASE_TIME = Date.now();

const createCommit = (): Commit => {
  commitSeq += 1;
  const time =
    commitSeq <= INITIAL_COMMIT_COUNT
      ? new Date(BASE_TIME - (INITIAL_COMMIT_COUNT - commitSeq) * 60_000)
      : new Date();
  return {
    hash: createHash(),
    title: `commit #${commitSeq}`,
    date: time.toISOString().slice(0, 19).replace("T", " "),
  };
};

// 模拟「服务端的 commit 列表」：它是可变的，新增提交后这里会变长
let commits: Commit[] = Array.from({ length: INITIAL_COMMIT_COUNT }, () => createCommit());

const sleep = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

// 列表接口：每次都是最新的列表，所以列表数据不需要永久缓存
export const fetchCommits = async (): Promise<Commit[]> => {
  commitFetchCount += 1;
  console.log(`[api] fetchCommits 第 ${commitFetchCount} 次调用（列表可变，每次都要拿最新的）`);

  await sleep(LIST_DELAY_MS);
  return [...commits];
};

// 模拟「服务端多了 1~3 个新提交」：新 hash 的 diff 还没有任何缓存
export const addNewCommits = async (): Promise<Commit[]> => {
  await sleep(200);

  const count = 1 + Math.floor(Math.random() * 3);
  const fresh = Array.from({ length: count }, () => createCommit());
  commits = [...fresh, ...commits];
  console.log(
    `[api] 服务端新增 ${count} 个 commit`,
    fresh.map((commit) => commit.hash),
  );
  return fresh;
};

// 每次点「展开」都要展示的 diff 文本：只由 hash 决定，所以同一个 hash 永远是同一份
const createDiffText = (hash: string): string =>
  [
    `diff --git a/src/service-${hash.slice(0, 4)}.ts b/src/service-${hash.slice(0, 4)}.ts`,
    `index ${hash.slice(0, 7)}..${hash.slice(4, 11)} 100644`,
    `--- a/src/service-${hash.slice(0, 4)}.ts`,
    `+++ b/src/service-${hash.slice(0, 4)}.ts`,
    "@@ -1,4 +1,5 @@",
    " export const version = 1;",
    `-export const oldName = "${hash.slice(0, 6)}";`,
    `+export const newName = "${hash.slice(6, 12)}";`,
    `+export const commit = "${hash}";`,
  ].join("\n");

// 批量接口：一次拿多个 hash 的 diff。批量请求次数由这里统计，是本 demo 的核心观察点
export const fetchDiffBatch = async (hashes: string[]): Promise<Record<string, string>> => {
  console.log(`[batch] fetchDiffBatch 收到 ${hashes.length} 个 hash`, hashes);
  recordBatch(hashes);

  await sleep(BATCH_DIFF_DELAY_MS);

  const diffs: Record<string, string> = {};
  for (const hash of hashes) {
    diffs[hash] = createDiffText(hash);
  }
  return diffs;
};

// 单 hash 接口：故意留着不用。一旦统计面板里它不为 0，说明批处理被绕过了
export const fetchDiff = async (hash: string): Promise<string> => {
  recordSingleFetch();
  console.log(`[api] fetchDiff 单 hash 请求：${hash}（批处理没生效时才会看到）`);

  await sleep(BATCH_DIFF_DELAY_MS);
  return createDiffText(hash);
};
