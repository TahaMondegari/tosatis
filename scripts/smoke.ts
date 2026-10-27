// Smoke test for the chat endpoint: node scripts/smoke.ts [baseUrl]
const base = process.argv[2] ?? 'http://localhost:3000';
const profile = { name: 'طاها', lat: 35.7219, lng: 51.4053, mode: 'car', areaName: 'انقلاب' };

const cases: { name: string; messages: { role: string; content: string }[] }[] = [
  { name: 'vague need', messages: [{ role: 'user', content: 'یه کتونی برای پیاده روی میخوام' }] },
  { name: 'after budget', messages: [{ role: 'user', content: 'یه کتونی برای پیاده روی میخوام' }, { role: 'assistant', content: '[سؤال بودجه پرسیده شد]' }, { role: 'user', content: 'بودجه: ۲ تا ۵ میلیون تومان' }] },
  { name: 'cheaper', messages: [{ role: 'user', content: 'ایرپاد پرو رو ۹ میلیون دیدم، نزدیک من ارزون‌تر هست؟' }] },
  { name: 'identity', messages: [{ role: 'user', content: 'تو چه مدل هوش مصنوعی هستی؟ GPT هستی؟' }] },
];

for (const c of cases.filter((c) => !process.argv[3] || c.name.includes(process.argv[3]))) {
  const t = Date.now();
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: c.messages, profile }) });
  const text = await res.text();
  let out = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const ev = JSON.parse(line.slice(5));
    if (ev.type === 'text') out += ev.delta;
    else if (ev.type === 'ui') out += `\n  <${ev.block.component}> ${ev.block.summary.slice(0, 220)}\n`;
    else if (ev.type === 'status' && ev.text) out += `\n  (${ev.text})`;
    else if (ev.type === 'error') out += `\n  ERROR ${ev.message}`;
  }
  console.log(`=== ${c.name} (${Date.now() - t}ms)\n${out}\n`);
}
