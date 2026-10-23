// Chat engine: sends turns to the agent, streams events into the store, and runs UI actions locally.
import { effectiveProfile, useApp } from '../store';
import { api, streamChat } from './api';
import type { Message, Part, UIBlock } from './types';
import { uid } from './format';

import { tr } from './i18n';
let controller: AbortController | null = null;

function toHistory(messages: Message[]) {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    const content = m.parts
      .map((p) => (p.kind === 'text' ? p.text : p.block.summary))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${content}`;
    else out.push({ role: m.role, content });
  }
  return out;
}

const state = () => useApp.getState();

export function stopGeneration() {
  controller?.abort();
  controller = null;
}

export async function sendUser(text: string, display?: string) {
  const s = state();
  if (s.busy) stopGeneration();
  const trimmed = text.trim();
  if (!trimmed) return;
  s.addMessage({ id: uid(), role: 'user', parts: [{ kind: 'text', text: display ?? trimmed }], at: Date.now() });
  // The model sees the full text even when the bubble shows a shorter label
  const chat = useApp.getState().chats.find((c) => c.id === useApp.getState().activeChatId);
  const history = toHistory(chat?.messages ?? []);
  if (display && history.length) history[history.length - 1].content = trimmed;
  await runAssistant(history);
}

async function runAssistant(history: { role: 'user' | 'assistant'; content: string }[]) {
  const s = state();
  const id = uid();
  s.addMessage({ id, role: 'assistant', parts: [], at: Date.now(), status: 'streaming', statusText: tr("دارم فکر می‌کنم…") });
  s.set({ busy: true });
  controller = new AbortController();
  const patch = (fn: (m: Message) => Message) => useApp.getState().patchMessage(id, fn);
  try {
    await streamChat({ messages: history, profile: effectiveProfile() }, (e) => {
      if (e.type === 'text') {
        patch((m) => {
          const parts = [...m.parts];
          const last = parts[parts.length - 1];
          if (last?.kind === 'text') parts[parts.length - 1] = { kind: 'text', text: last.text + e.delta };
          else parts.push({ kind: 'text', text: e.delta });
          return { ...m, parts, statusText: '' };
        });
      } else if (e.type === 'ui') {
        patch((m) => ({ ...m, parts: [...m.parts, { kind: 'ui', block: e.block }] }));
      } else if (e.type === 'agent') {
        patch((m) => ({ ...m, statusText: tr("{0} داره بررسی می‌کنه…", e.label) }));
      } else if (e.type === 'status') {
        patch((m) => ({ ...m, statusText: e.text }));
      } else if (e.type === 'error') {
        patch((m) => ({ ...m, status: 'error', parts: [...m.parts, { kind: 'text', text: e.message }] }));
      }
    }, controller.signal);
    patch((m) => ({ ...m, status: m.status === 'error' ? 'error' : 'done', statusText: '' }));
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    patch((m) => ({
      ...m, status: aborted ? 'done' : 'error', statusText: '',
      parts: aborted ? m.parts : [...m.parts, { kind: 'text', text: tr("اتصال برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.") }],
    }));
  } finally {
    useApp.getState().set({ busy: false });
    controller = null;
  }
}

/** Retry the last user turn (used by the error state). */
export function retryLast() {
  const chat = useApp.getState().chats.find((c) => c.id === useApp.getState().activeChatId);
  if (!chat) return;
  const msgs = chat.messages;
  const lastAssistant = msgs[msgs.length - 1];
  if (lastAssistant?.role === 'assistant') {
    useApp.setState((s) => ({ chats: s.chats.map((c) => (c.id === chat.id ? { ...c, messages: c.messages.slice(0, -1) } : c)) }));
  }
  const fresh = useApp.getState().chats.find((c) => c.id === chat.id)!;
  void runAssistant(toHistory(fresh.messages));
}

/** Post a local assistant message (no LLM round-trip). */
export function postLocal(parts: Part[], userText?: string) {
  const s = state();
  if (userText) s.addMessage({ id: uid(), role: 'user', parts: [{ kind: 'text', text: userText }], at: Date.now(), local: true });
  const id = uid();
  s.addMessage({ id, role: 'assistant', parts, at: Date.now(), status: 'done', local: true });
  return id;
}

/** Run a tool directly from a button and drop its card into the chat. */
export async function runAction(tool: string, args: Record<string, unknown>, opts: { userText?: string; intro?: string; outro?: string } = {}) {
  const s = state();
  if (opts.userText) s.addMessage({ id: uid(), role: 'user', parts: [{ kind: 'text', text: opts.userText }], at: Date.now(), local: true });
  const id = uid();
  s.addMessage({ id, role: 'assistant', parts: [], at: Date.now(), status: 'streaming', statusText: tr("یک لحظه…"), local: true });
  try {
    const r = await api.action(tool, args, effectiveProfile());
    const parts: Part[] = [];
    if (opts.intro) parts.push({ kind: 'text', text: opts.intro });
    if (r.ui) parts.push({ kind: 'ui', block: r.ui as UIBlock });
    if (opts.outro) parts.push({ kind: 'text', text: opts.outro });
    if (!r.ui && !opts.intro) parts.push({ kind: 'text', text: tr("چیزی پیدا نکردم. یک بار دیگر امتحان کن.") });
    useApp.getState().patchMessage(id, (m) => ({ ...m, parts, status: 'done', statusText: '' }));
    return r;
  } catch {
    useApp.getState().patchMessage(id, (m) => ({ ...m, parts: [{ kind: 'text', text: tr("الان نتونستم اطلاعات رو بگیرم. دوباره امتحان کن.") }], status: 'error', statusText: '' }));
    return null;
  }
}
