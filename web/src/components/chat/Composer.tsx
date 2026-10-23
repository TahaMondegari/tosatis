import { placeName } from '../../lib/iran';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Bike, Bus, CalendarClock, Car, CarTaxiFront, CreditCard, Footprints, Heart, MapPin, Mic, Plus, Square, X } from 'lucide-react';
import { useActiveChat, useApp } from '../../store';
import { sendUser, stopGeneration } from '../../lib/chat';
import type { TravelMode } from '../../lib/types';
import { fa } from '../../lib/format';
import { haptic } from '../LocationPicker';
import { cx } from '../ui';
import { VoiceRecorder, speechSupported } from './VoiceRecorder';
import { t, useLang } from '../../lib/i18n';


import { tr } from '../../lib/i18n';
export const MODES: { id: TravelMode; label: string; icon: typeof Car }[] = [
  { id: 'car', label: tr("خودرو"), icon: Car },
  { id: 'taxi', label: tr("تاکسی"), icon: CarTaxiFront },
  { id: 'transit', label: tr("مترو"), icon: Bus },
  { id: 'motor', label: tr("موتور"), icon: Bike },
  { id: 'walk', label: tr("پیاده"), icon: Footprints },
];

function ToolsMenu({ onClose, onLocation }: { onClose: () => void; onLocation: () => void }) {
  const chat = useActiveChat();
  const profile = useApp((s) => s.profile)!;
  const plan = useApp((s) => s.plan.length);
  const saved = useApp((s) => s.saved.length);
  const { setChatPrefs, set } = useApp.getState();
  const mode = chat?.mode ?? profile.mode;
  const inst = chat?.installmentOnly ?? profile.installmentOnly;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="absolute right-0 bottom-[calc(100%+10px)] z-30 w-[min(340px,calc(100vw-24px))] origin-bottom-right rounded-3xl border border-line bg-surface p-2 shadow-[0_24px_60px_-20px_#000a]"
      role="menu"
    >
      <div className="px-2.5 pt-1.5 pb-1 text-[12.5px] font-bold text-muted">{tr("برای این گفتگو")}</div>
      <div className="grid grid-cols-5 gap-1 px-1">
        {MODES.map((m) => (
          <button key={m.id} role="menuitemradio" aria-checked={mode === m.id} onClick={() => { haptic(); setChatPrefs({ mode: m.id }); }}
            className={cx('flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[11.5px] font-semibold transition-all duration-300', mode === m.id ? 'bg-accent-soft text-fg ring-1 ring-accent' : 'text-muted hover:bg-surface-3')}>
            <m.icon className="size-5" />{m.label}
          </button>
        ))}
      </div>
      <div className="my-1.5 h-px bg-line" />
      <button role="menuitemcheckbox" aria-checked={inst} onClick={() => { haptic(); setChatPrefs({ installmentOnly: !inst }); }} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-right hover:bg-surface-3">
        <CreditCard className="size-5 text-muted" /><span className="flex-1 text-[14.5px] font-semibold">{tr("فقط فروشگاه‌های قسطی")}</span>
        <span className={cx('relative h-6 w-10 rounded-full transition-colors duration-300', inst ? 'bg-accent' : 'bg-surface-3 ring-1 ring-line')}><span className={cx('absolute top-1 size-4 rounded-full bg-white shadow transition-all duration-300', inst ? 'right-5' : 'right-1')} /></span>
      </button>
      <button role="menuitem" onClick={() => { onClose(); onLocation(); }} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-right hover:bg-surface-3">
        <MapPin className="size-5 text-muted" /><span className="flex-1 text-[14.5px] font-semibold">{tr("موقعیت")}</span><span className="truncate text-[13px] text-muted">{placeName(profile.areaName ?? profile.city)}</span>
      </button>
      <button role="menuitem" onClick={() => { onClose(); set({ sheet: { type: 'plan' } }); }} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-right hover:bg-surface-3">
        <CalendarClock className="size-5 text-muted" /><span className="flex-1 text-[14.5px] font-semibold">{tr("برنامه بازدید")}</span>{plan > 0 && <span className="rounded-full bg-accent-soft px-2 text-[12px] text-accent-text">{fa(plan)}</span>}
      </button>
      <button role="menuitem" onClick={() => { onClose(); set({ sheet: { type: 'saved' } }); }} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-right hover:bg-surface-3">
        <Heart className="size-5 text-muted" /><span className="flex-1 text-[14.5px] font-semibold">{tr("ذخیره‌شده‌ها")}</span>{saved > 0 && <span className="rounded-full bg-surface-3 px-2 text-[12px]">{fa(saved)}</span>}
      </button>
    </motion.div>
  );
}

function ActivePills() {
  const chat = useActiveChat();
  const profile = useApp((s) => s.profile);
  const { setChatPrefs } = useApp.getState();
  if (!chat || !profile) return null;
  const pills: { key: string; label: string; icon: typeof Car; clear: () => void }[] = [];
  if (chat.mode && chat.mode !== profile.mode) { const m = MODES.find((x) => x.id === chat.mode)!; pills.push({ key: 'm', label: m.label, icon: m.icon, clear: () => setChatPrefs({ mode: undefined }) }); }
  if (chat.installmentOnly != null && chat.installmentOnly !== profile.installmentOnly) pills.push({ key: 'i', label: chat.installmentOnly ? tr("فقط قسطی") : tr("همه فروشگاه‌ها"), icon: CreditCard, clear: () => setChatPrefs({ installmentOnly: undefined }) });
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-2 pt-2">
      <AnimatePresence initial={false}>
        {pills.map((p) => (
          <motion.span key={p.key} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft pr-2.5 pl-1 text-[13px] font-semibold text-accent-text">
            <p.icon className="size-4" />{p.label}
            <button aria-label={tr("حذف {0}", p.label)} onClick={() => { haptic(); p.clear(); }} className="grid size-6 place-items-center rounded-full hover:bg-black/10"><X className="size-3.5" /></button>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Composer({ onLocation }: { onLocation: () => void }) {
  const busy = useApp((s) => s.busy);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [recording, setRecording] = useState(false);
  useLang();
  const PLACEHOLDERS = t('placeholders');
  const [ph, setPh] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);
  useEffect(() => { const t = setInterval(() => setPh((x) => (x + 1) % PLACEHOLDERS.length), 3200); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!menu) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [menu]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    haptic(10);
    setText('');
    void sendUser(t);
    if (window.matchMedia('(pointer: coarse)').matches) ref.current?.blur();
  };

  const canSend = !!text.trim();
  return (
    <div ref={box} className="relative">
      <AnimatePresence>{menu && <ToolsMenu onClose={() => setMenu(false)} onLocation={onLocation} />}</AnimatePresence>
      <div className="rounded-[26px] border border-line bg-surface shadow-[0_10px_40px_-18px_#0008] transition-[border-color,box-shadow] duration-300 focus-within:border-line-strong">
        <ActivePills />
        {recording ? (
          <VoiceRecorder onCancel={() => setRecording(false)} onDone={(v) => { setRecording(false); if (v) { setText((x) => (x ? `${x} ${v}` : v)); setTimeout(() => ref.current?.focus(), 50); } }} />
        ) : (
        <div className="flex items-end gap-1 p-1.5">
          <button aria-label={tr("گزینه‌ها")} aria-expanded={menu} onClick={() => { haptic(); setMenu(!menu); }} className={cx('grid size-11 shrink-0 place-items-center rounded-full transition-all duration-300', menu ? 'rotate-45 bg-surface-3 text-fg' : 'text-muted hover:bg-surface-3 hover:text-fg')}>
            <Plus className="size-[22px]" />
          </button>
          <div className="relative min-h-11 flex-1">
            <textarea
              ref={ref} rows={1} value={text} aria-label={tr("پیام شما")} enterKeyHint="send"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); submit(); } }}
              className="block max-h-[132px] min-h-11 w-full resize-none bg-transparent px-1.5 py-[10px] text-[16px] leading-6 outline-none"
            />
            {!text && (
              <AnimatePresence mode="wait">
                <motion.span key={ph} aria-hidden initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} className="pointer-events-none absolute inset-x-1.5 top-[10px] truncate text-[16px] leading-6 text-ph">
                  {PLACEHOLDERS[ph]}
                </motion.span>
              </AnimatePresence>
            )}
          </div>
          {speechSupported() && !busy && (
            <button aria-label={t('voice')} onClick={() => { haptic(); setRecording(true); }} className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors duration-300 hover:bg-surface-3 hover:text-fg">
              <Mic className="size-5" />
            </button>
          )}
          {busy ? (
            <button aria-label={tr("توقف")} onClick={stopGeneration} className="grid size-11 shrink-0 place-items-center rounded-full bg-fg text-bg"><Square className="size-4" fill="currentColor" /></button>
          ) : (
            <motion.button aria-label={tr("ارسال")} onClick={submit} disabled={!canSend} animate={{ scale: canSend ? 1 : 0.9, opacity: canSend ? 1 : 0.35 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </motion.button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
