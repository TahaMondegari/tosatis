import { placeName } from '../../lib/iran';
import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, GripVertical, LocateFixed, MapPin, Search, Send, Sparkles } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Chip, cx } from '../ui';
import { t } from '../../lib/i18n';
import { useApp } from '../../store';
import { sendUser } from '../../lib/chat';
import { fa, toman } from '../../lib/format';
import { TEHRAN_AREAS, nearestArea } from '../../lib/areas';

import { tr, locale } from '../../lib/i18n';
function submit(blockId: string, answer: unknown, text: string, display?: string) {
  useApp.getState().setAnswer(blockId, answer);
  void sendUser(text, display);
}

function Head({ question, hint }: { question: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[16.5px] leading-7 font-extrabold lg:text-[18px]">{question}</h2>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

function SubmitBar({ disabled, label, onClick }: { disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <div className={cx('moving-border mt-4', disabled && 'paused')}>
      <Button full size="md" disabled={disabled} onClick={onClick} className="!shadow-none" icon={<Send className="size-4 -scale-x-100" />}>{label}</Button>
    </div>
  );
}

// ------------------------------------------------------------------ ChoiceForm

export function ChoiceForm({ block, answer }: { block: any; answer?: any }) {
  const p = block.props as { id: string; question: string; hint?: string; multiple: boolean; options: { id: string; label: string }[]; allowOther?: boolean; submitLabel?: string };
  const [sel, setSel] = useState<string[]>(answer?.selected ?? []);
  const [other, setOther] = useState<string>(answer?.other ?? '');
  const done = !!answer;
  const toggle = (id: string) => {
    if (done) return;
    if (!p.multiple && !other.trim()) {
      // Single choice: answer on tap, like a chat app
      const label = p.options.find((o) => o.id === id)!.label;
      setSel([id]);
      setTimeout(() => submit(p.id, { id: p.id, selected: [id], other: '' }, tr("پاسخ به «{0}»: {1}", p.question, label), label), 220);
      return;
    }
    setSel((s) => (p.multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : s[0] === id ? [] : [id]));
  };
  const labels = () => [...p.options.filter((o) => sel.includes(o.id)).map((o) => o.label), ...(other.trim() ? [other.trim()] : [])];
  const send = () => {
    const l = labels();
    submit(p.id, { id: p.id, selected: sel, other }, tr("پاسخ به «{0}»: {1}", p.question, l.join('، ') || tr("فرقی نمی‌کنه")), l.join('، ') || tr("فرقی نمی‌کنه"));
  };
  return (
    <Card className="p-4 lg:p-5">
      <Head question={p.question} hint={p.hint ?? (p.multiple ? tr("چندتا رو می‌تونی با هم انتخاب کنی") : tr("یکی رو بزن"))} />
      <div className="flex flex-wrap gap-2" role={p.multiple ? 'group' : 'radiogroup'}>
        {p.options.map((o) => (
          <Chip key={o.id} active={sel.includes(o.id)} disabled={done} onClick={() => toggle(o.id)} role={p.multiple ? 'checkbox' : 'radio'} aria-checked={sel.includes(o.id)} className="min-h-11 text-[14.5px]">
            {sel.includes(o.id) && <Check className="size-4 text-accent" strokeWidth={2.5} />}
            {o.label}
          </Chip>
        ))}
        {!done && (
          <Chip onClick={() => { setSel([]); submit(p.id, { id: p.id, selected: [], skipped: true }, tr("پاسخ به «{0}»: فرقی نمی‌کنه", p.question), tr("فرقی نمی‌کنه")); }} className="border-dashed text-muted">{tr("فرقی نمی‌کنه")}</Chip>
        )}
      </div>
      {p.allowOther && !done && (
        <label className="mt-2.5 flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 focus-within:border-accent">
          <Sparkles className="size-4 text-muted" />
          <input value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (sel.length || other.trim()) && send()} placeholder={tr("یا خودت بنویس…")} className="h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ph" />
        </label>
      )}
      {!done && (p.multiple || !!other.trim()) && <SubmitBar disabled={!sel.length && !other.trim()} label={sel.length > 1 ? tr("ادامه با {0} انتخاب", sel.length.toLocaleString(locale())) : (p.submitLabel ?? tr("ادامه"))} onClick={send} />}
    </Card>
  );
}

// ------------------------------------------------------------------ Budget

export function BudgetPicker({ block, answer }: { block: any; answer?: any }) {
  const p = block.props as { id: string; question: string; hint?: string; min: number; max: number; step: number; suggested?: { min: number; max: number }; presets: { label: string; min: number; max: number }[]; median?: number };
  const [lo, setLo] = useState<number>(answer?.min ?? p.suggested?.min ?? p.min);
  const [hi, setHi] = useState<number>(answer?.max ?? p.suggested?.max ?? p.max);
  const done = !!answer;
  const pct = (v: number) => ((v - p.min) / (p.max - p.min || 1)) * 100;
  const send = () => submit(p.id, { id: p.id, min: lo, max: hi }, tr("بودجه: از {0} تا {1}", toman(lo), toman(hi)), tr("بودجه‌ام بین {0} تا {1} تومانه", toman(lo, true), toman(hi, true)));
  return (
    <Card className="p-4 lg:p-5">
      <Head question={p.question} hint={p.hint} />
      {/* Labels are swapped visually (from ↔ to); the slider itself keeps its direction */}
      <div className="flex items-end justify-between gap-3 rtl:flex-row-reverse">
        <div className="text-end"><div className="text-[12.5px] text-muted">{t('from')}</div><div className="num text-[19px] font-extrabold">{toman(lo, true)}</div></div>
        <div className="h-px flex-1 translate-y-[-12px] bg-line" />
        <div><div className="text-[12.5px] text-muted">{t('to')}</div><div className="num text-[19px] font-extrabold">{toman(hi, true)}</div></div>
      </div>
      {/* Follows the page direction: in RTL the low amount sits on the right, the high one on the left */}
      <div className="relative mt-5 h-11">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-surface-3" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent" style={{ insetInlineStart: `${pct(lo)}%`, insetInlineEnd: `${100 - pct(hi)}%` }} />
        {p.median != null && <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-muted/60" style={{ insetInlineStart: `${pct(p.median)}%` }} title={tr("میانه قیمت بازار")} />}
        <input aria-label={tr("حداقل بودجه")} type="range" min={p.min} max={p.max} step={p.step} value={lo} disabled={done} onChange={(e) => setLo(Math.min(Number(e.target.value), hi - p.step))} className="range-thumb pointer-events-none absolute inset-0 w-full appearance-none bg-transparent" />
        <input aria-label={tr("حداکثر بودجه")} type="range" min={p.min} max={p.max} step={p.step} value={hi} disabled={done} onChange={(e) => setHi(Math.max(Number(e.target.value), lo + p.step))} className="range-thumb pointer-events-none absolute inset-0 w-full appearance-none bg-transparent" />
      </div>
      {p.median != null && <p className="mt-1 text-[13px] text-muted">{t('marketMedian')} <b className="text-fg-2">{toman(p.median)}</b></p>}
      {!!p.presets.length && (
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
          {p.presets.map((pr) => (
            <Chip key={pr.label} disabled={done} active={lo === pr.min && hi === pr.max} onClick={() => { setLo(pr.min); setHi(pr.max); }}>
              {pr.label} <span className="text-muted">· {pr.min ? tr("{0} تا ", toman(pr.min, true)) : tr("تا ")}{toman(pr.max, true)}</span>
            </Chip>
          ))}
        </div>
      )}
      {!done && <SubmitBar label={t('thisBudget')} onClick={send} />}
    </Card>
  );
}

// ------------------------------------------------------------------ Priority ranker

function RankRow({ id, label, index, total, move, overlay, disabled }: { id: string; label: string; index: number; total: number; move?: (from: number, to: number) => void; overlay?: boolean; disabled?: boolean }) {
  const s = useSortable({ id, disabled });
  const style = overlay ? undefined : { transform: CSS.Transform.toString(s.transform), transition: s.transition };
  return (
    <li ref={overlay ? undefined : s.setNodeRef} style={style}
      className={cx('flex min-h-14 items-center gap-3 rounded-2xl border bg-surface-2 px-3 text-[15.5px] font-semibold', overlay ? 'scale-[1.04] -rotate-1 border-accent bg-surface-3 shadow-[0_22px_30px_-10px_#000,0_0_24px_-10px_var(--accent)]' : 'border-line', s.isDragging && !overlay && 'opacity-30')}>
      <button aria-label={tr("جابه‌جایی {0}", label)} className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted active:cursor-grabbing" {...(overlay ? {} : s.attributes)} {...(overlay ? {} : s.listeners)} disabled={disabled}>
        <GripVertical className="size-5" />
      </button>
      <span className={cx('grid size-8 shrink-0 place-items-center rounded-[10px] text-[14px] font-extrabold', index === 0 ? 'bg-primary text-on-primary' : 'bg-surface-3 text-fg')}>{fa(index + 1)}</span>
      <span className="flex-1">{label}</span>
      {move && !disabled && (
        <span className="flex">
          <button aria-label={tr("بالاتر")} disabled={index === 0} onClick={() => move(index, index - 1)} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-3 disabled:opacity-25"><ChevronUp className="size-5" /></button>
          <button aria-label={tr("پایین‌تر")} disabled={index === total - 1} onClick={() => move(index, index + 1)} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-3 disabled:opacity-25"><ChevronDown className="size-5" /></button>
        </span>
      )}
    </li>
  );
}

export function PriorityRanker({ block, answer }: { block: any; answer?: any }) {
  const p = block.props as { id: string; question: string; hint?: string; items: { id: string; label: string }[] };
  const profile = useApp((s) => s.profile);
  const initial = answer?.order ?? (profile?.priorities?.length ? [...profile.priorities.filter((x) => p.items.some((i) => i.id === x)), ...p.items.map((i) => i.id).filter((x) => !profile.priorities.includes(x))] : p.items.map((i) => i.id));
  const [order, setOrder] = useState<string[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const done = !!answer;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const label = (id: string) => p.items.find((i) => i.id === id)?.label ?? id;
  const move = (from: number, to: number) => setOrder((o) => arrayMove(o, from, to));
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (e.over && e.active.id !== e.over.id) setOrder((o) => arrayMove(o, o.indexOf(String(e.active.id)), o.indexOf(String(e.over!.id))));
  };
  const send = () => {
    useApp.getState().updateProfile({ priorities: order });
    submit(p.id, { id: p.id, order }, tr("اولویت‌های من به ترتیب اهمیت: {0}", order.map((id, i) => `${i + 1}) ${label(id)}`).join(' ')), tr("اولویت‌هام: {0}…", order.slice(0, 3).map(label).join('، ')));
  };
  return (
    <Card className="p-4 lg:p-5">
      <Head question={p.question} hint={p.hint} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {order.map((id, i) => <RankRow key={id} id={id} label={label(id)} index={i} total={order.length} move={move} disabled={done} />)}
          </ol>
        </SortableContext>
        <DragOverlay>{dragging ? <ul><RankRow id={dragging} label={label(dragging)} index={order.indexOf(dragging)} total={order.length} overlay /></ul> : null}</DragOverlay>
      </DndContext>
      {!done && <SubmitBar label={tr("ثبت اولویت‌ها")} onClick={send} />}
    </Card>
  );
}

// ------------------------------------------------------------------ Location

export function AreaPicker({ onPick, compact }: { onPick: (a: (typeof TEHRAN_AREAS)[number]) => void; compact?: boolean }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => TEHRAN_AREAS.filter((a) => !q || a.name.includes(q.trim())), [q]);
  return (
    <div>
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 focus-within:border-accent">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("جست‌وجوی محله (مثلاً ونک)")} className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ph" />
      </label>
      <div className={cx('thin-scroll mt-3 grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3', compact ? 'max-h-56' : 'max-h-72')}>
        {list.map((a) => (
          <button key={a.name} onClick={() => onPick(a)} className="flex min-h-12 items-center gap-2 rounded-2xl border border-line px-3 text-right text-[14.5px] font-semibold transition-colors duration-500 hover:border-accent hover:bg-accent-soft">
            <MapPin className="size-4 shrink-0 text-muted" />
            <span className="flex-1 truncate">{placeName(a.name)}</span>
            <span className="text-[12px] text-muted">{tr("منطقه")}{' '}{fa(a.district)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function requestGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}

export function LocationRequest({ block, answer }: { block: any; answer?: any }) {
  const p = block.props as { id: string; reason?: string };
  const [state, setState] = useState<'idle' | 'loading' | 'denied'>('idle');
  const done = !!answer;
  const finish = (lat: number, lng: number, areaName: string, source: 'gps' | 'area') => {
    useApp.getState().updateProfile({ lat, lng, areaName, locationSource: source });
    submit(p.id, { status: source === 'gps' ? 'granted' : 'manual', coords: { lat, lng } }, tr("موقعیت من ثبت شد: {0}", areaName), tr("موقعیتم: {0}", areaName));
  };
  const gps = async () => {
    setState('loading');
    try {
      const c = await requestGPS();
      const { area, km } = nearestArea(c.lat, c.lng);
      finish(c.lat, c.lng, km < 4 ? tr("نزدیک {0}", area.name) : tr("موقعیت فعلی"), 'gps');
    } catch { setState('denied'); }
  };
  return (
    <Card className="overflow-hidden p-4 lg:p-5">
      {[12, 34, 58, 80].map((l, i) => <span key={l} className="meteor" style={{ left: `${l}%`, animationDelay: `${i * 0.8}s` }} />)}
      <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full border border-line bg-surface-3 shadow-[0_0_40px_-6px_var(--accent)]" style={{ animation: 'bob 3s ease-in-out infinite' }}>
        <LocateFixed className="size-7 text-accent" />
      </div>
      <h2 className="text-center text-[18px] font-extrabold">{tr("کجا هستی؟")}</h2>
      <p className="mx-auto mt-1 max-w-sm text-center text-[14px] text-muted">{p.reason || tr("تا نزدیک‌ترین فروشگاه‌ها و زمان رسیدن رو دقیق حساب کنم.")}</p>
      {!done && state !== 'denied' && (
        <div className="mt-4 flex flex-col gap-2">
          <Button full size="lg" onClick={gps} disabled={state === 'loading'} icon={<LocateFixed className="size-5" />}>{state === 'loading' ? tr("در حال گرفتن موقعیت…") : tr("استفاده از موقعیت فعلی")}</Button>
          <Button full variant="ghost" onClick={() => setState('denied')}>{tr("انتخاب محله روی فهرست")}</Button>
        </div>
      )}
      {!done && state === 'denied' && (
        <div className="mt-4">
          <p className="mb-2 text-[13.5px] text-muted">{tr("دسترسی به موقعیت داده نشد؛ محله‌ات رو انتخاب کن:")}</p>
          <AreaPicker compact onPick={(a) => finish(a.lat, a.lng, a.name, 'area')} />
        </div>
      )}
    </Card>
  );
}
