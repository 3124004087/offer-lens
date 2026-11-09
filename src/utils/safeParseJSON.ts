/**
 * 把模型返回的一串文字，安全地变成对象。
 *
 * 为什么需要：模型不是编译器，输出不可控 —— 会包 ```json 围栏、会在前后加
 * 「好的，以下是…」、会被 max_tokens 硬截断成半截。直接 JSON.parse 遇到这些
 * 会抛错，没接住就是整个函数中断、页面白屏。
 *
 * 为什么失败返回 null 而不是抛错：
 *   「这次没吐合法 JSON」是预期内的分支，不是异常。返回 null 让返回类型变成
 *   T | null，编译器会强制调用方写空值处理，漏了当场报错；抛错则依赖每个人
 *   都记得包一层「万一出错怎么办」，一定会漏。
 */

export function safeParseJSON<T>(raw: string): T | null {
  if (!raw) return null

  // 一级：模型听话，直接解析。绝大多数情况走这里
  try {
    return JSON.parse(raw) as T
  } catch {
    // 不是合法 JSON，进下一级
  }

  // 二级：截首个 { 到最后一个 }，围栏和前后废话顺带被剥掉
  //
  // 用 indexOf/lastIndexOf 而不是正则，两个原因：
  //   1. 正则要转义 \{ 和 [\s\S]，漏一个反斜杠就静默失效，很难查
  //   2. 懒惰匹配 *? 遇到嵌套对象会在内层的 } 处提前停下，
  //      而 dimensions 正是「数组套对象」，必然踩中（spec 第 4 条锁的就是它）
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')

  // end > start 不能省：万一文字是 `x} y {`，右括号在左括号前面，
  // 切出来长度是负数，slice 会返回空串，白跑一次
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1)) as T
    } catch {
      // 剪完还是不行，进第三级
    }
  }

  // 三级：认输，交给上层降级（回落到本地关键词结果），不在这里瞎修
  return null
}
