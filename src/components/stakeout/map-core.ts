/**
 * Pieces shared by the investigator map and the small Sky View map: the base
 * style, building layers, marker elements, saved preferences, and the sight
 * check against the buildings the map has loaded.
 */
import maplibregl, { type Map as MapLibre } from "maplibre-gl";
import type { LatLng } from "@/lib/crm-api";
import { BUILDINGS, basemapById, buildingLook, type Basemap, type BasemapId } from "./basemaps";

// ── Preferences (shared by both maps) ──────────────────────────────────

export type MarkerStyle = "number" | "avatar";
export type MapPrefs = { basemap?: BasemapId; threeD?: boolean; markers?: MarkerStyle };

const PREFS_KEY = "stakeout-map";
const PREFS_EVENT = "stakeout-map-prefs";

export const readPrefs = (): MapPrefs => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
};

/** Saves and tells the other map, so both follow the same style and marker look. */
export const writePrefs = (patch: MapPrefs) => {
  const next = { ...readPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<MapPrefs>(PREFS_EVENT, { detail: next }));
};

export const onPrefsChange = (fn: (prefs: MapPrefs) => void) => {
  const handler = (e: Event) => fn((e as CustomEvent<MapPrefs>).detail);
  window.addEventListener(PREFS_EVENT, handler);
  return () => window.removeEventListener(PREFS_EVENT, handler);
};

// ── Style and layers ───────────────────────────────────────────────────

export const PITCH_3D = 60;

const rasterSource = (base: Basemap): maplibregl.RasterSourceSpecification => ({
  type: "raster",
  tiles: base.tiles ?? [],
  tileSize: base.tileSize,
  attribution: base.attribution,
  maxzoom: base.maxzoom,
});

export const baseStyle = (base: Basemap): maplibregl.StyleSpecification => ({
  version: 8,
  sources: { base: rasterSource(base), buildings: BUILDINGS.source },
  layers: [{ id: "base", type: "raster", source: "base" }],
});

const applyBuildingLook = (map: MapLibre, base: Basemap) => {
  const look = buildingLook(base);
  map.setPaintProperty("buildings-3d", "fill-extrusion-color", look.color as maplibregl.ExpressionSpecification);
  map.setPaintProperty("buildings-3d", "fill-extrusion-opacity", look.opacity);
};

/**
 * 3D buildings plus an invisible footprint layer. The footprint layer keeps
 * building tiles loaded in 2D too, which the sight check reads.
 */
export const addBuildingLayers = (map: MapLibre, base: Basemap, threeD: boolean) => {
  map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.35, position: [1.4, 210, 35] });
  const filter = BUILDINGS.filter ? { filter: BUILDINGS.filter as maplibregl.FilterSpecification } : {};
  map.addLayer({
    id: "buildings-footprint",
    type: "fill",
    source: "buildings",
    "source-layer": BUILDINGS.sourceLayer,
    minzoom: 14,
    ...filter,
    paint: { "fill-opacity": 0 },
  });
  map.addLayer({
    id: "buildings-3d",
    type: "fill-extrusion",
    source: "buildings",
    "source-layer": BUILDINGS.sourceLayer,
    minzoom: 14,
    ...filter,
    layout: { visibility: threeD ? "visible" : "none" },
    paint: {
      "fill-extrusion-height": BUILDINGS.height as maplibregl.ExpressionSpecification,
      "fill-extrusion-base": BUILDINGS.base as maplibregl.ExpressionSpecification,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  applyBuildingLook(map, base);
};

export const swapBasemap = (map: MapLibre, base: Basemap) => {
  map.removeLayer("base");
  map.removeSource("base");
  map.addSource("base", rasterSource(base));
  map.addLayer({ id: "base", type: "raster", source: "base" }, map.getStyle().layers[0]?.id);
  applyBuildingLook(map, base);
};

export const setThreeD = (map: MapLibre, on: boolean, bearing?: number) => {
  map.setLayoutProperty("buildings-3d", "visibility", on ? "visible" : "none");
  map.easeTo({ pitch: on ? PITCH_3D : 0, ...(bearing !== undefined && { bearing }), duration: 900 });
};

export const rotateBy = (map: MapLibre, degrees: number) => map.easeTo({ bearing: map.getBearing() + degrees, duration: 450 });

/** Cycles flat → tilted → steep, showing buildings once tilted. */
export const tiltStep = (map: MapLibre): boolean => {
  const pitch = map.getPitch();
  const next = pitch < 20 ? 45 : pitch < 55 ? 70 : 0;
  map.setLayoutProperty("buildings-3d", "visibility", next > 0 ? "visible" : "none");
  map.easeTo({ pitch: next, duration: 600 });
  return next > 0;
};

export { basemapById };

/**
 * Zoom that keeps every spot on screen once the map is tilted: bounds are
 * fitted flat, and a tilted view loses the far and near edges.
 */
export const fitZoom = (flatZoom: number, pitch: number) => flatZoom - (pitch / 60) * 0.8;

// ── Markers ────────────────────────────────────────────────────────────

/** In person mode the 3D figure stands on the spot; the label sits just below its feet. */
export const AVATAR_OFFSET: [number, number] = [0, 16];

export function pinElement(className: string, text: string, color: string, title: string, style: MarkerStyle = "number") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `stk-pin ${className} ${style === "avatar" ? "avatar" : ""}`;
  el.style.setProperty("--pin", color);
  el.title = title;
  const label = document.createElement("span");
  label.textContent = text;
  el.appendChild(label);
  return el;
}

// ── 3D people ──────────────────────────────────────────────────────────

/**
 * Figures are oversized (about 12 m tall) so they read at street zoom next
 * to houses; at true scale a person is a couple of pixels.
 */
const PERSON_PARTS = [
  { dx: -1.1, r: 0.9, base: 0, top: 4.2, shade: 0.75 },
  { dx: 1.1, r: 0.9, base: 0, top: 4.2, shade: 0.75 },
  { dx: 0, r: 2.3, base: 4.2, top: 8.6, shade: 1 },
  { dx: 0, r: 1.7, base: 9, top: 12, shade: 1.1 },
];

const shadeColor = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
};

const circle = (center: LatLng, dxM: number, radiusM: number) => {
  const kx = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  const ky = 110_540;
  const ring: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ring.push([center.lng + (dxM + Math.cos(a) * radiusM) / kx, center.lat + (Math.sin(a) * radiusM) / ky]);
  }
  return ring;
};

export type Person = LatLng & { color: string };

export const peopleData = (people: Person[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: people.flatMap((p) =>
    PERSON_PARTS.map((part) => ({
      type: "Feature" as const,
      properties: { color: shadeColor(p.color, part.shade), base: part.base, top: part.top },
      geometry: { type: "Polygon" as const, coordinates: [circle(p, part.dx, part.r)] },
    })),
  ),
});

export const addPeopleLayer = (map: MapLibre) => {
  map.addSource("people", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "people-3d",
    type: "fill-extrusion",
    source: "people",
    paint: {
      "fill-extrusion-color": ["get", "color"],
      "fill-extrusion-base": ["get", "base"],
      "fill-extrusion-height": ["get", "top"],
      "fill-extrusion-opacity": 0.96,
      "fill-extrusion-vertical-gradient": true,
    },
  });
};

export const setPeople = (map: MapLibre, people: Person[]) =>
  (map.getSource("people") as maplibregl.GeoJSONSource | undefined)?.setData(peopleData(people));

export function targetElement(hasFront: boolean) {
  const el = document.createElement("div");
  el.className = "stk-target";
  el.title = "Front of the house: what the camera has to see";
  el.appendChild(document.createElement("i"));
  if (hasFront) el.appendChild(document.createElement("b"));
  return el;
}

// ── Sight check against the map's buildings ────────────────────────────

type XY = { x: number; y: number };
type Footprint = { ring: XY[]; minX: number; minY: number; maxX: number; maxY: number };

const projector = (origin: LatLng) => {
  const kx = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const ky = 110_540;
  return (p: LatLng): XY => ({ x: (p.lng - origin.lng) * kx, y: (p.lat - origin.lat) * ky });
};

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/** Where along a→b (0..1) the segment c→d crosses it, or null. */
const crossingAt = (a: XY, b: XY, c: XY, d: XY): number | null => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = cross(rx, ry, sx, sy);
  if (denom === 0) return null;
  const t = cross(c.x - a.x, c.y - a.y, sx, sy) / denom;
  const u = cross(c.x - a.x, c.y - a.y, rx, ry) / denom;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? t : null;
};

const inside = (p: XY, ring: XY[]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

const areaOf = (ring: XY[]) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return Math.abs(sum / 2);
};

/** Sheds and kiosks under this size do not hide a car. */
const MIN_BLOCKING_M2 = 12;
/** A line that only clips a corner still sees past it. */
const MIN_CROSSING_M = 3;
/** Porch, garage and yard right at the front are part of the shot, not in its way. */
const TARGET_CLEARANCE_M = 6;

/** Metres of the segment a→b that run inside the ring. */
const lengthInside = (a: XY, b: XY, ring: XY[]) => {
  const cuts = [0, 1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const t = crossingAt(a, b, ring[j], ring[i]);
    if (t !== null) cuts.push(t);
  }
  if (cuts.length === 2) return 0;
  cuts.sort((x, y) => x - y);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  let inner = 0;
  for (let k = 1; k < cuts.length; k++) {
    const mid = (cuts[k - 1] + cuts[k]) / 2;
    if (inside({ x: a.x + (b.x - a.x) * mid, y: a.y + (b.y - a.y) * mid }, ring)) inner += (cuts[k] - cuts[k - 1]) * len;
  }
  return inner;
};

/**
 * Checks spots against the buildings drawn on the map (Mapbox has far more US
 * houses than OpenStreetMap, which the server planner reads). Returns the keys
 * of spots whose straight line to the target crosses a building. The subject's
 * house and any building the spot itself sits in are ignored.
 */
export function blockedSpots(map: MapLibre, target: LatLng, address: LatLng, spots: (LatLng & { key: string })[]): Set<string> {
  const blocked = new Set<string>();
  if (!map.getSource("buildings") || spots.length === 0) return blocked;
  const toXY = projector(target);
  const t = toXY(target);
  const home = toXY(address);

  const footprints: Footprint[] = [];
  for (const feature of map.querySourceFeatures("buildings", { sourceLayer: BUILDINGS.sourceLayer })) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const polygon of polygons) {
      const ring = (polygon[0] ?? []).map(([lng, lat]) => toXY({ lat, lng }));
      if (ring.length < 4 || areaOf(ring) < MIN_BLOCKING_M2) continue;
      if (inside(t, ring) || inside(home, ring)) continue;
      const xs = ring.map((p) => p.x);
      const ys = ring.map((p) => p.y);
      footprints.push({ ring, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) });
    }
  }
  if (footprints.length === 0) return blocked;

  for (const spot of spots) {
    const s = toXY(spot);
    const span = Math.hypot(s.x - t.x, s.y - t.y);
    if (span <= TARGET_CLEARANCE_M) continue;
    const k = TARGET_CLEARANCE_M / span;
    const end = { x: t.x + (s.x - t.x) * k, y: t.y + (s.y - t.y) * k };
    const box = { minX: Math.min(s.x, end.x), minY: Math.min(s.y, end.y), maxX: Math.max(s.x, end.x), maxY: Math.max(s.y, end.y) };
    const hit = footprints.some((f) => {
      if (f.maxX < box.minX || f.minX > box.maxX || f.maxY < box.minY || f.minY > box.maxY) return false;
      if (inside(s, f.ring)) return false;
      return lengthInside(s, end, f.ring) >= MIN_CROSSING_M;
    });
    if (hit) blocked.add(spot.key);
  }
  return blocked;
}

export const spotKey = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
