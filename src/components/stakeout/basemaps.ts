/**
 * Raster base maps for the investigator map. Keyless ones always work; Mapbox
 * and Thunderforest need a key in the frontend env and are hidden without it.
 * Stadia (dark, toner) works keyless on localhost; on a real domain either add
 * the domain in the Stadia dashboard or set VITE_STADIA_KEY.
 */
export type BasemapId = "dark" | "light" | "satellite" | "toner" | "streets" | "transit" | "mapbox" | "transport" | "osm";

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
  /** Why it cannot be used right now. */
  missing?: string;
};

const env = import.meta.env;
const stadiaKey = env.VITE_STADIA_KEY ? `?api_key=${env.VITE_STADIA_KEY}` : "";
const mapboxToken = env.VITE_MAPBOX_TOKEN as string | undefined;
const thunderforestKey = env.VITE_THUNDERFOREST_KEY as string | undefined;

const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const STADIA = '© <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a>';

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
    id: "satellite",
    label: "Satellite",
    hint: "Esri World Imagery",
    tone: "dark",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    attribution: "Tiles © Esri — Maxar, Earthstar Geographics",
    maxzoom: 19,
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
    id: "streets",
    label: "Streets",
    hint: "Stadia OSM Bright: street names and shops",
    tone: "light",
    tiles: [`https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}@2x.png${stadiaKey}`],
    tileSize: 256,
    attribution: `${STADIA} © OpenMapTiles ${OSM}`,
    maxzoom: 20,
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
  },
  {
    id: "mapbox",
    label: "Mapbox Streets",
    hint: "Premium street detail",
    tone: "light",
    tiles: mapboxToken
      ? [`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`]
      : null,
    tileSize: 512,
    attribution: `© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> ${OSM}`,
    maxzoom: 22,
    missing: mapboxToken ? undefined : "Needs VITE_MAPBOX_TOKEN",
  },
  {
    id: "transport",
    label: "Transport",
    hint: "Thunderforest: transit and road classes",
    tone: "light",
    tiles: thunderforestKey ? [`https://tile.thunderforest.com/transport/{z}/{x}/{y}@2x.png?apikey=${thunderforestKey}`] : null,
    tileSize: 256,
    attribution: `© <a href="https://www.thunderforest.com/" target="_blank" rel="noreferrer">Thunderforest</a> ${OSM}`,
    maxzoom: 22,
    missing: thunderforestKey ? undefined : "Needs VITE_THUNDERFOREST_KEY",
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

/** Keyed styles only show up once their key is set. */
export const BASEMAPS: Basemap[] = ALL_BASEMAPS.filter((b) => b.tiles);

export const basemapById = (id: string | null | undefined): Basemap =>
  BASEMAPS.find((b) => b.id === id && b.tiles) ?? BASEMAPS[0];

/** Vector tiles with building heights, used for the 3D view on top of any base map. */
export const BUILDINGS_SOURCE = "https://tiles.openfreemap.org/planet";
export const BUILDINGS_ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>';
