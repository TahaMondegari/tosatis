import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapProvider } from '../lib/mapProviders';

import { tr } from '../lib/i18n';
type Pin = { id: string; name: string; lat: number; lng: number; label: string; best?: boolean; sub?: string };

/** Real tiled map (only loaded when a provider is configured) with an animated route to the recommended shop. */
export default function MapView({ user, shops, onPick, height = 300, provider }: { user: { lat: number; lng: number } | null; shops: Pin[]; onPick?: (id: string) => void; height?: number; provider: MapProvider }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const dark = document.documentElement.dataset.theme !== 'light';
    const m = L.map(el.current, { zoomControl: false, attributionControl: true });
    L.tileLayer(provider.url(dark), { maxZoom: 19, attribution: provider.attribution, subdomains: provider.subdomains ?? 'abc' }).addTo(m);
    L.control.zoom({ position: 'bottomleft' }).addTo(m);
    const pts: L.LatLngExpression[] = [];
    const best = shops.find((s) => s.best) ?? shops[0];
    if (user && best) {
      L.polyline([[user.lat, user.lng], [best.lat, best.lng]], { className: 'ty-route', weight: 4, opacity: 0.9 }).addTo(m);
    }
    for (const s of shops) {
      const icon = L.divIcon({ className: '', html: `<div class="ty-pin${s.id === best?.id ? ' best' : ''}"><span>${s.label}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
      const mk = L.marker([s.lat, s.lng], { icon }).addTo(m);
      mk.bindTooltip(`${s.name}${s.sub ? ` · ${s.sub}` : ''}`, { direction: 'top', offset: [0, -28] });
      if (onPick) mk.on('click', () => onPick(s.id));
      pts.push([s.lat, s.lng]);
    }
    if (user) {
      L.marker([user.lat, user.lng], { icon: L.divIcon({ className: '', html: '<div class="ty-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(m).bindTooltip(tr("تو اینجایی"));
      pts.push([user.lat, user.lng]);
    }
    if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 });
    else m.setView([35.6997, 51.4], 12);
    return () => { m.remove(); };
  }, [user?.lat, user?.lng, shops.map((s) => s.id).join(), provider.id]);
  return <div ref={el} style={{ height }} className="overflow-hidden rounded-2xl border border-line" />;
}
