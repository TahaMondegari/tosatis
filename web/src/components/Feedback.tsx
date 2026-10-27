import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MessageSquareHeart, Star, X } from 'lucide-react';
import { useApp } from '../store';
import { haptic } from './LocationPicker';
import { Button, cx } from './ui';

import { tr, locale } from '../lib/i18n';
const MIN_AGE = 40 * 60_000; // assume the visit happened ~40 min after we sent them on their way
const AWAY = 20 * 60_000; // or they left the app for a while and came back

/** The purchase the user most likely finished and hasn't rated yet. */
export function duePurchase() {
  const { purchases, lastSeen } = useApp.getState();
  const now = Date.now();
  const returned = now - lastSeen > AWAY;
  return purchases.find((p) => p.status === 'pending' && (now - p.at > MIN_AGE || (returned && now - p.at > 8 * 60_000))) ?? null;
}

/** Opens the survey once when the user comes back to the app after a likely visit. */
export function useSmartFeedback() {
  useEffect(() => {
    const check = () => {
      const p = duePurchase();
      const s = useApp.getState();
      if (p && !s.sheet && !s.busy) {
        s.patchPurchase(p.id, { status: 'asked' });
        setTimeout(() => useApp.getState().set({ sheet: { type: 'feedback', id: p.id } }), 900);
      }
      useApp.setState({ lastSeen: Date.now() });
    };
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); else useApp.setState({ lastSeen: Date.now() }); };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => { if (document.visibilityState === 'visible') useApp.setState({ lastSeen: Date.now() }); }, 60_000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, []);
}

export function FeedbackBanner() {
  const purchases = useApp((s) => s.purchases);
  const p = purchases.find((x) => x.status === 'asked' || (x.status === 'pending' && Date.now() - x.at > 10 * 60_000));
  if (!p) return null;
  return (
    <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={() => { haptic(); useApp.getState().set({ sheet: { type: 'feedback', id: p.id } }); }}
      className="mb-5 flex items-center gap-3 rounded-2xl bg-accent-soft p-3 text-right ring-1 ring-accent/30">
      <MessageSquareHeart className="size-6 shrink-0 text-accent" />
      <span className="min-w-0 flex-1"><b className="block text-[14.5px]">{tr("خریدت از")}{' '}{p.shopName} {' '}{tr("چطور بود؟")}</b><span className="block truncate text-[12.5px] text-muted">{tr("۱۰ ثانیه وقت می‌گیره و پیشنهادهای بعدی رو بهتر می‌کنه")}</span></span>
    </motion.button>
  );
}

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 text-[14.5px] font-semibold">{label}</div>
      <div className="flex gap-1" dir="ltr" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button key={n} role="radio" aria-checked={value === n} aria-label={tr("{0} از ۵", n.toLocaleString(locale()))} whileTap={{ scale: 0.8 }} animate={{ scale: value >= n ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            onClick={() => { haptic(6); onChange(n); }} className="grid size-11 place-items-center">
            <Star className={cx('size-8 transition-colors duration-200', value >= n ? 'fill-accent text-accent' : 'text-line-strong')} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackSheetBody({ id }: { id: string }) {
  const p = useApp((s) => s.purchases.find((x) => x.id === id));
  const name = useApp((s) => s.profile?.name);
  const [bought, setBought] = useState<boolean | null>(null);
  const [find, setFind] = useState(0);
  const [buy, setBuy] = useState(0);
  const [match, setMatch] = useState(0);
  const [note, setNote] = useState('');
  const close = () => useApp.getState().set({ sheet: null });
  if (!p) return <p className="py-8 text-center text-muted">{tr("موردی برای نظرسنجی نیست.")}</p>;
  const later = () => { useApp.getState().patchPurchase(p.id, { status: 'pending', at: Date.now() }); close(); };
  const submit = () => {
    const rating = { find, buy, match, bought: !!bought, note: note.trim() || undefined };
    useApp.getState().patchPurchase(p.id, { status: 'done', rating });
    void fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shopId: p.shopId, productId: p.productId, ...rating }) }).catch(() => {});
    haptic(20);
    useApp.getState().showToast(tr("ممنون! نظرت ثبت شد"));
    close();
  };
  return (
    <div className="flex flex-col gap-5 pb-2">
      <div>
        <h2 className="text-[19px] leading-8 font-extrabold">{name ? tr("{0}، ", name) : ''}{tr("بالاخره خریدی؟")}</h2>
        <p className="text-[14px] text-muted">{p.shopName}{p.productTitle ? ` · ${p.productTitle}` : ''}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[[tr("بله، خریدم"), true], [tr("نه، نشد"), false]].map(([l, v]) => (
          <button key={String(v)} onClick={() => { haptic(); setBought(v as boolean); }} className={cx('min-h-12 rounded-2xl border text-[14.5px] font-bold transition-all duration-300', bought === v ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-3')}>{l as string}</button>
        ))}
        <button onClick={later} className="min-h-12 rounded-2xl border border-dashed border-line text-[14px] font-semibold text-muted hover:bg-surface-3">{tr("هنوز نرفتم")}</button>
      </div>
      {bought !== null && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <Stars label={tr("پیدا کردن فروشگاه چقدر راحت بود؟")} value={find} onChange={setFind} />
          <Stars label={tr("قیمت و موجودی با چیزی که ترب‌یار گفت می‌خوند؟")} value={match} onChange={setMatch} />
          {bought && <Stars label={tr("از خریدت چقدر راضی بودی؟")} value={buy} onChange={setBuy} />}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={bought ? tr("نکته‌ای که به بقیه کمک کنه (اختیاری)") : tr("چی شد؟ موجود نبود؟ قیمت فرق داشت؟ (اختیاری)")} className="resize-none rounded-2xl border border-line bg-surface-2 p-3 text-[15px] outline-none focus:border-accent" />
          <Button size="lg" full disabled={!find || (bought && !buy)} onClick={submit}>{tr("ثبت نظر")}</Button>
        </motion.div>
      )}
      <button onClick={() => { useApp.getState().patchPurchase(p.id, { status: 'dismissed' }); close(); }} className="mx-auto flex min-h-10 items-center gap-1 text-[13px] text-muted hover:text-fg"><X className="size-3.5" />{tr("دیگه نپرس")}</button>
    </div>
  );
}
