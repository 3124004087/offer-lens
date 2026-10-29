# TypeScript 速查（只覆盖本项目用到的部分）

> 目标：**能读懂项目里的 TS**，不要求你能从零写复杂类型。
> 项目里出现的 TS 语法 100% 在下面 9 条之内，看完这一页就不会卡。

---

## 1. 类型标注：`变量名: 类型`

```ts
const count: number = 0
```

冒号后面就是"这个东西是什么类型"。**写错了编辑器立刻标红，但代码照常运行**（TS 类型在编译时会被全部擦掉，浏览器根本看不到）。

项目里：
```ts
export function extractKeywords(text: string): string[] { ... }
//                                 ↑参数是字符串   ↑返回值是字符串数组
```

**人话**：告诉编译器"我要往里塞什么、会拿出什么"。

---

## 2. interface：描述一个对象长什么样

```ts
export interface KeywordDiff {
  matched: string[]
  missing: string[]
  extra: string[]
}
```

**人话**：给对象画一张"表格模板"。`types/index.ts` 里全是这种东西。

用的时候：
```ts
const diff: KeywordDiff = diffKeywords(a, b)
diff.matched   // ✅ 有提示
diff.matchd    // ❌ 立刻报错，拼错了
```

**项目的价值**：字段名打错、改了结构忘了改调用方，全靠它兜。

---

## 3. 可选属性：`?`

```ts
subtitle?: string
```

**人话**：这个字段**可以没有**。等价于 `string | undefined`。

```ts
interface Foo { a: string; b?: string }
const x: Foo = { a: '1' }        // ✅ b 不传也行
const y: Foo = { b: '1' }        // ❌ 缺 a，报错
```

项目里：`TextPanel` 的 7 个 props，只有 `title` 和 `modelValue` 是必填的，其余都带 `?`。

---

## 4. 联合类型：`|`（这个最常用）

```ts
type: 'weak' | 'missing' | 'good'
```

**人话**：只能是这几个值里的一个，写别的就报错。

```ts
type: 'week'   // ❌ 报错，因为 week ≠ weak
```

比写 `type: string` 强太多——`string` 什么都能塞，`'weak' | ...` 只能塞对的。

项目里 `RewriteItem.type`、`Question.category` 都是这种写法。

---

## 5. 数组类型：`string[]`

```ts
matched: string[]      // 字符串数组
questions: Question[]  // Question 对象数组
```

**人话**：`类型[]` 就是"这种类型组成的数组"。

---

## 6. Record：一个"键值对字典"

```ts
const ALIAS: Record<string, string> = {
  vue3: 'vue',
  vue2: 'vue',
}
```

**人话**：`Record<键的类型, 值的类型>`。上面这行的意思是"键是字符串，值也是字符串"。

只在 `ALIAS` 这一处用到，看到 `Record<K, V>` 知道是字典就行。

---

## 7. 泛型：`<...>`（认得就行，不用会写）

有三种长相，都是同一个东西：

```ts
ref<Analysis | null>(null)          // ① ref 里装的是 Analysis 或 null
defineProps<{ title: string }>()    // ② props 的类型
defineEmits<{ 'update:modelValue': [value: string] }>()   // ③ emit 的类型
```

**人话**：尖括号是给函数"填空"的。`ref` 本身不知道你要装什么，你用 `<Analysis>` 告诉它。

第 ③ 条那个 `[value: string]` 是"参数列表"的意思：emit 的时候要传一个 string。

**你不需要会写泛型**，只需要知道"尖括号里写的是类型"。

---

## 8. `as`：类型断言（"我确信它是这个类型"）

```ts
const data = JSON.parse(raw) as Partial<Draft>
```

**人话**：`JSON.parse` 的返回值 TS 只能推断成 `any`（因为是运行时才决定的），用 `as` 手动告诉它"我知道这是个对象"。

`Partial<Draft>` = "Draft 的所有字段都变成可选的"。因为用户存的草稿可能缺字段。

⚠️ **`as` 是逃生舱，不是常规操作**。它骗过编译器但不做任何运行时检查，用多了等于没有 TS。

---

## 9. `any`：放弃治疗

```ts
function foo(x: any) { ... }
```

**人话**：什么类型都行，TS 不再管它。

**用法建议**：卡住的时候先用 `any` 让流程跑通，**但一定留个 TODO**，回头补。宁可 `any` 也不要为了凑类型卡两小时——你的主线是 Vue，不是 TS。

---

## 遇到这三个报错怎么读

项目里 `npm run build` 会跑 `vue-tsc --noEmit`，类型错就打包失败。常见三种：

**① `Property 'xxx' does not exist on type 'YYY'`**
→ 你在 YYY 上用了一个它没有的字段。八成是拼错了，或者改了接口忘了同步。

**② `Type 'string' is not assignable to type 'number'`**
→ 类型对不上。看两边，改掉不合适的那一边。

**③ `Object is possibly 'null'` / `possibly 'undefined'`**
→ 这个值可能是空的，你得先判断：
```ts
if (!value) return
value.foo   // 现在 TS 知道它不是空了
```
或者用可选链 `value?.foo`、空值合并 `value ?? '默认值'`。

---

## 你现在只需要做到

- [x] 看到 `: string` 知道是类型标注
- [x] 看到 `interface` 知道是对象模板
- [x] 看到 `|` 知道是"只能是这几个之一"
- [x] 看到 `<...>` 知道是"填类型"
- [x] 看到 `as` 知道是"强行断言"
- [x] 报错能看懂大意，能定位到哪一行

**做到这些，你就能无障碍读这个项目的全部代码。**

写不出来的时候直接用 `any`，或者来问我。TS 的优先级排在 JS、CSS、Vue3 之后，现在不值得为它停下来专门学。
