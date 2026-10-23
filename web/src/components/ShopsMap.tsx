import { lazy, Suspense, useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { km as fmtKm, minutes } from '../lib/format';
import { mapProvider } from '../lib/mapProviders';

import { tr } from '../lib/i18n';
const TiledMap = lazy(() => import('./MapView'));

type Pin = { id: string; name: string; lat: number; lng: number; label: string; best?: boolean; sub?: string };
type Pt = { lat: number; lng: number };

const kmBetween = (a: Pt, b: Pt) => {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/** Deterministic pseudo-random so the drawn streets stay the same for the same place. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

/** Faux city: avenues, side streets, blocks, a park and a river — purely decorative context. */
function CityBackdrop({ W, H, seed, gid }: { W: number; H: number; seed: number; gid: string }) {
  const g = useMemo(() => {
    const r = rng(seed);
    const avenues = Array.from({ length: 3 }, (_, i) => {
      const y = (H / 4) * (i + 1) + (r() - 0.5) * 30;
      return `M-20 ${y} C ${W * 0.3} ${y + (r() - 0.5) * 50}, ${W * 0.7} ${y + (r() - 0.5) * 50}, ${W + 20} ${y + (r() - 0.5) * 30}`;
    });
    const cross = Array.from({ length: 4 }, (_, i) => {
      const x = (W / 5) * (i + 1) + (r() - 0.5) * 40;
      return `M${x} -20 C ${x + (r() - 0.5) * 40} ${H * 0.4}, ${x + (r() - 0.5) * 40} ${H * 0.6}, ${x + (r() - 0.5) * 30} ${H + 20}`;
    });
    const blocks = Array.from({ length: 16 }, () => ({ x: r() * W, y: r() * H, w: 18 + r() * 34, h: 14 + r() * 26, o: 0.35 + r() * 0.4 }));
    const park = { x: r() * W * 0.6 + W * 0.1, y: r() * H * 0.5 + H * 0.1, rx: 30 + r() * 24, ry: 18 + r() * 14 };
    const ry = H * (0.2 + r() * 0.6);
    const river = `M-20 ${ry} Q ${W * 0.25} ${ry - 40} ${W * 0.5} ${ry + 10} T ${W + 20} ${ry - 10}`;
    return { avenues, cross, blocks, park, river };
  }, [W, H, seed]);
  return (
    <g aria-hidden>
      <rect width={W} height={H} fill={`url(#${gid}-bg)`} />
      {g.blocks.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill="var(--surface-3)" opacity={b.o} />)}
      <ellipse cx={g.park.x} cy={g.park.y} rx={g.park.rx} ry={g.park.ry} fill="var(--ok)" opacity=".10" />
      <path d={g.river} fill="none" stroke="var(--accent)" strokeOpacity=".10" strokeWidth="14" strokeLinecap="round" />
      {g.cross.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke="var(--border)" strokeWidth="5" strokeLinecap="round" />)}
      {g.avenues.map((d, i) => <path key={`a${i}`} d={d} fill="none" stroke="var(--border-strong)" strokeOpacity=".55" strokeWidth="8" strokeLinecap="round" />)}
      {g.avenues.map((d, i) => <path key={`am${i}`} d={d} fill="none" stroke="var(--surface)" strokeOpacity=".5" strokeWidth="1" strokeDasharray="6 8" />)}
    </g>
  );
}

/** Sketch map: real relative positions of you and the shops over a decorative city, with a curved route. */
export function Schematic({ user, shops, onPick, height = 260, etaMinutes }: { user: Pt | null; shops: Pin[]; onPick?: (id: string) => void; height?: number; etaMinutes?: number | null }) {
  const gid = useId().replace(/:/g, '');
  const W = 360, H = height;
  const pts = [...shops, ...(user ? [user] : [])];
  if (!pts.length) return null;
  const cos = Math.cos((pts[0].lat * Math.PI) / 180);
  const xs = pts.map((p) => p.lng * cos), ys = pts.map((p) => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 44;
  const dx = Math.max(maxX - minX, 0.002), dy = Math.max(maxY - minY, 0.002);
  const sc = Math.min((W - pad * 2) / dx, (H - pad * 2) / dy);
  const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
  const proj = (p: Pt) => ({ x: W / 2 + (p.lng * cos - cx0) * sc, y: H / 2 - (p.lat - cy0) * sc });
  const u = user ? proj(user) : null;
  const best = shops.find((s) => s.best) ?? shops[0];
  const b = best ? proj(best) : null;
  // Curved route: control point offset perpendicular to the straight line
  const route = u && b ? (() => {
    const mx = (u.x + b.x) / 2, my = (u.y + b.y) / 2, len = Math.hypot(b.x - u.x, b.y - u.y) || 1;
    const nx = -(b.y - u.y) / len, ny = (b.x - u.x) / len, bend = Math.min(60, len * 0.28);
    return { d: `M${u.x} ${u.y} Q ${mx + nx * bend} ${my + ny * bend} ${b.x} ${b.y}`, lx: mx + nx * bend * 0.55, ly: my + ny * bend * 0.55 };
  })() : null;
  const dist = user && best ? kmBetween(user, best) : null;
  // Scale bar: pixels per km at this zoom
  const pxPerKm = sc / 111;
  const scaleKm = [0.2, 0.5, 1, 2, 5, 10].find((k) => k * pxPerKm >= 40) ?? 10;
  const seed = Math.round((best?.lat ?? 35.7) * 1000 + (best?.lng ?? 51.4) * 1000);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={tr("نقشه شماتیک مسیر تا فروشگاه")}>
        <defs>
          <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--surface-2)" /><stop offset="1" stopColor="var(--surface)" /></linearGradient>
          <linearGradient id={`${gid}-route`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent)" stopOpacity=".55" /><stop offset="1" stopColor="var(--accent)" /></linearGradient>
          <radialGradient id={`${gid}-glow`}><stop offset="0" stopColor="var(--accent)" stopOpacity=".4" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
          <filter id={`${gid}-sh`} x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".3" /></filter>
        </defs>
        <CityBackdrop W={W} H={H} seed={seed} gid={gid} />

        {/* faint lines to other shops */}
        {u && shops.filter((s) => s.id !== best?.id).map((s, i) => {
          const p = proj(s);
          return <motion.line key={`l${s.id}`} x1={u.x} y1={u.y} x2={p.x} y2={p.y} stroke="var(--muted)" strokeOpacity=".35" strokeWidth="1" strokeDasharray="3 5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.3 + 0.04 * i }} />;
        })}

        {/* main route: casing, drawn line, then flowing dashes */}
        {route && (
          <>
            <path d={route.d} fill="none" stroke="var(--bg)" strokeOpacity=".6" strokeWidth="9" strokeLinecap="round" />
            <motion.path d={route.d} fill="none" stroke={`url(#${gid}-route)`} strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
            <motion.path d={route.d} fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 9" initial={{ opacity: 0 }} animate={{ opacity: 0.9, strokeDashoffset: [0, -44] }} transition={{ opacity: { delay: 1.1 }, strokeDashoffset: { duration: 1.4, repeat: Infinity, ease: 'linear' } }} />
            {dist != null && (
              <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, type: 'spring', stiffness: 300, damping: 18 }} style={{ transformOrigin: `${route.lx}px ${route.ly}px` }}>
                <rect x={route.lx - 44} y={route.ly - 13} width="88" height="26" rx="13" fill="var(--surface)" stroke="var(--border)" filter={`url(#${gid}-sh)`} />
                <text x={route.lx} y={route.ly + 4.5} textAnchor="middle" className="fill-[var(--text)] text-[12px] font-extrabold">{fmtKm(dist)}{etaMinutes ? ` · ${minutes(etaMinutes)}` : ''}</text>
              </motion.g>
            )}
          </>
        )}

        {/* shop pins drop in */}
        {shops.map((s, i) => {
          const p = proj(s);
          const isBest = s.id === best?.id;
          return (
            <motion.g key={s.id} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.35 + 0.05 * i }} style={{ cursor: onPick ? 'pointer' : undefined }} onClick={() => onPick?.(s.id)}>
              <title>{`${s.name}${s.sub ? ` · ${s.sub}` : ''}`}</title>
              {isBest && <circle cx={p.x} cy={p.y - 14} r="22" fill={`url(#${gid}-glow)`}><animate attributeName="r" values="16;26;16" dur="2.2s" repeatCount="indefinite" /></circle>}
              <path d={`M${p.x} ${p.y} l-${isBest ? 9 : 7} -${isBest ? 11 : 9} a${isBest ? 12 : 10} ${isBest ? 12 : 10} 0 1 1 ${isBest ? 18 : 14} 0 z`} fill={isBest ? 'var(--accent)' : 'var(--surface)'} stroke={isBest ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth="1.5" filter={`url(#${gid}-sh)`} />
              <text x={p.x} y={p.y - (isBest ? 16 : 13)} textAnchor="middle" className={`text-[10.5px] font-extrabold ${isBest ? 'fill-[var(--on-primary)]' : 'fill-[var(--text)]'}`}>{s.label}</text>
              {isBest && shops.length <= 3 && (
                <text x={p.x} y={p.y + 14} textAnchor="middle" className="fill-[var(--text)] text-[11px] font-bold" style={{ paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>{s.name.slice(0, 18)}</text>
              )}
            </motion.g>
          );
        })}

        {/* you */}
        {u && (
          <g>
            <circle cx={u.x} cy={u.y} r="24" fill={`url(#${gid}-glow)`}><animate attributeName="r" values="12;28;12" dur="2.4s" repeatCount="indefinite" /></circle>
            <circle cx={u.x} cy={u.y} r="8" fill="var(--accent)" stroke="var(--surface)" strokeWidth="3" filter={`url(#${gid}-sh)`} />
            <text x={u.x} y={u.y + 24} textAnchor="middle" className="fill-[var(--text)] text-[11px] font-extrabold" style={{ paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>{tr("تو")}</text>
          </g>
        )}

        {/* compass + scale */}
        <g transform={`translate(${W - 22} 22)`} aria-hidden>
          <circle r="13" fill="var(--surface)" stroke="var(--border)" />
          <path d="M0 -8 L4 2 L0 0 L-4 2 Z" fill="var(--accent)" />
          <text y="11" textAnchor="middle" className="fill-[var(--muted)] text-[7px] font-bold">N</text>
        </g>
        <g transform={`translate(14 ${H - 16})`} aria-hidden>
          <rect width={scaleKm * pxPerKm} height="4" rx="2" fill="var(--muted)" opacity=".6" />
          <text x={scaleKm * pxPerKm + 6} y="5" className="fill-[var(--muted)] text-[10px] font-semibold">{fmtKm(scaleKm)}</text>
        </g>
      </svg>
      <span className="absolute top-2 right-2 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-muted backdrop-blur">{tr("نقشه طرح‌واره · فاصله مستقیم")}</span>
    </div>
  );
}

export function ShopsMap(props: { user: Pt | null; shops: Pin[]; onPick?: (id: string) => void; height?: number; etaMinutes?: number | null }) {
  if (!mapProvider) return <Schematic {...props} />;
  return <Suspense fallback={<div className="skeleton" style={{ height: props.height ?? 260 }} />}><TiledMap {...props} provider={mapProvider} /></Suspense>;
}
