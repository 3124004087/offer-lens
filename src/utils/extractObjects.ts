// 从「还没写完的 JSON 数组」里，把已经完整的对象单独取出来。
//
// 为什么需要它：改写建议走流式，每次收到的都是半截字符串，
// 直接 JSON.parse 必然失败；等全部到齐再解析，流式就白做了。
// 唯一可行的路：在半截里把「已经闭合的对象」先抠出来上屏。
//
// 依据不是技巧，是 JSON 的语法本身：对象结束 = 最外层花括号配平。
export function extractObjects(text: string): any[] {
    // 用 any[]：拿到的数据形状由模型决定，事先无法约束；
    // 真正的字段校验放在 useRewrite 映射时做，不塞进这个纯函数
    const result: any[] = [];

    let depth = 0;      // 当前在第几层花括号里；回到 0 = 一个对象收尾
    let start = -1;     // 当前对象从哪个下标开始；-1 = 现在没有在收的对象
    let instring = false; // 是否在引号内部（在里面的 { } 只是文字）
    let escape = false; // 上一个字符是不是反斜杠（\" 里的引号不算字符串结束）

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        // ① 字符串内部：只关心引号什么时候结束，其他字符一律放行。
        //    escape 的判断必须放最前：被放行的字符（包括 \ 自己）不能再当转义
        if (instring) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === '"') instring = false;
            // continue：字符串里的字符绝不能掉进下面的花括号计数，
            // 否则建议句里一个 { 就能让 depth 永远回不到 0，整条建议消失
            continue;
        }

        // ② 进入字符串。continue 表示「这个字符已定性，看下一个」
        if (ch === '"') {
            instring = true;
            continue;
        }

        // ③ 花括号计数，主逻辑
        if (ch === '{') {
            if (depth === 0) start = i; // 第 0 层遇到 { 才是新对象的开头
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                // i 是 } 的下标，所以要 + 1 才能把右括号切进去
                try {
                    result.push(JSON.parse(text.slice(start, i + 1)));
                } catch {
                    // 单个对象坏了跳过，不影响后面继续收：
                    // 一条脏数据不该让整个改写列表作废
                }
                start = -1; // 复位，准备收下一个对象
            }
        }
    }

    // 没闭合的半截对象自然丢弃：它还不完整，等下一片数据补齐再收
    return result;
}