// src/prompts/question.ts
// 面试题预测的「任务说明书」。单独一个文件的理由同 score.ts / rewrite.ts：
// 嫌题太多、嫌思路太虚，改的都只是这里，不用去组件里翻一段中文。
//
// ⚠️ 字段名必须和 types/index.ts 的 Question 对齐
// （category / question / hint / difficulty），改一边就得改另一边，
// 对不上时 useQuestions 映射出来的字段全是 undefined —— 和前两个 prompt 同一条纪律。

export const QUESTION_SYSTEM = `你是资深前端面试官，正在为一位候选人准备面试。
根据他的简历和这份 JD，预测这次面试最可能被问到的 8 道题。
只输出 json，不要 markdown 代码块，不要任何解释文字。
json 结构固定为：
{
  "items": [
    {
      "category": "basic | project | scene 三选一",
      "question": "面试官会问的完整问句，30 字以内",
      "hint": "答题思路，分 3 个要点，60 字以内",
      "difficulty": 1
    }
  ]
}
category 只能是这三个词之一，不要自创分类：
- basic：JS / CSS / 浏览器 / Vue3 原理类的通用题，和简历无关也会问
- project：从简历里挑一条具体经历追问，问句里必须出现简历中的项目名或技术点
- scene：给一个真实工作场景，问怎么设计或怎么排查，例如「上线后首屏突然变慢」
数量固定 8 道：basic 3 道、project 3 道、scene 2 道。
difficulty 是 1 到 3 的整数：1 = 基础必答，2 = 要想一下，3 = 答不好很正常。
hint 写的是「怎么答」不是「答案本身」：分点写清楚思路，不要写成背诵式的长句。
project 类只许引用简历里真实存在的项目和技术栈：编一个不存在的项目，候选人当场就露馅。`

/**
 * 拼这次的「原始材料」：简历 + JD + 本地算出的缺失关键词。
 *
 * 截断比 score.ts 更短（1500 / 800，评分那边是 2500 / 1200），原因：
 * 出题只需要知道「他做过什么、这个岗位要什么」。简历里的自我评价、
 * 社团经历、兴趣爱好对出题没用，塞进去反而让 8 道题全围着同一段经历转。
 *
 * 缺失关键词仍然由 useKeywordExtract 在本地算好再传进来（W1 的老规矩：
 * 本地能算的绝不交给 AI），模型有了明确靶子，project 类更容易问到真缺口。
 */
export function buildQuestionUser(resume: string, job: string, missing: string[]) {
  const missText = missing.length > 0 ? missing.join('、') : '（无）'

  return `【简历】\n${resume.slice(0, 1500)}\n\n【岗位 JD】\n${job.slice(0, 800)}\n\n【本地比对出的缺失关键词】\n${missText}`
}
