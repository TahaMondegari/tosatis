import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, CircleHelp, Clock, CreditCard, MessageSquareText, PhoneCall, PhoneOff, Quote, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { useApp } from '../../store';
import { postLocal, runAction } from '../../lib/chat';
import { toman } from '../../lib/format';
import { tr } from '../../lib/i18n';
import { Badge, Button, Card, cx } from '../ui';
import { NavigateBlock } from './contact';

type CallStatus = 'dialing' | 'ringing' | 'talking' | 'done' | 'no_answer' | 'failed';
type CallRec = {
  id: string; status: CallStatus; error?: string; createdAt: number; updatedAt: number;
  result?: { answered: boolean; available: 'yes' | 'no' | 'unknown'; price: number | null; hours: string | null; installment: string | null; notes: string | null };
};
type Props = { id: string; callId: string; shop: { id: string; name: string; phone: string | null; lat: number; lng: number; open?: any }; product: { id: string; title: string; price: number | null } | null };

const TERMINAL: CallStatus[] = ['done', 'no_answer', 'failed'];
const STEPS: { key: CallStatus; label: () => string }[] = [
  { key: 'dialing', label: () => tr('شماره‌گیری') },
  { key: 'ringing', label: () => tr('زنگ می‌خوره') },
  { key: 'talking', label: () => tr('در حال گفتگو با فروشنده') },
  { key: 'done', label: () => tr('نتیجه') },
];

/** Start an AI phone call from a button and drop the live card into the chat. */
export async function startAiCall(shop: Props['shop'], product: Props['product'], purpose = 'stock') {
  const s = useApp.getState();
  const userText = tr('به {0} زنگ بزن و بپرس', shop.name);
  try {
    const r = await fetch('/api/calls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shopId: shop.id, productId: product?.id, purpose, userName: s.profile?.name }) });
    const rec = (await r.json()) as CallRec & { error?: string };
    if (!r.ok) throw new Error(rec.error);
    const id = `cl_${rec.id}`;
    postLocal([
      { kind: 'text', text: tr('الان دارم به «{0}» زنگ می‌زنم؛ نتیجه رو همین‌جا لحظه‌به‌لحظه می‌بینی.', shop.name) },
      { kind: 'ui', block: { id, component: 'aiCall', props: { id, callId: rec.id, shop, product }, summary: `[تماس هوشمند با ${shop.name} (shop_id=${shop.id}) آغاز شد]` } },
    ], userText);
  } catch {
    s.showToast(tr('الان امکان تماس نیست؛ از پیام آماده استفاده کن'));
  }
}

export function AiCallCard({ block, answer }: { block: any; answer?: CallRec }) {
  const p = block.props as Props;
  const [rec, setRec] = useState<CallRec | null>(answer ?? null);
  const [now, setNow] = useState(Date.now());
  const handled = useRef(!!answer);

  useEffect(() => {
    if (answer && TERMINAL.includes(answer.status)) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/calls/${p.callId}`);
        if (r.ok && alive) {
          const c = (await r.json()) as CallRec;
          setRec(c);
          if (TERMINAL.includes(c.status)) { onFinished(c); return; }
        }
      } catch { /* keep polling */ }
      if (alive) setTimeout(poll, 2000);
    };
    void poll();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFinished = (c: CallRec) => {
    if (handled.current) return;
    handled.current = true;
    const s = useApp.getState();
    s.setAnswer(p.id, c); // persist the final state so reloads don't re-poll
    try { navigator.vibrate?.([20, 60, 20]); } catch { /* noop */ }
    const r = c.result;
    if (c.status === 'done' && r?.available === 'yes') {
      s.setInquiry({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product?.id, productTitle: p.product?.title, status: 'available', price: r.price, note: r.notes ?? undefined, at: Date.now() });
      s.trackPurchase({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product?.id, productTitle: p.product?.title });
      if (p.product) s.addToPlan({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product.id, productTitle: p.product.title, price: r.price ?? p.product.price });
    } else if (p.product) {
      const status = c.status === 'done' && r?.available === 'no' ? 'unavailable' : 'no_answer';
      s.setInquiry({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product.id, productTitle: p.product.title, status, at: Date.now(), note: r?.notes ?? undefined });
      void runAction('find_alternatives', { product_id: p.product.id, exclude_shop_id: p.shop.id, reason: status === 'unavailable' ? 'out_of_stock' : 'no_answer' }, {
        intro: status === 'unavailable' ? tr('فروشنده گفت موجود نیست؛ سریع جایگزین‌ها رو آوردم:') : tr('فروشنده جواب نداد؛ تا دوباره تلاش کنیم، این گزینه‌ها آماده‌اند:'),
      });
    }
  };

  const status: CallStatus = rec?.status ?? 'dialing';
  const live = !TERMINAL.includes(status);
  const secs = Math.max(0, Math.floor(((live ? now : rec?.updatedAt ?? now) - (rec?.createdAt ?? now)) / 1000));
  const stepIdx = status === 'done' ? 3 : STEPS.findIndex((x) => x.key === status);
  const r = rec?.result;
  const priceDiff = r?.price && p.product?.price ? r.price - p.product.price : null;

  return (
    <Card className="overflow-hidden p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <div className="relative grid size-12 shrink-0 place-items-center">
          {live && [0, 1].map((i) => <span key={i} className="absolute inset-0 rounded-full bg-accent/30" style={{ animation: `ring-out 1.8s ${i * 0.9}s ease-out infinite` }} />)}
          <span className={cx('relative grid size-12 place-items-center rounded-full', live ? 'bg-accent text-on-primary' : status === 'done' ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
            {live ? <PhoneCall className="size-5" style={{ animation: status === 'ringing' ? 'shake .5s ease-in-out infinite' : undefined }} /> : status === 'done' ? <BadgeCheck className="size-6" /> : <PhoneOff className="size-5" />}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-text"><Sparkles className="size-3.5" />{tr('تماس هوشمند ترب‌یار')}</div>
          <h3 className="truncate text-[16px] font-extrabold">{p.shop.name}</h3>
          {p.product && <p className="truncate text-[12.5px] text-muted">{p.product.title}</p>}
        </div>
        <span className="num shrink-0 text-[13px] font-semibold text-muted">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
      </div>

      {/* live steps */}
      <ol className="mt-4 flex items-center gap-1.5" aria-live="polite">
        {STEPS.map((st, i) => {
          const doneStep = i < stepIdx || (i === stepIdx && !live);
          const active = i === stepIdx && live;
          return (
            <li key={st.key} className="flex flex-1 flex-col gap-1.5">
              <span className="relative h-1.5 overflow-hidden rounded-full bg-surface-3">
                <motion.span className={cx('absolute inset-y-0 right-0 rounded-full', status === 'failed' || status === 'no_answer' ? 'bg-bad' : 'bg-accent')} initial={{ width: 0 }} animate={{ width: doneStep ? '100%' : active ? '55%' : '0%' }} transition={{ duration: 0.6 }} />
                {active && <span className="absolute inset-0 animate-pulse bg-accent/20" />}
              </span>
              <span className={cx('text-[11.5px] font-semibold', active || doneStep ? 'text-fg' : 'text-muted')}>{st.label()}</span>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        {live && (
          <motion.p key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="shimmer-text mt-3 text-[13.5px]">
            {status === 'dialing' ? tr('در حال برقراری تماس…') : status === 'ringing' ? tr('منتظر جواب فروشنده‌ام…') : tr('دارم موجودی، قیمت و ساعت کاری رو می‌پرسم…')}
          </motion.p>
        )}
      </AnimatePresence>

      {/* recap */}
      {!live && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-col gap-3">
          {status === 'done' && r ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {r.available === 'yes' ? <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>{tr('فروشنده: موجوده')}</Badge> : r.available === 'no' ? <Badge tone="bad" icon={<XCircle className="size-3.5" />}>{tr('فروشنده: ناموجود')}</Badge> : <Badge icon={<CircleHelp className="size-3.5" />}>{tr('موجودی روشن نشد')}</Badge>}
                {r.hours && <Badge icon={<Clock className="size-3.5" />}>{r.hours}</Badge>}
                {r.installment && <Badge tone="accent" icon={<CreditCard className="size-3.5" />}>{r.installment}</Badge>}
              </div>
              {r.price != null && (
                <div className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
                  <div className="text-[12.5px] text-muted">{tr('قیمت امروز به گفته فروشنده')}</div>
                  <div className="num text-[18px] font-extrabold">{toman(r.price)}</div>
                  {priceDiff != null && priceDiff !== 0 && (
                    <div className={cx('text-[12.5px] font-semibold', priceDiff > 0 ? 'text-warn' : 'text-ok')}>
                      {priceDiff > 0 ? tr('{0} گران‌تر از قیمت ثبت‌شده', toman(priceDiff, true)) : tr('{0} ارزان‌تر از قیمت ثبت‌شده', toman(-priceDiff, true))}
                    </div>
                  )}
                </div>
              )}
              {r.notes && <p className="flex gap-2 rounded-2xl bg-accent-soft p-3 text-[14px] leading-7"><Quote className="mt-1 size-4 shrink-0 text-accent" />{r.notes}</p>}
              {r.available === 'yes' && <NavigateBlock block={{ props: { shop: p.shop } }} />}
            </>
          ) : (
            <p className="rounded-2xl bg-bad-soft p-3 text-[14px] text-bad">
              {status === 'no_answer' ? tr('فروشنده جواب نداد. اگر تنظیم شده باشه، دوباره خودکار زنگ می‌زنم.') : tr('تماس برقرار نشد{0}.', rec?.error ? ` (${rec.error})` : '')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => startAiCall(p.shop, p.product)}>{tr('تماس دوباره')}</Button>
            <Button size="sm" variant="ghost" icon={<MessageSquareText className="size-4" />} onClick={() => runAction('contact_store', { shop_id: p.shop.id, product_id: p.product?.id, purpose: 'stock' }, { userText: tr('خودم پیام می‌دم') })}>{tr('خودم پیام می‌دم')}</Button>
          </div>
        </motion.div>
      )}
      <p className="mt-3 text-[11.5px] text-muted">{tr('تماس توسط دستیار صوتی انجام می‌شود و خلاصه گفتگو اینجا ثبت می‌شود.')}</p>
    </Card>
  );
}
