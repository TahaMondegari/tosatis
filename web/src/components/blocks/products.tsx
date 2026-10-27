import { useState } from 'react';
import { Heart, MapPin, Scale, Sparkles, Store, Check, Info, Trophy } from 'lucide-react';
import { Badge, Button, Card, ProductImage, cx, OpenBadge } from '../ui';
import { useApp } from '../../store';
import { runAction, sendUser } from '../../lib/chat';
import { fa, km, toman } from '../../lib/format';
import type { ProductCard } from '../../lib/types';

import { tr } from '../../lib/i18n';
export function openStores(p: { id: string; title: string }) {
  void runAction('find_stores', { product_id: p.id }, { userText: tr("فروشگاه‌های «{0}» رو نشونم بده", p.title), intro: tr("فروشگاه‌هایی که این محصول رو ثبت کرده‌اند، بر اساس اولویت‌های تو مرتب شده‌اند:") });
}

function ProductTile({ p, reason, selected, onSelect, rank }: { p: ProductCard; reason?: string; selected: boolean; onSelect: () => void; rank: number }) {
  const saved = useApp((s) => s.saved.some((x) => x.id === p.id));
  const toggleSaved = useApp((s) => s.toggleSaved);
  const set = useApp((s) => s.set);
  const min = p.priceStats?.min ?? p.minPrice;
  const max = p.priceStats?.max ?? p.maxPrice;
  return (
    <Card className="tilt flex w-[70vw] max-w-[250px] shrink-0 snap-start flex-col gap-2 p-3 sm:w-[250px]" style={{ animation: `up .8s ${0.08 * rank}s cubic-bezier(.22,1,.36,1) both` }}>
      <div className="lift relative">
        <button onClick={() => set({ sheet: { type: 'product', id: p.id } })} className="block w-full" aria-label={tr("جزئیات {0}", p.title)}>
          <ProductImage src={p.image} alt={p.title} className="h-32 w-full sm:h-36" />
        </button>
        {rank === 0 && <span className="absolute top-2 right-2"><Badge tone="accent" icon={<Trophy className="size-3.5" />}>{tr("پیشنهاد اول")}</Badge></span>}
        <button aria-label={saved ? tr("حذف از ذخیره‌ها") : tr("ذخیره")} onClick={() => toggleSaved(p)} className={cx('absolute top-2 left-2 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-transform duration-500 active:scale-90', saved && 'text-[#ff5a6a]')}>
          <Heart className="size-5" fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button onClick={() => set({ sheet: { type: 'product', id: p.id } })} className="lift line-clamp-2 min-h-[3.2em] text-right text-[14px] leading-[1.6] font-bold hover:text-accent-text">{p.title}</button>
      <div className="lift">
        <div className="num text-[16px] font-extrabold">{min != null ? (max && max !== min ? tr("از {0}", toman(min)) : toman(min)) : tr("قیمت ثبت نشده")}</div>
        {max != null && min != null && max !== min && (
          <div className="text-[12.5px] text-muted">{p.priceStats?.median && max > min * 1.6 ? tr("میانه {0} در فروشگاه‌ها", toman(p.priceStats.median)) : tr("تا {0} در فروشگاه‌های دیگر", toman(max))}</div>
        )}
      </div>
      {reason && (
        <p className="lift flex gap-1.5 rounded-xl bg-accent-soft px-2.5 py-1.5 text-[13px] leading-6 text-fg-2"><Sparkles className="mt-1 size-3.5 shrink-0 text-accent" />{reason}</p>
      )}
      <div className="lift flex flex-wrap gap-1.5">
        <Badge icon={<Store className="size-3.5" />}>{fa(p.shopsCount ?? p.nShops)} {' '}{tr("فروشگاه")}</Badge>
        {p.nearest?.open && <OpenBadge open={p.nearest.open} />}
      </div>
      {p.nearest && (
        <div className="lift flex items-center gap-1.5 text-[13px] text-muted">
          <MapPin className="size-4 shrink-0" />
          <span className="truncate">{p.nearest.name}{p.nearest.mall ? ` · ${p.nearest.mall}` : p.nearest.area ? ` · ${p.nearest.area}` : ''}</span>
          {p.nearest.distanceKm != null && <span className="mr-auto shrink-0 font-semibold text-fg-2">{km(p.nearest.distanceKm)}</span>}
        </div>
      )}
      <div className="lift mt-auto flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={() => openStores(p)} icon={<Store className="size-4" />}>{tr("فروشگاه‌ها")}</Button>
        <button aria-pressed={selected} aria-label={tr("انتخاب برای مقایسه")} onClick={onSelect} className={cx('grid min-h-11 min-w-11 place-items-center rounded-full border transition-all duration-500', selected ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg')}>
          {selected ? <Check className="size-5" /> : <Scale className="size-5" />}
        </button>
      </div>
    </Card>
  );
}

export function ProductCards({ block }: { block: any }) {
  const p = block.props as { title?: string; products: ProductCard[]; reasons?: Record<string, string> };
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  if (!p.products?.length) return <p className="text-muted">{tr("محصولی پیدا نشد.")}</p>;
  return (
    <div>
      {p.title && <div className="mb-2 flex items-center gap-2 text-[14px] font-bold text-muted"><Sparkles className="size-4 text-accent" />{p.title}</div>}
      <div className="carousel no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0" style={{ perspective: 1200 }}>
        {p.products.map((x, i) => <ProductTile key={x.id} p={x} rank={i} reason={p.reasons?.[x.id]} selected={sel.includes(x.id)} onSelect={() => toggle(x.id)} />)}
      </div>
      {sel.length > 0 && <div className="flex items-center gap-2" style={{ animation: 'up .5s both' }}>
        <Button size="sm" disabled={sel.length < 2} onClick={() => runAction('compare_products', { product_ids: sel }, { userText: tr("این {0} محصول رو مقایسه کن", fa(sel.length)), intro: tr("مقایسه بر اساس قیمت ثبت‌شده، فروشگاه‌ها و مشخصات فنی:") })} icon={<Scale className="size-4" />}>
          {tr("مقایسه")}{' '}{fa(sel.length)} {' '}{tr("محصول")}</Button>
        <span className="text-[13px] text-muted">{sel.length < 2 ? tr("یک مورد دیگر هم انتخاب کن") : tr("حداکثر ۴ مورد")}</span>
      </div>}
    </div>
  );
}

export function CompareTable({ block }: { block: any }) {
  const p = block.props as { products?: { id: string; title: string; image: string | null }[]; stores?: { id: string; name: string }[]; product?: { id: string; title: string }; rows: { label: string; values: string[]; bestIndex?: number }[] };
  const cols = p.products ?? p.stores ?? [];
  const isStores = !!p.stores;
  const wins = cols.map((_, i) => p.rows.filter((r) => r.bestIndex === i).length);
  const winner = wins.indexOf(Math.max(...wins));
  const [chosen, setChosen] = useState<number | null>(null);
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Scale className="size-5 text-accent" />
        <h3 className="flex-1 text-[16px] font-extrabold">{isStores ? tr("مقایسه فروشگاه‌ها{0}", p.product ? ` · ${p.product.title}` : '') : tr("مقایسه محصولات")}</h3>
      </div>
      <div className="thin-scroll -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <table className={cx('w-full border-separate border-spacing-y-1.5 text-[14px]', cols.length > 2 ? 'min-w-[560px]' : 'min-w-0')}>
          <thead>
            <tr>
              <th className="sticky right-0 z-10 w-24 bg-surface p-2 text-right text-[12.5px] font-semibold text-muted sm:w-32">{tr("معیار")}</th>
              {cols.map((c: any, i) => (
                <th key={c.id} className="p-2 text-right align-bottom">
                  {c.image !== undefined && <ProductImage src={c.image} alt={c.title} className="mb-1.5 h-16 w-16" />}
                  <div className="line-clamp-2 text-[13.5px] leading-6 font-bold">{c.title ?? c.name}</div>
                  {i === winner && wins[i] > 0 && <Badge tone="accent" className="mt-1">{tr("برنده")}{' '}{fa(wins[i])} {' '}{tr("معیار")}</Badge>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.label} className="group">
                <td className="sticky right-0 z-10 rounded-r-xl bg-surface-2 p-2.5 text-[13px] font-semibold text-muted group-hover:bg-surface-3">{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={cx('bg-surface-2 p-2.5 group-hover:bg-surface-3 last:rounded-l-xl', r.bestIndex === i && 'font-extrabold text-accent-text')}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-muted"><Info className="mt-0.5 size-3.5 shrink-0" />{tr("مقدار برتر هر ردیف رنگی است. قیمت‌ها «ثبت‌شده» هستند و موجودی تا استعلام از فروشنده تأیید نشده است.")}</p>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {cols.map((c: any, i) => (
          <Button key={c.id} size="sm" variant={chosen === i ? 'primary' : 'ghost'} onClick={() => {
            setChosen(i);
            if (isStores) useApp.getState().set({ sheet: { type: 'store', id: c.id, productId: p.product?.id } });
            else void sendUser(tr("«{0}» رو انتخاب کردم. فروشگاه‌هاش رو مقایسه کن.", c.title), tr("«{0}» رو انتخاب کردم", c.title));
          }}>
            {isStores ? tr("جزئیات {0}", c.name) : tr("انتخاب {0}", fa(i + 1))}
          </Button>
        ))}
      </div>
    </Card>
  );
}

export function QuickReplies({ block, latest }: { block: any; latest: boolean }) {
  const busy = useApp((s) => s.busy);
  if (!latest) return null;
  const opts: string[] = block.props.options ?? [];
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 lg:mx-0 lg:flex-wrap lg:px-0">
      {opts.map((o, i) => (
        <button key={o} disabled={busy} onClick={() => sendUser(o)} className="min-h-11 shrink-0 rounded-full border border-line px-4 text-[14px] font-semibold text-fg-2 transition-all duration-500 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-3 disabled:opacity-50" style={{ animation: `up .6s ${0.06 * i}s both` }}>
          {o}
        </button>
      ))}
    </div>
  );
}
