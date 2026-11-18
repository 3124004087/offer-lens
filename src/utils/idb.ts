// utils/idb.ts
// IndexedDB 的 Promise 封装。
//
// 为什么需要这一层：原生 IndexedDB 全是回调（onsuccess / onerror），
// 一次「打开库 → 开事务 → 发请求」写下来就是三层嵌套；包成 Promise 之后
// 业务代码才能用 await 顺着往下读。
//
// 为什么不引 idb / localforage：整个项目就 5 个操作（读写删清空、按索引取），
// 引库要多背一套 API，出问题还多一层要排查。这个文件自己写完不到 100 行。

const DB_NAME = 'offer-lens'
const DB_VERSION = 1

/** 库里的表名。一条分析记录 = 一份快照，所以只有一张表 */
export const STORE = 'analyses'

let opening: Promise<IDBDatabase> | null = null

/**
 * 打开（必要时创建）数据库。
 * 返回的是缓存的同一个 Promise：每次操作都 open 一次会开出多条连接，
 * 后面写操作就要互相等锁，还会撞上 onblocked。
 */
export function openDB(): Promise<IDBDatabase> {
  if (opening) return opening

  opening = new Promise((resolve, reject) => {
    // 隐私模式 / 极老的浏览器可能根本没有这个对象。
    // 不先判一下，报出来的是「Cannot read property 'open' of undefined」，看不懂
    if (typeof indexedDB === 'undefined') {
      reject(new Error('这个浏览器不支持本地数据库（IndexedDB），历史记录用不了'))
      return
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION)

    // 只有「第一次打开」或「版本号变大」才会进这里。建表、建索引都写在这。
    // 注意：这里不能 await 别的东西，事务一让出控制权就会被自动提交
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        // 历史列表要按时间倒序。建了索引就能让数据库排好再返回，
        // 比「全表读出来再 sort」省一次遍历
        store.createIndex('createdAt', 'createdAt')
      }
    }

    req.onsuccess = () => {
      const db = req.result
      // 另一个标签页要升级版本时，会请求当前连接让位。不让的话对方一直卡在
      // onblocked 上（用户看到的就是「另一个页面没关」的提示）
      db.onversionchange = () => {
        db.close()
        opening = null
      }
      resolve(db)
    }

    req.onerror = () => reject(req.error ?? new Error('打开本地数据库失败'))
  })

  // 失败要清掉缓存，否则这次失败会被一直复用，只能刷新页面才好
  opening.catch(() => {
    opening = null
  })

  return opening
}

/**
 * 在一个事务里跑一次操作，等**事务**结束才返回结果。
 *
 * 为什么不等请求的 onsuccess 就返回：请求成功只说明「这条数据进了事务」，
 * 事务本身还可能在最后整体失败（磁盘满、约束冲突）。写操作必须等 oncomplete
 * 才算真的落盘 —— 这是 IndexedDB 和 localStorage 最不一样的地方。
 */
export function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction
        try {
          tx = db.transaction(STORE, mode)
        } catch (e) {
          // 库被别的标签页删掉了之类的极端情况，会在这里同步抛
          reject(e)
          return
        }

        let result: T
        const req = fn(tx.objectStore(STORE))
        req.onsuccess = () => {
          result = req.result
        }
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => reject(tx.error ?? new Error('本地数据读写失败'))
        tx.onabort = () => reject(tx.error ?? new Error('本地事务被中止'))
      }),
  )
}
