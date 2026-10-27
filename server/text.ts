// Persian text normalization shared by the DB build script and the server.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/** Aggressive normalization for search: unify letters, digits, drop diacritics and punctuation. */
export function norm(input: string | null | undefined): string {
  if (!input) return '';
  let s = toLatinDigits(String(input));
  s = s
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[‌‍‎‏]/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return s;
}

/** Colloquial → catalogue vocabulary. Each key expands to OR alternatives. */
export const SYNONYMS: Record<string, string[]> = {
  'کتونی': ['کتانی', 'کفش'],
  'کتانی': ['کتونی'],
  'اسنیکر': ['کتانی', 'کفش'],
  'گوشی': ['موبایل'],
  'موبایل': ['گوشی'],
  'هندزفری': ['هدفون', 'هدست', 'ایرپاد'],
  'ایرپاد': ['هندزفری', 'هدفون'],
  'لپتاپ': ['لپ', 'نوت'],
  'لپ': ['لپتاپ'],
  'یخچال': ['فریزر'],
  'تلویزیون': ['tv', 'تی وی'],
  'شارژر': ['شارژ'],
  'پاوربانک': ['پاور', 'شارژر همراه'],
  'ساعت': ['واچ'],
  'اسمارت': ['هوشمند'],
  'هوشمند': ['اسمارت'],
  'دوربین': ['کمرا'],
  'لامپ': ['چراغ'],
  'عطر': ['ادکلن', 'ادو'],
  'ادکلن': ['عطر'],
  'آیفون': ['iphone', 'اپل'],
  'ایفون': ['iphone', 'اپل'],
  'سامسونگ': ['samsung', 'گلکسی'],
  'شیائومی': ['xiaomi', 'ردمی', 'پوکو'],
  'نایک': ['nike', 'نایکی'],
  'نایکی': ['nike', 'نایک'],
  'آدیداس': ['adidas', 'ادیداس'],
  'ادیداس': ['adidas'],
  'پوما': ['puma'],
  'اسکیچرز': ['skechers'],
  'نیوبالانس': ['new balance', 'نیو بالانس'],
};

const STOP = new Set(['و', 'یا', 'با', 'برای', 'از', 'به', 'در', 'که', 'این', 'اون', 'یه', 'یک', 'می', 'خوام', 'میخوام', 'میخام', 'دنبال', 'هستم', 'رو', 'را', 'مدل', 'های', 'ها', 'تا', 'خرید', 'قیمت', 'ارزان', 'ارزون', 'خوب', 'بهترین', 'مناسب', 'چی', 'چه', 'کجا', 'نزدیک', 'تومان', 'تومن', 'میلیون', 'هزار']);

/** Build a forgiving FTS5 MATCH expression from free text. Returns '' if nothing usable. */
export function ftsQuery(text: string, mode: 'and' | 'or' = 'and'): string {
  const terms = norm(text).split(' ').filter((t) => t && !STOP.has(t) && !(t.length === 1 && !/\d/.test(t)));
  if (!terms.length) return '';
  const groups = terms.slice(0, 8).map((t) => {
    const alts = new Set<string>([t]);
    for (const syn of SYNONYMS[t] ?? []) alts.add(norm(syn));
    const parts = [...alts].map((a) => (a.includes(' ') ? `"${a}"` : `"${a}"*`));
    return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0];
  });
  return groups.join(mode === 'and' ? ' AND ' : ' OR ');
}
