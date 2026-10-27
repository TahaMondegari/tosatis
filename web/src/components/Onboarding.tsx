import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CreditCard, LocateFixed, MapPin, Sparkles, Scale, MessageSquareText } from 'lucide-react';
import { useApp } from '../store';
import type { Profile, TravelMode } from '../lib/types';
import { nearestArea } from '../lib/areas';
import { requestGPS } from './blocks/inputs';
import { LocationField, LocationPicker } from './LocationPicker';
import { MODE_FA, MODE_ICON } from './chat/ChatView';
import { Button, Logo, Toggle, Wordmark, cx } from './ui';

import { tr } from '../lib/i18n';
const STEPS = ['welcome', 'name', 'location', 'mode', 'prefs'] as const;

export function Onboarding({ edit = false, onDone }: { edit?: boolean; onDone?: () => void }) {
  const existing = useApp((s) => s.profile);
  const [step, setStep] = useState(edit ? 1 : 0);
  const [dir, setDir] = useState(1);
  const [p, setP] = useState<Profile>(existing ?? { name: '', city: tr("تهران"), areaName: null, lat: null, lng: null, locationSource: null, mode: 'car', installmentOnly: false, priorities: [] });
  const [gps, setGps] = useState<'idle' | 'loading' | 'error'>('idle');
  const [picker, setPicker] = useState(false);
  const go = (d: number) => { setDir(d); setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + d))); };
  const id = STEPS[step];
  const canNext = id === 'name' ? p.name.trim().length > 0 : id === 'location' ? p.lat != null : true;

  const finish = () => {
    const s = useApp.getState();
    s.setProfile({ ...p, name: p.name.trim() });
    if (!edit) s.newChat();
    onDone?.();
  };

  const useGPS = async () => {
    setGps('loading');
    try {
      const c = await requestGPS();
      const { area, km } = nearestArea(c.lat, c.lng);
      setP((x) => ({ ...x, lat: c.lat, lng: c.lng, areaName: km < 4 ? tr("نزدیک {0}", area.name) : tr("موقعیت فعلی"), locationSource: 'gps' }));
      setGps('idle');
      go(1);
    } catch { setGps('error'); }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-clip">
      <div className="bg-dots pointer-events-none absolute inset-0" />
      <div className="spotlight" />
      <div className="safe-top relative z-10 flex items-center gap-3 px-5 pt-5">
        {step > (edit ? 1 : 0) ? <button aria-label={tr("قبلی")} onClick={() => go(-1)} className="grid size-11 place-items-center rounded-xl hover:bg-surface-3"><ArrowRight className="size-5" /></button> : <Logo className="size-10" />}
        {!edit && step > 0 && <button onClick={() => { const s2 = useApp.getState(); s2.setProfile({ ...p, name: p.name.trim(), lat: p.lat ?? 35.7, lng: p.lng ?? 51.41, areaName: p.areaName }); s2.newChat(); }} className="order-last min-h-10 rounded-full px-3 text-[13.5px] font-semibold text-muted hover:text-fg">{tr("رد شدن")}</button>}
        <div className="flex flex-1 gap-1.5" aria-label={tr("مرحله {0} از {1}", step, STEPS.length - 1)}>
          {STEPS.slice(1).map((s, i) => <span key={s} className={cx('h-1.5 flex-1 rounded-full transition-colors duration-700', i < step ? 'bg-accent' : 'bg-surface-3')} />)}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pt-8 pb-6">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={id} custom={dir} initial={{ opacity: 0, x: -40 * dir, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: 40 * dir, filter: 'blur(6px)' }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="flex flex-1 flex-col">
            {id === 'welcome' && (
              <div className="flex flex-1 flex-col">
                
                <h1 className="flex flex-wrap items-center gap-x-2.5 text-[30px] leading-[1.6] font-extrabold">{tr("سلام! من")}{' '}<Wordmark height={34} /> {' '}{tr("هستم.")}</h1>
                <p className="mt-2 text-[17px] leading-8 text-muted">{tr("دستیار خرید حضوری از فروشگاه‌ها، پاساژها و مراکز خرید تهران.")}</p>
                <ul className="mt-8 flex flex-col gap-3">
                  {[[Sparkles, tr("کمک می‌کنم بفهمی دقیقاً چه مدلی به کارت میاد")], [Scale, tr("قیمت، فاصله، ساعت کاری و شرایط قسطی فروشگاه‌ها رو مقایسه می‌کنم")], [MessageSquareText, tr("قبل از رفتن، موجودی و قیمت به‌روز رو از فروشنده می‌پرسیم")], [MapPin, tr("تا جلوی مغازه داخل پاساژ مسیر رو نشونت می‌دم")]].map(([I, t], i) => (
                    <li key={i} className="flex items-center gap-3 text-[15.5px]" style={{ animation: `up .7s ${0.15 + i * 0.08}s both` }}>
                      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-surface-3"><I className="size-5" /></span>{t as string}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8"><div className="moving-border"><Button full size="lg" className="!shadow-none" onClick={() => go(1)}>{tr("شروع کنیم")}</Button></div></div>
              </div>
            )}

            {id === 'name' && (
              <div className="flex flex-1 flex-col">
                <h2 className="text-[24px] font-extrabold">{tr("اسمت چیه؟")}</h2>
                <p className="mt-1 text-[15px] text-muted">{tr("تا صدات کنم و پیام‌های فروشگاه رو به اسم خودت آماده کنم.")}</p>
                <input autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && canNext && go(1)} placeholder={tr("مثلاً سارا")} maxLength={30} className="mt-6 h-14 rounded-2xl border border-line bg-surface px-4 text-[18px] outline-none focus:border-accent" />
              </div>
            )}

            {id === 'location' && (
              <div className="flex flex-1 flex-col">
                <h2 className="text-[24px] font-extrabold">{p.name ? tr("{0}، ", p.name) : ''}{tr("کجا خرید می‌کنی؟")}</h2>
                <p className="mt-1 text-[15px] text-muted">{tr("برای نزدیک‌ترین فروشگاه‌ها و زمان رسیدن. فقط روی گوشی خودت ذخیره می‌شه.")}</p>
                <Button size="lg" className="mt-6" onClick={useGPS} disabled={gps === 'loading'} icon={<LocateFixed className="size-5" />}>{gps === 'loading' ? tr("در حال پیدا کردن…") : tr("موقعیت فعلی من")}</Button>
                {gps === 'error' && <p className="mt-2 text-[13.5px] text-warn">{tr("دسترسی به موقعیت ممکن نشد؛ از فهرست انتخاب کن.")}</p>}
                <div className="my-4 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />{tr("یا")}<span className="h-px flex-1 bg-line" /></div>
                <LocationField city={p.lat != null ? p.city : undefined} areaName={p.areaName} onClick={() => setPicker(true)} />
                <p className="mt-3 text-[13px] text-muted">{tr("انتخاب محله اختیاریه.")}</p>
                <LocationPicker open={picker} onClose={() => setPicker(false)} current={p} onPick={(l) => { setP((x) => ({ ...x, city: l.city, province: l.province, areaName: l.areaName, lat: l.lat, lng: l.lng, locationSource: l.source })); setTimeout(() => go(1), 250); }} />
              </div>
            )}

            {id === 'mode' && (
              <div className="flex flex-1 flex-col">
                <h2 className="text-[24px] font-extrabold">{tr("معمولاً با چی می‌ری خرید؟")}</h2>
                <p className="mt-1 text-[15px] text-muted">{tr("زمان رسیدن و ترافیک ساعت‌های شلوغ رو بر همین اساس حساب می‌کنم.")}</p>
                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  {(['car', 'taxi', 'transit', 'motor', 'walk'] as TravelMode[]).map((m) => {
                    const I = MODE_ICON[m];
                    return (
                      <button key={m} onClick={() => setP({ ...p, mode: m })} className={cx('flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-[16px] font-bold transition-all duration-500', p.mode === m ? 'border-accent bg-accent-soft shadow-[0_0_22px_-10px_var(--accent)]' : 'border-line hover:bg-surface-3')}>
                        <I className="size-6" />{MODE_FA[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {id === 'prefs' && (
              <div className="flex flex-1 flex-col">
                <h2 className="text-[24px] font-extrabold">{tr("شرایط خرید")}</h2>
                <p className="mt-1 text-[15px] text-muted">{tr("هر وقت خواستی از تنظیمات یا نوار بالای پیام‌ها عوضش کن.")}</p>
                <div className="mt-6 rounded-3xl border border-line bg-surface p-4">
                  <Toggle checked={p.installmentOnly} onChange={(v) => setP({ ...p, installmentOnly: v })} label={tr("فقط فروشگاه‌های قسطی و اعتباری")} hint={tr("اسنپ‌پی، دیجی‌پی، تارا، ازکی‌وام، ترب‌پی و…")} />
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-2xl bg-accent-soft p-4 text-[14px] leading-7 text-fg-2"><CreditCard className="mt-1 size-4 shrink-0 text-accent" />{tr("اولویت‌هایت (قیمت، فاصله، باز بودن، گارانتی…) رو هم وسط گفتگو ازت می‌پرسم تا رتبه‌بندی فروشگاه‌ها شخصی بشه.")}</div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {id !== 'welcome' && (
          <div className="safe-bottom mt-6 flex gap-2 pt-2">
            {step < STEPS.length - 1 ? (
              <Button full size="lg" disabled={!canNext} onClick={() => go(1)} icon={<ArrowLeft className="size-5" />}>{tr("ادامه")}</Button>
            ) : (
              <div className="moving-border w-full"><Button full size="lg" className="!shadow-none" onClick={finish} icon={<Check className="size-5" />}>{edit ? tr("ذخیره") : tr("بزن بریم")}</Button></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
