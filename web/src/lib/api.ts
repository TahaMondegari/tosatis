import type { OffersResult, ProductFull, Profile, ShopFull, UIBlock } from './types';

export function ctxParams(p: Profile | null, extra: Record<string, unknown> = {}) {
  const q = new URLSearchParams();
  if (p?.lat != null && p?.lng != null) { q.set('lat', String(p.lat)); q.set('lng', String(p.lng)); }
  if (p?.mode) q.set('mode', p.mode);
  if (p?.priorities?.length) q.set('priorities', p.priorities.join(','));
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== false && v !== '') q.set(k, v === true ? '1' : String(v));
  return q.toString();
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}

export const api = {
  product: (id: string) => get<ProductFull>(`/api/products/${id}`),
  offers: (id: string, p: Profile | null, f: Record<string, unknown>) => get<OffersResult>(`/api/products/${id}/offers?${ctxParams(p, f)}`),
  shop: (id: string, p: Profile | null) => get<ShopFull>(`/api/shops/${id}?${ctxParams(p)}`),
  health: () => get<{ ok: boolean; ai: boolean }>('/api/health'),
  stats: () => get<{ shops: number; products: number; offers: number; installmentShops: number; latestPrice: string }>('/api/stats'),
  action: async (tool: string, args: Record<string, unknown>, profile: Profile | null) => {
    const r = await fetch(`/api/action/${tool}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ args, profile }) });
    if (!r.ok) throw new Error(`${r.status}`);
    return (await r.json()) as { ui: UIBlock | null; result: unknown };
  },
};

export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'ui'; block: UIBlock }
  | { type: 'status'; text: string }
  | { type: 'agent'; key: string; label: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

/** POST /api/chat and stream SSE events. */
export async function streamChat(body: unknown, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) {
  const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try { onEvent(JSON.parse(line.slice(5))); } catch { /* ignore */ }
      }
    }
  }
}
