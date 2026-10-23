import { placeName } from '../lib/iran';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, Heart, MessageSquareHeart, PanelRight, Search, Settings, SquarePen, Trash2, X } from 'lucide-react';
import { useApp } from '../store';
import { fa } from '../lib/format';
import { haptic } from './LocationPicker';
import { IconButton, Logo, Wordmark, cx } from './ui';

import { tr } from '../lib/i18n';
const DAY = 86_400_000;
function groupLabel(at: number) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t = start.getTime();
  if (at >= t) return tr("امروز");
  if (at >= t - DAY) return tr("دیروز");
  if (at >= t - 7 * DAY) return tr("۷ روز گذشته");
  return tr("قبل‌تر");
}

function Nav({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const chats = useApp((s) => s.chats);
  const active = useApp((s) => s.activeChatId);
  const plan = useApp((s) => s.plan.length);
  const saved = useApp((s) => s.saved.length);
  const profile = useApp((s) => s.profile);
  const toRate = useApp((s) => s.purchases.find((p) => p.status === 'pending' || p.status === 'asked'));
  const { newChat, openChat, deleteChat, set } = useApp.getState();
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const groups = useMemo(() => {
    const list = chats.filter((c) => c.messages.length && (!q.trim() || c.title.includes(q.trim())));
    const out: { label: string; items: typeof list }[] = [];
    for (const c of list) {
      const label = groupLabel(c.at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(c); else out.push({ label, items: [c] });
    }
    return out;
  }, [chats, q]);

  const go = (fn: () => void) => () => { haptic(); fn(); };
  const row = 'group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold transition-colors duration-300';
  const shortcuts = [
    { key: 'plan', icon: CalendarClock, label: tr("برنامه بازدید"), count: plan, onClick: () => set({ sheet: { type: 'plan' }, drawerOpen: false }) },
    { key: 'saved', icon: Heart, label: tr("ذخیره‌شده‌ها"), count: saved, onClick: () => set({ sheet: { type: 'saved' }, drawerOpen: false }) },
  ];
  let idx = 0;

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className={cx('flex items-center gap-2 pb-3', collapsed ? 'flex-col' : 'px-1')}>
        <Logo className="size-8" />
        {!collapsed && <Wordmark height={24} />}
        {onClose ? (
          <IconButton label={tr("بستن منو")} className="mr-auto" onClick={go(onClose)}><X className="size-5" /></IconButton>
        ) : (
          <IconButton label={collapsed ? tr("باز کردن منو") : tr("جمع کردن منو")} className={cx(!collapsed && 'mr-auto')} onClick={go(() => set({ sidebarCollapsed: !collapsed }))}>
            <PanelRight className={cx('size-5 transition-transform duration-500', collapsed && '-scale-x-100')} />
          </IconButton>
        )}
      </div>

      {/* new chat */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={go(() => newChat())} aria-label={tr("گفتگوی جدید")}
        className={cx('flex min-h-11 items-center gap-2.5 rounded-xl font-bold transition-colors duration-300', collapsed ? 'mx-auto size-11 justify-center bg-surface-3 hover:bg-line' : 'bg-surface-3 px-3 hover:bg-line')}>
        <SquarePen className="size-[18px]" />{!collapsed && <span className="flex-1 text-right text-[14.5px]">{tr("گفتگوی جدید")}</span>}
        {!collapsed && <span className="hidden text-[11px] font-semibold text-muted md:inline">Ctrl+K</span>}
      </motion.button>

      {/* search */}
      {!collapsed && (
        <label className="mt-2 flex h-10 items-center gap-2 rounded-xl px-3 text-muted ring-1 ring-line ring-inset transition-shadow focus-within:ring-accent">
          <Search className="size-4 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("جست‌وجو در گفتگوها")} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-ph" />
          {q && <button aria-label={tr("پاک کردن")} onClick={() => setQ('')} className="grid size-6 place-items-center rounded-full hover:bg-surface-3"><X className="size-3.5" /></button>}
        </label>
      )}

      {/* shortcuts */}
      <div className="mt-3 flex flex-col gap-0.5">
        {shortcuts.map((s) => (
          <motion.button key={s.key} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * idx++ }} whileTap={{ scale: 0.98 }}
            onClick={go(s.onClick)} title={s.label} className={cx(row, 'text-fg-2 hover:bg-surface-3', collapsed && 'justify-center px-0')}>
            <s.icon className="size-[18px] shrink-0 text-muted" />
            {!collapsed && <span className="flex-1 text-right">{s.label}</span>}
            {s.count > 0 && <span className={cx('grid min-w-5 place-items-center rounded-full bg-accent-soft px-1.5 text-[11.5px] font-bold text-accent-text', collapsed && 'absolute top-1 left-1 h-4 min-w-4 px-1 text-[10px]')}>{fa(s.count)}</span>}
          </motion.button>
        ))}
        {toRate && (
          <motion.button initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={go(() => set({ sheet: { type: 'feedback', id: toRate.id }, drawerOpen: false }))} title={tr("ثبت تجربه خرید")}
            className={cx(row, 'bg-accent-soft text-accent-text', collapsed && 'justify-center px-0')}>
            <MessageSquareHeart className="size-[18px] shrink-0" />
            {!collapsed && <span className="min-w-0 flex-1 truncate text-right">{tr("خریدت از")}{' '}{toRate.shopName} {' '}{tr("چطور بود؟")}</span>}
          </motion.button>
        )}
      </div>

      {/* history */}
      <div className="thin-scroll -mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
        {!collapsed && !groups.length && (
          <p className="px-3 pt-4 text-center text-[13px] leading-6 text-muted">{q ? tr("گفتگویی با این عنوان پیدا نشد.") : tr("گفتگوهات اینجا نگه داشته می‌شن.")}</p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-2">
            {!collapsed && <div className="sticky top-0 z-10 bg-inherit px-3 pt-2 pb-1 text-[12px] font-bold text-muted backdrop-blur">{g.label}</div>}
            {g.items.map((c) => {
              const on = c.id === active;
              return (
                <motion.div key={c.id} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(0.03 * idx++, 0.3) }} className="relative">
                  {on && <motion.span layoutId={collapsed ? 'active-c' : 'active'} className="absolute inset-0 rounded-xl bg-surface-3" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <div className={cx(row, 'pl-1', !on && 'hover:bg-surface-3/60', collapsed && 'justify-center px-0')}>
                    {on && !collapsed && <span className="absolute top-2.5 right-0 bottom-2.5 w-[3px] rounded-full bg-accent" />}
                    <button onClick={go(() => openChat(c.id))} title={c.title} className={cx('relative min-w-0 flex-1 truncate text-right', on ? 'text-fg' : 'text-fg-2', collapsed && 'flex-none')}>
                      {collapsed ? <span className="grid size-9 place-items-center rounded-lg text-[13px] font-extrabold">{c.title.slice(0, 1)}</span> : c.title}
                    </button>
                    {!collapsed && (
                      confirm === c.id ? (
                        <span className="relative flex items-center gap-1">
                          <button onClick={go(() => { deleteChat(c.id); setConfirm(null); })} className="h-8 rounded-lg bg-bad-soft px-2 text-[12px] font-bold text-bad">{tr("حذف")}</button>
                          <button onClick={() => setConfirm(null)} className="h-8 rounded-lg px-2 text-[12px] text-muted hover:bg-surface-3">{tr("نه")}</button>
                        </span>
                      ) : (
                        <button aria-label={tr("حذف گفتگو")} onClick={() => setConfirm(c.id)} className="relative grid size-8 place-items-center rounded-lg text-muted opacity-100 transition-opacity hover:bg-surface-3 hover:text-bad md:opacity-0 md:group-hover:opacity-100"><Trash2 className="size-4" /></button>
                      )
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* profile card → settings */}
      <motion.button whileTap={{ scale: 0.98 }} onClick={go(() => set({ sheet: { type: 'settings' }, drawerOpen: false }))} title={tr("تنظیمات")}
        className={cx('mt-2 flex items-center gap-3 rounded-2xl p-2 text-right transition-colors duration-300 hover:bg-surface-3', collapsed ? 'justify-center' : 'ring-1 ring-line')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[15px] font-extrabold text-on-primary">{profile?.name?.trim()?.[0] ?? <Settings className="size-4" />}</span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{profile?.name || tr("پروفایل من")}</span>
              <span className="block truncate text-[12px] text-muted">{placeName(profile?.city)}{profile?.areaName ? ` · ${placeName(profile.areaName)}` : ''} {' '}{tr("· تنظیمات و تم")}</span>
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-fg-2" aria-hidden><Settings className="size-[18px]" /></span>
          </>
        )}
      </motion.button>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useApp((s) => s.sidebarCollapsed);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); useApp.getState().newChat(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <aside className={cx('relative z-20 hidden h-full shrink-0 overflow-hidden border-l border-line bg-surface-2/70 py-4 whitespace-nowrap backdrop-blur-xl transition-[width,padding] duration-500 ease-out-soft md:block', collapsed ? 'w-[72px] px-2.5' : 'w-[72px] px-2.5 lg:w-[280px] lg:px-3')}>
      <div className="hidden h-full lg:block"><Nav collapsed={collapsed} /></div>
      <div className="h-full lg:hidden"><Nav collapsed /></div>
    </aside>
  );
}

/** Mobile drawer: slides from the right, swipe right (or tap outside) to close. */
export function Drawer() {
  const open = useApp((s) => s.drawerOpen);
  const set = useApp((s) => s.set);
  const close = () => set({ drawerOpen: false });
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.nav aria-label={tr("منو")} className="safe-top safe-bottom absolute top-0 right-0 bottom-0 w-[84vw] max-w-[330px] rounded-l-[28px] border-l border-line bg-bg px-3 pt-3 shadow-[0_0_60px_-10px_#000a]"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.5 }}
            onDragEnd={(_, i) => { if (i.offset.x > 80 || i.velocity.x > 500) close(); }}>
            <Nav collapsed={false} onClose={close} />
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}
