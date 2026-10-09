/**
 * Raster base maps for the investigator map. Premium styles (Mapbox,
 * Thunderforest) show when their key is set and replace their keyless
 * stand-ins; without keys the stand-ins show instead.
 * Stadia (dark, toner, streets stand-in) works keyless on localhost; on a real
 * domain either add the domain in the Stadia dashboard or set VITE_STADIA_KEY.
 */
export type BasemapId =
  | "dark"
  | "satellite-streets"
  | "satellite"
  | "mapbox"
  | "streets"
  | "light"
  | "toner"
  | "transport"
  | "transport-dark"
  | "transit"
  | "osm";

export type Basemap = {
  id: BasemapId;
  label: string;
  hint: string;
  recommended?: boolean;
  /** Dark styles get light overlays and dark 3D buildings. */
  tone: "dark" | "light";
  tiles: string[] | null;
  tileSize: 256 | 512;
  attribution: string;
  maxzoom: number;
  /** Keyless stand-in, hidden when this premium style is available. */
  replacedBy?: BasemapId;
};

const env = import.meta.env;
const stadiaKey = env.VITE_STADIA_KEY ? `?api_key=${env.VITE_STADIA_KEY}` : "";
const mapboxToken = env.VITE_MAPBOX_TOKEN as string | undefined;
const thunderforestKey = env.VITE_THUNDERFOREST_KEY as string | undefined;

const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const STADIA = '© <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a>';
const MAPBOX = '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a>';
const THUNDERFOREST = '© <a href="https://www.thunderforest.com/" target="_blank" rel="noreferrer">Thunderforest</a>';

const mapbox = (style: string) =>
  mapboxToken ? [`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`] : null;
const thunderforest = (style: string) =>
  thunderforestKey ? [`https://tile.thunderforest.com/${style}/{z}/{x}/{y}@2x.png?apikey=${thunderforestKey}`] : null;

const ALL_BASEMAPS: Basemap[] = [
  {
    id: "dark",
    label: "Dark",
    hint: "Stadia Alidade Smooth Dark",
    recommended: true,
    tone: "dark",
    tiles: [`https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png${stadiaKey}`],
    tileSize: 256,
    attribution: `${STADIA} ${OSM}`,
    maxzoom: 20,
  },
  {
    id: "satellite-streets",
    label: "Satellite + labels",
    hint: "Mapbox: imagery with street names and numbers",
    tone: "dark",
    tiles: mapbox("satellite-streets-v12"),
    tileSize: 512,
    attribution: `${MAPBOX} ${OSM} © Maxar`,
    maxzoom: 22,
  },
  {
    id: "satellite",
    label: "Satellite",
    hint: "Esri World Imagery: often a different date than Mapbox",
    tone: "dark",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    attribution: "Tiles © Esri — Maxar, Earthstar Geographics",
    maxzoom: 19,
  },
  {
    id: "mapbox",
    label: "Streets",
    hint: "Mapbox Streets: names, shops, house numbers",
    tone: "light",
    tiles: mapbox("streets-v12"),
    tileSize: 512,
    attribution: `${MAPBOX} ${OSM}`,
    maxzoom: 22,
  },
  {
    id: "streets",
    label: "Streets",
    hint: "Stadia OSM Bright: street names and shops",
    tone: "light",
    tiles: [`https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}@2x.png${stadiaKey}`],
    tileSize: 256,
    attribution: `${STADIA} © OpenMapTiles ${OSM}`,
    maxzoom: 20,
    replacedBy: "mapbox",
  },
  {
    id: "light",
    label: "Light",
    hint: "CartoDB Positron",
    tone: "light",
    tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`),
    tileSize: 256,
    attribution: `© <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> ${OSM}`,
    maxzoom: 20,
  },
  {
    id: "toner",
    label: "High contrast",
    hint: "Stamen Toner",
    tone: "light",
    tiles: [`https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}@2x.png${stadiaKey}`],
    tileSize: 256,
    attribution: `${STADIA} © Stamen Design ${OSM}`,
    maxzoom: 20,
  },
  {
    id: "transport-dark",
    label: "Transport dark",
    hint: "Thunderforest: bus, rail and road classes at night",
    tone: "dark",
    tiles: thunderforest("transport-dark"),
    tileSize: 256,
    attribution: `${THUNDERFOREST} ${OSM}`,
    maxzoom: 22,
  },
  {
    id: "transport",
    label: "Transport",
    hint: "Thunderforest: bus, rail and road classes",
    tone: "light",
    tiles: thunderforest("transport"),
    tileSize: 256,
    attribution: `${THUNDERFOREST} ${OSM}`,
    maxzoom: 22,
  },
  {
    id: "transit",
    label: "Transit",
    hint: "ÖPNVKarte: bus, rail and stops",
    tone: "light",
    tiles: ["https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png"],
    tileSize: 256,
    attribution: `Map <a href="https://memomaps.de/" target="_blank" rel="noreferrer">memomaps.de</a> CC-BY-SA ${OSM}`,
    maxzoom: 18,
    replacedBy: "transport",
  },
  {
    id: "osm",
    label: "Street map",
    hint: "OpenStreetMap standard",
    tone: "light",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    attribution: OSM,
    maxzoom: 19,
  },
];

const available = (id: BasemapId) => Boolean(ALL_BASEMAPS.find((b) => b.id === id)?.tiles);

/** What the switcher offers: every style with tiles, minus stand-ins whose premium version is there. */
export const BASEMAPS: Basemap[] = ALL_BASEMAPS.filter((b) => b.tiles && !(b.replacedBy && available(b.replacedBy)));

/** A saved choice that is no longer offered falls back to its premium version, then to the default. */
export const basemapById = (id: string | null | undefined): Basemap => {
  const saved = ALL_BASEMAPS.find((b) => b.id === id);
  const target = saved?.replacedBy && available(saved.replacedBy) ? saved.replacedBy : id;
  return BASEMAPS.find((b) => b.id === target) ?? BASEMAPS[0];
};

type Expression = unknown[];

/**
 * Building footprints and heights for the 3D view, on top of any base map.
 * Mapbox has far more US houses mapped than OpenStreetMap, so it is used when
 * there is a token; OpenFreeMap (OpenStreetMap buildings) otherwise.
 */
export const BUILDINGS: {
  source: { type: "vector"; url?: string; tiles?: string[]; maxzoom?: number; attribution: string };
  sourceLayer: string;
  height: Expression;
  base: Expression;
  filter?: Expression;
} = mapboxToken
  ? {
      source: {
        type: "vector",
        tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${mapboxToken}`],
        maxzoom: 16,
        attribution: MAPBOX,
      },
      sourceLayer: "building",
      height: ["coalesce", ["get", "height"], 6],
      base: ["coalesce", ["get", "min_height"], 0],
      filter: ["all", ["!=", ["get", "underground"], "true"], ["!=", ["get", "extrude"], "false"]],
    }
  : {
      source: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
      },
      sourceLayer: "building",
      height: ["coalesce", ["get", "render_height"], 6],
      base: ["coalesce", ["get", "render_min_height"], 0],
    };

/** How buildings look over a base map: solid on drawn maps, see-through over imagery so roofs show. */
export const buildingLook = (base: Basemap): { color: Expression | string; opacity: number } => {
  if (base.id.startsWith("satellite")) {
    return { color: ["interpolate", ["linear"], BUILDINGS.height, 0, "#e9e4da", 30, "#f6f3ee"], opacity: 0.55 };
  }
  if (base.tone === "dark") {
    return { color: ["interpolate", ["linear"], BUILDINGS.height, 0, "#283043", 40, "#3a4560"], opacity: 0.9 };
  }
  return { color: ["interpolate", ["linear"], BUILDINGS.height, 0, "#d7dbe3", 40, "#c3c9d6"], opacity: 0.9 };
};
