import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { streamSSE } from 'hono/streaming';
import { compress } from 'hono/compress';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cat from './catalog.ts';
import { runAgent, type ClientMsg } from './agent.ts';
import { runTool, ctxFrom } from './tools.ts';
import { llmEnabled, LLM_MODEL } from './llm.ts';
import { langStore } from './i18n.ts';
import { callsEnabled, callsPublicConfig, startCall, getCall, handleWebhook } from './poshtyar.ts';

const app = new Hono();
app.use('/api/*', compress());
// UI language for server-built labels: header from the app (falls back to Persian)
app.use('/api/*', (c, next) => langStore.run({ lang: c.req.header('x-lang') === 'en' ? 'en' : 'fa' }, () => next()));

const num = (v: string | undefined) => (v == null || v === '' || isNaN(Number(v)) ? undefined : Number(v));
const flag = (v: string | undefined) => v === '1' || v === 'true';
function ctxFromQuery(q: Record<string, string>): cat.Ctx {
  return {
    lat: num(q.lat), lng: num(q.lng), mode: (q.mode as any) || 'car',
    installment: flag(q.installment), torobPay: flag(q.torobPay), openNow: flag(q.openNow), warranty: flag(q.warranty),
    maxKm: num(q.maxKm), minPrice: num(q.minPrice), maxPrice: num(q.maxPrice),
    priorities: q.priorities ? q.priorities.split(',') : undefined,
  };
}

app.get('/api/health', (c) => c.json({ ok: true, ai: llmEnabled(), model: llmEnabled() ? 'torob-yar' : 'rules', calls: callsPublicConfig() }));

// ---- AI phone calls to shops (Poshtyar). Disabled unless POSHTYAR_ENABLED=true.
app.post('/api/calls', async (c) => {
  if (!callsEnabled()) return c.json({ error: 'calls disabled' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const shop = typeof b.shopId === 'string' ? cat.getShop(b.shopId) : null;
  if (!shop) return c.json({ error: 'shop not found' }, 404);
  const product = typeof b.productId === 'string' ? cat.getProduct(b.productId) : null;
  const offer = product ? cat.getOffers(product.id, {})?.offers.find((o) => o.shop.id === shop.id) : null;
  const rec = startCall({ shopId: shop.id, shopName: shop.name, phone: shop.phone, productId: product?.id, productTitle: product?.title, registeredPrice: offer?.price ?? null, purpose: b.purpose, userName: typeof b.userName === 'string' ? b.userName.slice(0, 40) : undefined });
  return c.json(rec);
});
app.get('/api/calls/:id', (c) => {
  const rec = getCall(c.req.param('id'));
  return rec ? c.json(rec) : c.json({ error: 'not found' }, 404);
});
// Poshtyar tool webhook `report_shop_answer` (set the same X-Webhook-Token in the Poshtyar dashboard)
app.post('/api/poshtyar/webhook', async (c) => {
  const b = await c.req.json().catch(() => null);
  const r = handleWebhook(b, c.req.header('x-webhook-token'));
  return c.json(r.body, r.status as 200 | 401);
});
app.get('/api/stats', (c) => c.json(cat.datasetStats()));
app.get('/api/coverage', (c) => c.json(cat.coverage()));

// Post-purchase survey: append-only log (data/feedback.jsonl); later feeds shop reputation in ranking.
const FEEDBACK_FILE = resolve(process.env.FEEDBACK_FILE ?? 'data/feedback.jsonl');
app.post('/api/feedback', async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || typeof b.shopId !== 'string') return c.json({ error: 'bad request' }, 400);
  const row = { at: new Date().toISOString(), shopId: b.shopId.slice(0, 60), productId: typeof b.productId === 'string' ? b.productId.slice(0, 60) : null, bought: !!b.bought, find: Math.max(0, Math.min(5, Number(b.find) || 0)), buy: Math.max(0, Math.min(5, Number(b.buy) || 0)), match: Math.max(0, Math.min(5, Number(b.match) || 0)), note: typeof b.note === 'string' ? b.note.slice(0, 500) : null };
  try { mkdirSync(resolve(FEEDBACK_FILE, '..'), { recursive: true }); appendFileSync(FEEDBACK_FILE, JSON.stringify(row) + '\n'); } catch (e) { console.error('[feedback]', e); }
  return c.json({ ok: true });
});

app.get('/api/search', (c) => {
  const q = c.req.query();
  return c.json(cat.searchProducts({ query: q.q, category: q.category, brand: q.brand, minPrice: num(q.minPrice), maxPrice: num(q.maxPrice), sort: q.sort as any, limit: num(q.limit) ?? 12 }, ctxFromQuery(q)));
});
app.get('/api/categories', (c) => c.json(cat.findCategories(c.req.query('q') ?? '')));
app.get('/api/categories/insights', (c) => c.json(cat.categoryInsights(c.req.query('name') ?? '')));

app.get('/api/products/:id', (c) => {
  const p = cat.getProduct(c.req.param('id'));
  return p ? c.json(p) : c.json({ error: 'not found' }, 404);
});
app.get('/api/products/:id/offers', (c) => {
  const q = c.req.query();
  const r = cat.getOffers(c.req.param('id'), ctxFromQuery(q), (q.sort as any) || 'best', q.exclude);
  return r ? c.json({ ...r, offers: r.offers.slice(0, 40) }) : c.json({ error: 'not found' }, 404);
});
app.get('/api/shops/:id', (c) => {
  const s = cat.getShop(c.req.param('id'), ctxFromQuery(c.req.query()));
  return s ? c.json(s) : c.json({ error: 'not found' }, 404);
});

// UI actions reuse the agent tools so buttons and chat render identical cards.
const ACTION_TOOLS = new Set(['find_stores', 'compare_stores', 'compare_products', 'store_details', 'contact_store', 'check_cheaper_nearby', 'find_alternatives', 'plan_visit', 'show_products', 'ask_user']);
app.post('/api/action/:tool', async (c) => {
  const tool = c.req.param('tool');
  if (!ACTION_TOOLS.has(tool)) return c.json({ error: 'unknown action' }, 400);
  const body = await c.req.json().catch(() => ({}));
  try {
    const r = runTool(tool, body.args ?? {}, body.profile ?? {});
    return c.json({ ui: r.ui ?? null, result: r.result });
  } catch (e) {
    console.error('[action]', tool, e);
    return c.json({ error: 'failed' }, 500);
  }
});

app.post('/api/chat', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return c.json({ error: 'bad request' }, 400);
  const messages: ClientMsg[] = body.messages
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-24);
  const profile = body.profile ?? {};
  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    stream.onAbort(() => ac.abort());
    let chain = Promise.resolve();
    const emit = (ev: Record<string, unknown>) => { chain = chain.then(() => stream.writeSSE({ data: JSON.stringify(ev) })).catch(() => {}); };
    try {
      await langStore.run({ lang: profile?.lang === 'en' ? 'en' : 'fa' }, () => runAgent(messages, profile, emit as any, ac.signal));
    } catch (e) {
      console.error('[chat]', e);
      emit({ type: 'error', message: 'یه مشکل موقت پیش اومد. دوباره امتحان کن.' });
    }
    emit({ type: 'done' });
    await chain;
  });
});

// ---- static SPA
const dist = resolve('web/dist');
if (existsSync(dist)) {
  app.use('/assets/*', async (c, next) => { await next(); c.header('Cache-Control', 'public, max-age=31536000, immutable'); });
  app.use('/*', serveStatic({ root: './web/dist' }));
  const index = readFileSync(resolve(dist, 'index.html'), 'utf8');
  app.get('*', (c) => c.html(index));
}

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`ترب‌یار on :${port} · AI ${llmEnabled() ? `on (${LLM_MODEL})` : 'off (rule-based fallback)'}`));

export { ctxFrom };
