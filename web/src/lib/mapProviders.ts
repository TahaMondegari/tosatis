// Map tile providers. Pick one at build time:
//   VITE_MAP_PROVIDER = carto | osm | maptiler | stadia | mapir | custom   (empty → built-in sketch map, no network)
//   VITE_MAP_KEY      = API key for providers that need one
//   VITE_MAP_TILE_URL = template for `custom` ({z}/{x}/{y}, optional {theme} = light|dark, {key})
//
// | provider | where                         | key  | cost                                   | get it                         |
// |----------|-------------------------------|------|----------------------------------------|--------------------------------|
// | carto    | foreign (CARTO basemaps)      | no   | free (fair use)                        | —                              |
// | osm      | foreign (openstreetmap.org)   | no   | free, low traffic only                 | —                              |
// | maptiler | foreign                       | yes  | free tier ~100k tiles/mo, then paid    | https://cloud.maptiler.com     |
// | stadia   | foreign                       | yes  | free for dev/non-commercial, paid plans| https://client.stadiamaps.com  |
// | mapir    | Iranian (Map.ir)              | yes  | free tier on signup, then paid         | https://corp.map.ir            |
// | custom   | any XYZ raster (e.g. Neshan/Parsimap tiles via your own proxy) | depends | — |
//
// Neshan's web map is delivered through its own SDK (key from https://platform.neshan.org), not raw XYZ tiles;
// put a tile proxy URL in VITE_MAP_TILE_URL to use it here. Navigation buttons open the Neshan app either way.

export type MapProvider = { id: string; url: (dark: boolean) => string; attribution: string; subdomains?: string };

const KEY = (import.meta.env.VITE_MAP_KEY as string | undefined) ?? '';
const ID = ((import.meta.env.VITE_MAP_PROVIDER as string | undefined) ?? '').trim().toLowerCase();
const CUSTOM = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ?? '';

const PROVIDERS: Record<string, MapProvider> = {
  carto: { id: 'carto', url: (d) => `https://{s}.basemaps.cartocdn.com/${d ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd' },
  osm: { id: 'osm', url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  maptiler: { id: 'maptiler', url: (d) => `https://api.maptiler.com/maps/${d ? 'streets-v2-dark' : 'streets-v2'}/{z}/{x}/{y}.png?key=${KEY}`, attribution: '&copy; MapTiler &copy; OpenStreetMap' },
  stadia: { id: 'stadia', url: (d) => `https://tiles.stadiamaps.com/tiles/${d ? 'alidade_smooth_dark' : 'alidade_smooth'}/{z}/{x}/{y}{r}.png?api_key=${KEY}`, attribution: '&copy; Stadia Maps &copy; OpenStreetMap' },
  mapir: { id: 'mapir', url: () => `https://map.ir/shiveh/xyz/1.0.0/Shiveh:Shiveh@EPSG:3857@png/{z}/{x}/{y}.png?x-api-key=${KEY}`, attribution: '&copy; Map.ir' },
  custom: { id: 'custom', url: (d) => CUSTOM.replace('{theme}', d ? 'dark' : 'light').replace('{key}', KEY), attribution: (import.meta.env.VITE_MAP_ATTRIBUTION as string) || '&copy; OpenStreetMap' },
};

const NEEDS_KEY = new Set(['maptiler', 'stadia', 'mapir']);

/** Active provider, or null → use the sketch map. */
export const mapProvider: MapProvider | null = (() => {
  const id = ID || (CUSTOM ? 'custom' : '');
  const p = PROVIDERS[id];
  if (!p) return null;
  if (NEEDS_KEY.has(id) && !KEY) { console.warn(`[map] ${id} needs VITE_MAP_KEY; falling back to sketch map`); return null; }
  if (id === 'custom' && !CUSTOM) return null;
  return p;
})();
