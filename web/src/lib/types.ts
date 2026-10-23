export type TravelMode = 'car' | 'taxi' | 'transit' | 'motor' | 'walk';

export type OpenState = {
  state: 'open' | 'closed' | 'unknown' | 'open_unknown_hours';
  closesAt?: number;
  opensAt?: { day: string; minutes: number };
  closingSoon?: boolean;
  label: string;
};

export type Freshness = { days: number | null; level: 'fresh' | 'ok' | 'stale' | 'unknown'; label: string };

export type Payment = { provider: string; channel: 'in_person' | 'unknown'; min: number | null; max: number | null };

export type ShopBrief = {
  id: string; name: string; address: string; area: string | null; lat: number; lng: number;
  mall: string | null; floor: string | null; unit: string | null; phone: string | null;
  instagram: string | null; website: string | null; fastDelivery: boolean | null;
  installment: boolean; torobPay: boolean; torobPayInPerson: boolean; payments: Payment[];
  open: OpenState; distanceKm: number | null; etaMinutes: number | null; travelMode: TravelMode; realName: boolean; nOffers: number;
};

export type ShopFull = ShopBrief & {
  categories: string[];
  hours: { day: string; dayFa: string; text: string; closed: boolean }[] | null;
  mallInfo: { name: string; floor: string | null; unit: string | null; torobShopsInMall: number } | null;
  neighbors: { id: string; name: string; floor: string | null; unit: string | null; cats: string[] }[];
  findTips: string[];
  topProducts: { id: string; title: string; image: string | null; price: number | null; freshness: Freshness }[];
};

export type Offer = {
  offerId: number; price: number | null; sellerTitle: string; description: string | null;
  warranty: { provider: string; months: number | null; real: boolean } | null;
  changedAt: string | null; freshness: Freshness; stock: 'unverified'; shop: ShopBrief;
  score?: number; reasons?: string[]; badges?: string[];
};

export type ProductBrief = {
  id: string; title: string; brand: string | null; category: string | null; image: string | null;
  minPrice: number | null; maxPrice: number | null; nShops: number; nOffers: number; lastChange: string | null;
  highlights: { key: string; value: string }[];
};

export type ProductCard = ProductBrief & {
  images?: string[];
  shopsCount?: number;
  priceStats?: { min: number; max: number; median: number } | null;
  nearest?: { shopId: string; name: string; area: string | null; mall: string | null; distanceKm: number | null; etaMinutes: number | null; open: OpenState; price: number | null } | null;
  freshness?: Freshness | null;
};

export type ProductFull = ProductBrief & { images: string[]; specs: { key: string; value: string }[]; model: string | null };

export type OffersResult = {
  product: ProductBrief; total: number; filteredOut: number; filteredOutReasons: Record<string, number>;
  stats: { min: number; max: number; median: number } | null; offers: Offer[];
};

export type UIBlock = { id: string; component: string; props: any; summary: string };

export type Part =
  | { kind: 'text'; text: string }
  | { kind: 'ui'; block: UIBlock; answer?: unknown };

export type Message = {
  id: string; role: 'user' | 'assistant'; parts: Part[]; at: number;
  status?: 'streaming' | 'done' | 'error'; statusText?: string; local?: boolean;
};

export type Chat = { id: string; title: string; at: number; messages: Message[]; mode?: TravelMode; installmentOnly?: boolean };

export type Purchase = { id: string; shopId: string; shopName: string; productId?: string; productTitle?: string; at: number; status: 'pending' | 'asked' | 'done' | 'dismissed'; rating?: { find: number; buy: number; match?: number; bought: boolean; note?: string } };

export type Profile = {
  name: string; city: string; province?: string; areaName: string | null; lat: number | null; lng: number | null;
  locationSource: 'gps' | 'area' | null; mode: TravelMode; installmentOnly: boolean; priorities: string[];
};

export type InquiryStatus = 'pending' | 'available' | 'unavailable' | 'no_answer' | 'closed';
export type Inquiry = { shopId: string; shopName: string; productId?: string; productTitle?: string; status: InquiryStatus; price?: number | null; note?: string; at: number };

export type PlanItem = { shopId: string; shopName: string; productId?: string; productTitle?: string; price?: number | null; addedAt: number };
