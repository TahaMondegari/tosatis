// Read-only queries over the Torob dataset: products, offers, shops, categories.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { norm, ftsQuery } from './text.ts';
import { haversineKm, etaMinutes, openStatus, hoursTable, freshness, type Hours, type TravelMode, type OpenState } from './geo.ts';

import { tr, loc } from './i18n.ts';
const DB_PATH = resolve(process.env.DB_PATH ?? 'data/torob.db');
if (!existsSync(DB_PATH)) throw new Error(`Database not found at ${DB_PATH}. Run: npm run build:db`);
export const db = new DatabaseSync(DB_PATH, { readOnly: true });
db.exec('PRAGMA cache_size=-64000; PRAGMA mmap_size=300000000;');

export type Ctx = {
  lat?: number; lng?: number; mode?: TravelMode;
  installment?: boolean; torobPay?: boolean; openNow?: boolean; warranty?: boolean;
  maxKm?: number; minPrice?: number; maxPrice?: number;
  priorities?: string[]; // ordered, most important first: price | distance | open | warranty | installment | fresh
};

type Row = Record<string, any>;
const parse = <T,>(s: string | null | undefined, d: T): T => { if (!s) return d; try { return JSON.parse(s) as T; } catch { return d; } };

// ---------------------------------------------------------------- shops

export type PayOption = { p: string; ch: string; min?: number | null; max?: number | null };

export function shopBrief(r: Row, ctx: Ctx = {}) {
  const hours = parse<Hours>(r.hours, null);
  const open = openStatus(hours);
  const km = ctx.lat != null && ctx.lng != null ? haversineKm(ctx.lat, ctx.lng, r.lat, r.lon) : null;
  const pay = parse<PayOption[]>(r.pay, []);
  return {
    id: r.sid as string,
    name: r.name as string,
    address: r.address as string,
    area: r.area as string | null,
    lat: r.lat as number, lng: r.lon as number,
    mall: r.mall as string | null, floor: r.floor as string | null, unit: r.unit as string | null,
    phone: r.phone as string | null,
    instagram: r.instagram as string | null, website: r.website as string | null,
    fastDelivery: r.fast_delivery === null ? null : !!r.fast_delivery,
    installment: !!r.installment,
    torobPay: !!r.torobpay, torobPayInPerson: !!r.torobpay_inperson,
    payments: pay.map((p) => ({ provider: p.p, channel: p.ch === 'in_person' ? 'in_person' : 'unknown', min: p.min ?? null, max: p.max ?? null })),
    open,
    distanceKm: km == null ? null : Math.round(km * 10) / 10,
    etaMinutes: km == null ? null : etaMinutes(km, ctx.mode ?? 'car'),
    travelMode: ctx.mode ?? 'car',
    realName: !!r.real_name,
    nOffers: r.n_offers as number,
  };
}
export type ShopBrief = ReturnType<typeof shopBrief>;

const shopBySid = db.prepare('SELECT * FROM shops WHERE sid = ?');
const shopByRowid = db.prepare('SELECT * FROM shops WHERE id = ?');

export function getShop(sid: string, ctx: Ctx = {}) {
  const r = shopBySid.get(sid) as Row | undefined;
  if (!r) return null;
  const brief = shopBrief(r, ctx);
  const neighbors = r.mall_key
    ? (db.prepare('SELECT * FROM shops WHERE mall_key = ? AND id != ? LIMIT 60').all(r.mall_key, r.id) as Row[]).map((n) => ({
        id: n.sid as string, name: n.name as string, floor: n.floor as string | null, unit: n.unit as string | null,
        cats: parse<string[]>(n.cats, []).slice(0, 2),
      }))
    : [];
  const topProducts = (db.prepare(`SELECT p.pid, p.title, p.images, o.price, o.changed_at FROM offers o JOIN products p ON p.id = o.product
      WHERE o.shop = ? ORDER BY (p.images IS NULL), p.n_shops DESC LIMIT 12`).all(r.id) as Row[]).map((p) => ({
    id: p.pid as string, title: p.title as string, image: parse<string[]>(p.images, [])[0] ?? null, price: p.price as number | null, freshness: freshness(p.changed_at),
  }));
  return {
    ...brief,
    categories: parse<string[]>(r.cats, []),
    hours: hoursTable(parse<Hours>(r.hours, null)),
    mallInfo: r.mall ? { name: r.mall as string, floor: r.floor as string | null, unit: r.unit as string | null, torobShopsInMall: neighbors.length + 1 } : null,
    neighbors: neighbors.slice(0, 12),
    findTips: findInMallTips(brief, neighbors),
    topProducts,
  };
}

function findInMallTips(s: ShopBrief, neighbors: { name: string; floor: string | null; unit: string | null }[]) {
  const tips: string[] = [];
  if (s.mall) {
    tips.push(`داخل «${s.mall}»${s.floor ? tr("، طبقه {0}", s.floor) : ''}${s.unit ? tr("، واحد/پلاک {0}", s.unit) : ''}.`);
    const sameFloor = neighbors.filter((n) => n.floor && s.floor && norm(n.floor) === norm(s.floor)).slice(0, 3);
    if (sameFloor.length) tips.push(`هم‌طبقه با: ${sameFloor.map((n) => `${n.name}${n.unit ? tr(" (واحد {0})", n.unit) : ''}`).join('، ')} — اگر پیدا نکردی از این‌ها بپرس.`);
    if (s.unit && /^\d+/.test(s.unit) && !s.floor) tips.push(`در خیلی از پاساژها رقم اول شماره واحد همان طبقه است (واحد ${s.unit}).`);
    tips.push('معمولاً نگهبانی یا تابلوی راهنمای ورودی پاساژ، فهرست واحدها را دارد.');
  } else if (s.floor || s.unit) {
    tips.push(`در ساختمان${s.floor ? tr("، طبقه {0}", s.floor) : ''}${s.unit ? tr("، واحد {0}", s.unit) : ''} — نشانی خیابانی را دنبال کن.`);
    tips.push('اگر تابلو نداشت، قبل از رفتن تماس بگیر و نشانه بپرس.');
  } else {
    tips.push('این فروشگاه نشانی پاساژ ثبت نکرده؛ نشانی خیابانی را دنبال کن یا قبل از رفتن تماس بگیر.');
  }
  return tips;
}

// ---------------------------------------------------------------- products

export function productBrief(r: Row) {
  const specs = parse<[string, string][]>(r.specs, []);
  return {
    id: r.pid as string,
    title: r.title as string,
    brand: r.brand as string | null,
    category: r.category as string | null,
    image: parse<string[]>(r.images, [])[0] ?? null,
    minPrice: r.min_price as number | null,
    maxPrice: r.max_price as number | null,
    nShops: r.n_shops as number,
    nOffers: r.n_offers as number,
    lastChange: r.last_change as string | null,
    highlights: specs.filter(([k]) => !/نام محصول|شرکت سازنده|برند|مدل/.test(k)).slice(0, 4).map(([k, v]) => ({ key: k, value: v })),
  };
}
export type ProductBrief = ReturnType<typeof productBrief>;

const productByPid = db.prepare('SELECT * FROM products WHERE pid = ?');

export function getProduct(pid: string) {
  const r = productByPid.get(pid) as Row | undefined;
  if (!r) return null;
  return { ...productBrief(r), images: parse<string[]>(r.images, []), specs: parse<[string, string][]>(r.specs, []).map(([key, value]) => ({ key, value })), model: r.model as string | null };
}

type OfferRow = Row & { o_id: number; o_price: number | null; o_title: string; o_descr: string | null; w_provider: string | null; w_months: number | null; changed_at: string | null };

const offersForProduct = db.prepare(`SELECT o.id o_id, o.price o_price, o.title o_title, o.descr o_descr, o.w_provider, o.w_months, o.changed_at, s.*
  FROM offers o JOIN shops s ON s.id = o.shop WHERE o.product = ?`);

const DEFAULT_PRIORITIES = ['price', 'distance', 'open', 'fresh', 'warranty', 'installment'];

function hasWarranty(o: OfferRow) {
  return !!o.w_provider && !/بدون گارانتی|تست و تحویل/.test(o.w_provider);
}

export function offerView(o: OfferRow, ctx: Ctx) {
  const shop = shopBrief(o, ctx);
  return {
    offerId: o.o_id,
    price: o.o_price,
    sellerTitle: o.o_title,
    description: o.o_descr,
    warranty: o.w_provider ? { provider: o.w_provider, months: o.w_months, real: hasWarranty(o) } : null,
    changedAt: o.changed_at,
    freshness: freshness(o.changed_at),
    stock: 'unverified' as const, // dataset has no stock — only a registered offer
    shop,
  };
}
export type OfferView = ReturnType<typeof offerView> & { score?: number; reasons?: string[]; badges?: string[] };

function passes(v: OfferView, ctx: Ctx) {
  if (ctx.installment && !v.shop.installment) return false;
  if (ctx.torobPay && !v.shop.torobPay) return false;
  if (ctx.openNow && !(v.shop.open.state === 'open' || v.shop.open.state === 'open_unknown_hours')) return false;
  if (ctx.warranty && !v.warranty?.real) return false;
  if (ctx.maxKm && v.shop.distanceKm != null && v.shop.distanceKm > ctx.maxKm) return false;
  if (ctx.maxPrice && v.price != null && v.price > ctx.maxPrice) return false;
  if (ctx.minPrice && v.price != null && v.price < ctx.minPrice) return false;
  return true;
}

/** Weighted score from the user's ranked priorities; adds human reasons + badges. */
export function scoreOffers(list: OfferView[], ctx: Ctx) {
  const pri = (ctx.priorities?.length ? ctx.priorities : DEFAULT_PRIORITIES).filter((p) => DEFAULT_PRIORITIES.includes(p));
  for (const p of DEFAULT_PRIORITIES) if (!pri.includes(p)) pri.push(p);
  const weight = Object.fromEntries(pri.map((p, i) => [p, Math.pow(0.62, i)]));
  const prices = list.map((v) => v.price).filter((p): p is number => p != null);
  const minP = Math.min(...prices);
  const dists = list.map((v) => v.shop.distanceKm).filter((d): d is number => d != null);
  const minD = Math.min(...dists);
  // Rank-based (percentile) scores so a single outlier price or far shop doesn't flatten the scale
  const pct = (sorted: number[], x: number) => (sorted.length < 2 ? 1 : 1 - sorted.filter((y) => y < x).length / (sorted.length - 1));
  const sp = [...prices].sort((a, b) => a - b);
  const sd = [...dists].sort((a, b) => a - b);
  for (const v of list) {
    const s: Record<string, number> = {
      price: v.price == null ? 0.2 : pct(sp, v.price),
      distance: v.shop.distanceKm == null ? 0.4 : pct(sd, v.shop.distanceKm) * 0.7 + (v.shop.distanceKm <= 2 ? 0.3 : v.shop.distanceKm <= 6 ? 0.15 : 0),
      open: v.shop.open.state === 'open' ? (v.shop.open.closingSoon ? 0.6 : 1) : v.shop.open.state === 'open_unknown_hours' ? 0.7 : v.shop.open.state === 'unknown' ? 0.35 : 0,
      fresh: v.freshness.level === 'fresh' ? 1 : v.freshness.level === 'ok' ? 0.6 : 0.15,
      warranty: v.warranty?.real ? 1 : 0,
      installment: v.shop.installment ? 1 : 0,
    };
    let total = 0, wsum = 0;
    for (const p of pri) { total += s[p] * weight[p]; wsum += weight[p]; }
    v.score = Math.round((total / wsum) * 100);
    const reasons: string[] = [];
    const badges: string[] = [];
    if (v.price != null && v.price === minP && prices.length > 1) { reasons.push('ارزان‌ترین قیمت ثبت‌شده'); badges.push('cheapest'); }
    if (v.shop.distanceKm != null && v.shop.distanceKm === minD && dists.length > 1) { reasons.push('نزدیک‌ترین به تو'); badges.push('nearest'); }
    if (v.shop.open.state === 'open') reasons.push(v.shop.open.closingSoon ? tr("باز است ولی به‌زودی می‌بندد") : tr("الان باز است"));
    if (v.warranty?.real) reasons.push(`گارانتی ${v.warranty.provider}${v.warranty.months ? tr(" {0} ماهه", v.warranty.months.toLocaleString(loc())) : ''}`);
    if (v.shop.installment) reasons.push('امکان خرید اقساطی');
    if (v.freshness.level === 'fresh') reasons.push('قیمت تازه ثبت شده');
    v.reasons = reasons;
    v.badges = badges;
  }
  list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (list[0]) list[0].badges = [...(list[0].badges ?? []), 'best'];
  return list;
}

export type OfferSort = 'best' | 'price' | 'distance' | 'fresh';

export function getOffers(pid: string, ctx: Ctx = {}, sort: OfferSort = 'best', excludeShop?: string) {
  const p = productByPid.get(pid) as Row | undefined;
  if (!p) return null;
  const all = (offersForProduct.all(p.id) as OfferRow[]).map((o) => offerView(o, ctx) as OfferView).filter((v) => v.shop.id !== excludeShop);
  const kept = all.filter((v) => passes(v, ctx));
  scoreOffers(kept, ctx);
  if (sort === 'price') kept.sort((a, b) => (a.price ?? 9e15) - (b.price ?? 9e15));
  if (sort === 'distance') kept.sort((a, b) => (a.shop.distanceKm ?? 9e9) - (b.shop.distanceKm ?? 9e9));
  if (sort === 'fresh') kept.sort((a, b) => (a.freshness.days ?? 9e9) - (b.freshness.days ?? 9e9));
  const priced = kept.filter((v) => v.price != null).map((v) => v.price!);
  return {
    product: productBrief(p),
    total: all.length,
    filteredOut: all.length - kept.length,
    filteredOutReasons: filterReasons(all, ctx),
    stats: priced.length ? { min: Math.min(...priced), max: Math.max(...priced), median: priced.sort((a, b) => a - b)[Math.floor(priced.length / 2)] } : null,
    offers: kept,
  };
}

function filterReasons(all: OfferView[], ctx: Ctx) {
  const r: Record<string, number> = {};
  for (const v of all) {
    if (ctx.installment && !v.shop.installment) r.installment = (r.installment ?? 0) + 1;
    if (ctx.openNow && !(v.shop.open.state === 'open' || v.shop.open.state === 'open_unknown_hours')) r.openNow = (r.openNow ?? 0) + 1;
    if (ctx.maxKm && v.shop.distanceKm != null && v.shop.distanceKm > ctx.maxKm) r.distance = (r.distance ?? 0) + 1;
    if (ctx.warranty && !v.warranty?.real) r.warranty = (r.warranty ?? 0) + 1;
    if (ctx.maxPrice && v.price != null && v.price > ctx.maxPrice) r.price = (r.price ?? 0) + 1;
  }
  return r;
}

// ---------------------------------------------------------------- search

export type SearchArgs = {
  query?: string; category?: string; brand?: string;
  minPrice?: number; maxPrice?: number;
  specs?: { key: string; value: string }[];
  limit?: number; sort?: 'relevance' | 'price' | 'popular' | 'nearest';
};

const ftsStmt = db.prepare(`SELECT rowid, bm25(pfts, 10.0, 4.0, 6.0, 1.5) AS rank FROM pfts WHERE pfts MATCH ? ORDER BY rank LIMIT ?`);

function ftsIds(q: string, limit: number, modes: readonly ('and' | 'or')[] = ['and', 'or']): Map<number, number> {
  const out = new Map<number, number>();
  for (const mode of modes) {
    const expr = ftsQuery(q, mode);
    if (!expr) break;
    try {
      for (const r of ftsStmt.all(expr, limit) as Row[]) if (!out.has(r.rowid)) out.set(r.rowid, r.rank + (mode === 'or' ? 5 : 0));
    } catch { /* malformed expr */ }
    if (out.size >= 12) break;
  }
  return out;
}

export function searchProducts(args: SearchArgs, ctx: Ctx = {}) {
  const limit = Math.min(args.limit ?? 12, 40);
  const where: string[] = ['p.n_offers > 0'];
  const params: (string | number)[] = [];
  let ranked: Map<number, number> | null = null;
  const q = [args.query, args.brand && !args.query?.includes(args.brand) ? args.brand : ''].filter(Boolean).join(' ');
  if (q.trim()) {
    ranked = ftsIds(q, 1500);
    if (!ranked.size && !args.category) return { total: 0, products: [] as (ProductBrief & { nearest?: unknown; matchReasons?: string[] })[] };
  }
  if (args.category) { where.push('p.category = ?'); params.push(args.category); }
  if (args.brand) { where.push('(p.brand = ? OR p.title LIKE ?)'); params.push(args.brand, `%${args.brand}%`); }
  if (args.maxPrice) { where.push('p.min_price <= ?'); params.push(args.maxPrice); }
  if (args.minPrice) { where.push('p.max_price >= ?'); params.push(args.minPrice); }
  // Spec filters: coarse LIKE in SQL, exact key/value pair check in JS
  const specFilters = (args.specs ?? []).filter((s) => s.key && s.value);
  for (const s of specFilters) { where.push('p.specs LIKE ?'); params.push(`%${norm(s.value).split(' ')[0] || s.value}%`); }
  const specOk = (r: Row) => !specFilters.length || specFilters.every((f) => parse<[string, string][]>(r.specs, []).some(([k, v]) => (norm(k).includes(norm(f.key)) || norm(f.key).includes(norm(k))) && norm(v).includes(norm(f.value))));
  let rows: Row[];
  if (ranked && ranked.size) {
    const byIds = (ids: number[]) => (db.prepare(`SELECT p.* FROM products p WHERE p.id IN (${ids.join(',')}) AND ${where.join(' AND ')}`).all(...params) as Row[]).filter(specOk);
    rows = byIds([...ranked.keys()]);
    if (!rows.length && args.category) {
      // Nothing matched every word inside the category: try any word, keeping text relevance.
      const loose = ftsIds(q, 5000, ['or']);
      for (const [id, r] of loose) if (!ranked.has(id)) ranked.set(id, r + 5);
      rows = loose.size ? byIds([...loose.keys()]) : [];
    }
  } else {
    rows = (db.prepare(`SELECT p.* FROM products p WHERE ${where.join(' AND ')} ORDER BY p.n_shops DESC, (p.images IS NULL) LIMIT 400`).all(...params) as Row[]).filter(specOk);
  }
  const total = rows.length;
  const rel = (r: Row) => (ranked?.get(r.id) ?? 0) - Math.log2(1 + r.n_shops) * 1.2 - (r.images ? 0.6 : 0) - (r.min_price ? 0.4 : 0);
  if (args.sort === 'price') rows.sort((a, b) => (a.min_price ?? 9e15) - (b.min_price ?? 9e15));
  else if (args.sort === 'popular') rows.sort((a, b) => b.n_shops - a.n_shops);
  else rows.sort((a, b) => rel(a) - rel(b));

  const head = rows.slice(0, Math.max(limit * 3, 30));
  const enriched = head.map((r) => {
    const b = productBrief(r) as ProductBrief & { nearest?: unknown; filteredShops?: number; matchReasons?: string[]; priceInRange?: { min: number; max: number } | null };
    const offers = (offersForProduct.all(r.id) as OfferRow[]).map((o) => offerView(o, ctx) as OfferView);
    const kept = offers.filter((v) => passes(v, { ...ctx, minPrice: args.minPrice, maxPrice: args.maxPrice }));
    b.filteredShops = kept.length;
    const priced = kept.filter((k) => k.price != null);
    b.priceInRange = priced.length ? { min: Math.min(...priced.map((k) => k.price!)), max: Math.max(...priced.map((k) => k.price!)) } : null;
    const near = [...kept].sort((x, y) => (x.shop.distanceKm ?? 9e9) - (y.shop.distanceKm ?? 9e9))[0];
    b.nearest = near ? { shopId: near.shop.id, name: near.shop.name, area: near.shop.area, mall: near.shop.mall, distanceKm: near.shop.distanceKm, etaMinutes: near.shop.etaMinutes, price: near.price, open: near.shop.open } : null;
    const reasons: string[] = [];
    if (b.nShops > 1) reasons.push(`${b.nShops.toLocaleString(loc())} فروشگاه حضوری`);
    if (near?.shop.distanceKm != null) reasons.push(`نزدیک‌ترین: ${near.shop.distanceKm.toLocaleString(loc())} کیلومتر`);
    if (kept.some((k) => k.shop.installment)) reasons.push('فروشنده اقساطی دارد');
    if (kept.some((k) => k.warranty?.real)) reasons.push('گارانتی‌دار');
    b.matchReasons = reasons;
    return b;
  });
  let products = enriched.filter((b) => (b.filteredShops ?? 0) > 0);
  if (args.sort === 'nearest') products.sort((a: any, b: any) => (a.nearest?.distanceKm ?? 9e9) - (b.nearest?.distanceKm ?? 9e9));
  products = dedupeTitles(products).slice(0, limit);
  return { total, products };
}

function dedupeTitles<T extends { title: string }>(list: T[]) {
  const seen = new Set<string>();
  return list.filter((p) => { const k = norm(p.title).slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------------------------------------------------------------- categories

const cftsStmt = db.prepare(`SELECT c.*, bm25(cfts) rank FROM cfts JOIN categories c ON c.rowid = cfts.rowid WHERE cfts MATCH ? ORDER BY rank LIMIT 12`);

export function findCategories(query: string) {
  const scores = new Map<string, { name: string; score: number; n_products: number; n_offers: number; n_shops: number; min_price: number; max_price: number }>();
  for (const mode of ['and', 'or'] as const) {
    const expr = ftsQuery(query, mode);
    if (!expr) break;
    try {
      for (const r of cftsStmt.all(expr) as Row[]) if (!scores.has(r.name)) scores.set(r.name, { ...(r as any), score: (mode === 'and' ? 30 : 10) - r.rank });
    } catch { /* ignore */ }
  }
  // Category distribution among matching products
  const ids = ftsIds(query, 400);
  if (ids.size) {
    const dist = db.prepare(`SELECT p.category name, count(*) n FROM products p WHERE p.id IN (${[...ids.keys()].join(',')}) AND p.category IS NOT NULL GROUP BY p.category ORDER BY n DESC LIMIT 8`).all() as Row[];
    for (const d of dist) {
      const c = db.prepare('SELECT * FROM categories WHERE name = ?').get(d.name) as Row;
      const prev = scores.get(d.name);
      scores.set(d.name, { ...(c as any), score: (prev?.score ?? 0) + d.n / 4 });
    }
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 6).map((c) => ({
    name: c.name, products: c.n_products, offers: c.n_offers, shops: c.n_shops, minPrice: c.min_price, maxPrice: c.max_price,
  }));
}

const facetCache = new Map<string, unknown>();

/** Real-data facets for a category: price bands, brands, common spec keys and values. */
export function categoryInsights(category: string) {
  if (facetCache.has(category)) return facetCache.get(category) as ReturnType<typeof computeInsights>;
  const v = computeInsights(category);
  facetCache.set(category, v);
  return v;
}

function computeInsights(category: string) {
  const rows = db.prepare('SELECT brand, specs, min_price, n_shops FROM products WHERE category = ? AND n_offers > 0').all(category) as Row[];
  if (!rows.length) return null;
  const prices = (db.prepare('SELECT o.price FROM offers o JOIN products p ON p.id = o.product WHERE p.category = ? AND o.price IS NOT NULL ORDER BY o.price').all(category) as Row[]).map((r) => r.price as number);
  const q = (f: number) => prices[Math.min(prices.length - 1, Math.floor(prices.length * f))];
  const brands = new Map<string, number>();
  const keys = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.brand) brands.set(r.brand, (brands.get(r.brand) ?? 0) + 1);
    for (const [k, v] of parse<[string, string][]>(r.specs, [])) {
      if (/نام محصول|شرکت سازنده|تاریخ|کد|شناسه|ابعاد|وزن|سایر|توضیحات|مدل/.test(k)) continue;
      let m = keys.get(k); if (!m) keys.set(k, (m = new Map()));
      for (const part of String(v).split(/[،,]/).map((x) => x.trim()).filter((x) => x && x.length < 40).slice(0, 12)) m.set(part, (m.get(part) ?? 0) + 1);
    }
  }
  const specFacets = [...keys.entries()]
    .map(([key, m]) => ({ key, coverage: [...m.values()].reduce((a, b) => a + b, 0), values: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count })) }))
    .filter((f) => f.values.length >= 2 && f.coverage >= Math.max(5, rows.length * 0.12))
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 8);
  return {
    category,
    products: rows.length,
    priceBands: prices.length ? { p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), min: prices[0], max: prices[prices.length - 1] } : null,
    brands: [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count })),
    specFacets,
  };
}

// ---------------------------------------------------------------- composite helpers

/** "I saw it for X at Y — is there a cheaper one near me?" */
export function cheaperNearby(pid: string, seenPrice: number | undefined, ctx: Ctx) {
  const res = getOffers(pid, { ...ctx, maxKm: undefined, openNow: undefined }, 'price');
  if (!res) return null;
  const cheaper = res.offers.filter((o) => o.price != null && (seenPrice ? o.price < seenPrice : true));
  const withSaving = cheaper.map((o) => ({ ...o, saving: seenPrice && o.price ? seenPrice - o.price : null }));
  return {
    product: res.product,
    seenPrice: seenPrice ?? null,
    stats: res.stats,
    cheaperCount: seenPrice ? cheaper.length : null,
    best: withSaving.slice(0, 8),
    nearestCheaper: [...withSaving].sort((a, b) => (a.shop.distanceKm ?? 9e9) - (b.shop.distanceKm ?? 9e9))[0] ?? null,
    verdict: !seenPrice ? 'no_price' : cheaper.length ? 'cheaper_found' : 'you_have_best',
  };
}

/** Alternatives when a shop is closed / out of stock / not answering. */
export function alternatives(pid: string, excludeShop: string | undefined, ctx: Ctx) {
  const same = getOffers(pid, { ...ctx, openNow: false }, 'best', excludeShop);
  if (!same) return null;
  const sameOpen = same.offers.filter((o) => o.shop.open.state !== 'closed').slice(0, 5);
  const p = productByPid.get(pid) as Row;
  // Similar products in same category & price band that have a shop nearby
  const band = p.min_price ? { minPrice: Math.round(p.min_price * 0.7), maxPrice: Math.round(p.min_price * 1.35) } : {};
  const words = norm(p.title).split(' ').filter((w) => w.length > 2).slice(0, 4).join(' ');
  const similar = searchProducts({ query: words, category: p.category ?? undefined, ...band, limit: 8, sort: 'nearest' }, ctx).products.filter((x) => x.id !== pid).slice(0, 6);
  const sameMall = excludeShop ? sameMallShops(excludeShop, p.category) : [];
  return { product: productBrief(p), sameProduct: sameOpen, similar, sameMall };
}

function sameMallShops(sid: string, category: string | null) {
  const r = shopBySid.get(sid) as Row | undefined;
  if (!r?.mall_key || !category) return [];
  return (db.prepare(`SELECT DISTINCT s.* FROM shops s JOIN shop_cats c ON c.shop = s.id WHERE s.mall_key = ? AND s.id != ? AND c.cat = ? LIMIT 6`).all(r.mall_key, r.id, category) as Row[])
    .map((s) => ({ id: s.sid as string, name: s.name as string, floor: s.floor as string | null, unit: s.unit as string | null, note: tr("در دسته این محصول فعالیت دارد؛ موجودی این محصول مشخص نیست") }));
}

/** Shops whose activity category matches but no specific product offer — clearly marked as unverified. */
export function categoryOnlyShops(category: string, ctx: Ctx, limit = 6) {
  const rows = db.prepare(`SELECT s.* FROM shop_cats c JOIN shops s ON s.id = c.shop WHERE c.cat = ? LIMIT 400`).all(category) as Row[];
  return rows.map((r) => shopBrief(r, ctx)).sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9)).slice(0, limit);
}

export function shopsByIds(sids: string[], ctx: Ctx) {
  return sids.map((sid) => shopBySid.get(sid) as Row | undefined).filter(Boolean).map((r) => shopBrief(r!, ctx));
}

/** Order shops for an in-person visit: nearest-neighbour, then check each is open on arrival. */
export function planVisit(sids: string[], ctx: Ctx, startAt: Date = new Date()) {
  const shops = sids.map((s) => shopBySid.get(s) as Row | undefined).filter(Boolean) as Row[];
  if (!shops.length) return null;
  const mode = ctx.mode ?? 'car';
  const legs: { shop: ShopBrief; legKm: number; legMin: number; arriveAt: string; arriveOffset: number; openOnArrival: OpenState; warning?: string }[] = [];
  let cur = ctx.lat != null && ctx.lng != null ? { lat: ctx.lat, lon: ctx.lng } : { lat: shops[0].lat, lon: shops[0].lon };
  let offset = 0;
  const left = [...shops];
  while (left.length) {
    left.sort((a, b) => haversineKm(cur.lat, cur.lon, a.lat, a.lon) - haversineKm(cur.lat, cur.lon, b.lat, b.lon));
    const n = left.shift()!;
    const km = haversineKm(cur.lat, cur.lon, n.lat, n.lon);
    const sameMall = legs.length && legs[legs.length - 1].shop.mall && legs[legs.length - 1].shop.mall === n.mall;
    const legMin = sameMall ? 4 : km < 0.6 ? Math.max(3, Math.round(km / 4.8 * 60)) : etaMinutes(km, mode, new Date(startAt.getTime() + offset * 60000));
    offset += legMin;
    const at = new Date(startAt.getTime() + offset * 60000);
    const openOnArrival = openStatus(parse<Hours>(n.hours, null), at);
    const t = new Intl.DateTimeFormat(loc(), { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
    let warning: string | undefined;
    if (openOnArrival.state === 'closed') warning = tr("وقتی برسی ({0}) احتمالاً بسته است — {1}", t, openOnArrival.label);
    else if (openOnArrival.state === 'open' && openOnArrival.closingSoon) warning = tr("نزدیک ساعت بسته شدن می‌رسی؛ قبلش تماس بگیر");
    else if (openOnArrival.state === 'unknown') warning = tr("ساعت کاری ثبت نشده؛ قبل از رفتن تماس بگیر");
    legs.push({ shop: shopBrief(n, ctx), legKm: Math.round(km * 10) / 10, legMin, arriveAt: t, arriveOffset: offset, openOnArrival, warning });
    offset += 15; // time inside the shop
    cur = { lat: n.lat, lon: n.lon };
  }
  return { mode, legs, totalMinutes: offset, startAt: startAt.toISOString() };
}

/** Cities that have shop data (scales as new datasets add a city column). */
export function coverage() {
  const hasCity = (db.prepare("SELECT count(*) n FROM pragma_table_info('shops') WHERE name = 'city'").get() as Row).n > 0;
  return hasCity ? db.prepare('SELECT city, count(*) shops FROM shops GROUP BY city ORDER BY shops DESC').all() : [{ city: tr("تهران"), shops: (db.prepare('SELECT count(*) n FROM shops').get() as Row).n }];
}

export function datasetStats() {
  return db.prepare(`SELECT (SELECT count(*) FROM shops) shops, (SELECT count(*) FROM products) products, (SELECT count(*) FROM offers) offers,
    (SELECT count(*) FROM shops WHERE installment = 1) installmentShops, (SELECT max(changed_at) FROM offers) latestPrice`).get();
}

export function resolveProduct(ref: string) {
  if (ref.startsWith('product_')) return ref;
  const hit = searchProducts({ query: ref, limit: 5 }).products.sort((a, b) => b.nShops - a.nShops)[0];
  return hit?.id ?? null;
}

export { shopByRowid };
