import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type PointerEvent as RPointerEvent, type HTMLAttributes } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { createPortal } from 'react-dom';
import { BRAND } from '../brand';
import { Clock, X, Image as ImageIcon, BadgeCheck, CircleHelp, CircleAlert } from 'lucide-react';
import type { Freshness, OpenState } from '../lib/types';

import { tr, locale } from '../lib/i18n';
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; full?: boolean };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'primary', size = 'md', icon, full, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[transform,background,box-shadow,opacity,color] duration-500 ease-out-soft active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none',
        size === 'sm' && 'min-h-11 px-4 text-[14px]',
        size === 'md' && 'min-h-12 px-5 text-[15px]',
        size === 'lg' && 'min-h-[52px] px-6 text-[16px]',
        variant === 'primary' && 'bg-primary text-on-primary shadow-[var(--primary-shadow)] hover:-translate-y-0.5',
        variant === 'ghost' && 'bg-transparent text-fg ring-1 ring-inset ring-line hover:bg-surface-3',
        variant === 'soft' && 'bg-surface-3 text-fg hover:bg-line',
        variant === 'danger' && 'bg-bad-soft text-bad ring-1 ring-inset ring-bad/30',
        full && 'w-full',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} {...rest} className={cx('grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-colors duration-500 hover:bg-surface-3 hover:text-fg active:bg-surface-3', className)}>
      {children}
    </button>
  );
}

export function Chip({ active, className, children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      aria-pressed={active}
      {...rest}
      onClick={(e) => { try { navigator.vibrate?.(6); } catch { /* noop */ } onClick?.(e); }}
      className={cx(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-all duration-300 ease-out-soft active:scale-[.93]',
        active ? 'scale-[1.03] border-accent bg-accent-soft text-fg shadow-[0_0_22px_-10px_var(--accent)]' : 'border-line text-fg-2 hover:border-line-strong hover:bg-surface-3',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Card with pointer-following spotlight. */
export function Card({ className, children, onPointerMove, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    onPointerMove?.(e);
  };
  return (
    <div {...rest} onPointerMove={move} className={cx('card', className)}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'accent'; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold leading-6 whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-3 text-fg-2',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'accent' && 'bg-accent-soft text-accent-text',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function OpenBadge({ open }: { open: OpenState }) {
  const tone = open.state === 'open' ? (open.closingSoon ? 'warn' : 'ok') : open.state === 'closed' ? 'bad' : open.state === 'open_unknown_hours' ? 'ok' : 'neutral';
  return (
    <Badge tone={tone} icon={<Clock className="size-3.5" strokeWidth={2} />}>
      {open.state === 'open' && !open.closingSoon ? open.label.replace('باز تا', 'باز تا') : open.label}
    </Badge>
  );
}

export function FreshBadge({ f }: { f: Freshness | null | undefined }) {
  if (!f) return null;
  const tone = f.level === 'fresh' ? 'ok' : f.level === 'ok' ? 'neutral' : 'warn';
  return <Badge tone={tone}>{f.label}</Badge>;
}

export function StockBadge({ status, at }: { status?: string; at?: number }) {
  if (status === 'available') return <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>{tr("موجودی تأییدشده")}{at ? ` · ${new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(at)}` : ''}</Badge>;
  if (status === 'unavailable') return <Badge tone="bad" icon={<CircleAlert className="size-3.5" />}>{tr("فروشنده: ناموجود")}</Badge>;
  if (status === 'no_answer') return <Badge tone="warn" icon={<CircleAlert className="size-3.5" />}>{tr("جواب نداد")}</Badge>;
  if (status === 'closed') return <Badge tone="bad" icon={<CircleAlert className="size-3.5" />}>{tr("بسته بود")}</Badge>;
  return <Badge icon={<CircleHelp className="size-3.5" />}>{tr("موجودی تأیید نشده")}</Badge>;
}

export function ProductImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cx('relative grid place-items-center overflow-hidden rounded-2xl border border-line bg-white', className)}>
      {src && !err ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => setErr(true)} className={cx('h-full w-full object-contain p-2 transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-surface-2 text-muted"><ImageIcon className="size-8" strokeWidth={1.5} /></div>
      )}
      {src && !err && !loaded && <div className="skeleton absolute inset-0 rounded-none" />}
    </div>
  );
}

/** Square brand mark (see src/brand.ts to replace). */
export function Logo({ className }: { className?: string }) {
  return <img src={BRAND.mark} alt="" aria-hidden draggable={false} className={cx('shrink-0 object-contain', className ?? 'size-9')} />;
}

/** Wordmark: coloured part as-is + dark part painted with the theme text colour (light in dark mode). */
export function Wordmark({ height = 28, className }: { height?: number; className?: string }) {
  const w = Math.round(height * BRAND.wordmarkRatio);
  return (
    <span role="img" aria-label={BRAND.name} className={cx('relative inline-block shrink-0 align-middle', className)} style={{ width: w, height }}>
      {BRAND.wordmarkInk && (
        <span aria-hidden className="absolute inset-0 bg-fg" style={{ WebkitMaskImage: `url(${BRAND.wordmarkInk})`, maskImage: `url(${BRAND.wordmarkInk})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }} />
      )}
      <img src={BRAND.wordmarkRed} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full" />
    </span>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={tr("در حال نوشتن")}>
      <span className="typing-dot" />
      <span className="typing-dot" style={{ animationDelay: '.15s' }} />
      <span className="typing-dot" style={{ animationDelay: '.3s' }} />
    </span>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-1 text-right">
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-500', checked ? 'bg-accent' : 'bg-surface-3 ring-1 ring-inset ring-line')}>
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-all duration-500 ease-out-soft', checked ? 'right-6' : 'right-1')} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx('flex gap-1 rounded-2xl bg-surface-3 p-1', className)}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={cx('flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold whitespace-nowrap transition-all duration-500 ease-out-soft', value === o.id ? 'bg-surface text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/** Bottom sheet on mobile (drag to dismiss), side panel on desktop. */
export function Sheet({ open, onClose, title, children, footer, wide, tall }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; tall?: boolean }) {
  const controls = useDragControls();
  const [desktop, setDesktop] = useState(isDesktop());
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const fn = () => setDesktop(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => panel.current?.focus(), 50);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} onClick={onClose} />
          <motion.div
            ref={panel}
            tabIndex={-1}
            className={cx(
              'absolute flex flex-col bg-bg outline-none',
              desktop ? cx('top-0 bottom-0 left-0 border-r border-line', wide ? 'w-[560px]' : 'w-[460px]') : cx('inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px] border-t border-line', tall && 'h-[80dvh]'),
            )}
            initial={desktop ? { x: '-100%' } : { y: '100%' }}
            animate={desktop ? { x: 0 } : { y: 0 }}
            exit={desktop ? { x: '-100%' } : { y: '100%' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.55 }}
            drag={desktop ? false : 'y'}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
          >
            {!desktop && (
              <div className="flex cursor-grab touch-none justify-center pt-3 pb-1" onPointerDown={(e) => controls.start(e)}>
                <span className="h-1.5 w-11 rounded-full bg-line-strong" />
              </div>
            )}
            <div className="flex items-center gap-2 px-4 pt-1 pb-2 lg:pt-4" onPointerDown={(e) => !desktop && controls.start(e)}>
              <div className="min-w-0 flex-1 text-[17px] font-extrabold">{title}</div>
              <IconButton label={tr("بستن")} onClick={onClose}><X className="size-5" /></IconButton>
            </div>
            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
            {footer && <div className="safe-bottom border-t border-line bg-elev px-4 pt-3 backdrop-blur-xl">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-7', className)}>
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <h3 className="flex-1 text-[13.5px] font-bold text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
