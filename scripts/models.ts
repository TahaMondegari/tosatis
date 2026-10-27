// Benchmark hackathon models for tool calling + latency: node --env-file=.env scripts/models.ts
const base = process.env.LLM_BASE_URL ?? 'https://ai.boxapi.ir/ai/v1';
const key = process.env.BOXAPI_API_KEY!;
const models = (process.argv[2] ?? 'gpt-6.1-sol,gpt-6-astra,gpt-6-luna,gpt-6-sol,gpt-5-mini,gpt-5.6-luna,gpt-5.6-terra,gpt-5.6-sol,gpt-5.4-mini').split(',');
const tools = [{ type: 'function', function: { name: 'find_categories', description: 'Map a need to catalogue categories', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } }];
await Promise.all(models.map(async (model) => {
  const t = Date.now();
  try {
    const r = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: 'You are a Persian shopping assistant. Use tools.' }, { role: 'user', content: 'یه کتونی برای پیاده روی میخوام' }], tools, tool_choice: 'auto' }) });
    const j: any = await r.json();
    const m = j.choices?.[0]?.message;
    console.log(model.padEnd(14), r.status, `${Date.now() - t}ms`, m?.tool_calls ? `TOOL ${m.tool_calls[0].function.name}(${m.tool_calls[0].function.arguments})` : (m?.content ?? JSON.stringify(j).slice(0, 160)));
  } catch (e) { console.log(model, 'ERR', (e as Error).message); }
}));
