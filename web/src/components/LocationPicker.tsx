import { placeName } from '../lib/iran';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronLeft, LocateFixed, MapPin, Search, Sparkles } from 'lucide-react';
import { PROVINCES, ALL_CITIES, districtsOf, type City } from '../lib/iran';
import { nearestArea } from '../lib/areas';
import { requestGPS } from './blocks/inputs';
import { Sheet, cx } from './ui';

import { tr, locale } from '../lib/i18n';
export type PickedLocation = { city: string; province: string; areaName: string | null; lat: number; lng: number; source: 'gps' | 'area' };

export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

function Row({ title, sub, active, onClick, i, badge }: { title: string; sub?: string; active?: boolean; onClick: () => void; i: number; badge?: string }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 14) * 0.018, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { haptic(); onClick(); }}
      className={cx('flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3.5 text-right transition-colors duration-300', active ? 'bg-accent-soft' : 'hover:bg-surface-3 active:bg-surface-3')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15.5px] font-semibold">{title}</span>
        {sub && <span className="block truncate text-[12.5px] text-muted">{sub}</span>}
      </span>
      {badge && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11.5px] font-bold text-ok">{badge}</span>}
      {active ? <Check className="size-5 text-accent" /> : <ChevronLeft className="size-4 text-muted" />}
    </motion.button>
  );
}

let coverageCache: Set<string> | null = null;
/** Cities with shop data, from the server — new datasets light up here without code changes. */
function useCoverage() {
  const [cov, setCov] = useState<Set<string>>(coverageCache ?? new Set(ALL_CITIES.filter((x) => x.covered).map((x) => x.name)));
  useEffect(() => {
    if (coverageCache) return;
    fetch('/api/coverage').then((r) => r.json()).then((rows: { city: string }[]) => { coverageCache = new Set(rows.map((r) => r.city)); setCov(coverageCache); }).catch(() => {});
  }, []);
  return cov;
}

export function LocationPicker({ open, onClose, onPick, current }: { open: boolean; onClose: () => void; onPick: (l: PickedLocation) => void; current?: { city?: string; areaName?: string | null } }) {
  const cov = useCoverage();
  const [q, setQ] = useState('');
  const [province, setProvince] = useState<string | null>(null);
  const [city, setCity] = useState<(City & { province: string }) | null>(null);
  const [gps, setGps] = useState<'idle' | 'loading' | 'error'>('idle');

  const reset = () => { setQ(''); setProvince(null); setCity(null); setGps('idle'); };
  const close = () => { reset(); onClose(); };
  const done = (l: PickedLocation) => { haptic(14); onPick(l); reset(); onClose(); };

  const pickCity = (ci: City & { province: string }) => {
    if (districtsOf(ci.id).length) { setCity(ci); setQ(''); }
    else done({ city: ci.name, province: ci.province, areaName: null, lat: ci.lat, lng: ci.lng, source: 'area' });
  };

  const useGPS = async () => {
    setGps('loading');
    try {
      const p = await requestGPS();
      const { area, km } = nearestArea(p.lat, p.lng);
      done({ city: tr("تهران"), province: tr("تهران"), areaName: km < 4 ? tr("نزدیک {0}", area.name) : tr("موقعیت فعلی"), lat: p.lat, lng: p.lng, source: 'gps' });
    } catch { setGps('error'); }
  };

  const term = q.trim();
  const cityHits = useMemo(() => (term ? ALL_CITIES.filter((ci) => ci.name.includes(term) || ci.province.includes(term)).slice(0, 40) : []), [term]);
  const districts = city ? districtsOf(city.id).filter((d) => !term || d.name.includes(term) || d.group.includes(term)) : [];
  const prov = PROVINCES.find((p) => p.id === province);
  const step = city ? 'district' : prov ? 'city' : 'province';
  const title = step === 'district' ? tr("{0} · محله (اختیاری)", placeName(city!.name)) : step === 'city' ? placeName(prov!.name) : tr("کجا خرید می‌کنی؟");

  return (
    <Sheet tall open={open} onClose={close} title={
      <span className="flex items-center gap-1">
        {step !== 'province' && <button aria-label={tr("برگشت")} onClick={() => { haptic(); if (city) setCity(null); else setProvince(null); setQ(''); }} className="-mr-2 grid size-10 place-items-center rounded-xl hover:bg-surface-3"><ChevronLeft className="size-5 rotate-180" /></button>}
        {title}
      </span>
    }>
      <div className="sticky top-0 z-10 -mx-4 bg-bg px-4 pb-2">
        <label className="flex h-12 items-center gap-2 rounded-2xl bg-surface-3 px-4 ring-accent focus-within:ring-2">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={step === 'district' ? tr("جست‌وجوی محله یا منطقه") : tr("جست‌وجوی شهر یا استان")} className="h-12 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ph" />
        </label>
      </div>

      {step === 'province' && !term && (
        <button onClick={useGPS} disabled={gps === 'loading'} className="mb-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line px-4 text-right transition-colors hover:bg-surface-3">
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><LocateFixed className="size-5" /></span>
          <span className="flex-1"><b className="block text-[15px]">{gps === 'loading' ? tr("در حال پیدا کردن…") : tr("موقعیت فعلی من")}</b><span className="text-[12.5px] text-muted">{gps === 'error' ? tr("دسترسی داده نشد؛ از فهرست انتخاب کن") : tr("دقیق‌ترین فاصله‌ها رو حساب می‌کنم")}</span></span>
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={step + term} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.22 }} className="flex flex-col gap-0.5">
          {step === 'province' && term && cityHits.map((ci, i) => <Row key={ci.id} i={i} title={placeName(ci.name)} sub={placeName(ci.province)} badge={cov.has(ci.name) ? tr("فعال") : undefined} active={current?.city === ci.name} onClick={() => pickCity(ci)} />)}
          {step === 'province' && term && !cityHits.length && <p className="py-8 text-center text-[14px] text-muted">{tr("شهری با این نام پیدا نکردم.")}</p>}
          {step === 'province' && !term && PROVINCES.map((p, i) => (
            <Row key={p.id} i={i} title={placeName(p.name)} sub={tr("{0} شهر", p.cities.length.toLocaleString(locale()))} badge={p.cities.some((x) => cov.has(x.name)) ? tr("فعال") : undefined} onClick={() => setProvince(p.id)} />
          ))}
          {step === 'city' && prov!.cities.filter((ci) => !term || ci.name.includes(term)).map((ci, i) => (
            <Row key={ci.id} i={i} title={placeName(ci.name)} sub={cov.has(ci.name) ? tr("فروشگاه‌های حضوری فعال") : tr("به‌زودی")} badge={cov.has(ci.name) ? tr("فعال") : undefined} active={current?.city === ci.name} onClick={() => pickCity({ ...ci, province: prov!.name })} />
          ))}
          {step === 'district' && (
            <>
              <Row i={0} title={tr("همه‌جای {0}", placeName(city!.name))} sub={tr("بدون انتخاب محله — از مرکز شهر حساب می‌کنم")} onClick={() => done({ city: city!.name, province: city!.province, areaName: null, lat: city!.lat, lng: city!.lng, source: 'area' })} />
              {Object.entries(districts.reduce<Record<string, typeof districts>>((g, d) => ((g[d.group] ??= []).push(d), g), {})).map(([group, list]) => (
                <div key={group} className="mt-2">
                  <div className="px-3.5 pb-1 text-[12.5px] font-bold text-muted">{group}</div>
                  {list.map((d, i) => <Row key={d.name} i={i + 1} title={placeName(d.name)} active={current?.areaName === d.name} onClick={() => done({ city: city!.name, province: city!.province, areaName: d.name, lat: d.lat, lng: d.lng, source: 'area' })} />)}
                </div>
              ))}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      {step !== 'district' && <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted"><Sparkles className="size-3.5" />{tr("فعلاً فروشگاه‌های تهران فعال‌اند؛ بقیه شهرها با اضافه شدن داده‌ها فعال می‌شن.")}</p>}
    </Sheet>
  );
}

/** Select-like trigger that opens the picker. */
export function LocationField({ city, areaName, onClick }: { city?: string; areaName?: string | null; onClick: () => void }) {
  return (
    <button onClick={() => { haptic(); onClick(); }} className="group flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-right transition-all duration-300 hover:border-line-strong active:scale-[.99]">
      <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent"><MapPin className="size-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-muted">{tr("شهر و محله")}</span>
        <span className="block truncate text-[15.5px] font-bold">{city ? placeName(city) : tr("انتخاب کن")}{areaName ? ` · ${placeName(areaName)}` : ''}</span>
      </span>
      <ChevronLeft className="size-5 text-muted transition-transform duration-300 group-hover:-translate-x-0.5" />
    </button>
  );
}
