// Distance, travel-time estimates and opening-hours logic (Tehran time).

import { tr, loc } from './i18n.ts';
export type TravelMode = 'car' | 'taxi' | 'transit' | 'motor' | 'walk';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const MODE: Record<TravelMode, { kmh: number; overhead: number; rush: number }> = {
  car: { kmh: 22, overhead: 7, rush: 0.65 }, // overhead = parking in the bazaar area
  taxi: { kmh: 22, overhead: 5, rush: 0.65 },
  motor: { kmh: 30, overhead: 2, rush: 0.9 },
  transit: { kmh: 17, overhead: 10, rush: 0.9 },
  walk: { kmh: 4.8, overhead: 0, rush: 1 },
};

/** Rough door-to-door minutes. Straight-line distance × 1.35 road factor, slower in rush hour. */
export function etaMinutes(km: number, mode: TravelMode = 'car', at: Date = new Date()): number {
  const m = MODE[mode] ?? MODE.car;
  const { minutes } = tehranNow(at);
  const h = minutes / 60;
  const rush = (h >= 7 && h < 10) || (h >= 16 && h < 20.5);
  const speed = m.kmh * (rush ? m.rush : 1);
  return Math.max(2, Math.round((km * 1.35 / speed) * 60 + (km < 0.6 ? 0 : m.overhead)));
}

export const DAY_KEYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
export const DAY_FA: Record<string, string> = { sat: tr("شنبه"), sun: tr("یکشنبه"), mon: tr("دوشنبه"), tue: tr("سه‌شنبه"), wed: tr("چهارشنبه"), thu: tr("پنجشنبه"), fri: tr("جمعه") };
const JS_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function tehranNow(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return { dayKey: JS_TO_KEY[wd], dayIndex: DAY_KEYS.indexOf(JS_TO_KEY[wd] as (typeof DAY_KEYS)[number]), minutes };
}

export type Hours = Record<string, 'c' | 'n' | 'o' | [number, number][]> | null;

export type OpenState = {
  state: 'open' | 'closed' | 'unknown' | 'open_unknown_hours';
  closesAt?: number; // minutes since midnight
  opensAt?: { day: string; minutes: number };
  closingSoon?: boolean;
  label: string;
};

export const hhmm = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};

/** Open/closed status for a shop at a given moment (default now) plus a human label. */
export function openStatus(hours: Hours, at: Date = new Date(), offsetMin = 0): OpenState {
  if (!hours) return { state: 'unknown', label: tr("ساعت کاری ثبت نشده") };
  const now = tehranNow(new Date(at.getTime() + offsetMin * 60000));
  const today = hours[now.dayKey];
  const prevKey = DAY_KEYS[(now.dayIndex + 6) % 7];
  const prev = hours[prevKey];
  // Overnight shift from yesterday
  if (Array.isArray(prev)) {
    for (const [, b] of prev) if (b > 1440 && now.minutes < b - 1440) return { state: 'open', closesAt: b - 1440, closingSoon: b - 1440 - now.minutes <= 45, label: tr("باز تا {0}", hhmm(b)) };
  }
  if (Array.isArray(today)) {
    for (const [a, b] of today) {
      if (now.minutes >= a && now.minutes < b) return { state: 'open', closesAt: b, closingSoon: b - now.minutes <= 45, label: b - now.minutes <= 45 ? tr("تا {0} دقیقه دیگر می‌بندد", b - now.minutes) : tr("باز تا {0}", hhmm(b)) };
    }
    const later = today.find(([a]) => a > now.minutes);
    if (later) return { state: 'closed', opensAt: { day: now.dayKey, minutes: later[0] }, label: tr("بسته · امروز از {0}", hhmm(later[0])) };
  } else if (today === 'o') {
    return { state: 'open_unknown_hours', label: tr("امروز باز (ساعت دقیق نامشخص)") };
  } else if (today === 'n' || today === undefined) {
    return { state: 'unknown', label: tr("ساعت امروز ثبت نشده") };
  }
  // Find next opening day
  for (let i = 1; i <= 7; i++) {
    const k = DAY_KEYS[(now.dayIndex + i) % 7];
    const d = hours[k];
    if (Array.isArray(d) && d.length) return { state: 'closed', opensAt: { day: k, minutes: d[0][0] }, label: tr("بسته · {0} از {1}", i === 1 ? tr("فردا") : tr(DAY_FA[k]), hhmm(d[0][0])) };
    if (d === 'o') return { state: 'closed', opensAt: { day: k, minutes: 600 }, label: tr("بسته · {0} باز است", i === 1 ? tr("فردا") : tr(DAY_FA[k])) };
  }
  return { state: 'closed', label: today === 'c' ? tr("امروز تعطیل") : tr("بسته") };
}

export function hoursTable(hours: Hours) {
  if (!hours) return null;
  return DAY_KEYS.map((k) => {
    const d = hours[k];
    let text: string;
    if (Array.isArray(d)) text = d.map(([a, b]) => tr("{0} تا {1}", hhmm(a), hhmm(b))).join(tr(" و "));
    else if (d === 'c') text = tr("تعطیل");
    else if (d === 'o') text = tr("باز (ساعت نامشخص)");
    else text = tr("نامشخص");
    return { day: k, dayFa: tr(DAY_FA[k]), text, closed: d === 'c' };
  });
}

/** How stale is a registered price. Dataset snapshot is ~1 week old. */
export function freshness(changedAt: string | null, at: Date = new Date()) {
  if (!changedAt) return { days: null as number | null, level: 'unknown' as const, label: tr("زمان ثبت قیمت نامشخص") };
  const days = Math.max(0, Math.floor((at.getTime() - new Date(changedAt).getTime()) / 86400000));
  const level = days <= 10 ? 'fresh' : days <= 45 ? 'ok' : 'stale';
  const label = days === 0 ? tr("قیمت امروز به‌روز شده") : days < 31 ? tr("قیمت {0} روز پیش ثبت شده", days) : days < 365 ? tr("قیمت {0} ماه پیش ثبت شده", Math.round(days / 30)) : tr("قیمت بیش از {0} سال پیش ثبت شده", Math.floor(days / 365));
  return { days, level, label } as { days: number | null; level: 'fresh' | 'ok' | 'stale' | 'unknown'; label: string };
}
