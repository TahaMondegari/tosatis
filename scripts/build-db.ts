// Builds data/torob.db from the Torob CSV dataset.
// Usage: node scripts/build-db.ts [datasetDir] [outFile]
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'csv-parse';
import { norm, toLatinDigits } from '../server/text.ts';

const dataDir = resolve(process.argv[2] ?? '_input/torob-dataset');
const outFile = resolve(process.argv[3] ?? 'data/torob.db');
mkdirSync(dirname(outFile), { recursive: true });
if (existsSync(outFile)) rmSync(outFile);

const db = new DatabaseSync(outFile);
db.exec(`
PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-200000;
CREATE TABLE shops(
  id INTEGER PRIMARY KEY, sid TEXT UNIQUE, city TEXT, name TEXT, address TEXT, lat REAL, lon REAL, area TEXT,
  cats TEXT, hours TEXT, phone TEXT, instagram TEXT, website TEXT, fast_delivery INTEGER,
  pay TEXT, installment INTEGER, torobpay INTEGER, torobpay_inperson INTEGER,
  mall TEXT, mall_key TEXT, floor TEXT, unit TEXT, real_name INTEGER, n_offers INTEGER DEFAULT 0
);
CREATE TABLE products(
  id INTEGER PRIMARY KEY, pid TEXT UNIQUE, title TEXT, brand TEXT, category TEXT, model TEXT,
  images TEXT, specs TEXT, n_offers INTEGER DEFAULT 0, n_shops INTEGER DEFAULT 0,
  min_price INTEGER, max_price INTEGER, last_change TEXT
);
CREATE TABLE offers(
  id INTEGER PRIMARY KEY, product INTEGER, shop INTEGER, price INTEGER, title TEXT, descr TEXT,
  w_provider TEXT, w_months INTEGER, changed_at TEXT
);
CREATE TABLE shop_cats(shop INTEGER, cat TEXT);
`);

async function* rows(file: string) {
  const parser = createReadStream(join(dataDir, file)).pipe(parse({ columns: true, relax_quotes: true, bom: true }));
  for await (const r of parser) yield r as Record<string, string>;
}
const nul = (v: string | undefined) => (v === undefined || v === '' || v === 'null' ? null : v);
const json = <T,>(v: string | undefined, d: T): T => {
  try { return nul(v) ? (JSON.parse(v!) as T) : d; } catch { return d; }
};

// ---------- shops ----------
const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

function parseHours(raw: string) {
  const wh = json<Record<string, { status: string; shifts: { start_time: string; end_time: string }[] }>>(raw, {});
  if (!Object.keys(wh).length) return null;
  const out: Record<string, unknown> = {};
  for (const d of DAYS) {
    const v = wh[d];
    if (!v) { out[d] = 'n'; continue; } // no data for this day
    if (v.status === 'closed') { out[d] = 'c'; continue; }
    if (v.status !== 'declared') { out[d] = 'n'; continue; }
    const shifts = (v.shifts ?? []).map((s) => {
      const a = toMin(s.start_time), b = toMin(s.end_time);
      return [a, b <= a && !(a === 0 && b === 0) ? b + 1440 : b];
    }).filter(([a, b]) => !(a === 0 && b === 0));
    out[d] = shifts.length ? shifts : 'o'; // 'o' = declared open, hours not specified
  }
  return JSON.stringify(out);
}

// Keyword must start a word (so «شمال» is not read as «مال»)
const MALL_RE = /(?:^|[\s،,(])(پاساژ|مجتمع(?:\s*(?:تجاری|اداری|تجاری اداری|اداری تجاری))?|مرکز\s*(?:خرید|تجارت|تجاری)(?:\s*جهانی)?|بازار|برج|تیمچه|سرای|ساختمان|مال)\s+([^،,\-]{2,40})/;
const FLOOR_RE = /(?:^|[\s،,])(?:طبقه|ط\.)\s*([^،,]{1,20})/;
const UNIT_RE = /(?:^|[\s،,])(?:واحد|غرفه|مغازه)\s*([^،,]{1,14})/;
const PLATE_RE = /(?:^|[\s،,])پلاک\s*([^،,]{1,14})/;

function parseAddress(addr: string) {
  const m = addr.match(MALL_RE);
  const mall = m ? `${m[1]} ${m[2]}`.replace(/\s+/g, ' ').trim() : null;
  const floor = addr.match(FLOOR_RE)?.[1]?.trim() ?? null;
  const unit = (addr.match(UNIT_RE)?.[1] ?? (mall ? addr.match(PLATE_RE)?.[1] : undefined))?.trim() ?? null;
  const mallKey = mall ? norm(mall).replace(/^(پاساژ|مجتمع|مرکز|بازار|برج|تیمچه|سرای|ساختمان|مال)\s*/, '').replace(/(تجاری|اداری|خرید|تجارت|جهانی)\s*/g, '').replace(/ء/g, '').replace(/اا/g, 'ا').replace(/\s+/g, '') : null;
  return { mall, mallKey, floor, unit };
}

const shopIds = new Map<string, number>();
{
  const ins = db.prepare(`INSERT INTO shops(id,sid,city,name,address,lat,lon,area,cats,hours,phone,instagram,website,fast_delivery,pay,installment,torobpay,torobpay_inperson,mall,mall_key,floor,unit,real_name)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insCat = db.prepare('INSERT INTO shop_cats VALUES(?,?)');
  db.exec('BEGIN');
  let id = 0;
  for await (const r of rows('shops.csv')) {
    id++;
    shopIds.set(r.shop_id, id);
    const cats = json<string[]>(r.category_names, []);
    const contacts = json<{ channel: string; display_number?: string }[]>(r.contacts, []);
    const phone = contacts.find((c) => c.channel === 'phone')?.display_number;
    const payRaw = json<{ provider_name: string; channel: string; min_price_toman: number | null; max_price_toman: number | null; category_names: string[] }[]>(r.payment_options, []);
    const pay = payRaw.map((p) => ({ p: p.provider_name, ch: p.channel, min: p.min_price_toman || null, max: p.max_price_toman || null, cats: p.category_names?.length ? p.category_names : undefined }));
    const tp = pay.filter((p) => p.p === 'ترب‌پی');
    const { mall, mallKey, floor, unit } = parseAddress(r.address ?? '');
    const fd = nul(r.supports_fast_delivery);
    ins.run(id, r.shop_id, nul(r.city) ?? 'تهران', r.name, r.address, Number(r.lat), Number(r.lon), nul(r.location_label), JSON.stringify(cats.slice(0, 40)),
      parseHours(r.weekly_hours), phone ? toLatinDigits(phone) : null, nul(r.instagram), nul(r.website_url),
      fd === null ? null : fd === 'true' ? 1 : 0, pay.length ? JSON.stringify(pay) : null, pay.length ? 1 : 0,
      tp.length ? 1 : 0, tp.some((p) => p.ch === 'in_person') ? 1 : 0, mall, mallKey, floor, unit,
      nul(r.instagram) || nul(r.website_url) ? 1 : 0);
    for (const c of cats) insCat.run(id, c);
  }
  db.exec('COMMIT');
  console.log('shops', id);
}

// ---------- products ----------
const productIds = new Map<string, number>();
{
  const ins = db.prepare('INSERT INTO products(id,pid,title,brand,category,model,images,specs) VALUES(?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  let id = 0;
  for await (const r of rows('products.csv')) {
    id++;
    productIds.set(r.product_id, id);
    const imgs = json<string[]>(r.image_urls, []).slice(0, 4);
    const specs = json<{ key: string; value: string }[]>(r.specs, [])
      .filter((s) => s.key && s.value && String(s.value).length < 120)
      .slice(0, 28)
      .map((s) => [s.key, String(s.value)]);
    ins.run(id, r.product_id, r.persian_title, nul(r.brand_name), nul(r.category_name), nul(r.model),
      imgs.length ? JSON.stringify(imgs) : null, specs.length ? JSON.stringify(specs) : null);
    if (id % 50000 === 0) { db.exec('COMMIT; BEGIN'); console.log('products', id); }
  }
  db.exec('COMMIT');
  console.log('products', id);
}

// ---------- offers ----------
{
  const ins = db.prepare('INSERT INTO offers(id,product,shop,price,title,descr,w_provider,w_months,changed_at) VALUES(?,?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  let id = 0, skipped = 0;
  for await (const r of rows('offers.csv')) {
    const p = productIds.get(r.product_id), s = shopIds.get(r.shop_id);
    if (!p || !s) { skipped++; continue; }
    id++;
    const price = Number(r.price_toman);
    const w = json<{ provider?: string | null; period_months?: number | null } | null>(r.warranty, null);
    const descr = nul(r.description);
    ins.run(id, p, s, price > 0 ? Math.round(price) : null, r.seller_title || null,
      descr ? descr.replace(/\s+/g, ' ').slice(0, 400) : null, w?.provider ?? null, w?.period_months ?? null, nul(r.last_price_changed_at));
    if (id % 50000 === 0) { db.exec('COMMIT; BEGIN'); console.log('offers', id); }
  }
  db.exec('COMMIT');
  console.log('offers', id, 'skipped', skipped);
}

// ---------- aggregates, indexes, FTS ----------
console.log('aggregating…');
db.exec(`
CREATE INDEX offers_product ON offers(product);
CREATE INDEX offers_shop ON offers(shop);
CREATE INDEX shop_cats_cat ON shop_cats(cat);
CREATE INDEX products_cat ON products(category);
CREATE INDEX shops_mall ON shops(mall_key);
CREATE INDEX shops_city ON shops(city);
UPDATE products SET (n_offers, n_shops, min_price, max_price, last_change) = (
  SELECT count(*), count(DISTINCT shop), min(price), max(price), max(changed_at) FROM offers WHERE offers.product = products.id);
UPDATE shops SET n_offers = (SELECT count(*) FROM offers WHERE offers.shop = shops.id);
CREATE TABLE categories AS
  SELECT category AS name, count(*) AS n_products, sum(n_offers) AS n_offers,
         (SELECT count(DISTINCT o.shop) FROM offers o JOIN products p2 ON p2.id = o.product WHERE p2.category = products.category) AS n_shops,
         min(min_price) AS min_price, max(max_price) AS max_price
  FROM products WHERE category IS NOT NULL GROUP BY category;
CREATE VIRTUAL TABLE pfts USING fts5(t, b, c, s, content='', tokenize='unicode61 remove_diacritics 2', prefix='2 3');
CREATE VIRTUAL TABLE cfts USING fts5(name, content='', tokenize='unicode61 remove_diacritics 2', prefix='2 3');
`);

{
  const sel = db.prepare(`SELECT p.id, p.title, p.brand, p.category, p.model,
      (SELECT group_concat(title, ' ') FROM (SELECT DISTINCT title FROM offers WHERE product = p.id LIMIT 3)) AS st
    FROM products p`);
  const ins = db.prepare('INSERT INTO pfts(rowid,t,b,c,s) VALUES(?,?,?,?,?)');
  db.exec('BEGIN');
  let n = 0;
  for (const r of sel.iterate() as Iterable<Record<string, string | number | null>>) {
    const brand = [r.brand, r.model].filter(Boolean).join(' ');
    ins.run(r.id as number, norm(r.title as string), norm(brand), norm(r.category as string), norm((r.st as string) ?? ''));
    if (++n % 50000 === 0) console.log('fts', n);
  }
  const cats = db.prepare('SELECT rowid, name FROM categories').all() as { rowid: number; name: string }[];
  const insC = db.prepare('INSERT INTO cfts(rowid,name) VALUES(?,?)');
  for (const c of cats) insC.run(c.rowid, norm(c.name));
  db.exec('COMMIT');
}
db.exec(`INSERT INTO pfts(pfts) VALUES('optimize'); INSERT INTO cfts(cfts) VALUES('optimize'); ANALYZE; VACUUM;`);
const stats = db.prepare(`SELECT (SELECT count(*) FROM shops) shops, (SELECT count(*) FROM products) products, (SELECT count(*) FROM offers) offers,
  (SELECT count(*) FROM shops WHERE installment=1) installment, (SELECT count(*) FROM shops WHERE mall IS NOT NULL) in_mall,
  (SELECT count(*) FROM shops WHERE hours IS NOT NULL) with_hours`).get();
console.log(stats);
db.close();
