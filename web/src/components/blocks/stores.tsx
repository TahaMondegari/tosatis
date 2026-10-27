import { placeName } from '../../lib/iran';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PhoneCall, Award, Building2, CalendarClock, Car, ChevronDown, CreditCard, ListOrdered, Map as MapIcon, MapPin, MessageSquareText, Navigation, Phone, Plus, RefreshCw, Scale, ShieldCheck, SlidersHorizontal, Store, TrendingDown, Check, Clock, Info } from 'lucide-react';
import { Badge, Button, Card, Chip, FreshBadge, OpenBadge, ProductImage, Segmented, StockBadge, cx } from '../ui';
import { inquiryKey, useApp } from '../../store';
import { api } from '../../lib/api';
import { runAction } from '../../lib/chat';
import { MODE_LABEL, fa, km, minutes, toman } from '../../lib/format';
import { navLinks } from '../../lib/links';
import type { Offer, OffersResult, ProductCard, ShopBrief } from '../../lib/types';

import { ShopsMap } from '../ShopsMap';
import { startAiCall } from './aiCall';
import { effectiveProfile } from '../../store';

import { tr } from '../../lib/i18n';
// ------------------------------------------------------------------ Navigation dock

export function NavigationPicker({ shop, compact }: { shop: { id?: string; name: string; lat: number; lng: number; distanceKm?: number | null; etaMinutes?: number | null }; compact?: boolean }) {
  const profile = useApp((s) => s.profile);
  const from = profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
  const apps = navLinks(shop.lat, shop.lng, from);
  const [primary, ...rest] = apps;
  const go = () => {
    try { navigator.vibrate?.(10); } catch { /* noop */ }
    if (shop.id) useApp.getState().trackPurchase({ shopId: shop.id, shopName: shop.name });
  };
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={tr("مسیریابی تا {0}", shop.name)}>
      {!compact && <ShopsMap user={from} shops={[{ id: shop.id ?? 'x', name: shop.name, lat: shop.lat, lng: shop.lng, label: '★', best: true }]} height={190} etaMinutes={shop.etaMinutes} />}
      <a href={primary.href} target="_blank" rel="noopener" onClick={go} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-on-primary shadow-[var(--primary-shadow)] transition-transform duration-300 active:scale-[.97]">
        <Navigation className="size-4" />{tr("مسیریابی با")}{' '}{primary.name}
        {shop.etaMinutes != null && <span className="text-[13px] font-semibold opacity-75">· ~{minutes(shop.etaMinutes)}</span>}
      </a>
      <div className="flex gap-1.5">
        {rest.map((a) => (
          <a key={a.id} href={a.href} target="_blank" rel="noopener" onClick={go} className="flex min-h-10 flex-1 items-center justify-center rounded-full text-[13px] font-semibold text-fg-2 ring-1 ring-line ring-inset transition-colors hover:bg-surface-3">{a.name}</a>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Store row

function StoreRow({ o, i, productId, productTitle, expanded, onToggle }: { o: Offer; i: number; productId: string; productTitle: string; expanded: boolean; onToggle: () => void }) {
  const inquiry = useApp((s) => s.inquiries[inquiryKey(o.shop.id, productId)]);
  const inPlan = useApp((s) => s.plan.some((p) => p.shopId === o.shop.id));
  const calls = useApp((s) => s.features.calls);
  const { addToPlan, removeFromPlan, set, showToast } = useApp.getState();
  const best = o.badges?.includes('best');
  const price = inquiry?.status === 'available' && inquiry.price ? inquiry.price : o.price;
  return (
    <li className={cx('rounded-2xl border bg-surface-2 transition-all duration-500 ease-out-soft', best ? 'border-accent shadow-[0_0_28px_-14px_var(--accent)]' : 'border-line hover:border-line-strong')} style={{ animation: `up .7s ${0.05 * i}s both` }}>
      <button className="flex w-full items-start gap-2.5 p-3 text-right" onClick={onToggle} aria-expanded={expanded}>
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl border text-[14px] font-extrabold', best ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface-3')}>{fa(i + 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <b className="truncate text-[15px]">{o.shop.name}</b>
            {best && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 text-[11px] font-bold text-accent-text"><Award className="size-3.5" />{tr("پیشنهاد ما")}</span>}
          </span>
          <span className="block truncate text-[13px] text-muted">{[o.shop.mall, o.shop.floor ? tr("طبقه {0}", o.shop.floor) : null].filter(Boolean).join(' · ') || o.shop.area || o.shop.address}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <OpenBadge open={o.shop.open} />
            {o.shop.installment && <Badge tone="accent" icon={<CreditCard className="size-3.5" />}>{tr("قسطی")}</Badge>}
            {o.warranty?.real && <Badge icon={<ShieldCheck className="size-3.5" />}>{tr("گارانتی")}</Badge>}
            {inquiry && <StockBadge status={inquiry.status} at={inquiry.at} />}
          </span>
        </span>
        <span className="shrink-0 text-left">
          <b className={cx('num block text-[15.5px]', o.badges?.includes('cheapest') && 'text-accent-text')}>{price != null ? toman(price, true) : '—'}</b>
          {o.shop.distanceKm != null && <span className="block text-[12.5px] text-muted">{km(o.shop.distanceKm)}</span>}
          {o.shop.etaMinutes != null && <span className="block text-[12.5px] text-muted">~{minutes(o.shop.etaMinutes)}</span>}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-line px-3.5 pt-3 pb-3.5" style={{ animation: 'fade .4s both' }}>
          {!!o.reasons?.length && (
            <p className="mb-2 text-[13.5px] leading-7 text-fg-2"><b className="text-fg">{tr("چرا این رتبه؟")}{' '}</b>{o.reasons.join('، ')}{o.score != null && <span className="text-muted"> {' '}{tr("· امتیاز")}{' '}{fa(o.score)} {' '}{tr("از ۱۰۰")}</span>}</p>
          )}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <FreshBadge f={o.freshness} />
            {o.warranty && <Badge>{o.warranty.provider}{o.warranty.months ? tr(" · {0} ماه", fa(o.warranty.months)) : ''}</Badge>}
            {o.shop.payments.map((p) => <Badge key={p.provider} tone={p.channel === 'in_person' ? 'ok' : 'neutral'}>{p.provider}{p.channel === 'in_person' ? tr(" · حضوری") : ''}</Badge>)}
          </div>
          {o.sellerTitle && o.sellerTitle !== productTitle && <p className="mb-3 text-[13px] text-muted">{tr("عنوان فروشنده:")}{' '}{o.sellerTitle}</p>}
          {calls && (
            <button onClick={() => startAiCall({ id: o.shop.id, name: o.shop.name, phone: o.shop.phone, lat: o.shop.lat, lng: o.shop.lng, open: o.shop.open }, { id: productId, title: productTitle, price: o.price })}
              className="mb-2 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-accent-soft px-3 text-right ring-1 ring-accent/30 transition-transform active:scale-[.98]">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-primary"><PhoneCall className="size-4" /></span>
              <span className="min-w-0 flex-1"><b className="block text-[14px]">{tr("ترب‌یار خودش زنگ بزنه")}</b><span className="block truncate text-[12px] text-muted">{o.freshness.level === 'stale' || o.freshness.level === 'unknown' ? tr("قیمت قدیمیه؛ موجودی و قیمت امروز رو می‌پرسم") : tr("موجودی، قیمت امروز و ساعت کاری رو می‌پرسم")}</span></span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button size="sm" onClick={() => runAction('contact_store', { shop_id: o.shop.id, product_id: productId, purpose: 'stock' }, { userText: tr("از {0} موجودی و قیمت رو بپرس", o.shop.name), intro: tr("پیام آماده است. با یک لمس بفرست یا تماس بگیر؛ بعد جوابش رو اینجا بزن تا پیگیری کنم.") })} icon={<MessageSquareText className="size-4" />}>{tr("استعلام")}</Button>
            <Button size="sm" variant="ghost" onClick={() => set({ sheet: { type: 'store', id: o.shop.id, productId } })} icon={<Store className="size-4" />}>{tr("جزئیات")}</Button>
            <Button size="sm" variant="ghost" onClick={() => runAction('store_details', { shop_id: o.shop.id }, { userText: tr("مسیر {0}", o.shop.name), intro: tr("نشانی، پیدا کردن واحد داخل پاساژ و مسیریابی:") })} icon={<Navigation className="size-4" />}>{tr("مسیر")}</Button>
            <Button size="sm" variant={inPlan ? 'soft' : 'ghost'} onClick={() => { if (inPlan) removeFromPlan(o.shop.id); else { addToPlan({ shopId: o.shop.id, shopName: o.shop.name, productId, productTitle, price: o.price }); showToast(tr("به برنامه بازدید اضافه شد")); } }} icon={inPlan ? <Check className="size-4" /> : <Plus className="size-4" />}>{inPlan ? tr("در برنامه") : tr("برنامه")}</Button>
          </div>
        </div>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ StoreList

type Filters = { installment: boolean; openNow: boolean; warranty?: boolean; maxKm: number | null; sort: 'best' | 'price' | 'distance' | 'fresh' };

export function StoreList({ block }: { block: any }) {
  const props = block.props as { id: string; productId: string; initial: OffersResult; filters: Filters };
  const profile = useApp((s) => s.profile);
  const [filters, setFilters] = useState<Filters>(props.filters);
  const [data, setData] = useState<OffersResult>(props.initial);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [limit, setLimit] = useState(8);
  const [similar, setSimilar] = useState<any | null | 'loading'>(null);
  const [open, setOpen] = useState<number | null>(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    let alive = true;
    setLoading(true);
    api.offers(props.productId, effectiveProfile(), { installment: filters.installment, openNow: filters.openNow, warranty: filters.warranty, maxKm: filters.maxKm ?? undefined, sort: filters.sort })
      .then((r) => { if (alive) { setData(r); setOpen(0); useApp.getState().patchBlock(props.id, { initial: { ...r, offers: r.offers.slice(0, 30) }, filters }); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, profile?.lat, profile?.lng, profile?.mode, profile?.priorities?.join()]);
  const f = (p: Partial<Filters>) => setFilters((x) => ({ ...x, ...p }));
  const reasons = data.filteredOutReasons ?? {};
  const top3 = data.offers.slice(0, 3).map((o) => o.shop.id);
  return (
    <Card className="p-3.5 lg:p-5">
      <div className="mb-3 flex items-center gap-3">
        <ProductImage src={data.product.image} alt={data.product.title} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] leading-7 font-extrabold">{data.product.title}</h3>
          {data.stats && (
            <p className="text-[13px] text-muted">
              <span className="num">{toman(data.stats.min, true)}</span> {' '}{tr("تا")}{' '}<span className="num">{toman(data.stats.max, true)}</span> {' '}{tr("· میانه")}{' '}<span className="num">{toman(data.stats.median, true)}</span>
            </p>
          )}
        </div>
      </div>

      <Segmented value={filters.sort} onChange={(sort) => f({ sort })} options={[{ id: 'best', label: tr("بهترین") }, { id: 'price', label: tr("ارزان‌ترین") }, { id: 'distance', label: tr("نزدیک‌ترین") }, { id: 'fresh', label: tr("به‌روزترین") }]} />
      <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip active={filters.installment} onClick={() => f({ installment: !filters.installment })}><CreditCard className="size-4" />{tr("فقط قسطی")}</Chip>
        <Chip active={filters.openNow} onClick={() => f({ openNow: !filters.openNow })}><Clock className="size-4" />{tr("الان باز")}</Chip>
        <Chip active={!!filters.warranty} onClick={() => f({ warranty: !filters.warranty })}><ShieldCheck className="size-4" />{tr("گارانتی‌دار")}</Chip>
        {[2, 5, 10].map((d) => <Chip key={d} active={filters.maxKm === d} onClick={() => f({ maxKm: filters.maxKm === d ? null : d })}>{tr("تا")}{' '}{fa(d)} {' '}{tr("کیلومتر")}</Chip>)}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
        <SlidersHorizontal className="size-4" />
        <span className="flex-1">{loading ? tr("در حال به‌روزرسانی…") : tr("{0} فروشگاه از {1}{2}", fa(data.offers.length), fa(data.total), profile?.lat != null ? tr(" · فاصله {0}", MODE_LABEL[profile.mode]) : '')}</span>
        <button onClick={() => setView(view === 'list' ? 'map' : 'list')} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold text-fg-2 hover:bg-surface-3">
          {view === 'list' ? <MapIcon className="size-4" /> : <ListOrdered className="size-4" />}{view === 'list' ? tr("نقشه") : tr("فهرست")}
        </button>
      </div>

      {data.filteredOut > 0 && (
        <p className="mt-1 text-[12.5px] text-muted">
          {fa(data.filteredOut)} {' '}{tr("فروشگاه با فیلترها حذف شد")}{reasons.installment ? tr(" ({0} بدون خرید قسطی)", fa(reasons.installment)) : ''}{reasons.openNow ? tr(" ({0} الان بسته)", fa(reasons.openNow)) : ''}.
          <button className="mr-1 font-semibold text-accent-text underline-offset-4 hover:underline" onClick={() => setFilters({ installment: false, openNow: false, warranty: false, maxKm: null, sort: filters.sort })}>{tr("حذف فیلترها")}</button>
        </p>
      )}

      <div className={cx('mt-3 transition-opacity duration-500', loading && 'opacity-50')}>
        {view === 'map' ? (
          <ShopsMap user={profile?.lat != null ? { lat: profile.lat, lng: profile.lng! } : null} shops={data.offers.slice(0, 25).map((o, i) => ({ id: o.shop.id, name: o.shop.name, lat: o.shop.lat, lng: o.shop.lng, label: fa(i + 1), best: i === 0, sub: toman(o.price, true) }))} onPick={(id) => useApp.getState().set({ sheet: { type: 'store', id, productId: props.productId } })} />
        ) : data.offers.length ? (
          <ol className="flex flex-col gap-2">
            {data.offers.slice(0, limit).map((o, i) => <StoreRow key={o.offerId} o={o} i={i} productId={props.productId} productTitle={data.product.title} expanded={open === i} onToggle={() => setOpen(open === i ? null : i)} />)}
          </ol>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-5 text-center text-[14px] text-muted">
            {tr("با این فیلترها فروشگاهی نماند.")}<div className="mt-3 flex justify-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setFilters({ installment: false, openNow: false, warranty: false, maxKm: null, sort: 'best' })} icon={<RefreshCw className="size-4" />}>{tr("حذف فیلترها")}</Button>
              <Button size="sm" onClick={() => runAction('find_alternatives', { product_id: props.productId, reason: filters.installment ? 'price' : 'too_far' }, { userText: tr("گزینه‌های جایگزین رو نشون بده"), intro: tr("این‌ها نزدیک‌ترین جایگزین‌ها هستند:") })}>{tr("جایگزین‌ها")}</Button>
            </div>
          </div>
        )}
      </div>
      {view === 'list' && data.offers.length > limit && (
        <button onClick={() => setLimit(limit + 10)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-2xl text-[14px] font-semibold text-muted hover:bg-surface-3 hover:text-fg">
          {fa(data.offers.length - limit)} {' '}{tr("فروشگاه دیگر")}{' '}<ChevronDown className="size-4" />
        </button>
      )}
      <div className="mt-3">
        <button onClick={() => {
          if (similar && similar !== 'loading') { setSimilar(null); return; }
          setSimilar('loading');
          api.action('find_alternatives', { product_id: props.productId, reason: 'similar' }, effectiveProfile()).then((r) => setSimilar(r.ui)).catch(() => setSimilar(null));
        }} className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-dashed border-line px-3 text-right text-[14px] font-semibold text-fg-2 hover:bg-surface-3">
          <RefreshCw className="size-4 text-accent" /><span className="flex-1">{tr("مدل‌های مشابه در فروشگاه‌های دیگر")}</span>
          <ChevronDown className={cx('size-4 transition-transform duration-300', similar && similar !== 'loading' && 'rotate-180')} />
        </button>
        {similar === 'loading' && <div className="skeleton mt-2 h-28" />}
        {similar && similar !== 'loading' && <div className="mt-2" style={{ animation: 'up .5s both' }}><Alternatives block={similar} /></div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.offers.length >= 2 && <Button size="sm" variant="ghost" onClick={() => runAction('compare_stores', { product_id: props.productId, shop_ids: top3 }, { userText: tr("سه فروشگاه اول رو دقیق مقایسه کن") })} icon={<Scale className="size-4" />}>{tr("مقایسه دقیق")}{' '}{fa(Math.min(3, data.offers.length))} {' '}{tr("فروشگاه اول")}</Button>}
        {data.offers.length >= 2 && <Button size="sm" variant="ghost" onClick={() => runAction('plan_visit', { shop_ids: top3 }, { userText: tr("یک برنامه بازدید حضوری برای این فروشگاه‌ها بچین") })} icon={<CalendarClock className="size-4" />}>{tr("برنامه بازدید")}</Button>}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-6 text-muted"><Info className="mt-1 size-3.5 shrink-0" />{tr("قیمت‌ها همان «قیمت ثبت‌شده» فروشنده با تاریخ ثبت هستند؛ موجودی تا وقتی فروشنده تأیید نکند نامشخص است. زمان رسیدن تخمینی است.")}</p>
    </Card>
  );
}

// ------------------------------------------------------------------ Store details (block + sheet)

export function StoreDetailsBody({ shop, productId }: { shop: any; productId?: string }) {
  const [copied, setCopied] = useState(false);
  const today = useMemo(() => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()], []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <OpenBadge open={shop.open} />
        {shop.distanceKm != null && <Badge icon={<Car className="size-3.5" />}>{km(shop.distanceKm)} · ~{minutes(shop.etaMinutes)}</Badge>}
        {shop.installment && <Badge tone="accent" icon={<CreditCard className="size-3.5" />}>{tr("خرید قسطی")}</Badge>}
        {shop.fastDelivery && <Badge>{tr("ارسال فوری")}</Badge>}
      </div>

      {shop.mallInfo ? (
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <div className="flex items-center gap-2 text-[15px] font-extrabold"><Building2 className="size-5 text-accent" />{shop.mallInfo.name}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[[tr("طبقه"), shop.mallInfo.floor], [tr("واحد / پلاک"), shop.mallInfo.unit], [tr("فروشگاه ترب در پاساژ"), fa(shop.mallInfo.torobShopsInMall)]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-surface-3 px-2 py-2"><div className="text-[11.5px] text-muted">{l}</div><div className="text-[15px] font-extrabold">{v ? fa(v) : tr("نامشخص")}</div></div>
            ))}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px] leading-7 text-fg-2">
            {shop.findTips.map((t: string) => <li key={t} className="flex gap-2"><MapPin className="mt-1.5 size-3.5 shrink-0 text-muted" />{t}</li>)}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[13.5px] leading-7 text-fg-2">{shop.findTips?.map((t: string) => <li key={t}>{t}</li>)}</ul>
      )}

      <div>
        <div className="text-[13px] text-muted">{tr("نشانی")}</div>
        <p className="text-[15px] leading-8">{shop.address}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(shop.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? tr("کپی شد") : tr("کپی نشانی")}</Button>
          <a className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-bold ring-1 ring-line ring-inset hover:bg-surface-3" target="_blank" rel="noopener" href={`https://www.google.com/search?q=${encodeURIComponent(`${shop.name} ${shop.mall ?? ''} ${shop.address}`)}`}>{tr("جست‌وجوی نشانی در گوگل")}</a>
        </div>
      </div>

      <NavigationPicker shop={shop} />

      <ContactButtons shop={shop} productId={productId} />

      {shop.hours ? (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[14px] font-extrabold"><Clock className="size-4" />{tr("ساعت کاری")}</div>
          <div className="grid grid-cols-1 gap-1">
            {shop.hours.map((h: any) => (
              <div key={h.day} className={cx('flex min-h-10 items-center justify-between rounded-xl px-3 text-[14px]', h.day === today ? 'bg-accent-soft font-bold' : 'bg-surface-2')}>
                <span>{h.dayFa}{h.day === today && tr(" (امروز)")}</span><span className={cx('num', h.closed && 'text-bad')}>{fa(h.text)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13.5px] text-warn">{tr("این فروشگاه ساعت کاری ثبت نکرده؛ قبل از رفتن تماس بگیر.")}</p>}

      <div>
        <div className="mb-1.5 text-[14px] font-extrabold">{tr("شرایط پرداخت")}</div>
        {shop.payments.length ? (
          <div className="flex flex-wrap gap-1.5">{shop.payments.map((p: any) => <Badge key={p.provider} tone={p.channel === 'in_person' ? 'ok' : 'neutral'}>{p.provider} · {p.channel === 'in_person' ? tr("پذیرش حضوری") : tr("نوع پذیرش نامشخص")}</Badge>)}</div>
        ) : <p className="text-[13.5px] text-muted">{tr("خرید قسطی یا ترب‌پی اعلام نشده.")}</p>}
      </div>

      {(shop.instagram || shop.website) && (
        <div className="flex flex-wrap gap-2">
          {shop.website && <a href={shop.website} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-bold ring-1 ring-line ring-inset hover:bg-surface-3">{tr("وب‌سایت فروشگاه")}</a>}
          {shop.instagram && <a href={shop.instagram.startsWith('http') ? shop.instagram : `https://instagram.com/${shop.instagram.replace('@', '')}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-bold ring-1 ring-line ring-inset hover:bg-surface-3">{tr("اینستاگرام")}</a>}
        </div>
      )}

      {!!shop.neighbors?.length && (
        <div>
          <div className="mb-1.5 text-[14px] font-extrabold">{tr("همسایه‌ها در همین پاساژ")}</div>
          <div className="flex flex-col gap-1">
            {shop.neighbors.slice(0, 6).map((n: any) => (
              <div key={n.id} className="flex min-h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-[13.5px]">
                <span className="flex-1 truncate font-semibold">{n.name}</span>
                <span className="text-muted">{[n.floor ? tr("طبقه {0}", fa(n.floor)) : null, n.unit ? tr("واحد {0}", fa(n.unit)) : null].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!shop.categories?.length && (
        <div>
          <div className="mb-1.5 text-[14px] font-extrabold">{tr("زمینه فعالیت")}</div>
          <div className="flex flex-wrap gap-1.5">{shop.categories.slice(0, 10).map((c: string) => <Badge key={c}>{c}</Badge>)}</div>
          <p className="mt-1 text-[12px] text-muted">{tr("دسته فعالیت به‌تنهایی نشانه موجود بودن یک محصول خاص نیست.")}</p>
        </div>
      )}
    </div>
  );
}

function ContactButtons({ shop, productId }: { shop: ShopBrief; productId?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="moving-border"><Button full className="!shadow-none" onClick={() => runAction('contact_store', { shop_id: shop.id, product_id: productId, purpose: 'stock' }, { userText: tr("می‌خوام با {0} هماهنگ کنم", shop.name), intro: tr("پیام آماده است؛ بعد از جواب فروشنده، نتیجه رو بزن.") }).then(() => useApp.getState().set({ sheet: null }))} icon={<MessageSquareText className="size-4" />}>{tr("استعلام از فروشنده")}</Button></div>
      {shop.phone && <a href={`tel:${shop.phone}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full font-bold ring-1 ring-line ring-inset hover:bg-surface-3"><Phone className="size-4" /><span className="ltr num">{shop.phone}</span></a>}
    </div>
  );
}

export function StoreBlock({ block }: { block: any }) {
  const shop = block.props.shop;
  return (
    <Card className="p-3.5 lg:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-[14px] bg-primary text-on-primary"><Store className="size-5" /></span>
        <div className="min-w-0"><h3 className="truncate text-[17px] font-extrabold">{shop.name}</h3><p className="truncate text-[13px] text-muted">{shop.area ?? ''}</p></div>
      </div>
      <StoreDetailsBody shop={shop} />
    </Card>
  );
}

// ------------------------------------------------------------------ Cheaper nearby

export function CheaperCheck({ block }: { block: any }) {
  const p = block.props as { product: ProductCard; seenPrice: number | null; seenWhere: string | null; stats: OffersResult['stats']; cheaperCount: number | null; best: (Offer & { saving: number | null })[]; nearestCheaper: (Offer & { saving: number | null }) | null; verdict: string };
  const maxSaving = Math.max(0, ...p.best.map((b) => b.saving ?? 0));
  return (
    <Card className="p-3.5 lg:p-5">
      <div className="flex items-center gap-3">
        <ProductImage src={p.product.image} alt={p.product.title} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-[15px] leading-7 font-extrabold">{p.product.title}</h3>{p.seenPrice && <p className="text-[13px] text-muted">{tr("قیمتی که دیدی:")}{' '}<b className="num text-fg-2">{toman(p.seenPrice)}</b>{p.seenWhere ? ` · ${p.seenWhere}` : ''}</p>}</div>
      </div>
      <div className={cx('mt-4 rounded-2xl p-4', p.verdict === 'cheaper_found' ? 'bg-ok-soft' : 'bg-surface-3')}>
        {p.verdict === 'cheaper_found' ? (
          <>
            <div className="flex items-center gap-2 text-[16px] font-extrabold text-ok"><TrendingDown className="size-5" />{fa(p.cheaperCount!)} {' '}{tr("فروشگاه ارزان‌تر ثبت شده")}</div>
            <p className="mt-1 text-[14px] text-fg-2">{tr("تا")}{' '}<b className="num">{toman(maxSaving)}</b> {' '}{tr("صرفه‌جویی (بر اساس قیمت ثبت‌شده).")}{p.nearestCheaper?.shop.distanceKm != null && <> {' '}{tr("نزدیک‌ترین گزینه ارزان‌تر")}{' '}<b>{km(p.nearestCheaper.shop.distanceKm)}</b> {' '}{tr("فاصله دارد.")}</>}</p>
          </>
        ) : p.verdict === 'you_have_best' ? (
          <div className="text-[15px] font-bold">{tr("قیمتی که دیدی از همه قیمت‌های ثبت‌شده کمتر یا برابر است — خرید خوبیه.")}</div>
        ) : (
          <div className="text-[15px] font-bold">{tr("ارزان‌ترین قیمت‌های ثبت‌شده:")}</div>
        )}
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {p.best.slice(0, 5).map((o, i) => (
          <li key={o.offerId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-[14px] font-extrabold">{fa(i + 1)}</span>
            <button onClick={() => useApp.getState().set({ sheet: { type: 'store', id: o.shop.id, productId: p.product.id } })} className="min-w-0 flex-1 text-right">
              <b className="block truncate text-[14.5px]">{o.shop.name}</b>
              <span className="block truncate text-[12.5px] text-muted">{km(o.shop.distanceKm)} · {o.shop.open.label} · {o.freshness.label}</span>
            </button>
            <span className="text-left"><b className="num block text-[14.5px]">{toman(o.price, true)}</b>{o.saving ? <span className="block text-[12px] font-semibold text-ok">−{toman(o.saving, true)}</span> : null}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => runAction('find_stores', { product_id: p.product.id, sort: 'price' }, { userText: tr("همه فروشگاه‌ها رو با فیلتر نشون بده") })} icon={<Store className="size-4" />}>{tr("همه فروشگاه‌ها")}</Button></div>
    </Card>
  );
}

// ------------------------------------------------------------------ Alternatives

const REASON_FA: Record<string, string> = { closed: tr("فروشگاه بسته بود"), out_of_stock: tr("محصول موجود نبود"), no_answer: tr("فروشنده جواب نداد"), too_far: tr("فروشگاه دور است"), price: tr("قیمت مناسب نبود"), similar: tr("اگه مدل دیگه‌ای هم برات فرقی نمی‌کنه") };

export function Alternatives({ block }: { block: any }) {
  const p = block.props as { reason: string; product: ProductCard; sameProduct: Offer[]; similar: ProductCard[]; sameMall: { id: string; name: string; floor: string | null; unit: string | null; note: string }[] };
  return (
    <Card className="p-3.5 lg:p-5">
      <div className="mb-1 flex items-center gap-2"><RefreshCw className="size-5 text-accent" /><h3 className="text-[16px] font-extrabold">{p.reason === 'similar' ? tr("مدل‌های مشابه و فروشگاه‌هاشون") : tr("برنامه جایگزین")}</h3></div>
      <p className="mb-3 text-[13.5px] text-muted">{REASON_FA[p.reason] ?? ''} {' '}{tr("— سریع‌ترین گزینه‌های بعدی:")}</p>
      {p.sameProduct.length > 0 && (
        <>
          <div className="mb-1.5 text-[14px] font-bold">{tr("همین محصول در فروشگاه‌های دیگر")}</div>
          <ol className="flex flex-col gap-2">
            {p.sameProduct.slice(0, 4).map((o, i) => (
              <li key={o.offerId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-[14px] font-extrabold">{fa(i + 1)}</span>
                <button className="min-w-0 flex-1 text-right" onClick={() => useApp.getState().set({ sheet: { type: 'store', id: o.shop.id, productId: p.product.id } })}>
                  <b className="block truncate text-[14.5px]">{o.shop.name}</b>
                  <span className="block truncate text-[12.5px] text-muted">{km(o.shop.distanceKm)} · {o.shop.open.label}</span>
                </button>
                <b className="num text-[14.5px]">{toman(o.price, true)}</b>
                <Button size="sm" variant="ghost" className="!px-3" aria-label={tr("استعلام")} onClick={() => runAction('contact_store', { shop_id: o.shop.id, product_id: p.product.id, purpose: 'stock' }, { userText: tr("از {0} بپرس", o.shop.name), intro: tr("پیام آماده است:") })}><MessageSquareText className="size-4" /></Button>
              </li>
            ))}
          </ol>
        </>
      )}
      {p.sameMall.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[14px] font-bold">{tr("همین پاساژ (در این دسته فعالیت دارند)")}</div>
          {p.sameMall.map((s) => <div key={s.id} className="mb-1 flex min-h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-[13.5px]"><span className="flex-1 truncate font-semibold">{s.name}</span><span className="text-muted">{s.floor ? tr("طبقه {0}", fa(s.floor)) : ''}{s.unit ? tr(" · واحد {0}", fa(s.unit)) : ''}</span></div>)}
          <p className="text-[12px] text-muted">{tr("موجودی این محصول در این مغازه‌ها مشخص نیست.")}</p>
        </div>
      )}
      {p.similar.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[14px] font-bold">{tr("محصولات مشابه در همین بازه قیمت")}</div>
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {p.similar.map((s) => (
              <button key={s.id} onClick={() => useApp.getState().set({ sheet: { type: 'product', id: s.id } })} className="w-40 shrink-0 rounded-2xl border border-line bg-surface-2 p-2.5 text-right transition-colors duration-500 hover:border-line-strong">
                <ProductImage src={s.image} alt={s.title} className="h-24 w-full" />
                <div className="mt-1.5 line-clamp-2 text-[13px] leading-6 font-semibold">{s.title}</div>
                <div className="num text-[13.5px] font-extrabold">{toman(s.minPrice, true)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {!p.sameProduct.length && !p.similar.length && <p className="text-[14px] text-muted">{tr("جایگزین مناسبی پیدا نشد. محدوده یا بودجه رو بازتر کن.")}</p>}
    </Card>
  );
}

// ------------------------------------------------------------------ Visit plan

export function VisitPlan({ block }: { block: any }) {
  const p = block.props as { mode: string; totalMinutes: number; legs: { shop: ShopBrief; legKm: number; legMin: number; arriveAt: string; warning?: string }[] };
  const profile = useApp((s) => s.profile);
  const origin = profile?.lat != null ? `${profile.lat},${profile.lng}` : '';
  const last = p.legs[p.legs.length - 1]?.shop;
  const waypoints = p.legs.slice(0, -1).map((l) => `${l.shop.lat},${l.shop.lng}`).join('|');
  const gmaps = last ? `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${last.lat},${last.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}` : '#';
  return (
    <Card className="p-3.5 lg:p-5">
      <div className="mb-1 flex items-center gap-2"><CalendarClock className="size-5 text-accent" /><h3 className="flex-1 text-[16px] font-extrabold">{tr("برنامه بازدید حضوری")}</h3><Badge>{minutes(p.totalMinutes)}</Badge></div>
      <p className="mb-4 text-[13px] text-muted">{tr("ترتیب بهینه")}{' '}{MODE_LABEL[p.mode] ?? ''}{tr("، با ۱۵ دقیقه توقف در هر فروشگاه.")}</p>
      <ol className="relative flex flex-col gap-4 pr-6">
        <span className="absolute top-2 right-[9px] bottom-2 w-0.5 rounded bg-line" />
        <li className="relative text-[13.5px] text-muted"><span className="absolute top-1.5 -right-6 size-5 rounded-full border-4 border-bg bg-accent" />{tr("حرکت از")}{' '}{profile?.areaName ? placeName(profile.areaName) : tr("موقعیت تو")} {' '}{tr("· الان")}</li>
        {p.legs.map((l, i) => (
          <li key={l.shop.id} className="relative" style={{ animation: `up .6s ${0.08 * i}s both` }}>
            <span className="absolute top-1 -right-6 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-on-primary">{fa(i + 1)}</span>
            <div className="text-[12.5px] text-muted">{fa(l.legKm)} {' '}{tr("کیلومتر ·")}{' '}{minutes(l.legMin)} {' '}{tr("· رسیدن حدود")}{' '}<b className="text-fg-2">{l.arriveAt}</b></div>
            <button onClick={() => useApp.getState().set({ sheet: { type: 'store', id: l.shop.id } })} className="text-right text-[15px] font-bold hover:text-accent-text">{l.shop.name}</button>
            <div className="text-[13px] text-muted">{[l.shop.mall, l.shop.floor ? tr("طبقه {0}", l.shop.floor) : null].filter(Boolean).join(' · ') || l.shop.address}</div>
            {l.warning && <p className="mt-1 rounded-xl bg-warn-soft px-3 py-1.5 text-[13px] text-warn">{l.warning}</p>}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={gmaps} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-[14px] font-bold text-on-primary"><Navigation className="size-4" />{tr("کل مسیر در گوگل‌مپ")}</a>
        <Button size="sm" variant="ghost" onClick={() => { for (const l of p.legs) useApp.getState().addToPlan({ shopId: l.shop.id, shopName: l.shop.name }); useApp.getState().showToast(tr("به برنامه بازدید اضافه شد")); }} icon={<Plus className="size-4" />}>{tr("ذخیره در برنامه")}</Button>
      </div>
    </Card>
  );
}
