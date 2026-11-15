import { describe, it, expect } from 'vitest'
import { extractObjects } from './extractObjects'

/**
 * 用例各锁一个真实 bug 面：
 *   1 空输入不炸        —— AI 流开始前 buffer 就是空的
 *   2 完整对象全收      —— 正常收尾时一条不丢
 *   3 半截不抛错且不收  —— 流式 90% 的时间都在这种状态
 *   4 字符串里的花括号  —— 不处理 instring 会整条丢失
 *   5 转义引号          —— 字符串边界认错 → 配平全乱
 *   6 逐字到达只增不减  —— 界面上已出现的内容不能闪一下消失
 *   7 带壳半截也能收    —— json_object 强制顶层是对象，这才是真实形状
 *   8 壳收尾会整体解析一次 —— 已知取舍，业务过滤归 useRewrite
 *
 * 第 7 条是关键：最早版本只在「深度回到 0」时收对象，裸数组的用例全绿，
 * 但真实流是 {"items":[...]}，条目在第 1 层，等回 0 已整体结束——
 * 用例全绿掩盖了形状不一致（W2 的老课）。
 */
describe('extractObjects', () => {
  it('空串返回空数组，不抛错', () => {
    expect(extractObjects('')).toEqual([])
  })

  it('两个完整对象全部捞出', () => {
    // 外层没有 [ ] 也要能收：这个函数只认花括号配平，不认数组括号
    expect(extractObjects('{"a":1},{"b":2}')).toHaveLength(2)
    expect(extractObjects('{"a":1},{"b":2}')[0]).toEqual({ a: 1 })
  })

  it('第二个对象没闭合，只捞第一个且不抛错', () => {
    // 流式的常态：第二个对象的 { 已经把 depth 加到 1，
    // 但没等到 }，所以不 push、也不报错，等下一片补齐
    expect(extractObjects('{"a":1},{"b":')).toHaveLength(1)
  })

  it('字符串里的花括号不计入深度', () => {
    // 建议句里引用变量名很常见（把 {a} 改成 b）。
    // 如果 instring 不生效，{ 会被当新对象开头，depth 永远回不到 0 → 整条丢失
    const out = extractObjects('{"origin":"把 {a} 改成 b","type":"weak"}')
    expect(out).toHaveLength(1)
    // 内容必须原样保留：花括号是文字，不是结构
    expect(out[0].origin).toBe('把 {a} 改成 b')
  })

  it('转义引号不会提前结束字符串', () => {
    // \" 里的 " 不是字符串结束；不处理 escape 的话，
    // 字符串边界认错 → 后面的 { } 会被当结构 → 计数全乱
    const out = extractObjects(String.raw`{"suggestion":"把 \"a\" 改成 {b}"}`)
    expect(out).toHaveLength(1)
    expect(out[0].suggestion).toBe('把 "a" 改成 {b}')
  })

  it('逐字到达时，数量只增不减', () => {
    // 模拟真实流式：每次只给一小片，每次都要拿整个 buffer 全量重扫。
    // 已经收出的对象不能在下一次扫描中消失，否则界面会闪
    const full = '[{"a":1},{"b":2},{"c":3}]'
    let prev = 0
    for (let i = 1; i <= full.length; i++) {
      const n = extractObjects(full.slice(0, i)).length
      expect(n).toBeGreaterThanOrEqual(prev)
      prev = n
    }
    // 扫到最后一字时，三个都在
    expect(prev).toBe(3)
  })

  it('带 {"items":[...]} 外壳、第二条还没写完时，第一条已能捞出', () => {
    // json_object 模式强制顶层是对象，真实流就是这个形状。
    // 这条是整个函数存在的理由：不带壳用例全绿的版本，在这里会返回空数组
    expect(extractObjects('{"items":[{"a":1},{"b":')).toEqual([{ a: 1 }])
  })

  it('外壳收尾时会被整体解析一次（已知取舍，业务过滤归 useRewrite）', () => {
    const out = extractObjects('{"items":[{"a":1},{"b":2}]}')
    // 前两个是条目；最后一个是整体收尾时解析出来的壳，它没有业务字段
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ a: 1 })
    expect(out[1]).toEqual({ b: 2 })
    expect(out[2]).toEqual({ items: [{ a: 1 }, { b: 2 }] })
  })
})
