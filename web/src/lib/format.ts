import { tr, locale } from './i18n';
const nf = { format: (n: number) => new Intl.NumberFormat(locale()).format(n) };

export const fa = (n: number | string | null | undefined) => (n == null ? '' : typeof n === 'number' ? nf.format(n) : locale() === 'en-US' ? String(n).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) : String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]));

export function toman(n: number | null | undefined, short = false) {
  if (n == null) return tr("قیمت ثبت نشده");
  if (short && n >= 1_000_000) {
    const m = n / 1_000_000;
    return tr("{0} میلیون", fa(Math.round(m * 10) / 10));
  }
  if (short && n >= 1000) return tr("{0} هزار", fa(Math.round(n / 1000)));
  return tr("{0} تومان", nf.format(Math.round(n)));
}

export const km = (d: number | null | undefined) => (d == null ? tr("فاصله نامشخص") : d < 1 ? tr("{0} متر", fa(Math.round(d * 1000 / 10) * 10)) : tr("{0} کیلومتر", fa(Math.round(d * 10) / 10)));

export const minutes = (m: number | null | undefined) => (m == null ? '' : m < 60 ? tr("{0} دقیقه", fa(m)) : tr("{0} ساعت{1}", fa(Math.floor(m / 60)), m % 60 ? tr(" و {0} دقیقه", fa(m % 60)) : ''));

export const MODE_LABEL: Record<string, string> = { car: tr("با خودرو"), taxi: tr("با تاکسی"), transit: tr("با مترو/اتوبوس"), motor: tr("با موتور"), walk: tr("پیاده") };

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return tr("همین الان");
  if (s < 3600) return tr("{0} دقیقه پیش", fa(Math.floor(s / 60)));
  if (s < 86400) return tr("{0} ساعت پیش", fa(Math.floor(s / 3600)));
  return tr("{0} روز پیش", fa(Math.floor(s / 86400)));
}

export const clock = (ts: number) => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(ts);

/** Parse a Persian/English number typed by the user (supports ۱۲۳٬۴۵۶ and "۲ میلیون"). */
export function parseAmount(s: string): number | null {
  const t = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬\s]/g, '').replace('٫', '.');
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  let v = Number(m[1]);
  if (/میلیون|ملیون/.test(s)) v *= 1e6;
  else if (/هزار/.test(s)) v *= 1e3;
  return Math.round(v);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
