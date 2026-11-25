/**
 * EdgeOne Pages 版 /api/chat —— 国内部署用这个入口
 *
 * 为什么有两个入口：
 *   Vercel 和 EdgeOne 的函数签名不一样（Vercel 是 `export default handler(Request)`，
 *   EdgeOne 是 `export onRequest(context)`，Key 从 `context.env` 读而不是 `process.env`）。
 *   但**转发逻辑只有这一份**：请求体协议、错误码、SSE 透传三段完全一致。
 *   前端永远只请求 `/api/chat`，换平台不用改任何前端代码。
 *
 * EdgeOne 的运行时是 V8（和 Cloudflare Workers 同类），注意三条限制：
 *   1. 没有 Node 内置模块，也不能引 npm 包（这里本来也不需要）
 *   2. 没有 `Response.json()`，必须 `new Response(JSON.stringify(...))`
 *   3. 环境变量在控制台配，代码里从 `context.env` 取
 *
 * 路径映射：edge-functions/api/chat.js → POST /api/chat
 */
const UPSTREAM = 'https://api.deepseek.com/chat/completions'

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)

  let body
  try {
    body = await request.json()
  } catch {
    return reply({ error: 'bad_json' }, 400)
  }

  const {
    system = '',
    user = '',
    json = false,
    stream = true,
    temperature = 0.3,
  } = body ?? {}

  if (!user || typeof user !== 'string') return reply({ error: 'user_required' }, 400)

  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) return reply({ error: 'missing_api_key' }, 500)

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      stream,
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
    }),
  })

  // 上游失败时可能返回 JSON 错误体而不是流，必须提前判断，
  // 否则前端 getReader() 会拿到非 SSE 数据，解析直接报错
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return reply({ error: 'upstream_failed', status: upstream.status, detail }, upstream.status)
  }

  // 非流式（评分 / 出题用）：直接把 JSON 透传回去
  if (!stream) {
    const data = await upstream.text()
    return new Response(data, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  // 流式：原样转发 SSE。X-Accel-Buffering: no 是让边缘节点别攒包，
  // 少了它，逐字效果会变成「憋几秒然后一次性吐出来」
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
