import { describe, it, expect } from 'vitest'
import { safeParseJSON } from './safeParseJSON'

// 每条锁一种真实会遇到的坏情况。测试的价值不是证明现在对，
// 是防止以后有人改坏 —— 尤其是第 4 条。
describe('safeParseJSON', () => {
  // ① 加了兜底不能把正常情况搞坏
  it('1. 标准 JSON 直接解析', () => {
    expect(safeParseJSON<{ score: number }>('{"score":78}')).toEqual({ score: 78 })
  })

  // ② 有些客户端或代理会把内容包进 markdown 围栏
  it('2. 剥掉 ```json 围栏', () => {
    const raw = '```json\n{"score":78}\n```'
    expect(safeParseJSON<{ score: number }>(raw)?.score).toBe(78)
  })

  // ③ 模型最爱在前后加客套话
  it('3. 前后有解释文字', () => {
    const raw = '好的，以下是分析结果：{"score":78} 希望有帮助'
    expect(safeParseJSON<{ score: number }>(raw)?.score).toBe(78)
  })

  // ④ 最关键的一条：dimensions 是「数组套对象」= 括号套括号。
  //    如果有人把 indexOf 换成懒惰正则，截取会在内层 } 处停下，这条立刻红
  it('4. 嵌套对象不能被截断', () => {
    const raw = '{"score":78,"dimensions":[{"name":"技术栈","score":80}]}'
    const obj = safeParseJSON<{ dimensions: { name: string }[] }>(raw)
    expect(obj?.dimensions[0].name).toBe('技术栈')
  })

  // ⑤ 坏输入必须老老实实返回 null，绝不能抛错 —— 抛了就说明兜底没兜住
  it('5. 彻底是废文字返回 null', () => {
    expect(safeParseJSON('抱歉，我无法完成这个请求')).toBeNull()
  })
})
