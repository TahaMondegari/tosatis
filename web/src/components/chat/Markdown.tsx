import { Fragment, memo, type ReactNode } from 'react';

/**
 * Tiny markdown (paragraphs, bullet/numbered lists, **bold**) rendered word-by-word.
 * Words keep stable keys, so while streaming only newly arrived words mount and play the fade-in.
 */
export const Markdown = memo(function Markdown({ text, animate }: { text: string; animate: boolean }) {
  let w = 0;
  const words = (s: string, bold: boolean): ReactNode[] =>
    s.split(/(\s+)/).map((tok) => {
      if (!tok) return null;
      if (/^\s+$/.test(tok)) return tok;
      const k = w++;
      return animate ? <span key={k} className={bold ? 'word font-extrabold' : 'word'}>{tok}</span> : bold ? <b key={k} className="font-extrabold">{tok}</b> : <Fragment key={k}>{tok}</Fragment>;
    });
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).flatMap((seg) => (seg.startsWith('**') && seg.endsWith('**') ? words(seg.slice(2, -2), true) : words(seg.replace(/\*\*/g, ''), false)));
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? 'ol' : 'ul';
    blocks.push(<L key={`l${blocks.length}`} className={list.ordered ? 'my-1 list-decimal pr-5' : 'my-1 list-disc pr-5 marker:text-muted'}>{list.items.map((it, i) => <li key={i} className="my-0.5">{inline(it)}</li>)}</L>);
    list = null;
  };
  for (const raw of text.replace(/^#+\s*/gm, '').split('\n')) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-•*]\s+(.*)/);
    const ol = line.match(/^\s*(\d+|[۰-۹]+)[.)]\s+(.*)/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ul ? ul[1] : ol![2]) as string);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="my-1">{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
});
