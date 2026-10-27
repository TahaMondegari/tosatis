// Tehran neighbourhoods for manual location (approximate centres).
export type Area = { name: string; district: number; lat: number; lng: number };

export const TEHRAN_AREAS: Area[] = [
  { name: 'تجریش', district: 1, lat: 35.8045, lng: 51.4336 },
  { name: 'زعفرانیه', district: 1, lat: 35.8045, lng: 51.4135 },
  { name: 'نیاوران', district: 1, lat: 35.8128, lng: 51.4706 },
  { name: 'ونک', district: 3, lat: 35.7579, lng: 51.4096 },
  { name: 'جردن (آفریقا)', district: 3, lat: 35.7700, lng: 51.4186 },
  { name: 'میرداماد', district: 3, lat: 35.7605, lng: 51.4320 },
  { name: 'سعادت‌آباد', district: 2, lat: 35.7840, lng: 51.3770 },
  { name: 'شهرک غرب', district: 2, lat: 35.7590, lng: 51.3700 },
  { name: 'پونک', district: 5, lat: 35.7620, lng: 51.3330 },
  { name: 'گیشا', district: 2, lat: 35.7330, lng: 51.3780 },
  { name: 'ستارخان', district: 2, lat: 35.7090, lng: 51.3560 },
  { name: 'جنت‌آباد', district: 5, lat: 35.7480, lng: 51.3080 },
  { name: 'اکباتان', district: 5, lat: 35.7090, lng: 51.3050 },
  { name: 'صادقیه (فلکه دوم)', district: 5, lat: 35.7180, lng: 51.3350 },
  { name: 'آزادی', district: 9, lat: 35.6997, lng: 51.3376 },
  { name: 'یوسف‌آباد', district: 6, lat: 35.7300, lng: 51.4040 },
  { name: 'میدان ولیعصر', district: 6, lat: 35.7110, lng: 51.4080 },
  { name: 'انقلاب', district: 6, lat: 35.7010, lng: 51.3910 },
  { name: 'هفت تیر', district: 6, lat: 35.7160, lng: 51.4250 },
  { name: 'میدان فردوسی', district: 12, lat: 35.7015, lng: 51.4210 },
  { name: 'جمهوری / لاله‌زار', district: 12, lat: 35.6960, lng: 51.4140 },
  { name: 'بازار بزرگ', district: 12, lat: 35.6750, lng: 51.4210 },
  { name: 'بهارستان', district: 12, lat: 35.6915, lng: 51.4290 },
  { name: 'امام حسین', district: 13, lat: 35.7020, lng: 51.4450 },
  { name: 'شریعتی (قلهک)', district: 3, lat: 35.7700, lng: 51.4420 },
  { name: 'پاسداران', district: 4, lat: 35.7720, lng: 51.4700 },
  { name: 'نارمک', district: 8, lat: 35.7400, lng: 51.5000 },
  { name: 'تهرانپارس', district: 4, lat: 35.7380, lng: 51.5360 },
  { name: 'پیروزی', district: 13, lat: 35.6930, lng: 51.4800 },
  { name: 'نازی‌آباد', district: 16, lat: 35.6400, lng: 51.4040 },
  { name: 'شهرری', district: 20, lat: 35.5960, lng: 51.4350 },
  { name: 'نواب', district: 10, lat: 35.6880, lng: 51.3870 },
  { name: 'مرزداران', district: 2, lat: 35.7380, lng: 51.3540 },
  { name: 'چیتگر', district: 22, lat: 35.7400, lng: 51.2000 },
  { name: 'شهرک آسمان', district: 2, lat: 35.7770, lng: 51.3540 },
];

export const CITIES = [
  { id: 'tehran', name: 'تهران', active: true },
  { id: 'karaj', name: 'کرج', active: false },
  { id: 'mashhad', name: 'مشهد', active: false },
  { id: 'isfahan', name: 'اصفهان', active: false },
  { id: 'shiraz', name: 'شیراز', active: false },
  { id: 'tabriz', name: 'تبریز', active: false },
];

export function nearestArea(lat: number, lng: number) {
  let best = TEHRAN_AREAS[0], bd = Infinity;
  for (const a of TEHRAN_AREAS) {
    const d = (a.lat - lat) ** 2 + ((a.lng - lng) * Math.cos(lat * Math.PI / 180)) ** 2;
    if (d < bd) { bd = d; best = a; }
  }
  return { area: best, km: Math.sqrt(bd) * 111 };
}
