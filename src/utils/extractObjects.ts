// 从「还没写完的 JSON 文本」里，把已经完整的对象单独取出来。
//
// 为什么需要它：改写建议走流式，每次收到的都是半截字符串，
// 直接 JSON.parse 必然失败；等全部到齐再解析，流式就白做了。
//
// 为什么用「栈」而不是数 depth 回到 0：json_object 模式强制顶层是对象，
// 真实流的形状是 {"items":[{...},{...}]}——条目在第 1 层，
// 每条收尾时深度只回到 1，回到 0 要等整体结束。
// 单靠「深度归零才收」会让流式失效（写 useRewrite 时发现的设计洞）。
export function extractObjects(text: string): any[] {
    // 用 any[]：拿到的数据形状由模型决定，事先无法约束；
    // 业务字段的校验放在 useRewrite 做，这里只管结构
    const result: any[] = [];

    // 栈：每开一层 { 就压一个起始下标，配平的 } 把它弹出来。
    // 想知道「这个 } 收的是哪一层的对象」，计数器做不到，栈可以
    const starts: number[] = [];

    let instring = false; // 是否在引号内部（在里面的 { } 只是文字）
    let escape = false;   // 上一个字符是不是反斜杠（\" 里的引号不算字符串结束）

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        // ① 字符串内部：只关心引号什么时候结束，其他字符一律放行。
        //    escape 的判断必须放最前：被放行的字符（包括 \ 自己）不能再当转义
        if (instring) {
            if (escape) escape = false;
            else if (ch === '\\') escape = true;
            else if (ch === '"') instring = false;
            // continue：字符串里的字符绝不能掉进下面的花括号逻辑，
            // 否则建议句里一个 { 就能让配平全乱，整条建议消失
            continue;
        }

        // ② 进入字符串。continue 表示「这个字符已定性，看下一个」
        if (ch === '"') {
            instring = true;
            continue;
        }

        // ③ 花括号配平，主逻辑
        if (ch === '{') {
            starts.push(i);
        } else if (ch === '}') {
            const s = starts.pop() ?? -1;

            // 弹完之后栈里剩几层 = 这个对象的父级深度。只收两种：
            //   剩 0 层：对象本身就是顶层条目（裸数组，无外壳）
            //   剩 1 层：它是 {"items":[...]} 外壳的直接孩子 —— 真实流式的主力
            // 剩 2 层以上是更深的嵌套结构，不是条目，跳过
            if (s !== -1 && starts.length <= 1) {
                // i 是 } 的下标，所以要 + 1 才能把右括号切进去
                try {
                    result.push(JSON.parse(text.slice(s, i + 1)));
                } catch {
                    // 单个对象坏了跳过，不影响后面继续收：
                    // 一条脏数据不该让整个改写列表作废
                }
            }
        }
    }

    // 已知取舍：外壳 {"items":[...]} 自己收尾时（剩 0 层）也会被整体解析一次，
    // 它没有业务字段，由 useRewrite 的字段过滤挡掉——结构归这里，业务归那里。
    // 没闭合的半截对象自然丢弃：等下一片数据补齐再收
    return result;
}
