/**
 * 唯一的后端接口：AI 流式代理
 *
 * ⚠️ 这个文件是 W2 的内容，现在不用改，先放着。
 * 作用：把前端请求转发给 DeepSeek，并把 API Key 藏在服务端。
 *
 * 为什么不能前端直连 AI：
 *   1. Key 会被打进 JS 产物，任何人 F12 就能白嫖
 *   2. 厂商不允许浏览器跨域直连（CORS）
 *   3. 限流、重试、错误兜底做不了
 */
export const config = { runtime: 'edge' }

const UPSTREAM = 'https://api.deepseek.com/chat/completions'

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)

  let body: any
  try {
    body = await req.json()
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

  const apiKey = process.env.DEEPSEEK_API_KEY
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

  // 非流式（评分用）：直接把 JSON 透传回去
  if (!stream) {
    const data = await upstream.text()
    return new Response(data, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  // 流式：原样转发 SSE
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
