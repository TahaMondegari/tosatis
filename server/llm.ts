// Minimal OpenAI-compatible client for BoxAPI (chat/completions with streaming + tools).

export const LLM_BASE = process.env.LLM_BASE_URL ?? 'https://ai.boxapi.ir/ai/v1';
export const LLM_KEY = process.env.BOXAPI_API_KEY ?? process.env.LLM_API_KEY ?? '';
export const LLM_MODEL = process.env.LLM_MODEL ?? 'gpt-6-luna';
export const LLM_FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL ?? 'gpt-5.4-mini';
// BoxAPI only allows function tools on chat/completions for reasoning models when reasoning is off.
const EFFORT: Record<string, string | undefined> = { [LLM_MODEL]: process.env.LLM_REASONING_EFFORT ?? 'none', [LLM_FALLBACK_MODEL]: process.env.LLM_FALLBACK_REASONING_EFFORT || undefined };

export type ChatMsg =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type ToolDef = { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } };

export const LLM_RETRIES = Number(process.env.LLM_RETRIES ?? 2);
export const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 45000);

export const llmEnabled = () => !!LLM_KEY;

/** Streams one completion. Calls onText for content deltas; resolves with the full message. */
export async function streamChat(opts: {
  messages: ChatMsg[]; tools?: ToolDef[]; model?: string; signal?: AbortSignal;
  onText?: (delta: string) => void; temperature?: number;
}): Promise<{ content: string; toolCalls: ToolCall[]; finish: string | null }> {
  const body = JSON.stringify({
    model: opts.model ?? LLM_MODEL,
    reasoning_effort: EFFORT[opts.model ?? LLM_MODEL],
    messages: opts.messages,
    tools: opts.tools?.length ? opts.tools : undefined,
    tool_choice: opts.tools?.length ? 'auto' : undefined,
    stream: true,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
  });
  // Retry transient failures (network, timeout, 429, 5xx) with backoff before anything has streamed.
  let res: Response | null = null;
  let lastErr = '';
  for (let attempt = 0; attempt <= LLM_RETRIES; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, Math.min(4000, 600 * 2 ** (attempt - 1)) + Math.random() * 250));
    if (opts.signal?.aborted) throw new Error('aborted');
    const timeout = AbortSignal.timeout(LLM_TIMEOUT_MS);
    try {
      res = await fetch(`${LLM_BASE}/chat/completions`, {
        method: 'POST',
        signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_KEY}` },
        body,
      });
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      lastErr = (e as Error).message;
      console.warn(`[llm] attempt ${attempt + 1} failed: ${lastErr}`);
      res = null;
      continue;
    }
    if (res.ok && res.body) break;
    lastErr = `${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`;
    if (res.status !== 429 && res.status < 500) break; // 4xx (bad request/auth) won't fix itself
    console.warn(`[llm] attempt ${attempt + 1} got ${res.status}, retrying`);
    res = null;
  }
  if (!res || !res.ok || !res.body) {
    throw new Error(`LLM ${lastErr}`);
  }
  let content = '';
  let finish: string | null = null;
  const calls: ToolCall[] = [];
  const decoder = new TextDecoder();
  let buf = '';
  const ctype = res.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) {
    // Provider ignored stream:true
    const j = (await res.json()) as any;
    const m = j.choices?.[0]?.message ?? {};
    if (m.content) { content = m.content; opts.onText?.(m.content); }
    return { content, toolCalls: m.tool_calls ?? [], finish: j.choices?.[0]?.finish_reason ?? null };
  }
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let j: any;
      try { j = JSON.parse(data); } catch { continue; }
      const ch = j.choices?.[0];
      if (!ch) continue;
      const d = ch.delta ?? {};
      if (d.content) { content += d.content; opts.onText?.(d.content); }
      for (const tc of d.tool_calls ?? []) {
        const i = tc.index ?? 0;
        calls[i] ??= { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function?.name) calls[i].function.name += tc.function.name;
        if (tc.function?.arguments) calls[i].function.arguments += tc.function.arguments;
      }
      if (ch.finish_reason) finish = ch.finish_reason;
    }
  }
  return { content, toolCalls: calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` })), finish };
}
