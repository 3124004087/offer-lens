// composables/useLocalDB.ts
// 分析记录的读写。
//
// 名字沿用排期里的 useLocalDB，但它不是那种「返回一堆 ref」的 composable ——
// 它只是一组普通函数。因为历史记录不需要全局响应式：
// 哪个页面要列表，谁就自己去取（History.vue 用 ref 接住即可）。
//
// 数据库那一层的细节在 utils/idb.ts，这里只管业务：一条记录长什么样、怎么改。
import { STORE, withStore } from '@/utils/idb'
import type { SavedAnalysis } from '@/types'

/** 取出全部记录，按创建时间倒序（新的在上面） */
export async function listAnalyses(): Promise<SavedAnalysis[]> {
  const list = await withStore(
    'readonly',
    (store) => store.index('createdAt').getAll() as IDBRequest<SavedAnalysis[]>,
  )
  // 索引本身是升序（老 → 新），历史列表要反过来。
  // 用 reverse 而不是 sort：sort 要自己写比较函数，白算一遍
  return list.reverse()
}

/** 按 id 取一条，没有就返回 undefined（不是抛错：找不到是正常情况） */
export function getAnalysis(id: string): Promise<SavedAnalysis | undefined> {
  return withStore('readonly', (store) => store.get(id) as IDBRequest<SavedAnalysis | undefined>)
}

/** 整条写入（有同 id 就覆盖） */
export async function putAnalysis(item: SavedAnalysis): Promise<void> {
  await withStore('readwrite', (store) => store.put(item))
}

/**
 * 局部更新：读出来 → 合并 → 整条写回。
 *
 * 这是「读改写」三步，严格说应该包在同一个事务里。这里没包，是因为
 * 更新只发生在用户点一下「会/不会」「已投递」的时候，一秒一次都算多的，
 * 撞车概率约等于 0；换成嵌套事务要多写 20 行回调，不值。
 * 但要知道这个取舍 —— 面试被问「并发写怎么办」时能答出来就行。
 *
 * 返回合并后的新对象；原记录不在（被清了）就返回 null，让调用方决定怎么提示。
 */
export async function patchAnalysis(
  id: string,
  patch: Partial<SavedAnalysis>,
): Promise<SavedAnalysis | null> {
  const old = await getAnalysis(id)
  if (!old) return null

  // id 必须留在原地：patch 里万一带了别的 id，会把这条记录「搬」到另一个 key 上
  const next: SavedAnalysis = { ...old, ...patch, id: old.id }
  await putAnalysis(next)
  return next
}

/** 删一条 */
export async function removeAnalysis(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

/** 清空整张表（设置页的「清空本地数据」用） */
export async function clearAnalyses(): Promise<void> {
  await withStore('readwrite', (store) => store.clear())
}

/** 表名对外暴露一下，设置页显示存储位置时要用 */
export { STORE as ANALYSIS_STORE }
