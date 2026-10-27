// AI phone calls to shops via Poshtyar (https://docs.poshtyar.com/docs/outbound/originate-api).
//
// Flow: we POST /calls/originate with a scenario that includes our request id. Poshtyar's AI talks to the seller and,
// before hanging up, calls our webhook tool `report_shop_answer` (configured once in the Poshtyar dashboard and
// attached to the operator) with what it learned. The app polls /api/calls/:id for live status + the final recap.
// Originate returns no call id and there is no results API, so the webhook is the only way back.
//
// Everything is off unless POSHTYAR_ENABLED=true. POSHTYAR_MOCK=true simulates calls (for demos without a key).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const env = process.env;
export const CALLS = {
  enabled: env.POSHTYAR_ENABLED === 'true',
  mock: env.POSHTYAR_MOCK === 'true',
  baseUrl: env.POSHTYAR_BASE_URL ?? 'https://api.poshtyar.com/api/v1/external',
  apiKey: env.POSHTYAR_API_KEY ?? '',
  operatorId: env.POSHTYAR_OPERATOR_ID ?? '',
  webhookToken: env.POSHTYAR_WEBHOOK_TOKEN ?? '',
  /** Seconds between Poshtyar's own redial attempts when nobody answers */
  retryPolicy: (env.POSHTYAR_RETRY_POLICY ?? '').split(',').map(Number).filter((n) => n > 0),
  /** No report after this long → treat as unanswered / no result */
  timeoutMin: Number(env.POSHTYAR_TIMEOUT_MIN ?? 6),
  /** Route every call to this number (testing — dataset phone numbers are fake) */
  testPhone: env.POSHTYAR_TEST_PHONE ?? '',
};
export const callsEnabled = () => CALLS.enabled && (CALLS.mock || (!!CALLS.apiKey && !!CALLS.operatorId));

export type CallStatus = 'dialing' | 'ringing' | 'talking' | 'done' | 'no_answer' | 'failed';
export type CallResult = {
  answered: boolean;
  available: 'yes' | 'no' | 'unknown';
  price: number | null;
  hours: string | null;
  installment: string | null;
  notes: string | null;
};
export type CallRecord = {
  id: string; shopId: string; shopName: string; phone: string; productId?: string; productTitle?: string;
  registeredPrice: number | null; purpose: string; status: CallStatus; error?: string;
  createdAt: number; updatedAt: number; result?: CallResult; timeline: { at: number; status: CallStatus }[];
};

// ---- tiny persistent store (calls survive a restart; webhook may arrive minutes later)
const FILE = resolve(env.CALLS_FILE ?? 'data/calls.json');
const calls = new Map<string, CallRecord>();
try { if (existsSync(FILE)) for (const c of JSON.parse(readFileSync(FILE, 'utf8')) as CallRecord[]) calls.set(c.id, c); } catch { /* fresh */ }
let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify([...calls.values()].slice(-500))); } catch (e) { console.error('[calls] save', e); }
  }, 300);
}
function setStatus(c: CallRecord, status: CallStatus, patch: Partial<CallRecord> = {}) {
  Object.assign(c, patch, { status, updatedAt: Date.now() });
  if (c.timeline.at(-1)?.status !== status) c.timeline.push({ at: Date.now(), status });
  save();
}

export function getCall(id: string) {
  const c = calls.get(id);
  if (c && ['dialing', 'ringing', 'talking'].includes(c.status) && Date.now() - c.createdAt > CALLS.timeoutMin * 60_000) {
    setStatus(c, 'no_answer', { result: { answered: false, available: 'unknown', price: null, hours: null, installment: null, notes: null } });
  }
  return c ?? null;
}

const PURPOSE_FA: Record<string, string> = {
  stock: 'موجود بودن محصول و قیمت به‌روز آن',
  price: 'قیمت به‌روز و نهایی',
  hours: 'ساعت کاری امروز',
  installment: 'امکان خرید اقساطی یا اعتباری',
};

function scenario(c: CallRecord, userName?: string) {
  const item = c.productTitle ? `محصول «${c.productTitle}»${c.registeredPrice ? ` (قیمت ثبت‌شده در ترب: ${c.registeredPrice.toLocaleString('fa-IR')} تومان)` : ''}` : 'محصولات فروشگاه';
  return [
    `تو دستیار تلفنی «ترب‌یار» هستی و از طرف یک مشتری${userName ? ` به نام ${userName}` : ''} با فروشگاه «${c.shopName}» تماس می‌گیری.`,
    `هدف: پرسیدن ${PURPOSE_FA[c.purpose] ?? PURPOSE_FA.stock} درباره ${item}. همچنین بپرس امروز تا چه ساعتی باز هستند و آیا امکان خرید قسطی دارند.`,
    'مؤدب، کوتاه و محترمانه صحبت کن؛ حداکثر یک دقیقه. چیزی نخر و اطلاعات شخصی نده.',
    `قبل از خداحافظی حتماً ابزار report_shop_answer را صدا بزن با request_id="${c.id}" و پاسخ‌ها: available (yes/no/unknown)، price (عدد به تومان یا خالی)، hours (متن کوتاه)، installment (متن کوتاه)، notes (خلاصه یک‌خطی حرف فروشنده).`,
    'اگر فروشنده گفت شماره اشتباه است یا تمایلی به پاسخ ندارد، available=unknown بگذار و در notes بنویس.',
  ].join('\n');
}

const toInt = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Start a call. Returns the record immediately; status updates arrive via webhook (or the mock). */
export function startCall(input: { shopId: string; shopName: string; phone: string | null; productId?: string; productTitle?: string; registeredPrice?: number | null; purpose?: string; userName?: string }) {
  const phone = CALLS.testPhone || input.phone;
  const c: CallRecord = {
    id: randomUUID().replace(/-/g, '').slice(0, 16), shopId: input.shopId, shopName: input.shopName, phone: phone ?? '',
    productId: input.productId, productTitle: input.productTitle, registeredPrice: input.registeredPrice ?? null,
    purpose: input.purpose ?? 'stock', status: 'dialing', createdAt: Date.now(), updatedAt: Date.now(), timeline: [{ at: Date.now(), status: 'dialing' }],
  };
  calls.set(c.id, c);
  save();
  if (!phone) { setStatus(c, 'failed', { error: 'no_phone' }); return c; }
  if (CALLS.mock) { simulate(c); return c; }
  void dial(c, input.userName);
  return c;
}

async function dial(c: CallRecord, userName?: string) {
  const phone = c.phone;
  try {
    const res = await fetch(`${CALLS.baseUrl}/calls/originate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': CALLS.apiKey },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        phone_number: phone,
        operator_id: CALLS.operatorId,
        recipient_name: c.shopName,
        topic: `استعلام ${PURPOSE_FA[c.purpose] ?? ''} از طرف مشتری ترب`,
        description: scenario(c, userName),
        opener_text: 'سلام، وقت بخیر. از طرف یکی از مشتری‌های ترب تماس می‌گیرم؛ یک سؤال کوتاه درباره یک محصول داشتم.',
        outbound_type: 'ai',
        start_mode: 'user_first',
        retry_policy: CALLS.retryPolicy,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setStatus(c, 'failed', { error: body?.error ?? `HTTP ${res.status}` }); console.error('[poshtyar] originate', res.status, body); }
    else setStatus(c, 'ringing');
  } catch (e) {
    setStatus(c, 'failed', { error: (e as Error).message });
  }
}

/** Webhook from Poshtyar's `report_shop_answer` tool. Must answer within 3 s. */
export function handleWebhook(body: any, headerToken: string | undefined) {
  if (CALLS.webhookToken && headerToken !== CALLS.webhookToken) return { status: 401, body: { success: false, error: 'unauthorized' } };
  const a = body?.arguments ?? {};
  const c = typeof a.request_id === 'string' ? calls.get(a.request_id) : undefined;
  if (!c) return { status: 200, body: { success: false, error: 'درخواست پیدا نشد؛ مشکلی نیست، تماس را با تشکر تمام کن.' } };
  const available = ['yes', 'no'].includes(String(a.available)) ? (a.available as 'yes' | 'no') : /بله|دارد|موجود/.test(String(a.available)) ? 'yes' : /نه|ندار|ناموجود/.test(String(a.available)) ? 'no' : 'unknown';
  setStatus(c, 'done', {
    result: { answered: true, available, price: toInt(a.price), hours: a.hours ? String(a.hours).slice(0, 120) : null, installment: a.installment ? String(a.installment).slice(0, 120) : null, notes: a.notes ? String(a.notes).slice(0, 400) : null },
  });
  return { status: 200, body: { success: true, result: { saved: true }, message: 'ممنون، اطلاعات ثبت شد. با تشکر خداحافظی کن.' } };
}

/** Demo mode: walks the call through realistic states and fills a plausible answer. */
function simulate(c: CallRecord) {
  const rnd = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h % 100) / 100; };
  const r = rnd(c.id);
  setTimeout(() => setStatus(c, 'ringing'), 1500);
  if (r < 0.15) { setTimeout(() => setStatus(c, 'no_answer', { result: { answered: false, available: 'unknown', price: null, hours: null, installment: null, notes: null } }), 9000); return; }
  setTimeout(() => setStatus(c, 'talking'), 5000);
  setTimeout(() => {
    const yes = r < 0.8;
    const price = yes && c.registeredPrice ? Math.round((c.registeredPrice * (0.97 + r * 0.12)) / 10000) * 10000 : null;
    setStatus(c, 'done', {
      result: {
        answered: true, available: yes ? 'yes' : 'no', price, hours: 'امروز تا ساعت ۲۰',
        installment: r > 0.5 ? 'با اسنپ‌پی امکانش هست' : 'فقط نقدی',
        notes: yes ? `موجوده${price ? `، قیمت امروز ${price.toLocaleString('fa-IR')} تومان` : ''}. گفتن قبل از اومدن یه پیام بدید که کنار بذارن.` : 'فعلاً تموم کردن؛ گفتن هفته بعد بار جدید میاد.',
      },
    });
  }, 14000);
}

/** Feature flags for the app (only the switch, never secrets). */
export const callsPublicConfig = () => ({ enabled: callsEnabled(), mock: CALLS.enabled && CALLS.mock });
