// Per-request UI language for server-generated labels (open status, freshness, reasons, tips, messages).
// Set from the `x-lang` header by middleware in index.ts; Persian strings are the dictionary keys.
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';

const EN: Record<string, string> = JSON.parse(readFileSync(new URL('./i18n/en.json', import.meta.url), 'utf8'));
export const langStore = new AsyncLocalStorage<{ lang: 'fa' | 'en' }>();

export const currentLang = () => langStore.getStore()?.lang ?? 'fa';
export const loc = () => (currentLang() === 'en' ? 'en-US' : 'fa-IR');

export function tr(s: string, ...args: unknown[]): string {
  const out = currentLang() === 'en' ? EN[s] ?? s : s;
  return args.length ? out.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : out;
}
