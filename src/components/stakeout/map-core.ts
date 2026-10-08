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

// ── Markers ────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

/** A little person, for the avatar marker style. */
const personIcon = () => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const head = document.createElementNS(SVG_NS, "circle");
  head.setAttribute("cx", "12");
  head.setAttribute("cy", "8");
  head.setAttribute("r", "4");
  const body = document.createElementNS(SVG_NS, "path");
  body.setAttribute("d", "M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z");
  svg.append(head, body);
  return svg;
};

export function pinElement(className: string, text: string, color: string, title: string, style: MarkerStyle = "number") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `stk-pin ${className} ${style === "avatar" ? "avatar" : ""}`;
  el.style.setProperty("--pin", color);
  el.title = title;
  const label = document.createElement("span");
  label.textContent = text;
  if (style === "avatar") {
    el.appendChild(personIcon());
    label.className = "badge";
  }
  el.appendChild(label);
  return el;
}

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

const segmentsCross = (a: XY, b: XY, c: XY, d: XY) => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = cross(rx, ry, sx, sy);
  if (denom === 0) return false;
  const t = cross(c.x - a.x, c.y - a.y, sx, sy) / denom;
  const u = cross(c.x - a.x, c.y - a.y, rx, ry) / denom;
  return t > 0 && t < 1 && u > 0 && u < 1;
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
    const box = { minX: Math.min(s.x, t.x), minY: Math.min(s.y, t.y), maxX: Math.max(s.x, t.x), maxY: Math.max(s.y, t.y) };
    const hit = footprints.some((f) => {
      if (f.maxX < box.minX || f.minX > box.maxX || f.maxY < box.minY || f.minY > box.maxY) return false;
      if (inside(s, f.ring)) return false;
      for (let i = 0, j = f.ring.length - 1; i < f.ring.length; j = i++) {
        if (segmentsCross(s, t, f.ring[j], f.ring[i])) return true;
      }
      return false;
    });
    if (hit) blocked.add(spot.key);
  }
  return blocked;
}

export const spotKey = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
