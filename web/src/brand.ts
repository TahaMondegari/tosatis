// ─── Brand assets: replace here to re-brand ────────────────────────────────────────────
// Drop new files into web/public/brand/ (same names) or point these paths at your own.
// Optional env overrides at build time: VITE_BRAND_MARK, VITE_BRAND_WORDMARK_RED,
// VITE_BRAND_WORDMARK_INK, VITE_BRAND_NAME.
//
// wordmarkRed  — coloured part of the wordmark (kept as-is), transparent PNG/SVG
// wordmarkInk  — dark part, used as a MASK and painted with the theme text colour (so it's light in dark mode).
//                Set to '' to show `wordmarkRed` only (e.g. a single full-colour logo).
// mark         — square icon (sidebar, chat avatar, welcome). Favicon/app icons live in index.html & manifest.
// English UI uses the *_EN variants (VITE_BRAND_WORDMARK_EN_RED / _EN_INK).
import { tr, locale } from './lib/i18n';
const env = import.meta.env as Record<string, string | undefined>;
const en = locale() === 'en-US'; // language is fixed per page load (switching reloads)

export const BRAND = {
  name: env.VITE_BRAND_NAME || tr("ترب‌یار"),
  mark: env.VITE_BRAND_MARK || '/brand/mark.png',
  wordmarkRed: en ? env.VITE_BRAND_WORDMARK_EN_RED || '/brand/wordmark-en-red.png' : env.VITE_BRAND_WORDMARK_RED || '/brand/wordmark-red.png',
  wordmarkInk: en ? env.VITE_BRAND_WORDMARK_EN_INK ?? '/brand/wordmark-en-ink.png' : env.VITE_BRAND_WORDMARK_INK ?? '/brand/wordmark-ink.png',
  /** width / height of the wordmark images */
  wordmarkRatio: en ? 560 / 107 : 480 / 171,
};
