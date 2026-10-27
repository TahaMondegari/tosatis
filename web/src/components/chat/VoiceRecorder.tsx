import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, MicOff, X } from 'lucide-react';
import { useApp } from '../../store';
import { t } from '../../lib/i18n';

import { tr, locale } from '../../lib/i18n';
const BARS = 29; // odd → a centre bar; the wave is mirrored around it
const SILENCE_MS = 2600; // auto-finish after this much quiet once something was said
export const speechSupported = () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

/** Light clean-up of dictated Persian/English: fillers, repeated words, spacing. */
function tidy(s: string) {
  return s
    // \b is ASCII-only, so use whitespace boundaries for Persian
    .replace(/(^|\s)(اِ*م{2,}|ا+م+|اه+|uh+|um+|erm)(?=\s|$)/gi, ' ')
    .replace(/(^|\s)(\S+)(\s+\2)+(?=\s|$)/g, '$1$2')
    .replace(/\s+([،,.?؟!])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * ChatGPT-style dictation: the composer becomes a live, centre-mirrored waveform with Cancel / Done.
 * Keeps listening through short pauses; auto-finishes after a longer silence (countdown ring on Done).
 */
export function VoiceRecorder({ onCancel, onDone }: { onCancel: () => void; onDone: (text: string) => void }) {
  const lang = useApp((s) => s.lang);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [text, setText] = useState('');
  const [secs, setSecs] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [quiet, setQuiet] = useState(0); // 0..1 progress toward auto-finish
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef('');
  const textRef = useRef('');
  const active = useRef(true);
  const recRef = useRef<any>(null);
  const lastVoice = useRef(Date.now());
  const cleanup = useRef<() => void>(() => {});
  const done = useRef(false);

  const finish = (ok: boolean) => {
    if (done.current) return;
    done.current = true;
    cleanup.current();
    try { navigator.vibrate?.(ok ? 14 : 6); } catch { /* noop */ }
    if (ok) onDone(tidy(textRef.current)); else onCancel();
  };

  useEffect(() => {
    active.current = true;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const start = () => {
      const r = new SR();
      r.lang = lang === 'en' ? 'en-US' : locale();
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const tr = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalRef.current = `${finalRef.current} ${tr}`.trim();
          else interim += tr;
        }
        textRef.current = `${finalRef.current} ${interim}`.trim();
        setText(textRef.current);
        lastVoice.current = Date.now();
      };
      r.onend = () => { if (active.current) { try { start(); } catch { /* ignore */ } } }; // survive pauses
      r.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { active.current = false; setError(lang === 'en' ? 'Microphone access is blocked — allow it in the browser settings.' : tr("دسترسی میکروفون بسته است؛ از تنظیمات مرورگر اجازه بده.")); }
        if (e.error === 'network') setError(lang === 'en' ? 'Speech service is unreachable right now.' : tr("سرویس تبدیل صدا الان در دسترس نیست."));
      };
      recRef.current = r;
      r.start();
    };
    try { start(); } catch { /* ignore */ }

    let raf = 0, stream: MediaStream | null = null, ctx: AudioContext | null = null;
    navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((s) => {
      stream = s;
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(s).connect(an);
      const freq = new Uint8Array(an.frequencyBinCount);
      let last = 0;
      const half = Math.ceil(BARS / 2);
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - last < 50) return;
        last = now;
        an.getByteFrequencyData(freq);
        // Voice band (~80Hz–4kHz) → half the bars, then mirror around the centre
        const band = freq.slice(2, 96);
        const step = band.length / half;
        const halfLv = Array.from({ length: half }, (_, i) => {
          let m = 0;
          for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step); j++) m = Math.max(m, band[j]);
          return Math.min(1, (m / 255) ** 1.6 * 1.4);
        });
        const lv = [...halfLv.slice(1).reverse(), ...halfLv];
        const loud = lv.reduce((a, b) => a + b, 0) / lv.length;
        const isVoice = loud > 0.06;
        if (isVoice) lastVoice.current = Date.now();
        setSpeaking(isVoice);
        setLevels(lv);
      };
      raf = requestAnimationFrame(tick);
    }).catch(() => setError((e) => e ?? (lang === 'en' ? 'Microphone access is blocked — allow it in the browser settings.' : tr("دسترسی میکروفون بسته است؛ از تنظیمات مرورگر اجازه بده."))));

    const timer = setInterval(() => {
      setSecs((x) => x + 1);
    }, 1000);
    const silence = setInterval(() => {
      if (!textRef.current) { setQuiet(0); return; }
      const p = Math.min(1, (Date.now() - lastVoice.current) / SILENCE_MS);
      setQuiet(p);
      if (p >= 1) finish(true);
    }, 100);
    cleanup.current = () => {
      active.current = false;
      try { recRef.current?.stop(); } catch { /* ignore */ }
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      void ctx?.close();
      clearInterval(timer);
      clearInterval(silence);
    };
    return () => cleanup.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const R = 20, C = 2 * Math.PI * R;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="relative">
      {/* live transcript bubble */}
      <AnimatePresence>
        {(text || error) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-3 pt-2.5">
            <p className={`line-clamp-3 text-[15px] leading-7 ${error ? 'flex items-center gap-1.5 text-bad' : 'text-fg'}`}>
              {error ? <><MicOff className="size-4 shrink-0" />{error}</> : <>{tidy(text)}<span className="mr-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded bg-accent" /></>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 p-1.5">
        <motion.button whileTap={{ scale: 0.88 }} aria-label={t('cancel')} onClick={() => finish(false)} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 text-fg">
          <X className="size-5" />
        </motion.button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-11 flex-1 items-center justify-center gap-[3px]" aria-hidden dir="ltr">
            {levels.map((l, i) => {
              const centre = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2); // taller in the middle
              const idle = 0.12 + 0.1 * Math.sin(secs * 2 + i * 0.6) * (speaking ? 0 : 1);
              const h = Math.max(4, (Math.max(l, idle * centre)) * 40);
              return (
                <span key={i} className="w-[3.5px] shrink-0 rounded-full transition-[height,background-color,opacity] duration-150 ease-out"
                  style={{ height: h, backgroundColor: speaking ? 'var(--accent)' : 'var(--text)', opacity: 0.35 + Math.min(1, l * 1.4) * 0.65 }} />
              );
            })}
          </div>
          <span className="num shrink-0 text-[12.5px] font-semibold text-muted" aria-live="off">{mm}</span>
        </div>

        <motion.button whileTap={{ scale: 0.88 }} aria-label={t('done')} onClick={() => finish(true)} disabled={!!error && !text} className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-40">
          <ArrowUp className="size-5" strokeWidth={2.4} />
          {quiet > 0.15 && (
            <svg className="pointer-events-none absolute -inset-1 -rotate-90" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r={R} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - quiet)} />
            </svg>
          )}
        </motion.button>
      </div>
      {!text && !error && <p className="pb-1.5 text-center text-[11.5px] text-muted">{t('listening')} · {lang === 'en' ? 'stops by itself when you pause' : tr("وقتی مکث کنی خودش تموم می‌کنه")}</p>}
    </motion.div>
  );
}
