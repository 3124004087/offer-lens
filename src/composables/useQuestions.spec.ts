import { describe, it, expect } from 'vitest'
import { normalizeQuestions } from './useQuestions'

/**
 * 只测 normalizeQuestions，不测 run。
 * 理由：run 里除了「发请求」就是「调 normalize」，请求那部分的错误分支
 * 在 useScore 时期已经手测过（401 / 429 / 500）。把纯函数单独抽出来，
 * 才能不花 token 就测边界。
 *
 * 每条用例锁一个真实故障面：
 *   1 正常题全字段对上   —— 字段名和 types 漂移时这里先红
 *   2 category 自创      —— 不兜就掉出三个 Tab，页头 8 道实际只显示 7 道
 *   3 difficulty 脏值    —— "中等" 变 NaN，三个难度点一个都不亮
 *   4 超过 8 条截断      —— 多出来的没地方放
 *   5 脏条目被丢弃       —— 空题干会渲染成空卡片，且不能白占 8 条名额
 *   6 不是数组           —— 模型偶尔把 items 写成字符串
 */
describe('normalizeQuestions', () => {
  it('一条正常题：字段全部对上，mastered 补 false', () => {
    const list = normalizeQuestions([
      {
        category: 'scene',
        question: '首屏突然变慢怎么排查',
        hint: '1 看 Performance 2 找长任务 3 拆分包',
        difficulty: 2,
      },
    ])

    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      id: '0-scene',
      category: 'scene',
      question: '首屏突然变慢怎么排查',
      hint: '1 看 Performance 2 找长任务 3 拆分包',
      difficulty: 2,
      mastered: false,
    })
  })

  it('category 是模型自创的词时归到 basic，不掉出 Tab', () => {
    const list = normalizeQuestions([
      { category: 'framework', question: 'Vue3 响应式怎么实现的', difficulty: 1 },
    ])

    expect(list[0].category).toBe('basic')
    // id 也跟着兜底后的分类走，否则 id 和分类对不上，调试时误导
    expect(list[0].id).toBe('0-basic')
  })

  it('difficulty 脏值收敛成 1-3 的整数', () => {
    const list = normalizeQuestions([
      { question: '题一', difficulty: '中等' }, // 转数字得 NaN
      { question: '题二', difficulty: 5 }, // 超上限
      { question: '题三', difficulty: 0 }, // 低于下限
      { question: '题四' }, // 没给
      { question: '题五', difficulty: '3' }, // 字符串数字，能转
    ])

    expect(list.map((q) => q.difficulty)).toEqual([1, 3, 1, 1, 3])
  })

  it('超过 8 条只留前 8 条', () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({
      category: 'basic',
      question: `第 ${i} 题`,
      difficulty: 1,
    }))

    expect(normalizeQuestions(raw)).toHaveLength(8)
  })

  it('脏条目被丢弃，而且不占 8 条名额', () => {
    const raw = [
      null,
      '这是一道字符串题',
      { category: 'basic' }, // 没有题干
      { category: 'basic', question: '   ' }, // 题干全是空格
      ...Array.from({ length: 8 }, (_, i) => ({ category: 'basic', question: `好题 ${i}` })),
    ]

    const list = normalizeQuestions(raw)
    expect(list).toHaveLength(8)
    expect(list[0].question).toBe('好题 0')
  })

  it('items 不是数组时返回空数组，不抛错', () => {
    expect(normalizeQuestions(undefined)).toEqual([])
    expect(normalizeQuestions('{"items":[]}')).toEqual([])
    expect(normalizeQuestions({ items: [] })).toEqual([])
  })
})
