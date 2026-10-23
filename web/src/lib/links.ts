// Phone / messaging / navigation deep links.

/** 09121234567 / 02112345678 → +989121234567 / +982112345678 */
import { tr } from './i18n';
export function intlPhone(p: string | null | undefined) {
  if (!p) return null;
  const d = p.replace(/[^\d]/g, '');
  if (d.startsWith('98')) return `+${d}`;
  if (d.startsWith('0')) return `+98${d.slice(1)}`;
  return `+98${d}`;
}
export const isMobile = (p: string | null | undefined) => !!p && /^(\+98|0)?9\d{9}$/.test(p.replace(/[^\d+]/g, ''));

export const telLink = (p: string) => `tel:${intlPhone(p)}`;

/** iOS uses `&body=`, Android `?body=`; `?&body=` works on both. */
export const smsLink = (p: string, body: string) => `sms:${intlPhone(p)}?&body=${encodeURIComponent(body)}`;
export const whatsappLink = (p: string, body: string) => `https://wa.me/${intlPhone(p)!.slice(1)}?text=${encodeURIComponent(body)}`;
export const baleLink = (p: string) => `https://ble.ir/${intlPhone(p)!.replace('+98', '0')}`;

export const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

export type NavApp = { id: string; name: string; href: string; short: string };

/** Neshan format from NeshanMaps' official deeplink builder (nshn.ir); Balad uses its public /location page. */
export function navLinks(lat: number, lng: number, from?: { lat: number; lng: number } | null): NavApp[] {
  const ll = `${lat},${lng}`;
  const neshan = from ? `https://nshn.ir/?origin=${from.lat},${from.lng}&destination=${ll}&vehicle=d` : `https://nshn.ir/?lat=${lat}&lng=${lng}`;
  const apps: NavApp[] = [
    { id: 'neshan', name: tr("نشان"), short: tr("ن"), href: neshan },
    { id: 'balad', name: tr("بلد"), short: tr("ب"), href: `https://balad.ir/location?latitude=${lat}&longitude=${lng}&zoom=17` },
    { id: 'google', name: tr("گوگل‌مپ"), short: 'G', href: `https://www.google.com/maps/dir/?api=1&destination=${ll}` },
    { id: 'waze', name: tr("ویز"), short: 'W', href: `https://waze.com/ul?ll=${ll}&navigate=yes` },
  ];
  if (isIOS()) apps.push({ id: 'apple', name: tr("اپل‌مپ"), short: '', href: `https://maps.apple.com/?daddr=${ll}` });
  return apps;
}

export const googleSearchLink = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
