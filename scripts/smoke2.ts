// Multi-turn agent test: node scripts/smoke2.ts [baseUrl]
const base = process.argv[2] ?? 'http://localhost:3000';
const profile = { name: 'طاها', lat: 35.701, lng: 51.391, mode: 'car', areaName: 'انقلاب', installmentOnly: false };
const turns = [
  'یه گوشی سامسونگ تا ۲۰ میلیون میخوام',
  'پاسخ به «حافظه داخلی»: ۲۵۶ گیگابایت',
  'گزینه اول رو انتخاب کردم. فروشگاه‌هاش رو مقایسه کن.',
];
const history: { role: string; content: string }[] = [];
for (const t of turns) {
  history.push({ role: 'user', content: t });
  const t0 = Date.now();
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history, profile }) });
  let text = '', summaries: string[] = [];
  for (const line of (await res.text()).split('\n')) {
    if (!line.startsWith('data:')) continue;
    const ev = JSON.parse(line.slice(5));
    if (ev.type === 'text') text += ev.delta;
    if (ev.type === 'ui') { summaries.push(ev.block.summary || `<${ev.block.component}> ${JSON.stringify(ev.block.props).slice(0, 120)}`); }
  }
  console.log(`\n>>> ${t}  (${Date.now() - t0}ms)\n${text}\n${summaries.map((s) => '  ' + s.slice(0, 400)).join('\n')}`);
  history.push({ role: 'assistant', content: [text, ...summaries].join('\n') });
}
