// Minimal UI dictionary for the app chrome. Agent replies follow the same language (sent in the profile).
// Language is fixed per page load (switching reloads), read straight from saved settings.
// Not importing the store here avoids a store → format → i18n → store import cycle.
const LANG: 'fa' | 'en' = (() => {
  try { return JSON.parse(localStorage.getItem('torobyar') || '{}').state?.lang === 'en' ? 'en' : 'fa'; } catch { return 'fa'; }
})();

const fa = {
  cancel: 'لغو', done: 'تمام', listening: 'دارم گوش می‌دم…', voice: 'گفتن با صدا',
  placeholders: ['دنبال چی می‌گردی؟', 'مثلاً: کتونی سبک برای پیاده‌روی', 'گوشی تا ۲۰ میلیون، قسطی', 'ایرپاد رو ۹ میلیون دیدم، ارزون‌تر هست؟', 'نزدیک‌ترین فروشگاه لامپ LED'],
  greetNight: 'شب بخیر', greetMorning: 'صبح بخیر', greetDay: 'روز بخیر', greetEvening: 'عصر بخیر',
  welcomeSub: 'امروز دنبال چی هستی؟ کمکت می‌کنم بهترین مدل و نزدیک‌ترین فروشگاه رو پیدا کنی.',
  starters: [['کتونی برای پیاده‌روی', 'یه کتونی راحت برای پیاده‌روی می‌خوام ولی نمی‌دونم چه مدلی'], ['گوشی قسطی', 'یه گوشی خوب می‌خوام که بشه قسطی خرید'], ['ارزون‌تر پیدا کن', 'هدفون ایرپاد پرو ۲ رو ۹ میلیون دیدم، نزدیک من ارزون‌تر هست؟'], ['ایده هدیه', 'برای تولد مادرم یه هدیه تا ۵ میلیون می‌خوام، چی پیشنهاد می‌دی؟']],
  installment: 'فقط قسطی', newChat: 'گفتگوی جدید', settings: 'تنظیمات',
  from: 'از', to: 'تا', thisBudget: 'همین بودجه', marketMedian: 'قیمت میانه در فروشگاه‌های حضوری:',
  language: 'زبان', disclaimer: 'قیمت‌ها ثبت‌شده‌ی فروشندگان در ترب‌اند؛ قبل از رفتن موجودی رو استعلام کن.',
};
type Dict = typeof fa;
const en: Dict = {
  cancel: 'Cancel', done: 'Done', listening: 'Listening…', voice: 'Dictate',
  placeholders: ['What are you looking for?', 'e.g. light sneakers for walking', 'A phone under 20M, on installments', 'Saw AirPods for 9M — cheaper nearby?', 'Nearest shop for LED bulbs'],
  greetNight: 'Good evening', greetMorning: 'Good morning', greetDay: 'Good afternoon', greetEvening: 'Good evening',
  welcomeSub: "What are you shopping for today? I'll help you pick the right model and the nearest shop.",
  starters: [['Walking sneakers', "I want comfortable walking sneakers but don't know which model"], ['Phone on installments', 'I want a good phone I can buy on installments'], ['Find it cheaper', 'I saw AirPods Pro 2 for 9 million toman, is it cheaper near me?'], ['Gift ideas', 'Gift ideas for my mom under 5 million toman?']],
  installment: 'Installments only', newChat: 'New chat', settings: 'Settings',
  from: 'From', to: 'To', thisBudget: 'Use this budget', marketMedian: 'Median in-store price:',
  language: 'Language', disclaimer: 'Prices are as registered by sellers on Torob; check stock before you go.',
};

export type Lang = 'fa' | 'en';
const DICTS: Record<Lang, Dict> = { fa, en };

export function t<K extends keyof Dict>(k: K): Dict[K] {
  return DICTS[LANG][k];
}
/** Re-render on language change. */
export const useLang = () => LANG;

// ── Full-app translation: tr('متن فارسی {0}', arg) → English from i18n/en.json when lang = en.
// Persian source strings are the keys; missing keys fall back to Persian. Data (shop/product names) stays as-is.
import EN from '../i18n/en.json';
const EN_MAP = EN as Record<string, string>;
export function tr(s: string, ...args: unknown[]): string {
  const out = LANG === 'en' ? EN_MAP[s] ?? s : s;
  return args.length ? out.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : out;
}
/** Locale for numbers / dates. */
export const locale = () => (LANG === 'en' ? 'en-US' : 'fa-IR');
