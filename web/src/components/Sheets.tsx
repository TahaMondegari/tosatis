import { useEffect, useState } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronUp, Heart, Moon, Monitor, Navigation, Store, Sun, Trash2, Type, Globe, Star } from 'lucide-react';
import { useApp, type Theme } from '../store';
import { api } from '../lib/api';
import { runAction } from '../lib/chat';
import { fa, km, toman } from '../lib/format';
import type { OffersResult, ProductFull, ShopFull, TravelMode } from '../lib/types';
import { LocationField, LocationPicker } from './LocationPicker';
import { FeedbackSheetBody } from './Feedback';
import { StoreDetailsBody } from './blocks/stores';
import { openStores } from './blocks/products';
import { MODE_FA, MODE_ICON } from './chat/ChatView';
import { Badge, Button, ProductImage, Section, Segmented, Sheet, StockBadge, Toggle, cx } from './ui';

import { tr, locale } from '../lib/i18n';
const PRI_LABEL: Record<string, string> = { price: tr("قیمت کمتر"), distance: tr("نزدیک بودن"), open: tr("الان باز باشد"), warranty: tr("گارانتی معتبر"), installment: tr("خرید قسطی"), fresh: tr("قیمت به‌روز") };

function ThemeCard({ id, label, active, onClick }: { id: Theme; label: string; active: boolean; onClick: () => void }) {
  const pal = id === 'light' ? { bg: '#f4f4f6', s: '#fff', a: '#d32f3b', t: '#17171a', l: '#e4e4e8' } : id === 'dark' ? { bg: '#0a0a0a', s: '#151516', a: '#38bdf8', t: '#fafafa', l: '#262626' } : null;
  return (
    <button onClick={onClick} aria-pressed={active} className={cx('flex flex-col gap-2 rounded-2xl border p-2 text-[14px] font-bold transition-all duration-500', active ? 'border-accent shadow-[0_0_22px_-10px_var(--accent)]' : 'border-line hover:border-line-strong')}>
      <span className="relative block h-20 overflow-hidden rounded-xl" style={pal ? { background: pal.bg } : { background: 'linear-gradient(90deg,#0a0a0a 50%,#f4f4f6 50%)' }}>
        {pal && (
          <>
            <span className="absolute top-2 right-2 left-8 h-3 rounded" style={{ background: pal.s, border: `1px solid ${pal.l}` }} />
            <span className="absolute top-7 right-2 h-8 w-16 rounded-lg" style={{ background: pal.s, border: `1px solid ${pal.l}` }} />
            <span className="absolute bottom-2 left-2 h-4 w-10 rounded-full" style={{ background: pal.a }} />
            <span className="absolute top-8 right-4 h-1.5 w-10 rounded" style={{ background: pal.t, opacity: 0.6 }} />
          </>
        )}
      </span>
      <span className="flex items-center justify-center gap-1.5">{id === 'dark' ? <Moon className="size-4" /> : id === 'light' ? <Sun className="size-4" /> : <Monitor className="size-4" />}{label}{active && <Check className="size-4 text-accent" />}</span>
    </button>
  );
}

function SettingsSheet() {
  const profile = useApp((s) => s.profile)!;
  const theme = useApp((s) => s.theme);
  const textSize = useApp((s) => s.textSize);
  const lang = useApp((s) => s.lang);
  const { updateProfile, setTheme, setTextSize, clearChats, showToast } = useApp.getState();
  const [picking, setPicking] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); api.health().then((h) => setAi(h.ai)).catch(() => {}); }, []);
  const pri = profile.priorities.length ? profile.priorities : Object.keys(PRI_LABEL);
  const move = (i: number, d: number) => { const a = [...pri]; [a[i], a[i + d]] = [a[i + d], a[i]]; updateProfile({ priorities: a }); };
  return (
    <>
      <Section title={tr("ظاهر")} className="mt-1">
        <div className="grid grid-cols-3 gap-2">
          <ThemeCard id="dark" label={tr("تیره")} active={theme === 'dark'} onClick={() => setTheme('dark')} />
          <ThemeCard id="light" label={tr("روشن ترب")} active={theme === 'light'} onClick={() => setTheme('light')} />
          <ThemeCard id="system" label={tr("خودکار")} active={theme === 'system'} onClick={() => setTheme('system')} />
        </div>
        <div className="mt-3 flex items-center gap-3"><Type className="size-5 text-muted" /><span className="flex-1 text-[15px] font-semibold">{tr("اندازه متن")}</span>
          <Segmented className="w-44" value={textSize} onChange={setTextSize} options={[{ id: 'normal', label: tr("معمولی") }, { id: 'large', label: tr("درشت") }]} />
        </div>
        <div className="mt-3 flex items-center gap-3"><Globe className="size-5 text-muted" /><span className="flex-1 text-[15px] font-semibold">{tr("زبان / Language")}</span>
          <Segmented className="w-44" value={lang} onChange={(l) => { useApp.setState({ lang: l }); setTimeout(() => location.reload(), 60); }} options={[{ id: 'fa', label: tr("فارسی") }, { id: 'en', label: 'English' }]} />
        </div>
      </Section>

      <Section title={tr("پروفایل")}>
        <label className="block text-[13px] text-muted">{tr("نام")}</label>
        <input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} className="mt-1 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-accent" />
        <div className="mt-3"><LocationField city={profile.city} areaName={profile.areaName} onClick={() => setPicking(true)} /></div>
        <LocationPicker open={picking} onClose={() => setPicking(false)} current={profile} onPick={(l) => { updateProfile({ city: l.city, province: l.province, areaName: l.areaName, lat: l.lat, lng: l.lng, locationSource: l.source }); showToast(tr("موقعیت: {0}{1}", l.city, l.areaName ? ` · ${l.areaName}` : '')); }} />
        <div className="mt-3 text-[13px] text-muted">{tr("روش رفت‌وآمد")}</div>
        <div className="mt-1 grid grid-cols-5 gap-1.5">
          {(['car', 'taxi', 'transit', 'motor', 'walk'] as TravelMode[]).map((m) => { const I = MODE_ICON[m]; return (
            <button key={m} onClick={() => updateProfile({ mode: m })} aria-pressed={profile.mode === m} className={cx('flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-[12px] font-semibold transition-all duration-500', profile.mode === m ? 'border-accent bg-accent-soft' : 'border-line')}><I className="size-5" />{MODE_FA[m]}</button>
          ); })}
        </div>
      </Section>

      <Section title={tr("شرایط خرید")}>
        <div className="rounded-2xl border border-line bg-surface px-3">
          <Toggle checked={profile.installmentOnly} onChange={(v) => updateProfile({ installmentOnly: v })} label={tr("فقط فروشگاه‌های قسطی")} hint={tr("در پیشنهادها و فهرست فروشگاه‌ها اعمال می‌شود")} />
        </div>
        <div className="mt-3 text-[13px] text-muted">{tr("اولویت‌ها برای رتبه‌بندی فروشگاه‌ها (مهم‌ترین بالا)")}</div>
        <ol className="mt-1.5 flex flex-col gap-1.5">
          {pri.map((id, i) => (
            <li key={id} className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-3 text-[15px] font-semibold">
              <span className={cx('grid size-7 place-items-center rounded-lg text-[13px] font-extrabold', i === 0 ? 'bg-primary text-on-primary' : 'bg-surface-3')}>{fa(i + 1)}</span>
              <span className="flex-1">{PRI_LABEL[id]}</span>
              <button aria-label={tr("بالاتر")} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-3 disabled:opacity-25"><ChevronUp className="size-5" /></button>
              <button aria-label={tr("پایین‌تر")} disabled={i === pri.length - 1} onClick={() => move(i, 1)} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-3 disabled:opacity-25"><ChevronDown className="size-5" /></button>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={tr("داده‌ها")}>
        <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={() => { clearChats(); showToast(tr("گفتگوها پاک شد")); }}>{tr("پاک کردن همه گفتگوها")}</Button>
        {stats && (
          <p className="mt-3 text-[13px] leading-7 text-muted">
            {tr("منبع: دیتاست فروشگاه‌های حضوری ترب —")}{' '}{fa(stats.shops)} {' '}{tr("فروشگاه،")}{' '}{fa(stats.products)} {' '}{tr("محصول،")}{' '}{fa(stats.offers)} {' '}{tr("پیشنهاد قیمت. آخرین تغییر قیمت ثبت‌شده:")}{' '}{stats.latestPrice ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(stats.latestPrice)) : '—'}.
            {ai === false && tr(" (حالت پیشنهاد سریع فعال است)")}
          </p>
        )}
      </Section>
    </>
  );
}

function ProductSheetBody({ id }: { id: string }) {
  const profile = useApp((s) => s.profile);
  const saved = useApp((s) => s.saved.some((x) => x.id === id));
  const [p, setP] = useState<ProductFull | null>(null);
  const [offers, setOffers] = useState<OffersResult | null>(null);
  const [img, setImg] = useState(0);
  const [allSpecs, setAllSpecs] = useState(false);
  useEffect(() => {
    api.product(id).then(setP).catch(() => {});
    api.offers(id, profile, { sort: 'best' }).then(setOffers).catch(() => {});
  }, [id]);
  if (!p) return <div className="flex flex-col gap-3"><div className="skeleton h-64" /><div className="skeleton h-6 w-2/3" /><div className="skeleton h-24" /></div>;
  const close = () => useApp.getState().set({ sheet: null });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ProductImage src={p.images[img] ?? p.image} alt={p.title} className="h-64 w-full" />
        {p.images.length > 1 && (
          <div className="mt-2 flex gap-2">{p.images.map((u, i) => <button key={u} onClick={() => setImg(i)} aria-label={tr("تصویر {0}", i + 1)} className={cx('size-14 overflow-hidden rounded-xl border bg-white', i === img ? 'border-accent' : 'border-line')}><img src={u} alt="" loading="lazy" className="h-full w-full object-contain" /></button>)}</div>
        )}
      </div>
      <div>
        <div className="mb-1 flex flex-wrap gap-1.5">{p.category && <Badge>{p.category}</Badge>}{p.brand && <Badge tone="accent">{p.brand}</Badge>}</div>
        <h2 className="text-[19px] leading-9 font-extrabold">{p.title}</h2>
        {offers?.stats && <p className="mt-1 text-[15px]"><b className="num">{toman(offers.stats.min)}</b><span className="text-muted"> {' '}{tr("تا")}{' '}{toman(offers.stats.max)} · {fa(offers.total)} {' '}{tr("فروشگاه")}</span></p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => { close(); openStores(p); }} icon={<Store className="size-4" />}>{tr("مقایسه فروشگاه‌ها")}</Button>
        <Button variant="ghost" onClick={() => useApp.getState().toggleSaved(p)} icon={<Heart className="size-4" fill={saved ? 'currentColor' : 'none'} />}>{saved ? tr("ذخیره شد") : tr("ذخیره")}</Button>
      </div>
      {offers && offers.offers.length > 0 && (
        <Section title={tr("ارزان‌ترین و نزدیک‌ترین")}>
          <div className="flex flex-col gap-2">
            {offers.offers.slice(0, 3).map((o) => (
              <button key={o.offerId} onClick={() => useApp.getState().set({ sheet: { type: 'store', id: o.shop.id, productId: p.id } })} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-right hover:border-line-strong">
                <div className="min-w-0 flex-1"><b className="block truncate text-[14.5px]">{o.shop.name}</b><span className="block truncate text-[12.5px] text-muted">{km(o.shop.distanceKm)} · {o.shop.open.label}</span></div>
                <div className="text-left"><b className="num block text-[14.5px]">{toman(o.price, true)}</b><span className="text-[11.5px] text-muted">{o.freshness.label}</span></div>
              </button>
            ))}
          </div>
        </Section>
      )}
      {p.specs.length > 0 && (
        <Section title={tr("مشخصات")}>
          <dl className="grid grid-cols-1 gap-1">
            {(allSpecs ? p.specs : p.specs.slice(0, 8)).map((s) => <div key={s.key + s.value} className="flex gap-3 rounded-xl bg-surface-2 px-3 py-2 text-[14px]"><dt className="w-32 shrink-0 text-muted">{s.key}</dt><dd className="min-w-0 flex-1 font-semibold">{s.value}</dd></div>)}
          </dl>
          {p.specs.length > 8 && <button onClick={() => setAllSpecs(!allSpecs)} className="mt-1 min-h-11 text-[14px] font-semibold text-accent-text">{allSpecs ? tr("کمتر") : tr("همه {0} مشخصه", fa(p.specs.length))}</button>}
        </Section>
      )}
    </div>
  );
}

function StoreSheetBody({ id, productId }: { id: string; productId?: string }) {
  const profile = useApp((s) => s.profile);
  const [s, setS] = useState<ShopFull | null>(null);
  useEffect(() => { api.shop(id, profile).then(setS).catch(() => {}); }, [id]);
  if (!s) return <div className="flex flex-col gap-3"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40" /><div className="skeleton h-24" /></div>;
  return (
    <div>
      <h2 className="mb-2 text-[20px] font-extrabold">{s.name}</h2>
      <StoreDetailsBody shop={s} productId={productId} />
      {s.topProducts.length > 0 && (
        <Section title={tr("محصولات این فروشگاه ({0})", fa(s.nOffers))}>
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
            {s.topProducts.map((p) => (
              <button key={p.id} onClick={() => useApp.getState().set({ sheet: { type: 'product', id: p.id } })} className="w-36 shrink-0 rounded-2xl border border-line bg-surface-2 p-2 text-right">
                <ProductImage src={p.image} alt={p.title} className="h-24 w-full" />
                <div className="mt-1 line-clamp-2 text-[12.5px] leading-6 font-semibold">{p.title}</div>
                <div className="num text-[13px] font-extrabold">{toman(p.price, true)}</div>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function PlanSheet() {
  const plan = useApp((s) => s.plan);
  const inquiries = useApp((s) => s.inquiries);
  const { removeFromPlan, clearPlan, set } = useApp.getState();
  const [rating, setRating] = useState<Record<string, number>>({});
  if (!plan.length) return <EmptyState icon={CalendarClock} text={tr("هنوز فروشگاهی به برنامه بازدید اضافه نکردی. از فهرست فروشگاه‌ها دکمه «برنامه» رو بزن.")} />;
  return (
    <div className="flex flex-col gap-2">
      {plan.map((p, i) => {
        const inq = inquiries[`${p.shopId}:${p.productId ?? ''}`];
        return (
          <div key={p.shopId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-[14px] font-extrabold text-on-primary">{fa(i + 1)}</span>
            <button className="min-w-0 flex-1 text-right" onClick={() => set({ sheet: { type: 'store', id: p.shopId, productId: p.productId } })}>
              <b className="block truncate text-[15px]">{p.shopName}</b>
              {p.productTitle && <span className="block truncate text-[12.5px] text-muted">{p.productTitle}{p.price ? ` · ${toman(p.price, true)}` : ''}</span>}
              <span className="mt-1 block"><StockBadge status={inq?.status} at={inq?.at} /></span>
            </button>
            <button aria-label={tr("حذف")} onClick={() => removeFromPlan(p.shopId)} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-3"><Trash2 className="size-4" /></button>
          </div>
        );
      })}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button onClick={() => { set({ sheet: null }); void runAction('plan_visit', { shop_ids: plan.map((p) => p.shopId) }, { userText: tr("برنامه بازدیدم رو بچین"), intro: tr("ترتیب پیشنهادی با توجه به فاصله و ساعت کاری:") }); }} icon={<Navigation className="size-4" />}>{tr("چیدن مسیر")}</Button>
        <Button variant="ghost" onClick={clearPlan}>{tr("پاک کردن")}</Button>
      </div>
      <Section title={tr("بعد از خرید، تجربه‌ات چطور بود؟")}>
        {[['find', tr("راحتی پیدا کردن فروشگاه")], ['buy', tr("رضایت از خرید")]].map(([k, l]) => (
          <div key={k} className="flex items-center gap-2 py-1.5">
            <span className="flex-1 text-[14.5px] font-semibold">{l}</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={tr("{0} ستاره", fa(n))} onClick={() => setRating({ ...rating, [k]: n })} className="grid size-10 place-items-center transition-transform duration-500 hover:scale-125">
                <Star className={cx('size-7', (rating[k] ?? 0) >= n ? 'fill-accent text-accent' : 'text-line-strong')} />
              </button>
            ))}
          </div>
        ))}
        {rating.find && rating.buy && <p className="text-[13.5px] text-ok">{tr("ممنون! بازخوردت برای بهتر شدن پیشنهادها ثبت شد.")}</p>}
      </Section>
    </div>
  );
}

function SavedSheet() {
  const saved = useApp((s) => s.saved);
  const { set, toggleSaved } = useApp.getState();
  if (!saved.length) return <EmptyState icon={Heart} text={tr("محصولی ذخیره نکردی. روی قلب کارت‌های محصول بزن.")} />;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {saved.map((p) => (
        <div key={p.id} className="relative rounded-2xl border border-line bg-surface-2 p-2">
          <button className="w-full text-right" onClick={() => set({ sheet: { type: 'product', id: p.id } })}>
            <ProductImage src={p.image} alt={p.title} className="h-28 w-full" />
            <div className="mt-1.5 line-clamp-2 text-[13px] leading-6 font-semibold">{p.title}</div>
            <div className="num text-[13.5px] font-extrabold">{toman(p.priceStats?.min ?? p.minPrice, true)}</div>
          </button>
          <button aria-label={tr("حذف")} onClick={() => toggleSaved(p)} className="absolute top-3 left-3 grid size-9 place-items-center rounded-full bg-black/45 text-[#ff5a6a]"><Heart className="size-4" fill="currentColor" /></button>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: I, text }: { icon: any; text: string }) {
  return <div className="flex flex-col items-center gap-3 py-10 text-center text-[14.5px] text-muted"><span className="grid size-16 place-items-center rounded-full bg-surface-3"><I className="size-7" /></span>{text}</div>;
}

export function Sheets() {
  const sheet = useApp((s) => s.sheet);
  const close = () => useApp.getState().set({ sheet: null });
  const titles: Record<string, string> = { feedback: tr("نظرسنجی خرید"), settings: tr("تنظیمات"), plan: tr("برنامه بازدید"), saved: tr("ذخیره‌شده‌ها"), product: tr("جزئیات محصول"), store: tr("فروشگاه") };
  return (
    <Sheet open={!!sheet} onClose={close} title={sheet ? titles[sheet.type] : ''} wide={sheet?.type === 'store' || sheet?.type === 'product'}>
      {sheet?.type === 'settings' && <SettingsSheet />}
      {sheet?.type === 'product' && <ProductSheetBody key={sheet.id} id={sheet.id} />}
      {sheet?.type === 'store' && <StoreSheetBody key={sheet.id} id={sheet.id} productId={sheet.productId} />}
      {sheet?.type === 'plan' && <PlanSheet />}
      {sheet?.type === 'saved' && <SavedSheet />}
      {sheet?.type === 'feedback' && <FeedbackSheetBody id={sheet.id} />}
    </Sheet>
  );
}

