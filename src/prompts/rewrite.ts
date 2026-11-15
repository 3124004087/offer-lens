// src/prompts/rewrite.ts
// 改写功能的「任务说明书」。为什么单独一个文件：prompt 是全项目改动
// 最频繁的东西（嫌建议太长、嫌措辞太虚，改的都只是这里），单独放，
// 就不用去几百行的组件里翻一段中文。
//
// ⚠️ 字段名必须和 types/index.ts 的 RewriteItem 对齐，改一边就得改另一边，
// 否则 useRewrite 映射出来的字段全是 undefined —— 和 score.ts 是同一条纪律。

export const REWRITE_SYSTEM = `你是资深前端简历顾问，负责逐句改写简历，让它更贴近目标岗位。
只输出 json，不要 markdown 代码块，不要任何解释文字。
json 结构固定为：
{
  "items": [
    {
      "origin": "从简历里原样摘录的完整句子，一个字都不要改",
      "suggestion": "改写后的句子，保留事实，只优化表达，35 字以内",
      "reason": "为什么这样改，25 字以内",
      "type": "weak | missing | good 三选一"
    }
  ]
}
type 的判定标准：
- weak：表达弱，如「负责了登录页开发」「参与了项目」，动词没有分量
- missing：句子没体现 JD 要求的关键词，改写时要补进去
- good：本身写得好、不用改（最多 1 条，用于对比）
最多 6 条，按 weak > missing > good 的优先级挑。
origin 必须是简历正文中真实存在的连续句子：左右对比的左边是原文，
一旦你自己编一句，整个「对比」就是假的。`

/**
 * 拼这次的「原始材料」：简历 + JD + 本地算出的缺失关键词。
 *
 * 第三段是刻意设计的：缺失关键词由 useKeywordExtract 在本地算好
 * （W1 的能力，不花一分钱），直接喂给模型——它不用自己找差距，
 * 输出更稳、token 更省。「本地能算的绝不交给 AI」是本项目的取舍主线。
 */
export function buildRewriteUser(resume: string, job: string, missing: string[]) {
  // 截断理由同 score.ts：超长输入费 token，模型反而抓不住重点
  const missText = missing.length > 0 ? missing.join('、') : '（无）'

  return `【简历】\n${resume.slice(0, 2500)}\n\n【岗位 JD】\n${job.slice(0, 1200)}\n\n【本地比对出的缺失关键词】\n${missText}`
}
