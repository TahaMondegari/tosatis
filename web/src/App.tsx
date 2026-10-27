import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from './store';
import { Onboarding } from './components/Onboarding';
import { ChatView } from './components/chat/ChatView';
import { Drawer, Sidebar } from './components/Sidebar';
import { Sheets } from './components/Sheets';
import { useSmartFeedback } from './components/Feedback';

function useThemeSync() {
  const theme = useApp((s) => s.theme);
  const textSize = useApp((s) => s.textSize);
  const lang = useApp((s) => s.lang);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'; }, [lang]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const t = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = t;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#ffffff' : '#0a0a0a');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    if (textSize === 'large') document.documentElement.dataset.text = 'large';
    else delete document.documentElement.dataset.text;
  }, [textSize]);
}

function Toast() {
  const toast = useApp((s) => s.toast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="rounded-full border border-line bg-surface px-5 py-2.5 text-[14.5px] font-semibold shadow-[var(--shadow-card)]">
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Main() {
  useSmartFeedback();
  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((h) => useApp.setState({ features: { calls: !!h.calls?.enabled, callsMock: !!h.calls?.mock } })).catch(() => {});
  }, []);
  return (
    <div className="fixed inset-0 flex overflow-clip">
      <Sidebar />
      <Drawer />
      <ChatView />
      <Sheets />
      <Toast />
    </div>
  );
}

export default function App() {
  useThemeSync();
  const profile = useApp((s) => s.profile);
  return profile ? <Main /> : <Onboarding />;
}
