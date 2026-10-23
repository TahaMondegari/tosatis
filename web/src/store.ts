import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Chat, Inquiry, Message, Part, PlanItem, Profile, ProductCard, Purchase, TravelMode } from './lib/types';
import { uid } from './lib/format';

import { tr } from './lib/i18n';
export type Theme = 'dark' | 'light' | 'system';
export type Sheet =
  | { type: 'product'; id: string }
  | { type: 'store'; id: string; productId?: string }
  | { type: 'settings' }
  | { type: 'plan' }
  | { type: 'saved' }
  | { type: 'feedback'; id: string }
  | null;

type State = {
  profile: Profile | null;
  theme: Theme;
  textSize: 'normal' | 'large';
  lang: 'fa' | 'en';
  chats: Chat[];
  activeChatId: string | null;
  inquiries: Record<string, Inquiry>;
  plan: PlanItem[];
  saved: ProductCard[];
  sidebarCollapsed: boolean;
  purchases: Purchase[];
  lastSeen: number;
  // ephemeral
  drawerOpen: boolean;
  sheet: Sheet;
  busy: boolean;
  /** Server feature switches from /api/health (e.g. AI phone calls) */
  features: { calls: boolean; callsMock: boolean };
  toast: { id: string; text: string } | null;
};

type Actions = {
  setProfile: (p: Profile) => void;
  updateProfile: (p: Partial<Profile>) => void;
  setTheme: (t: Theme) => void;
  setTextSize: (t: 'normal' | 'large') => void;
  newChat: () => string;
  openChat: (id: string) => void;
  deleteChat: (id: string) => void;
  clearChats: () => void;
  addMessage: (m: Message) => void;
  patchMessage: (id: string, fn: (m: Message) => Message) => void;
  setAnswer: (blockId: string, answer: unknown) => void;
  patchBlock: (blockId: string, props: Record<string, unknown>) => void;
  setInquiry: (i: Inquiry) => void;
  addToPlan: (i: Omit<PlanItem, 'addedAt'>) => void;
  removeFromPlan: (shopId: string) => void;
  clearPlan: () => void;
  toggleSaved: (p: ProductCard) => void;
  set: (p: Partial<State>) => void;
  showToast: (text: string) => void;
  setChatPrefs: (p: { mode?: TravelMode; installmentOnly?: boolean }) => void;
  trackPurchase: (p: Omit<Purchase, 'id' | 'at' | 'status'>) => void;
  patchPurchase: (id: string, p: Partial<Purchase>) => void;
};

export const inquiryKey = (shopId: string, productId?: string) => `${shopId}:${productId ?? ''}`;

const activeChat = (s: State) => s.chats.find((c) => c.id === s.activeChatId) ?? null;

function titleFrom(parts: Part[]) {
  const t = parts.find((p) => p.kind === 'text') as { text: string } | undefined;
  return (t?.text ?? tr("گفتگوی جدید")).replace(/\s+/g, ' ').slice(0, 42);
}

export const useApp = create<State & Actions>()(
  persist(
    (set, get) => ({
      profile: null,
      theme: 'dark',
      textSize: 'normal',
      lang: 'fa',
      chats: [],
      activeChatId: null,
      inquiries: {},
      plan: [],
      saved: [],
      sidebarCollapsed: false,
      purchases: [],
      lastSeen: Date.now(),
      drawerOpen: false,
      sheet: null,
      busy: false,
      features: { calls: false, callsMock: false },
      toast: null,

      setProfile: (profile) => set({ profile }),
      updateProfile: (p) => set((s) => ({ profile: s.profile ? { ...s.profile, ...p } : null })),
      setTheme: (theme) => set({ theme }),
      setTextSize: (textSize) => set({ textSize }),

      newChat: () => {
        const id = uid();
        set((s) => ({ chats: [{ id, title: tr("گفتگوی جدید"), at: Date.now(), messages: [] }, ...s.chats.filter((c) => c.messages.length || c.mode || c.installmentOnly)].slice(0, 30), activeChatId: id, drawerOpen: false }));
        return id;
      },
      openChat: (id) => set({ activeChatId: id, drawerOpen: false }),
      deleteChat: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id), activeChatId: s.activeChatId === id ? null : s.activeChatId })),
      clearChats: () => set({ chats: [], activeChatId: null }),

      addMessage: (m) => {
        let s = get();
        if (!activeChat(s)) { get().newChat(); s = get(); }
        set((st) => ({
          chats: st.chats.map((c) => {
            if (c.id !== st.activeChatId) return c;
            const firstUser = m.role === 'user' && !c.messages.some((x) => x.role === 'user');
            return { ...c, at: Date.now(), title: firstUser ? titleFrom(m.parts) : c.title, messages: [...c.messages, m] };
          }),
        }));
      },
      patchMessage: (id, fn) =>
        set((s) => ({ chats: s.chats.map((c) => (c.id !== s.activeChatId ? c : { ...c, messages: c.messages.map((m) => (m.id === id ? fn(m) : m)) })) })),
      setAnswer: (blockId, answer) =>
        set((s) => ({
          chats: s.chats.map((c) => ({
            ...c,
            messages: c.messages.map((m) => ({ ...m, parts: m.parts.map((p) => (p.kind === 'ui' && p.block.id === blockId ? { ...p, answer } : p)) })),
          })),
        })),
      patchBlock: (blockId, props) =>
        set((s) => ({
          chats: s.chats.map((c) => ({
            ...c,
            messages: c.messages.map((m) => ({ ...m, parts: m.parts.map((p) => (p.kind === 'ui' && p.block.id === blockId ? { ...p, block: { ...p.block, props: { ...p.block.props, ...props } } } : p)) })),
          })),
        })),

      setInquiry: (i) => set((s) => ({ inquiries: { ...s.inquiries, [inquiryKey(i.shopId, i.productId)]: i } })),
      addToPlan: (i) => set((s) => (s.plan.some((p) => p.shopId === i.shopId) ? s : { plan: [...s.plan, { ...i, addedAt: Date.now() }].slice(0, 6) })),
      removeFromPlan: (shopId) => set((s) => ({ plan: s.plan.filter((p) => p.shopId !== shopId) })),
      clearPlan: () => set({ plan: [] }),
      toggleSaved: (p) => set((s) => ({ saved: s.saved.some((x) => x.id === p.id) ? s.saved.filter((x) => x.id !== p.id) : [p, ...s.saved].slice(0, 50) })),
      set: (p) => set(p),
      setChatPrefs: (p) => {
        if (!get().chats.some((c) => c.id === get().activeChatId)) get().newChat();
        set((s) => ({ chats: s.chats.map((c) => (c.id === s.activeChatId ? { ...c, ...p } : c)) }));
      },
      trackPurchase: (p) => set((s) => (s.purchases.some((x) => x.shopId === p.shopId && x.productId === p.productId && x.status !== 'done') ? s : { purchases: [{ ...p, id: uid(), at: Date.now(), status: 'pending' as const }, ...s.purchases].slice(0, 20) })),
      patchPurchase: (id, p) => set((s) => ({ purchases: s.purchases.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      showToast: (text) => {
        const id = uid();
        set({ toast: { id, text } });
        setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 2600);
      },
    }),
    {
      name: 'torobyar',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, theme: s.theme, textSize: s.textSize, lang: s.lang, chats: s.chats, activeChatId: s.activeChatId, inquiries: s.inquiries, plan: s.plan, saved: s.saved, sidebarCollapsed: s.sidebarCollapsed, purchases: s.purchases, lastSeen: s.lastSeen }),
    },
  ),
);

/** Profile with this chat's overrides (travel mode, installment) applied — what the agent and APIs see. */
export const effectiveProfile = () => {
  const s = useApp.getState();
  const chat = s.chats.find((c) => c.id === s.activeChatId);
  if (!s.profile) return null;
  return { ...s.profile, lang: s.lang, mode: chat?.mode ?? s.profile.mode, installmentOnly: chat?.installmentOnly ?? s.profile.installmentOnly };
};

export const useActiveChat = () => useApp((s) => s.chats.find((c) => c.id === s.activeChatId) ?? null);
