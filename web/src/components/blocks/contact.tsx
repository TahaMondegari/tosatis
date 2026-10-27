import { useState } from 'react';
import { PhoneCall, BadgeCheck, Clock, Copy, MessageCircle, MessageSquareText, Phone, PhoneOff, Share2, Store, XCircle, Navigation, CalendarPlus } from 'lucide-react';
import { Badge, Button, Card, OpenBadge, cx } from '../ui';
import { inquiryKey, useApp } from '../../store';
import { postLocal, runAction } from '../../lib/chat';
import { fa, parseAmount, toman } from '../../lib/format';
import { isMobile, smsLink, telLink, whatsappLink } from '../../lib/links';
import type { InquiryStatus } from '../../lib/types';
import { NavigationPicker } from './stores';
import { startAiCall } from './aiCall';

import { tr } from '../../lib/i18n';
type Props = {
  id: string;
  shop: { id: string; name: string; phone: string | null; open: any; lat: number; lng: number; address: string; instagram?: string | null; website?: string | null };
  product: { id: string; title: string; price: number | null } | null;
  purpose: string;
  message: string;
};

const OUTCOMES: { id: InquiryStatus; label: string; icon: any; tone: string }[] = [
  { id: 'available', label: tr("موجوده"), icon: BadgeCheck, tone: 'text-ok' },
  { id: 'unavailable', label: tr("ناموجوده"), icon: XCircle, tone: 'text-bad' },
  { id: 'no_answer', label: tr("جواب نداد"), icon: PhoneOff, tone: 'text-warn' },
  { id: 'closed', label: tr("بسته بود"), icon: Clock, tone: 'text-bad' },
];

export function ContactCard({ block, answer }: { block: any; answer?: any }) {
  const p = block.props as Props;
  const profile = useApp((s) => s.profile);
  const inquiry = useApp((s) => s.inquiries[inquiryKey(p.shop.id, p.product?.id)]);
  const [msg, setMsg] = useState(p.message);
  const [contacted, setContacted] = useState(!!answer || !!inquiry);
  const [outcome, setOutcome] = useState<InquiryStatus | null>(answer?.status ?? null);
  const [price, setPrice] = useState('');
  const [copied, setCopied] = useState(false);
  const mobile = isMobile(p.shop.phone);
  const done = !!answer;
  const calls = useApp((s) => s.features.calls);

  const record = (status: InquiryStatus, newPrice?: number | null) => {
    const s = useApp.getState();
    s.setInquiry({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product?.id, productTitle: p.product?.title, status, price: newPrice ?? null, at: Date.now() });
    s.setAnswer(p.id, { status, price: newPrice ?? null });
    if (status === 'available') {
      s.trackPurchase({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product?.id, productTitle: p.product?.title });
      if (p.product) s.addToPlan({ shopId: p.shop.id, shopName: p.shop.name, productId: p.product.id, productTitle: p.product.title, price: newPrice ?? p.product.price });
      postLocal([
        { kind: 'text', text: tr("عالی{0}! موجودی «{1}» تأیید شد{2} و به برنامه بازدیدت اضافه شد. {3} برای رفتن یکی از مسیریاب‌ها رو بزن:", profile?.name ? ` ${profile.name}` : '', p.shop.name, newPrice ? tr(" با قیمت به‌روز {0}", toman(newPrice)) : '', p.shop.open?.state === 'open' ? tr("الان {0}.", p.shop.open.label) : tr("وضعیت: {0}.", p.shop.open?.label ?? '')) },
        { kind: 'ui', block: { id: `nav_${p.id}`, component: 'navigate', props: { shop: p.shop }, summary: tr("[موجودی {0} توسط کاربر تأیید شد{1}]", p.shop.name, newPrice ? tr(" با قیمت {0}", newPrice) : '') } },
      ], tr("{0}: موجوده{1}", p.shop.name, newPrice ? ` · ${toman(newPrice)}` : ''));
    } else if (p.product) {
      const reason = status === 'unavailable' ? 'out_of_stock' : status;
      void runAction('find_alternatives', { product_id: p.product.id, exclude_shop_id: p.shop.id, reason }, {
        userText: `${p.shop.name}: ${OUTCOMES.find((o) => o.id === status)?.label}`,
        intro: status === 'no_answer' ? tr("نگران نباش؛ تا جواب بده، این گزینه‌ها آماده‌اند. یک ساعت دیگه هم می‌تونی دوباره پیام بدی.") : tr("حیف شد! سریع جایگزین‌ها رو پیدا کردم:"),
      });
    } else {
      postLocal([{ kind: 'text', text: tr("ثبت شد. اگر خواستی، فروشگاه دیگری رو امتحان کنیم.") }], `${p.shop.name}: ${OUTCOMES.find((o) => o.id === status)?.label}`);
    }
  };

  const share = async () => {
    try { await navigator.share({ text: msg }); setContacted(true); } catch { /* cancelled */ }
  };

  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[14px] bg-surface-3"><Store className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-extrabold">{p.shop.name}</h3>
          <div className="mt-0.5 flex flex-wrap gap-1.5"><OpenBadge open={p.shop.open} />{p.shop.phone && <Badge><span className="ltr num">{p.shop.phone}</span></Badge>}</div>
        </div>
      </div>

      {!done && calls && (
        <button onClick={() => startAiCall({ id: p.shop.id, name: p.shop.name, phone: p.shop.phone, lat: p.shop.lat, lng: p.shop.lng, open: p.shop.open }, p.product, p.purpose)}
          className="mb-3 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-accent-soft px-3 text-right ring-1 ring-accent/30 transition-transform active:scale-[.98]">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-primary"><PhoneCall className="size-4" /></span>
          <span className="min-w-0 flex-1"><b className="block text-[14px]">{tr("بذار ترب‌یار خودش زنگ بزنه")}</b><span className="block text-[12px] text-muted">{tr("دستیار صوتی می‌پرسه و نتیجه رو همین‌جا می‌گه")}</span></span>
        </button>
      )}
      {!done && (
        <>
          <label className="mb-1 block text-[13px] font-semibold text-muted" htmlFor={`m_${p.id}`}>{tr("متن پیام (قابل ویرایش)")}</label>
          <textarea id={`m_${p.id}`} value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-line bg-surface-2 p-3 text-[14.5px] leading-7 outline-none focus:border-accent" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {p.shop.phone && (
              <div className="moving-border col-span-2 sm:col-span-1">
                <a href={telLink(p.shop.phone)} onClick={() => setContacted(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary font-bold text-on-primary"><Phone className="size-4" />{tr("تماس")}</a>
              </div>
            )}
            {p.shop.phone && mobile && <a href={smsLink(p.shop.phone, msg)} onClick={() => setContacted(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-full font-bold ring-1 ring-line ring-inset hover:bg-surface-3"><MessageSquareText className="size-4" />{tr("پیامک")}</a>}
            {p.shop.phone && mobile && <a href={whatsappLink(p.shop.phone, msg)} target="_blank" rel="noopener" onClick={() => setContacted(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-full font-bold ring-1 ring-line ring-inset hover:bg-surface-3"><MessageCircle className="size-4" />{tr("واتساپ")}</a>}
            <button onClick={() => { void navigator.clipboard?.writeText(msg); setCopied(true); setContacted(true); setTimeout(() => setCopied(false), 1600); }} className="flex min-h-12 items-center justify-center gap-2 rounded-full font-bold ring-1 ring-line ring-inset hover:bg-surface-3"><Copy className="size-4" />{copied ? tr("کپی شد") : tr("کپی متن")}</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && <button onClick={share} className="flex min-h-12 items-center justify-center gap-2 rounded-full font-bold ring-1 ring-line ring-inset hover:bg-surface-3"><Share2 className="size-4" />{tr("اشتراک (بله، تلگرام…)")}</button>}
          </div>
          {!mobile && p.shop.phone && <p className="mt-2 text-[12.5px] text-muted">{tr("این شماره ثابت است؛ پیامک و واتساپ برایش کار نمی‌کند. تماس بگیر یا متن را کپی کن.")}</p>}
        </>
      )}

      <div className={cx('mt-4 rounded-2xl border border-line bg-surface-2 p-3.5 transition-opacity duration-500', !contacted && !done && 'opacity-70')}>
        <div className="mb-2 text-[14.5px] font-extrabold">{done ? tr("نتیجه پیگیری") : tr("جواب فروشنده چی بود؟")}</div>
        {done ? (
          <div className="flex items-center gap-2 text-[14.5px] font-bold">
            {(() => { const o = OUTCOMES.find((x) => x.id === answer.status)!; const I = o.icon; return <><I className={cx('size-5', o.tone)} />{o.label}{answer.price ? ` · ${toman(answer.price)}` : ''}</>; })()}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => (
                <button key={o.id} onClick={() => (o.id === 'available' ? setOutcome('available') : record(o.id))} className={cx('flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-[14.5px] font-bold transition-all duration-500', outcome === o.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-3')}>
                  <o.icon className={cx('size-5', o.tone)} />{o.label}
                </button>
              ))}
            </div>
            {outcome === 'available' && (
              <div className="mt-3 flex gap-2" style={{ animation: 'up .5s both' }}>
                <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={p.product?.price ? tr("قیمت جدید؟ (ثبت‌شده: {0})", fa(p.product.price)) : tr("قیمت اعلام‌شده (اختیاری)")} className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3 text-[14.5px] outline-none focus:border-accent" />
                <Button onClick={() => record('available', parseAmount(price))}>{tr("ثبت")}</Button>
              </div>
            )}
            <p className="mt-2 text-[12.5px] text-muted">{tr("با ثبت جواب، وضعیت «موجودی تأییدشده» کنار این فروشگاه نمایش داده می‌شود؛ اگر نبود، فوراً جایگزین پیدا می‌کنم.")}</p>
          </>
        )}
      </div>
    </Card>
  );
}

export function NavigateBlock({ block }: { block: any }) {
  const shop = block.props.shop;
  const add = () => { useApp.getState().addToPlan({ shopId: shop.id, shopName: shop.name }); useApp.getState().showToast(tr("به برنامه بازدید اضافه شد")); };
  return (
    <div className="flex flex-col gap-2">
      <NavigationPicker shop={shop} />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" icon={<Navigation className="size-4" />} onClick={() => useApp.getState().set({ sheet: { type: 'store', id: shop.id } })}>{tr("داخل پاساژ کجاست؟")}</Button>
        <Button size="sm" variant="ghost" icon={<CalendarPlus className="size-4" />} onClick={add}>{tr("برنامه بازدید")}</Button>
      </div>
    </div>
  );
}
