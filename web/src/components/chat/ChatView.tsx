import { placeName } from '../../lib/iran';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, CreditCard, MapPin, Bike, Bus, Car, CarTaxiFront, ChevronDown, Footprints, Gift, RotateCcw, SquarePen, Smartphone, Tag, Footprints as Shoe } from 'lucide-react';
import { useActiveChat, useApp } from '../../store';
import { retryLast, sendUser } from '../../lib/chat';
import type { Message, TravelMode } from '../../lib/types';
import { renderAgentComponent } from '../blocks/registry';
import { Markdown } from './Markdown';
import { Composer, MODES } from './Composer';
import { LocationPicker, haptic } from '../LocationPicker';
import { FeedbackBanner } from '../Feedback';
import { Logo, TypingDots, Wordmark, cx } from '../ui';
import { t, useLang } from '../../lib/i18n';

import { tr } from '../../lib/i18n';
export const MODE_ICON: Record<TravelMode, any> = { car: Car, taxi: CarTaxiFront, transit: Bus, motor: Bike, walk: Footprints };
export const MODE_FA: Record<TravelMode, string> = { car: tr("خودرو"), taxi: tr("تاکسی"), transit: tr("مترو/اتوبوس"), motor: tr("موتور"), walk: tr("پیاده") };

function MessageView({ m, latest }: { m: Message; latest: boolean }) {
  if (m.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className="flex justify-start">
        <div className="max-w-[82%] rounded-[22px] rounded-br-[8px] bg-[var(--user-bubble)] px-4 py-2 text-[15.5px] leading-7 ring-1 ring-line lg:max-w-[70%]">
          {m.parts.map((p, i) => (p.kind === 'text' ? <span key={i} className="whitespace-pre-wrap">{p.text}</span> : null))}
        </div>
      </motion.div>
    );
  }
  const streaming = m.status === 'streaming';
  return (
    <div className="flex gap-2.5">
      <Logo className="mt-1 hidden size-7 sm:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {m.parts.map((p, i) =>
          p.kind === 'text' ? (
            <div key={i} className="max-w-[680px] text-[16px] leading-[1.95] lg:text-[16.5px]"><Markdown text={p.text} animate={streaming || Date.now() - m.at < 4000} /></div>
          ) : (
            <motion.div key={p.block.id} className="min-w-0" initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
              {renderAgentComponent(p.block, p.answer, latest)}
            </motion.div>
          ),
        )}
        {streaming && (
          <div className="flex min-h-7 items-center gap-2.5 text-[13.5px] text-muted" aria-live="polite">
            <TypingDots />
            <AnimatePresence mode="wait">{m.statusText && <motion.span key={m.statusText} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="shimmer-text">{m.statusText}</motion.span>}</AnimatePresence>
          </div>
        )}
        {m.status === 'error' && latest && (
          <button onClick={retryLast} className="flex min-h-10 w-fit items-center gap-2 rounded-full px-4 text-[14px] font-semibold text-fg-2 ring-1 ring-line hover:bg-surface-3"><RotateCcw className="size-4" />{tr("دوباره امتحان کن")}</button>
        )}
      </div>
    </div>
  );
}

const STARTERS = [
  { icon: Shoe, title: tr("کتونی برای پیاده‌روی"), text: tr("یه کتونی راحت برای پیاده‌روی می‌خوام ولی نمی‌دونم چه مدلی") },
  { icon: Smartphone, title: tr("گوشی قسطی"), text: tr("یه گوشی خوب می‌خوام که بشه قسطی خرید") },
  { icon: Tag, title: tr("ارزون‌تر پیدا کن"), text: tr("هدفون ایرپاد پرو ۲ رو ۹ میلیون دیدم، نزدیک من ارزون‌تر هست؟") },
  { icon: Gift, title: tr("ایده هدیه"), text: tr("برای تولد مادرم یه هدیه تا ۵ میلیون می‌خوام، چی پیشنهاد می‌دی؟") },
];

function Welcome() {
  const profile = useApp((s) => s.profile);
  const h = new Date().getHours();
  useLang();
  const greet = h < 5 ? t('greetNight') : h < 12 ? t('greetMorning') : h < 17 ? t('greetDay') : h < 21 ? t('greetEvening') : t('greetNight');
  return (
    <div className="mx-auto flex h-full w-full max-w-[680px] flex-col justify-center px-1">
      <FeedbackBanner />
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-[24px] leading-[1.5] font-extrabold sm:text-[28px]">{greet}{profile?.name ? tr("، {0}", profile.name) : ''}</motion.h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-1 text-[15.5px] leading-7 text-muted">{t('welcomeSub')}</motion.p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {STARTERS.map((s, i) => ({ ...s, title: t('starters')[i][0], text: t('starters')[i][1] })).map((s, i) => (
          <motion.button key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.05, ease: [0.22, 1, 0.36, 1], duration: 0.5 }} whileTap={{ scale: 0.97 }}
            onClick={() => { haptic(); void sendUser(s.text); }}
            className="group flex min-h-[60px] items-center gap-2.5 rounded-2xl border border-line bg-surface/60 px-3 text-right transition-colors duration-300 hover:border-line-strong hover:bg-surface">
            <s.icon className="size-5 shrink-0 text-muted transition-colors duration-300 group-hover:text-accent" />
            <span className="text-[14px] leading-6 font-semibold">{s.title}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** One-tap travel-mode suggestion once stores are on screen and this chat has no mode yet. */
function ModeNudge() {
  const chat = useActiveChat();
  const [hidden, setHidden] = useState(false);
  const show = !!chat && !chat.mode && !hidden && chat.messages.some((m) => m.parts.some((p) => p.kind === 'ui' && (p.block.component === 'stores' || p.block.component === 'storeCompare')));
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 6, height: 0 }} className="overflow-hidden">
          <div className="mb-2 flex items-center gap-1.5 rounded-2xl bg-surface-2 p-1.5 pr-3 ring-1 ring-line">
            <span className="shrink-0 text-[13px] font-semibold text-fg-2">{tr("با چی می‌ری؟")}</span>
            <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => { haptic(); useApp.getState().setChatPrefs({ mode: m.id }); useApp.getState().showToast(tr("زمان رسیدن {0} حساب می‌شه", m.label === 'مترو' ? tr("با مترو") : tr("با {0}", m.label))); }} className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-muted hover:bg-surface-3 hover:text-fg">
                  <m.icon className="size-4" />{m.label}
                </button>
              ))}
            </div>
            <button aria-label={tr("بستن")} onClick={() => setHidden(true)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-3">×</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** First-screen quick settings (location · travel mode · installment). Later the + menu takes over. */
function WelcomeChips({ onLocation }: { onLocation: () => void }) {
  const profile = useApp((s) => s.profile);
  const chat = useActiveChat();
  const { setChatPrefs } = useApp.getState();
  const [modeOpen, setModeOpen] = useState(false);
  if (!profile) return null;
  const mode = chat?.mode ?? profile.mode;
  const inst = chat?.installmentOnly ?? profile.installmentOnly;
  const M = MODES.find((m) => m.id === mode)!;
  const chip = 'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-all duration-300 active:scale-95';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-2">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        <button onClick={() => { haptic(); onLocation(); }} className={cx(chip, 'border-line text-fg-2 hover:bg-surface-3')}><MapPin className="size-4 text-accent" />{placeName(profile.areaName ?? profile.city)}</button>
        <button onClick={() => { haptic(); setModeOpen(!modeOpen); }} aria-expanded={modeOpen} className={cx(chip, modeOpen ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-2 hover:bg-surface-3')}><M.icon className="size-4" />{M.label}<ChevronDown className={cx('size-3.5 transition-transform', modeOpen && 'rotate-180')} /></button>
        <button aria-pressed={inst} onClick={() => { haptic(); setChatPrefs({ installmentOnly: !inst }); }} className={cx(chip, inst ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-2 hover:bg-surface-3')}><CreditCard className="size-4" />{t('installment')}</button>
      </div>
      <AnimatePresence>
        {modeOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-1.5 flex gap-1.5">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => { haptic(); setChatPrefs({ mode: m.id }); setModeOpen(false); }} className={cx('flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11.5px] font-semibold transition-all duration-300', mode === m.id ? 'bg-accent-soft text-fg ring-1 ring-accent' : 'bg-surface-2 text-muted ring-1 ring-line')}>
                  <m.icon className="size-[18px]" />{m.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 8h16M4 16h10" /></svg>
  );
}

export function ChatView() {
  const chat = useActiveChat();
  const busy = useApp((s) => s.busy);
  const profile = useApp((s) => s.profile);
  const { set, newChat, updateProfile, showToast } = useApp.getState();
  const [picker, setPicker] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const msgs = chat?.messages ?? [];
  const lastLen = JSON.stringify(msgs[msgs.length - 1]?.parts ?? []).length;

  const prevLen = useRef(msgs.length);
  useLayoutEffect(() => {
    const el = scroller.current;
    const added = msgs.length > prevLen.current;
    prevLen.current = msgs.length;
    if (el && msgs.length && (atBottom || added)) el.scrollTo({ top: el.scrollHeight, behavior: msgs.length < 2 ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length, lastLen]);

  // Deep link: /?q=… starts a conversation from anywhere (share links, home-screen shortcuts)
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q');
    if (q) { history.replaceState(null, '', location.pathname); newChat(); void sendUser(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = scroller.current!;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };
  const empty = msgs.length === 0;

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-clip">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-70" />
      <header className="safe-top relative z-20 shrink-0">
        <div className="flex h-14 items-center gap-1 px-2 lg:h-16 lg:px-6">
          <button aria-label={tr("منو")} onClick={() => { haptic(); set({ drawerOpen: true }); }} className="grid size-11 place-items-center rounded-full text-fg transition-colors hover:bg-surface-3 active:bg-surface-3 md:hidden"><MenuIcon /></button>
          <div className="flex min-w-0 flex-1 flex-col items-center md:items-start">
            <span className="flex items-center gap-1.5 text-[16px] font-extrabold">
              {empty ? <><Wordmark height={22} className="my-0.5 md:hidden" /><span className="hidden md:inline">{tr("مشاور خرید حضوری")}</span></> : <span className="max-w-[56vw] truncate">{chat?.title}</span>}
              {busy && <span className="size-1.5 animate-pulse rounded-full bg-accent" />}
            </span>
            <button onClick={() => { haptic(); setPicker(true); }} className="-mt-0.5 flex items-center gap-0.5 rounded-full px-2 text-[12.5px] font-semibold text-muted transition-colors hover:text-fg">
              {placeName(profile?.city ?? 'تهران')}{profile?.areaName ? ` · ${placeName(profile.areaName)}` : ''}<ChevronDown className="size-3.5" />
            </button>
          </div>
          <button aria-label={tr("گفتگوی جدید")} onClick={() => { haptic(); newChat(); }} className="grid size-11 place-items-center rounded-full text-fg transition-colors hover:bg-surface-3 active:bg-surface-3"><SquarePen className="size-[21px]" /></button>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-full h-5 bg-gradient-to-b from-bg to-transparent" />
      </header>

      <div ref={scroller} onScroll={onScroll} className={cx('relative z-[1] min-h-0 flex-1 overscroll-contain px-4 lg:px-10', empty ? 'overflow-hidden' : 'thin-scroll overflow-y-auto overflow-x-hidden')}>
        {empty ? <Welcome /> : (
          <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 pt-4 pb-6">
            {msgs.map((m, i) => <MessageView key={m.id} m={m} latest={i === msgs.length - 1} />)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {!atBottom && !empty && (
          <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} aria-label={tr("رفتن به آخرین پیام")} onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })} className="absolute bottom-28 left-1/2 z-20 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-line bg-surface shadow-lg">
            <ArrowDown className="size-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="safe-bottom relative z-10 shrink-0 px-3 pt-1 lg:px-10 lg:pb-5">
        <div className="pointer-events-none absolute inset-x-0 bottom-full h-6 bg-gradient-to-t from-bg to-transparent" />
        <div className="mx-auto w-full max-w-[860px]">
          {empty ? <WelcomeChips onLocation={() => setPicker(true)} /> : <ModeNudge />}
          <Composer onLocation={() => setPicker(true)} />
          <p className="mt-1.5 hidden text-center text-[11.5px] text-muted sm:block">{t('disclaimer')}</p>
        </div>
      </div>

      <LocationPicker open={picker} onClose={() => setPicker(false)} current={{ city: profile?.city, areaName: profile?.areaName }}
        onPick={(l) => { updateProfile({ city: l.city, province: l.province, areaName: l.areaName, lat: l.lat, lng: l.lng, locationSource: l.source }); showToast(tr("موقعیت: {0}{1}", l.city, l.areaName ? ` · ${l.areaName}` : '')); }} />
    </div>
  );
}
