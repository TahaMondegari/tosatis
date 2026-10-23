import { locale } from './i18n';
// Iran provinces → cities, plus districts/neighbourhoods where we have them.
// `covered` cities have shop data today; the rest are selectable and ready for future datasets.
import { TEHRAN_AREAS } from './areas';

export type City = { id: string; name: string; lat: number; lng: number; covered?: boolean };
export type Province = { id: string; name: string; cities: City[] };
export type District = { name: string; group: string; lat: number; lng: number };

const c = (id: string, name: string, lat: number, lng: number, covered = false): City => ({ id, name, lat, lng, covered });

export const PROVINCES: Province[] = [
  { id: 'tehran', name: 'تهران', cities: [c('tehran', 'تهران', 35.6997, 51.3380, true), c('rey', 'شهرری', 35.5960, 51.4350), c('eslamshahr', 'اسلامشهر', 35.5596, 51.2350), c('shahriar', 'شهریار', 35.6596, 51.0592), c('pardis', 'پردیس', 35.7486, 51.7840), c('varamin', 'ورامین', 35.3242, 51.6457), c('damavand', 'دماوند', 35.7178, 52.0650), c('robatkarim', 'رباط‌کریم', 35.4846, 51.0829), c('qods', 'قدس', 35.7214, 51.1090), c('malard', 'ملارد', 35.6658, 50.9767), c('pakdasht', 'پاکدشت', 35.4817, 51.6803), c('lavasan', 'لواسان', 35.8233, 51.6338)] },
  { id: 'alborz', name: 'البرز', cities: [c('karaj', 'کرج', 35.8400, 50.9391), c('fardis', 'فردیس', 35.7230, 50.9870), c('hashtgerd', 'هشتگرد', 35.9619, 50.6799), c('nazarabad', 'نظرآباد', 35.9521, 50.6075), c('eshtehard', 'اشتهارد', 35.7255, 50.3662), c('taleqan', 'طالقان', 36.1717, 50.7639)] },
  { id: 'isfahan', name: 'اصفهان', cities: [c('isfahan', 'اصفهان', 32.6546, 51.6680), c('kashan', 'کاشان', 33.9850, 51.4100), c('najafabad', 'نجف‌آباد', 32.6342, 51.3668), c('khomeinishahr', 'خمینی‌شهر', 32.7000, 51.5211), c('shahinshahr', 'شاهین‌شهر', 32.8636, 51.5550), c('fouladshahr', 'فولادشهر', 32.4911, 51.4053), c('golpayegan', 'گلپایگان', 33.4537, 50.2884), c('ardestan', 'اردستان', 33.3761, 52.3694), c('naeen', 'نائین', 32.8599, 53.0875), c('mobarakeh', 'مبارکه', 32.3464, 51.5044)] },
  { id: 'razavi', name: 'خراسان رضوی', cities: [c('mashhad', 'مشهد', 36.2605, 59.6168), c('neyshabur', 'نیشابور', 36.2133, 58.7958), c('sabzevar', 'سبزوار', 36.2126, 57.6819), c('torbat-h', 'تربت حیدریه', 35.2740, 59.2195), c('quchan', 'قوچان', 37.1060, 58.5096), c('kashmar', 'کاشمر', 35.2383, 58.4656), c('chenaran', 'چناران', 36.6455, 59.1212), c('torbat-j', 'تربت جام', 35.2440, 60.6225), c('golbahar', 'گلبهار', 36.4885, 59.2260)] },
  { id: 'fars', name: 'فارس', cities: [c('shiraz', 'شیراز', 29.5918, 52.5837), c('marvdasht', 'مرودشت', 29.8742, 52.8025), c('jahrom', 'جهرم', 28.5000, 53.5605), c('kazerun', 'کازرون', 29.6195, 51.6541), c('fasa', 'فسا', 28.9383, 53.6482), c('darab', 'داراب', 28.7519, 54.5444), c('lar', 'لار', 27.6810, 54.3404), c('firuzabad', 'فیروزآباد', 28.8438, 52.5707), c('abadeh', 'آباده', 31.1608, 52.6506)] },
  { id: 'east-azarbaijan', name: 'آذربایجان شرقی', cities: [c('tabriz', 'تبریز', 38.0800, 46.2919), c('maragheh', 'مراغه', 37.3917, 46.2398), c('marand', 'مرند', 38.4329, 45.7749), c('mianeh', 'میانه', 37.4211, 47.7150), c('ahar', 'اهر', 38.4774, 47.0699), c('bonab', 'بناب', 37.3404, 46.0561), c('sarab', 'سراب', 37.9408, 47.5367), c('azarshahr', 'آذرشهر', 37.7589, 45.9784)] },
  { id: 'west-azarbaijan', name: 'آذربایجان غربی', cities: [c('urmia', 'ارومیه', 37.5527, 45.0761), c('khoy', 'خوی', 38.5503, 44.9521), c('mahabad', 'مهاباد', 36.7631, 45.7222), c('bukan', 'بوکان', 36.5210, 46.2089), c('miandoab', 'میاندوآب', 36.9694, 46.1027), c('salmas', 'سلماس', 38.1973, 44.7653), c('naqadeh', 'نقده', 36.9553, 45.3880), c('piranshahr', 'پیرانشهر', 36.6941, 45.1413)] },
  { id: 'ardabil', name: 'اردبیل', cities: [c('ardabil', 'اردبیل', 38.2498, 48.2933), c('parsabad', 'پارس‌آباد', 39.6482, 47.9174), c('meshginshahr', 'مشگین‌شهر', 38.3989, 47.6819), c('khalkhal', 'خلخال', 37.6189, 48.5258), c('germi', 'گرمی', 39.0215, 48.0801)] },
  { id: 'khuzestan', name: 'خوزستان', cities: [c('ahvaz', 'اهواز', 31.3183, 48.6706), c('dezful', 'دزفول', 32.3811, 48.4058), c('abadan', 'آبادان', 30.3473, 48.2934), c('khorramshahr', 'خرمشهر', 30.4256, 48.1891), c('andimeshk', 'اندیمشک', 32.4600, 48.3592), c('behbahan', 'بهبهان', 30.5959, 50.2417), c('mahshahr', 'ماهشهر', 30.5589, 49.1981), c('shushtar', 'شوشتر', 32.0455, 48.8567), c('izeh', 'ایذه', 31.8341, 49.8670), c('masjedsoleyman', 'مسجدسلیمان', 31.9364, 49.3039)] },
  { id: 'mazandaran', name: 'مازندران', cities: [c('sari', 'ساری', 36.5633, 53.0601), c('babol', 'بابل', 36.5513, 52.6789), c('amol', 'آمل', 36.4696, 52.3507), c('qaemshahr', 'قائم‌شهر', 36.4631, 52.8601), c('behshahr', 'بهشهر', 36.6923, 53.5526), c('chalus', 'چالوس', 36.6550, 51.4204), c('nowshahr', 'نوشهر', 36.6490, 51.4961), c('tonekabon', 'تنکابن', 36.8163, 50.8738), c('ramsar', 'رامسر', 36.9031, 50.6583), c('babolsar', 'بابلسر', 36.7025, 52.6576)] },
  { id: 'gilan', name: 'گیلان', cities: [c('rasht', 'رشت', 37.2808, 49.5832), c('bandaranzali', 'بندر انزلی', 37.4727, 49.4622), c('lahijan', 'لاهیجان', 37.2071, 50.0039), c('langarud', 'لنگرود', 37.1970, 50.1536), c('talesh', 'تالش', 37.8000, 48.9060), c('astara', 'آستارا', 38.4291, 48.8721), c('rudsar', 'رودسر', 37.1378, 50.2880), c('fuman', 'فومن', 37.2240, 49.3125)] },
  { id: 'golestan', name: 'گلستان', cities: [c('gorgan', 'گرگان', 36.8456, 54.4393), c('gonbad', 'گنبد کاووس', 37.2500, 55.1672), c('aliabad', 'علی‌آباد کتول', 36.9081, 54.8692), c('bandar-torkaman', 'بندر ترکمن', 36.9017, 54.0710), c('kordkuy', 'کردکوی', 36.7941, 54.1103), c('azadshahr', 'آزادشهر', 37.0869, 55.1738)] },
  { id: 'kerman', name: 'کرمان', cities: [c('kerman', 'کرمان', 30.2839, 57.0834), c('sirjan', 'سیرجان', 29.4520, 55.6814), c('rafsanjan', 'رفسنجان', 30.4067, 55.9939), c('jiroft', 'جیرفت', 28.6751, 57.7372), c('bam', 'بم', 29.1060, 58.3570), c('zarand', 'زرند', 30.8127, 56.5640), c('shahrebabak', 'شهربابک', 30.1165, 55.1186), c('kahnuj', 'کهنوج', 27.9467, 57.7058)] },
  { id: 'kermanshah', name: 'کرمانشاه', cities: [c('kermanshah', 'کرمانشاه', 34.3142, 47.0650), c('eslamabad', 'اسلام‌آباد غرب', 34.1094, 46.5275), c('kangavar', 'کنگاور', 34.5043, 47.9653), c('sonqor', 'سنقر', 34.7836, 47.6003), c('harsin', 'هرسین', 34.2721, 47.5861), c('javanrud', 'جوانرود', 34.8067, 46.4886)] },
  { id: 'kurdistan', name: 'کردستان', cities: [c('sanandaj', 'سنندج', 35.3219, 46.9862), c('saqqez', 'سقز', 36.2499, 46.2735), c('marivan', 'مریوان', 35.5181, 46.1764), c('baneh', 'بانه', 35.9975, 45.8853), c('qorveh', 'قروه', 35.1664, 47.8056), c('bijar', 'بیجار', 35.8668, 47.6051)] },
  { id: 'hamadan', name: 'همدان', cities: [c('hamadan', 'همدان', 34.7983, 48.5148), c('malayer', 'ملایر', 34.2969, 48.8235), c('nahavand', 'نهاوند', 34.1883, 48.3769), c('tuyserkan', 'تویسرکان', 34.5480, 48.4469), c('asadabad', 'اسدآباد', 34.7824, 48.1185), c('kabudarahang', 'کبودرآهنگ', 35.2083, 48.7239)] },
  { id: 'markazi', name: 'مرکزی', cities: [c('arak', 'اراک', 34.0917, 49.6892), c('saveh', 'ساوه', 35.0213, 50.3566), c('khomein', 'خمین', 33.6406, 50.0789), c('mahallat', 'محلات', 33.9110, 50.4535), c('delijan', 'دلیجان', 33.9905, 50.6838), c('tafresh', 'تفرش', 34.6920, 50.0131)] },
  { id: 'qazvin', name: 'قزوین', cities: [c('qazvin', 'قزوین', 36.2688, 50.0041), c('takestan', 'تاکستان', 36.0696, 49.6959), c('alvand', 'الوند', 36.1893, 50.0643), c('abyek', 'آبیک', 36.0400, 50.5310), c('buinzahra', 'بوئین‌زهرا', 35.7669, 50.0578)] },
  { id: 'qom', name: 'قم', cities: [c('qom', 'قم', 34.6416, 50.8746), c('jafariyeh', 'جعفریه', 34.7706, 50.5085), c('kahak', 'کهک', 34.3944, 50.8653)] },
  { id: 'zanjan', name: 'زنجان', cities: [c('zanjan', 'زنجان', 36.6736, 48.4787), c('abhar', 'ابهر', 36.1468, 49.2180), c('khorramdarreh', 'خرمدره', 36.2050, 49.1874), c('qeydar', 'قیدار', 36.1210, 48.5905)] },
  { id: 'semnan', name: 'سمنان', cities: [c('semnan', 'سمنان', 35.5769, 53.3953), c('shahrud', 'شاهرود', 36.4182, 54.9763), c('damghan', 'دامغان', 36.1683, 54.3480), c('garmsar', 'گرمسار', 35.2183, 52.3409)] },
  { id: 'yazd', name: 'یزد', cities: [c('yazd', 'یزد', 31.8974, 54.3569), c('meybod', 'میبد', 32.2501, 54.0166), c('ardakan', 'اردکان', 32.3100, 54.0175), c('bafq', 'بافق', 31.6128, 55.4107), c('mehriz', 'مهریز', 31.5917, 54.4318), c('taft', 'تفت', 31.7451, 54.2056)] },
  { id: 'hormozgan', name: 'هرمزگان', cities: [c('bandarabbas', 'بندرعباس', 27.1832, 56.2666), c('kish', 'کیش', 26.5328, 53.9800), c('qeshm', 'قشم', 26.9581, 56.2719), c('minab', 'میناب', 27.1467, 57.0801), c('bandarlengeh', 'بندر لنگه', 26.5580, 54.8807), c('hajiabad', 'حاجی‌آباد', 28.3091, 55.9017)] },
  { id: 'bushehr', name: 'بوشهر', cities: [c('bushehr', 'بوشهر', 28.9234, 50.8203), c('borazjan', 'برازجان', 29.2669, 51.2158), c('genaveh', 'گناوه', 29.5791, 50.5170), c('kangan', 'کنگان', 27.8371, 52.0623), c('asaluyeh', 'عسلویه', 27.4761, 52.6075)] },
  { id: 'sistan', name: 'سیستان و بلوچستان', cities: [c('zahedan', 'زاهدان', 29.4963, 60.8629), c('zabol', 'زابل', 31.0287, 61.5012), c('chabahar', 'چابهار', 25.2919, 60.6430), c('iranshahr', 'ایرانشهر', 27.2025, 60.6848), c('saravan', 'سراوان', 27.3709, 62.3342), c('khash', 'خاش', 28.2211, 61.2158)] },
  { id: 'south-khorasan', name: 'خراسان جنوبی', cities: [c('birjand', 'بیرجند', 32.8663, 59.2211), c('qaen', 'قائن', 33.7265, 59.1844), c('ferdows', 'فردوس', 34.0186, 58.1722), c('tabas', 'طبس', 33.5959, 56.9244), c('nehbandan', 'نهبندان', 31.5421, 60.0363)] },
  { id: 'north-khorasan', name: 'خراسان شمالی', cities: [c('bojnurd', 'بجنورد', 37.4747, 57.3290), c('shirvan', 'شیروان', 37.4092, 57.9276), c('esfarayen', 'اسفراین', 37.0765, 57.5101), c('jajarm', 'جاجرم', 36.9500, 56.3800)] },
  { id: 'lorestan', name: 'لرستان', cities: [c('khorramabad', 'خرم‌آباد', 33.4878, 48.3558), c('borujerd', 'بروجرد', 33.8973, 48.7516), c('dorud', 'دورود', 33.4955, 49.0578), c('kuhdasht', 'کوهدشت', 33.5350, 47.6061), c('aligudarz', 'الیگودرز', 33.4006, 49.6949), c('azna', 'ازنا', 33.4558, 49.4555)] },
  { id: 'ilam', name: 'ایلام', cities: [c('ilam', 'ایلام', 33.6374, 46.4227), c('dehloran', 'دهلران', 32.6941, 47.2679), c('abdanan', 'آبدانان', 32.9926, 47.4198), c('mehran', 'مهران', 33.1222, 46.1646), c('eyvan', 'ایوان', 33.8272, 46.3097)] },
  { id: 'chaharmahal', name: 'چهارمحال و بختیاری', cities: [c('shahrekord', 'شهرکرد', 32.3256, 50.8644), c('borujen', 'بروجن', 31.9652, 51.2873), c('farrokhshahr', 'فرخ‌شهر', 32.2715, 50.9800), c('lordegan', 'لردگان', 31.5103, 50.8294), c('farsan', 'فارسان', 32.2571, 50.5617)] },
  { id: 'kohgiluyeh', name: 'کهگیلویه و بویراحمد', cities: [c('yasuj', 'یاسوج', 30.6682, 51.5880), c('gachsaran', 'دوگنبدان', 30.3586, 50.7981), c('dehdasht', 'دهدشت', 30.7949, 50.5646), c('likak', 'لیکک', 30.8949, 50.0926)] },
];

export const ALL_CITIES = PROVINCES.flatMap((p) => p.cities.map((ci) => ({ ...ci, province: p.name })));
export const findCity = (name: string) => ALL_CITIES.find((ci) => ci.name === name);

/** Neighbourhoods for a city (Tehran grouped by municipal district). Empty → district step is skipped. */
export function districtsOf(cityId: string): District[] {
  if (cityId === 'tehran') return TEHRAN_AREAS.map((a) => ({ name: a.name, group: `منطقه ${a.district.toLocaleString(locale())}`, lat: a.lat, lng: a.lng }));
  return [];
}

// English display names (data stays Persian internally; only labels change)
const cap = (id: string) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const AREA_EN: Record<string, string> = {
  'تجریش': 'Tajrish', 'زعفرانیه': 'Zafaraniyeh', 'نیاوران': 'Niavaran', 'ونک': 'Vanak', 'جردن (آفریقا)': 'Jordan (Africa)', 'میرداماد': 'Mirdamad',
  'سعادت‌آباد': 'Saadat Abad', 'شهرک غرب': 'Shahrak-e Gharb', 'پونک': 'Punak', 'گیشا': 'Gisha', 'ستارخان': 'Sattarkhan', 'جنت‌آباد': 'Jannat Abad',
  'اکباتان': 'Ekbatan', 'صادقیه (فلکه دوم)': 'Sadeghiyeh', 'آزادی': 'Azadi', 'یوسف‌آباد': 'Yusef Abad', 'میدان ولیعصر': 'Valiasr Sq.', 'انقلاب': 'Enghelab',
  'هفت تیر': 'Haft-e Tir', 'میدان فردوسی': 'Ferdowsi Sq.', 'جمهوری / لاله‌زار': 'Jomhouri / Lalehzar', 'بازار بزرگ': 'Grand Bazaar', 'بهارستان': 'Baharestan',
  'امام حسین': 'Imam Hossein', 'شریعتی (قلهک)': 'Shariati (Gholhak)', 'پاسداران': 'Pasdaran', 'نارمک': 'Narmak', 'تهرانپارس': 'Tehranpars', 'پیروزی': 'Piroozi',
  'نازی‌آباد': 'Nazi Abad', 'شهرری': 'Shahr-e Rey', 'نواب': 'Navvab', 'مرزداران': 'Marzdaran', 'چیتگر': 'Chitgar', 'شهرک آسمان': 'Shahrak-e Aseman',
};
const NAME_EN = new Map<string, string>();
for (const p of PROVINCES) { NAME_EN.set(p.name, cap(p.id)); for (const ci of p.cities) NAME_EN.set(ci.name, cap(ci.id)); }
for (const [fa, en] of Object.entries(AREA_EN)) NAME_EN.set(fa, en);
NAME_EN.set('موقعیت فعلی', 'Current location');

/** Place label in the UI language: "نزدیک ونک" → "Near Vanak" in English. */
export function placeName(name: string | null | undefined): string {
  if (!name) return '';
  if (locale() !== 'en-US') return name;
  const near = name.match(/^نزدیک (.+)$/);
  if (near) return `Near ${NAME_EN.get(near[1]) ?? near[1]}`;
  return NAME_EN.get(name) ?? name;
}
