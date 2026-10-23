// Agent tools: JSON-schema definitions + executors that return UI blocks and compact model summaries.
import * as cat from './catalog.ts';
import type { Ctx } from './catalog.ts';
import type { ToolDef } from './llm.ts';
import { norm } from './text.ts';
import { startCall } from './poshtyar.ts';

import { tr, loc } from './i18n.ts';
export type UIBlock = { id: string; component: string; props: Record<string, unknown>; summary: string };
export type ToolResult = { result: unknown; ui?: UIBlock; endTurn?: boolean; status?: string; lead?: string };

const fmt = (n: number | null | undefined) => (n == null ? tr("نامشخص") : tr("{0} تومان", Math.round(n).toLocaleString(loc())));
let uid = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(uid++).toString(36)}`;

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef => ({
  type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
});
const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const bool = (description: string) => ({ type: 'boolean', description });
const strArr = (description: string) => ({ type: 'array', items: { type: 'string' }, description });

export const TOOL_DEFS: ToolDef[] = [
  fn('find_categories', 'Map a user need (Persian free text) to real catalogue categories with counts and price ranges. Use first when the product type is vague.', { query: str(tr("what the user wants, e.g. \"کتونی پیاده روی\"")) }, ['query']),
  fn('category_insights', 'Real facets of a category from the dataset: price quantiles, top brands, common spec keys with their values (e.g. sizes, colours). Use to craft grounded clarifying questions and budget ranges.', { category: str('exact category name from find_categories') }, ['category']),
  fn('ask_user', 'Render an interactive question card in the chat and END your turn (the user answers by tapping). kind=choice for single/multi select chips, budget for a price range slider, priority to let the user rank what matters (price, distance, ...), location to request their location. Ask ONE card per turn; keep option labels short Persian.', {
    kind: { type: 'string', enum: ['choice', 'budget', 'priority', 'location'] },
    lead: str(tr("ONE short friendly Persian sentence shown above the card: what you found so far and why you ask (e.g. «۸۶۵ مدل کتانی در ۴۹ فروشگاه پیدا کردم؛ برای پیشنهاد دقیق‌تر:»). Address the user by name when natural.")),
    question: str('Persian question title'),
    hint: str('short helper line under the question'),
    multiple: bool('choice only: allow multiple selections'),
    options: strArr('choice only: 2-8 short Persian option labels, grounded in category_insights when possible'),
    category: str('budget only: category name so the slider uses real price quantiles'),
  }, ['kind', 'lead', 'question']),
  fn('search_products', 'Search products that have in-person offers in Tehran shops. Returns compact candidates (id, title, price range, shop count, nearest shop distance). Does NOT show anything to the user — call show_products after choosing.', {
    query: str('Persian search text (model, brand, type)'),
    category: str('exact category filter (recommended)'),
    brand: str('brand name filter'),
    min_price: num('Toman'), max_price: num('Toman'),
    specs: { type: 'array', description: tr("spec filters, e.g. [{\"key\":\"سایز\",\"value\":\"42\"}]"), items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'], additionalProperties: false } },
    sort: { type: 'string', enum: ['relevance', 'price', 'popular', 'nearest'] },
    limit: num('max results, default 12'),
  }),
  fn('show_products', 'Show product cards (carousel) to the user. Give each product a one-line Persian reason why it fits their needs.', {
    product_ids: strArr('3-8 product ids from search_products'),
    title: str('short heading'),
    reasons: { type: 'array', description: 'one reason per product id, same order', items: { type: 'string' } },
  }, ['product_ids']),
  fn('compare_products', 'Show a side-by-side comparison table of 2-4 products (price, shops, distance, warranty, key specs). Return a verdict in your reply.', { product_ids: strArr('2-4 product ids') }, ['product_ids']),
  fn('find_stores', 'Show the list of shops that registered an offer for a product, ranked by the user priorities, with distance/ETA, open-now, price freshness, installment & warranty. Use after the user picks a product.', {
    product_id: str('product id'),
    sort: { type: 'string', enum: ['best', 'price', 'distance', 'fresh'] },
    installment_only: bool('only shops with installment / credit purchase'),
    open_now: bool('only shops open now'),
    max_km: num('max distance from user, km'),
  }, ['product_id']),
  fn('compare_stores', 'Show a detailed comparison table of 2-4 shops for one product (price, distance, ETA, hours, warranty, payment, freshness).', { product_id: str('product id'), shop_ids: strArr('2-4 shop ids; omit to take the top 3') }, ['product_id']),
  fn('store_details', 'Show a shop card: address, mall / floor / unit, how to find it inside the mall, neighbours in the same mall, weekly hours, payment options, navigation and contact buttons.', { shop_id: str('shop id') }, ['shop_id']),
  fn('contact_store', 'Prepare a message to the shop (stock / updated price / hours / installment question) with call, SMS and WhatsApp buttons, and a follow-up card where the user reports the answer.', {
    shop_id: str('shop id'), product_id: str('optional product id'),
    purpose: { type: 'string', enum: ['stock', 'price', 'hours', 'installment', 'custom'] },
    message: str('optional custom Persian message text'),
  }, ['shop_id', 'purpose']),
  fn('call_store', 'AI PHONE CALL (only when available): place a real call to the shop with a voice AI that asks about stock, today’s price, hours and installments, then reports back. Use when the registered price is old (> ~10 days), stock is unverified and the user is about to go, or the user asks you to call/ask. The card shows the call live and the outcome; tell the user in one sentence that you are calling.', {
    shop_id: str('shop id'), product_id: str('product id if relevant'),
    purpose: { type: 'string', enum: ['stock', 'price', 'hours', 'installment'] },
  }, ['shop_id']),
  fn('check_cheaper_nearby', 'User saw a product somewhere for a price — find registered offers that are cheaper and how far they are. First call search_products to find the EXACT model the user means (e.g. AirPods Pro 2 ≠ AirPods 4) and pass its product_id; if the model is ambiguous, show_products and ask which one.', {
    product_id: str('product id if known'), query: str('product name if id unknown'), seen_price: num('price the user saw, Toman'), seen_where: str('where they saw it'),
  }),
  fn('find_alternatives', 'When a shop is closed, out of stock, not answering or too far: show other shops for the same product plus similar products nearby.', {
    product_id: str('product id'), exclude_shop_id: str('the failing shop id'),
    reason: { type: 'string', enum: ['closed', 'out_of_stock', 'no_answer', 'too_far', 'price', 'similar'] },
  }, ['product_id']),
  fn('plan_visit', 'Build an in-person visit route over 1-5 shops: order, travel time, arrival time, open-on-arrival warnings.', { shop_ids: strArr('shop ids') }, ['shop_ids']),
  fn('quick_replies', 'Offer 2-4 short tap-to-send follow-up suggestions under your message (Persian). Call it LAST, after your final text — it ends your turn.', { options: strArr('short Persian suggestions') }, ['options']),
];

const priorityItems = () => [
  { id: 'price', label: tr("قیمت کمتر") },
  { id: 'distance', label: tr("نزدیک بودن") },
  { id: 'open', label: tr("الان باز باشد") },
  { id: 'warranty', label: tr("گارانتی معتبر") },
  { id: 'installment', label: tr("خرید قسطی") },
  { id: 'fresh', label: tr("قیمت به‌روز") },
];

function budgetProps(category: string | undefined) {
  const ins = category ? cat.categoryInsights(category) : null;
  const pb = ins?.priceBands;
  if (!pb) return { min: 0, max: 100_000_000, step: 500_000, presets: [] as { label: string; min: number; max: number }[] };
  const round = (n: number) => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(n, 1))) - 1)); return Math.round(n / p) * p; };
  const max = round(pb.p90 * 1.2);
  return {
    min: 0, max, step: round(max / 60) || 100_000,
    suggested: { min: round(pb.p25), max: round(pb.p75) },
    presets: [
      { label: tr("اقتصادی"), min: 0, max: round(pb.p25) },
      { label: tr("متوسط"), min: round(pb.p25), max: round(pb.p75) },
      { label: tr("باکیفیت"), min: round(pb.p75), max },
    ],
    median: pb.median,
  };
}

function productCompareRows(ids: string[], ctx: Ctx) {
  const items = ids.map((id) => cat.getProduct(id)).filter(Boolean) as NonNullable<ReturnType<typeof cat.getProduct>>[];
  const offers = items.map((p) => cat.getOffers(p.id, ctx));
  const rows: { label: string; values: string[]; bestIndex?: number }[] = [];
  const best = (vals: (number | null)[], dir: 'min' | 'max') => {
    const ok = vals.map((v, i) => [v, i] as const).filter(([v]) => v != null) as [number, number][];
    if (ok.length < 2) return undefined;
    const target = dir === 'min' ? Math.min(...ok.map(([v]) => v)) : Math.max(...ok.map(([v]) => v));
    return ok.filter(([v]) => v === target).length === 1 ? ok.find(([v]) => v === target)![1] : undefined;
  };
  const minPrices = offers.map((o) => o?.stats?.min ?? null);
  rows.push({ label: tr("کمترین قیمت ثبت‌شده"), values: minPrices.map(fmt), bestIndex: best(minPrices, 'min') });
  const shops = offers.map((o) => o?.total ?? 0);
  rows.push({ label: tr("تعداد فروشگاه حضوری"), values: shops.map((n) => n.toLocaleString(loc())), bestIndex: best(shops, 'max') });
  const near = offers.map((o) => { const d = o?.offers.map((x) => x.shop.distanceKm).filter((x): x is number => x != null); return d?.length ? Math.min(...d) : null; });
  rows.push({ label: tr("نزدیک‌ترین فروشگاه"), values: near.map((d) => (d == null ? tr("نامشخص") : tr("{0} کیلومتر", d.toLocaleString(loc())))), bestIndex: best(near, 'min') });
  const openN = offers.map((o) => o?.offers.filter((x) => x.shop.open.state === 'open').length ?? 0);
  rows.push({ label: tr("فروشگاه باز در این لحظه"), values: openN.map((n) => n.toLocaleString(loc())), bestIndex: best(openN, 'max') });
  const warr = offers.map((o) => (o?.offers.some((x) => x.warranty?.real) ? 1 : 0));
  rows.push({ label: tr("گارانتی‌دار"), values: warr.map((w) => (w ? tr("دارد") : tr("ثبت نشده"))) });
  const inst = offers.map((o) => (o?.offers.some((x) => x.shop.installment) ? 1 : 0));
  rows.push({ label: tr("فروشنده اقساطی"), values: inst.map((w) => (w ? tr("دارد") : tr("ندارد"))) });
  rows.push({ label: tr("برند"), values: items.map((p) => p.brand ?? tr("نامشخص")) });
  const keyCount = new Map<string, number>();
  for (const p of items) for (const s of p.specs) if (!/نام محصول|شرکت سازنده|تاریخ|برند/.test(s.key)) keyCount.set(s.key, (keyCount.get(s.key) ?? 0) + 1);
  const keys = [...keyCount.entries()].filter(([, n]) => n >= Math.min(2, items.length)).slice(0, 10).map(([k]) => k);
  for (const k of keys) rows.push({ label: k, values: items.map((p) => p.specs.find((s) => s.key === k)?.value ?? '—') });
  return { items, rows };
}

function storeCompareRows(pid: string, shopIds: string[] | undefined, ctx: Ctx) {
  const res = cat.getOffers(pid, ctx);
  if (!res) return null;
  const chosen = shopIds?.length ? shopIds.map((id) => res.offers.find((o) => o.shop.id === id)).filter(Boolean) as cat.OfferView[] : res.offers.slice(0, 3);
  const best = (vals: (number | null)[], dir: 'min' | 'max') => {
    const ok = vals.map((v, i) => [v, i] as const).filter(([v]) => v != null) as [number, number][];
    if (ok.length < 2) return undefined;
    const t = dir === 'min' ? Math.min(...ok.map(([v]) => v)) : Math.max(...ok.map(([v]) => v));
    return ok.filter(([v]) => v === t).length === 1 ? ok.find(([v]) => v === t)![1] : undefined;
  };
  const rows: { label: string; values: string[]; bestIndex?: number }[] = [];
  const prices = chosen.map((o) => o.price);
  rows.push({ label: tr("قیمت ثبت‌شده"), values: prices.map(fmt), bestIndex: best(prices, 'min') });
  rows.push({ label: tr("زمان ثبت قیمت"), values: chosen.map((o) => o.freshness.label), bestIndex: best(chosen.map((o) => o.freshness.days), 'min') });
  rows.push({ label: tr("موجودی"), values: chosen.map(() => tr("تأیید نشده — استعلام بگیر")) });
  const d = chosen.map((o) => o.shop.distanceKm);
  rows.push({ label: tr("فاصله"), values: d.map((x) => (x == null ? tr("نامشخص") : tr("{0} کیلومتر", x.toLocaleString(loc())))), bestIndex: best(d, 'min') });
  const eta = chosen.map((o) => o.shop.etaMinutes);
  rows.push({ label: tr("زمان رسیدن (تخمینی)"), values: eta.map((x) => (x == null ? tr("نامشخص") : tr("{0} دقیقه", x.toLocaleString(loc())))), bestIndex: best(eta, 'min') });
  rows.push({ label: tr("وضعیت الان"), values: chosen.map((o) => o.shop.open.label), bestIndex: best(chosen.map((o) => (o.shop.open.state === 'open' ? 1 : 0)), 'max') });
  rows.push({ label: tr("گارانتی"), values: chosen.map((o) => (o.warranty ? `${o.warranty.provider}${o.warranty.months ? tr(" · {0} ماه", o.warranty.months) : ''}` : tr("ثبت نشده"))) });
  rows.push({ label: tr("خرید اقساطی"), values: chosen.map((o) => (o.shop.payments.length ? o.shop.payments.map((p) => p.provider).join('، ') : tr("اعلام نشده"))) });
  rows.push({ label: tr("ترب‌پی حضوری"), values: chosen.map((o) => (o.shop.torobPayInPerson ? tr("پذیرنده حضوری") : o.shop.torobPay ? tr("اعلام شده (نوع نامشخص)") : tr("ندارد"))) });
  rows.push({ label: tr("محل"), values: chosen.map((o) => [o.shop.mall, o.shop.floor ? tr("طبقه {0}", o.shop.floor) : null].filter(Boolean).join('، ') || o.shop.area || '—') });
  rows.push({ label: tr("امتیاز ترب‌یار"), values: chosen.map((o) => tr("{0} از ۱۰۰", (o.score ?? 0).toLocaleString(loc()))), bestIndex: best(chosen.map((o) => o.score ?? null), 'max') });
  return { product: res.product, stores: chosen.map((o) => ({ id: o.shop.id, name: o.shop.name, offerId: o.offerId })), rows, offers: chosen };
}

export function contactMessage(shopName: string, productTitle: string | null, price: number | null, purpose: string, userName?: string) {
  const hello = tr("سلام، وقت بخیر{0}.", userName ? tr("؛ {0} هستم", userName) : '');
  const item = productTitle ? tr("«{0}»{1} در ترب دیدم.", productTitle, price ? tr(" را با قیمت {0}", fmt(price)) : tr(" را")) : '';
  const ask: Record<string, string> = {
    stock: tr("الان موجود دارید؟ قیمت به‌روزش چقدر است؟"),
    price: tr("قیمت به‌روز و نهایی‌اش چقدر است؟"),
    hours: tr("امروز تا چه ساعتی باز هستید؟"),
    installment: tr("امکان خرید اقساطی یا اعتباری (مثلاً اسنپ‌پی، دیجی‌پی یا ترب‌پی) دارید؟"),
    custom: tr("یک سؤال داشتم:"),
  };
  return tr("{0} {1} {2} اگر امروز حضوری بیایم، تا چه ساعتی هستید؟ ممنون.\n(ارسال‌شده با ترب‌یار)", hello, item, ask[purpose] ?? ask.stock).replace(/\s+\n/, '\n').replace(/ {2,}/g, ' ');
}

export function ctxFrom(profile: any, extra: Partial<Ctx> = {}): Ctx {
  return {
    lat: typeof profile?.lat === 'number' ? profile.lat : undefined,
    lng: typeof profile?.lng === 'number' ? profile.lng : undefined,
    mode: profile?.mode ?? 'car',
    installment: !!profile?.installmentOnly,
    priorities: Array.isArray(profile?.priorities) ? profile.priorities : undefined,
    ...extra,
  };
}


function askUser(args: any): ToolResult {
  const kind = args.kind;
  const id = newId('q');
  if (kind === 'choice') {
    const options = (args.options ?? []).slice(0, 10).map((label: string, i: number) => ({ id: `o${i}`, label }));
    return { result: 'shown; wait for the user', endTurn: true, ui: { id, component: 'choice', props: { id, question: args.question, hint: args.hint, multiple: !!args.multiple, options, allowOther: true, submitLabel: tr("ادامه") }, summary: tr("[سؤال پرسیده شد: {0} — گزینه‌ها: {1}]", args.question, options.map((o: any) => o.label).join('، ')) } };
  }
  if (kind === 'budget') {
    return { result: 'shown; wait for the user', endTurn: true, ui: { id, component: 'budget', props: { id, question: args.question, hint: args.hint, ...budgetProps(args.category) }, summary: tr("[سؤال بودجه پرسیده شد]") } };
  }
  if (kind === 'priority') {
    return { result: 'shown; wait for the user', endTurn: true, ui: { id, component: 'priority', props: { id, question: args.question, hint: args.hint ?? tr("بکش و رها کن یا با دکمه‌ها جابه‌جا کن"), items: priorityItems() }, summary: tr("[از کاربر خواسته شد اولویت‌ها را مرتب کند]") } };
  }
  return { result: 'shown; wait for the user', endTurn: true, ui: { id, component: 'location', props: { id, reason: args.hint ?? args.question }, summary: tr("[درخواست موقعیت مکانی]") } };
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function runTool(name: string, args: any, profile: any): ToolResult {
  const ctx = ctxFrom(profile);
  switch (name) {
    case 'find_categories': {
      const r = cat.findCategories(String(args.query ?? ''));
      return { result: r, status: tr("دسته‌بندی‌ها رو بررسی می‌کنم…") };
    }
    case 'category_insights': {
      const r = cat.categoryInsights(String(args.category ?? ''));
      return { result: r ?? { error: 'category not found' }, status: tr("ویژگی‌های این دسته رو از داده‌ها درمیارم…") };
    }
    case 'ask_user': {
      const r = askUser(args);
      return { ...r, lead: typeof args.lead === 'string' ? args.lead.trim() : undefined };
    }
    case 'search_products': {
      const r = cat.searchProducts({ query: args.query, category: args.category, brand: args.brand, minPrice: args.min_price, maxPrice: args.max_price, specs: args.specs, sort: args.sort, limit: args.limit ?? 12 }, ctx);
      return {
        status: tr("بین ۲۲۵ هزار محصول جست‌وجو می‌کنم…"),
        result: { total: r.total, products: r.products.map((p: any) => ({ id: p.id, title: p.title, brand: p.brand, category: p.category, price: p.priceInRange ?? { min: p.minPrice, max: p.maxPrice }, shops: p.filteredShops, nearestKm: p.nearest?.distanceKm ?? null, openNearest: p.nearest?.open?.state, specs: p.highlights.map((h: any) => `${h.key}: ${h.value}`).join(' | ') })) },
      };
    }
    case 'show_products': {
      const ids: string[] = (args.product_ids ?? []).slice(0, 8);
      const products = ids.map((id) => {
        const p = cat.getProduct(id);
        if (!p) return null;
        const offers = cat.getOffers(id, ctx);
        const near = offers?.offers.slice().sort((a, b) => (a.shop.distanceKm ?? 9e9) - (b.shop.distanceKm ?? 9e9))[0];
        return { ...p, specs: undefined, shopsCount: offers?.total ?? p.nShops, priceStats: offers?.stats ?? null, nearest: near ? { shopId: near.shop.id, name: near.shop.name, area: near.shop.area, mall: near.shop.mall, distanceKm: near.shop.distanceKm, etaMinutes: near.shop.etaMinutes, open: near.shop.open, price: near.price } : null, freshness: near?.freshness ?? null };
      }).filter(Boolean);
      const reasons: string[] = args.reasons ?? [];
      const id = newId('pc');
      return {
        result: `shown ${products.length} products`,
        ui: { id, component: 'products', props: { id, title: args.title, products, reasons: Object.fromEntries(ids.map((pid, i) => [pid, reasons[i]]).filter(([, r]) => r)) }, summary: tr("[کارت محصولات نمایش داده شد: {0}]", products.map((p: any) => tr("{0} (id={1}, از {2})", short(p.title, 50), p.id, fmt(p.priceStats?.min ?? p.minPrice))).join(tr(" ؛ "))) },
      };
    }
    case 'compare_products': {
      const { items, rows } = productCompareRows((args.product_ids ?? []).slice(0, 4), ctx);
      const id = newId('cp');
      return {
        result: { rows: rows.slice(0, 10) },
        ui: { id, component: 'productCompare', props: { id, products: items.map((p) => ({ id: p.id, title: p.title, image: p.image })), rows }, summary: tr("[جدول مقایسه محصولات: {0}]", items.map((p) => `${short(p.title, 40)} (id=${p.id})`).join(tr(" در برابر "))) },
      };
    }
    case 'find_stores': {
      const extra: Partial<Ctx> = {};
      if (args.installment_only != null) extra.installment = !!args.installment_only;
      if (args.open_now) extra.openNow = true;
      if (args.max_km) extra.maxKm = args.max_km;
      const c2 = { ...ctx, ...extra };
      const r = cat.getOffers(String(args.product_id), c2, args.sort ?? 'best');
      if (!r) return { result: { error: 'product not found' } };
      const id = newId('st');
      const top = r.offers.slice(0, 4).map((o) => ({ shop_id: o.shop.id, name: o.shop.name, price: o.price, km: o.shop.distanceKm, open: o.shop.open.label, installment: o.shop.installment, score: o.score }));
      return {
        status: tr("فروشگاه‌ها رو مقایسه می‌کنم…"),
        result: { total: r.total, shown: r.offers.length, filteredOut: r.filteredOut, top },
        ui: { id, component: 'stores', props: { id, productId: r.product.id, initial: { ...r, offers: r.offers.slice(0, 30) }, filters: { installment: !!c2.installment, openNow: !!c2.openNow, maxKm: c2.maxKm ?? null, sort: args.sort ?? 'best' } }, summary: tr("[فهرست فروشگاه‌های «{0}» (id={1}) — {2} فروشگاه. برترها: {3}]", short(r.product.title, 50), r.product.id, r.offers.length, top.slice(0, 3).map((t) => tr("{0} (shop_id={1}, {2}, {3} کیلومتر)", t.name, t.shop_id, fmt(t.price), t.km ?? '?')).join('، ')) },
      };
    }
    case 'compare_stores': {
      const r = storeCompareRows(String(args.product_id), args.shop_ids, ctx);
      if (!r) return { result: { error: 'product not found' } };
      const id = newId('sc');
      return {
        result: { stores: r.stores, rows: r.rows },
        ui: { id, component: 'storeCompare', props: { id, product: r.product, stores: r.stores, rows: r.rows }, summary: tr("[جدول مقایسه فروشگاه‌ها برای {0}: {1}]", short(r.product.title, 40), r.stores.map((s) => `${s.name} (shop_id=${s.id})`).join('، ')) },
      };
    }
    case 'store_details': {
      const s = cat.getShop(String(args.shop_id), ctx);
      if (!s) return { result: { error: 'shop not found' } };
      const id = newId('sd');
      return {
        result: { name: s.name, address: s.address, mall: s.mallInfo, open: s.open.label, hoursKnown: !!s.hours, km: s.distanceKm, payments: s.payments.map((p) => p.provider) },
        ui: { id, component: 'store', props: { id, shop: s }, summary: tr("[کارت فروشگاه {0} (shop_id={1}) نمایش داده شد]", s.name, s.id) },
      };
    }
    case 'contact_store': {
      const s = cat.getShop(String(args.shop_id), ctx);
      if (!s) return { result: { error: 'shop not found' } };
      const p = args.product_id ? cat.getProduct(String(args.product_id)) : null;
      const offer = p ? cat.getOffers(p.id, ctx)?.offers.find((o) => o.shop.id === s.id) : null;
      const message = args.message || contactMessage(s.name, p?.title ?? null, offer?.price ?? null, args.purpose ?? 'stock', profile?.name);
      const id = newId('ct');
      return {
        result: 'contact card shown with drafted message; user will report the answer',
        ui: { id, component: 'contact', props: { id, shop: { id: s.id, name: s.name, phone: s.phone, instagram: s.instagram, website: s.website, open: s.open, lat: s.lat, lng: s.lng, address: s.address }, product: p ? { id: p.id, title: p.title, price: offer?.price ?? null } : null, purpose: args.purpose ?? 'stock', message }, summary: tr("[کارت تماس با {0} (shop_id={1}) با پیام آماده نمایش داده شد]", s.name, s.id) },
      };
    }
    case 'call_store': {
      const shop = cat.getShop(String(args.shop_id), ctx);
      if (!shop) return { result: { error: 'shop not found' } };
      const p = args.product_id ? cat.getProduct(String(args.product_id)) : null;
      const offer = p ? cat.getOffers(p.id, ctx)?.offers.find((o) => o.shop.id === shop.id) : null;
      const rec = startCall({ shopId: shop.id, shopName: shop.name, phone: shop.phone, productId: p?.id, productTitle: p?.title, registeredPrice: offer?.price ?? null, purpose: args.purpose ?? 'stock', userName: profile?.name });
      const id = newId('cl');
      return {
        status: tr('دارم با فروشگاه تماس می‌گیرم…'),
        result: { call_id: rec.id, status: rec.status, note: 'call placed; the card shows live progress and the seller’s answer — do not wait for it' },
        ui: { id, component: 'aiCall', props: { id, callId: rec.id, shop: { id: shop.id, name: shop.name, phone: shop.phone, lat: shop.lat, lng: shop.lng, open: shop.open }, product: p ? { id: p.id, title: p.title, price: offer?.price ?? null } : null }, summary: `[تماس هوشمند با ${shop.name} (shop_id=${shop.id}) آغاز شد؛ نتیجه در کارت نمایش داده می‌شود]` },
      };
    }
    case 'check_cheaper_nearby': {
      const pid = args.product_id || (args.query ? cat.resolveProduct(String(args.query)) : null);
      if (!pid) return { result: { error: 'product not found; ask for the exact model' } };
      const r = cat.cheaperNearby(pid, args.seen_price, ctx);
      if (!r) return { result: { error: 'product not found' } };
      const id = newId('ch');
      return {
        status: tr("قیمت‌های اطراف رو چک می‌کنم…"),
        result: { verdict: r.verdict, cheaperCount: r.cheaperCount, best: r.best.slice(0, 3).map((o) => ({ shop_id: o.shop.id, name: o.shop.name, price: o.price, saving: o.saving, km: o.shop.distanceKm })), stats: r.stats },
        ui: { id, component: 'cheaper', props: { id, ...r, seenWhere: args.seen_where ?? null }, summary: tr("[بررسی ارزان‌تر برای {0} (id={1}): {2}]", short(r.product.title, 40), r.product.id, r.verdict === 'cheaper_found' ? tr("{0} مورد ارزان‌تر", r.cheaperCount) : r.verdict === 'you_have_best' ? tr("ارزان‌تری پیدا نشد") : tr("قیمت مرجع داده نشد")) },
      };
    }
    case 'find_alternatives': {
      const r = cat.alternatives(String(args.product_id), args.exclude_shop_id, ctx);
      if (!r) return { result: { error: 'product not found' } };
      const id = newId('al');
      return {
        status: tr("دنبال جایگزین می‌گردم…"),
        result: { sameProduct: r.sameProduct.slice(0, 3).map((o) => ({ shop_id: o.shop.id, name: o.shop.name, price: o.price, km: o.shop.distanceKm, open: o.shop.open.label })), similar: r.similar.slice(0, 3).map((p: any) => ({ id: p.id, title: p.title, price: p.minPrice })) },
        ui: { id, component: 'alternatives', props: { id, reason: args.reason ?? 'out_of_stock', excludeShopId: args.exclude_shop_id ?? null, ...r }, summary: tr("[جایگزین‌ها برای {0}: {1} فروشگاه دیگر، {2} محصول مشابه]", short(r.product.title, 40), r.sameProduct.length, r.similar.length) },
      };
    }
    case 'plan_visit': {
      const r = cat.planVisit((args.shop_ids ?? []).slice(0, 6), ctx);
      if (!r) return { result: { error: 'no shops' } };
      const id = newId('pl');
      return {
        result: { totalMinutes: r.totalMinutes, legs: r.legs.map((l) => ({ name: l.shop.name, arrive: l.arriveAt, warning: l.warning })) },
        ui: { id, component: 'plan', props: { id, ...r }, summary: tr("[برنامه بازدید: {0}، حدود {1} دقیقه]", r.legs.map((l) => l.shop.name).join(' ← '), r.totalMinutes) },
      };
    }
    case 'quick_replies':
      return { result: 'ok', endTurn: true, ui: { id: newId('qr'), component: 'quickReplies', props: { options: (args.options ?? []).slice(0, 4) }, summary: '' } };
  }
  return { result: { error: `unknown tool ${name}` } };
}

export { norm };
