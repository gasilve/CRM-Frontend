import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibre, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Axis3d, ChevronDown, RotateCcw, RotateCw, Star } from "lucide-react";
import type { LatLng, StakeoutPlan, StakeoutPosition } from "@/lib/crm-api";
import { BASEMAPS, basemapById, type BasemapId } from "./basemaps";
import {
  addBuildingLayers,
  baseStyle,
  blockedSpots,
  fitZoom,
  onPrefsChange,
  SUGGESTIONS_SHOWN,
  pinElement,
  rankSuggestions,
  readPrefs,
  rotateBy,
  spotKey,
  swapBasemap,
  targetElement,
  tiltStep,
  writePrefs,
} from "./map-core";
import { STAKEOUT_STATUS, SUGGESTION_COLOR } from "./StakeoutMapModal";
import "./stakeout-map.css";

/**
 * The stakeout card's map in Sky View: saved spots and the suggestions that
 * survive the sight check, with its own style picker, rotate and tilt.
 */
export function StakeoutMiniMap({
  plan,
  positions,
  home,
  onSuggestionsShown,
}: {
  plan: StakeoutPlan | null;
  positions: StakeoutPosition[];
  /** Where to look before the plan arrives. */
  home: LatLng | null;
  onSuggestionsShown?: (count: number) => void;
}) {
  const prefs = useMemo(readPrefs, []);
  const [basemapId, setBasemapId] = useState<BasemapId>(basemapById(prefs.basemap).id);
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(() => new Set());
  const basemap = basemapById(basemapId);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markers = useRef<Marker[]>([]);
  const checkSight = useRef(() => {});

  useEffect(
    () =>
      onPrefsChange((next) => {
        if (next.basemap) setBasemapId(basemapById(next.basemap).id);
      }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const start = plan?.plan.target ?? home ?? { lat: 39.8, lng: -98.5 };
    const threeD = prefs.threeD ?? true;
    const map = new maplibregl.Map({
      container,
      style: baseStyle(basemap),
      center: [start.lng, start.lat],
      zoom: plan || home ? 16.5 : 3,
      pitch: threeD ? 50 : 0,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      addBuildingLayers(map, basemap, threeD);
      setReady(true);
    });
    map.on("idle", () => checkSight.current());
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Created once; later changes go through the effects below.
  }, []);

  const appliedBase = useRef(basemap.id);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || appliedBase.current === basemap.id) return;
    appliedBase.current = basemap.id;
    swapBasemap(map, basemap);
  }, [basemap, ready]);

  useEffect(() => setBlocked(new Set()), [plan]);

  checkSight.current = () => {
    const map = mapRef.current;
    const p = plan?.plan;
    if (!map || !p) return;
    const spots = [...p.suggestions, ...positions].map((s) => ({ lat: s.lat, lng: s.lng, key: spotKey(s) }));
    const hits = blockedSpots(map, p.target, p.house ?? p.address, spots);
    setBlocked((prev) => {
      const fresh = [...hits].filter((k) => !prev.has(k));
      return fresh.length ? new Set([...prev, ...fresh]) : prev;
    });
  };
  useEffect(() => {
    if (ready) checkSight.current();
  }, [ready, plan, positions]);

  const suggestions = useMemo(() => rankSuggestions(plan?.plan.suggestions ?? [], blocked), [plan, blocked]);
  useEffect(() => onSuggestionsShown?.(suggestions.length), [suggestions.length, onSuggestionsShown]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const add = (el: HTMLElement, at: LatLng, options: maplibregl.MarkerOptions = {}) =>
      markers.current.push(new maplibregl.Marker({ element: el, ...options }).setLngLat([at.lng, at.lat]).addTo(map));

    const p = plan?.plan;
    const target = p?.target ?? home;
    if (target) {
      add(targetElement(Boolean(p?.front)), target, { rotationAlignment: "map", pitchAlignment: "map", rotation: p?.front?.bearing ?? 0 });
    }
    const warn = (spot: LatLng) => (blocked.has(spotKey(spot)) ? " warn" : "");
    suggestions.forEach((s, i) =>
      add(pinElement(`suggestion mini${warn(s)}`, String(i + 1), SUGGESTION_COLOR, `Suggestion ${i + 1} · ${s.score}/100`), s),
    );
    for (const position of positions) {
      const status = STAKEOUT_STATUS[position.status];
      const score = position.assessment?.score ?? position.score;
      add(pinElement(`position mini${warn(position)}`, score != null ? String(score) : "•", status.color, `${position.label} · ${status.label}`), position);
    }
  }, [plan, positions, suggestions, home, blocked, ready]);

  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    const p = plan?.plan;
    if (!map || !ready) return;
    const key = p ? `plan-${plan.address.id}-${positions.length}` : home ? `home-${home.lat},${home.lng}` : null;
    if (!key || fittedFor.current === key) return;
    fittedFor.current = key;
    if (!p) {
      map.jumpTo({ center: [home!.lng, home!.lat], zoom: 16.5 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const spot of [p.target, ...p.suggestions.slice(0, SUGGESTIONS_SHOWN), ...positions]) bounds.extend([spot.lng, spot.lat]);
    const bearing = map.getPitch() > 0 && p.front ? (p.front.bearing + 180) % 360 : 0;
    const camera = map.cameraForBounds(bounds, { padding: { top: 54, bottom: 30, left: 30, right: 30 }, bearing, maxZoom: 18 });
    const pitch = map.getPitch();
    if (camera) map.jumpTo({ ...camera, zoom: fitZoom(camera.zoom ?? 16.5, pitch), bearing, pitch });
  }, [plan, positions, home, ready]);

  const pickBasemap = (id: BasemapId) => {
    setBasemapId(id);
    setMenu(false);
    writePrefs({ basemap: id });
  };

  return (
    <div className="stk-mini">
      <div className="stk-mini-map" ref={containerRef} />

      <div className="stk-mini-tl">
        <button type="button" className={`stk-mini-btn wide ${menu ? "on" : ""}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          {basemap.label} <ChevronDown size={12} />
        </button>
        {menu && (
          <div className="stk-menu mini" role="menu">
            {BASEMAPS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="menuitemradio"
                aria-checked={b.id === basemapId}
                className={b.id === basemapId ? "on" : ""}
                onClick={() => pickBasemap(b.id)}
              >
                <span className="t">
                  {b.label}
                  {b.recommended && <Star size={11} fill="currentColor" aria-label="Recommended" />}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="stk-mini-tr">
        <button type="button" className="stk-mini-btn" title="Rotate left" aria-label="Rotate left" onClick={() => mapRef.current && rotateBy(mapRef.current, -45)}>
          <RotateCcw size={13} />
        </button>
        <button type="button" className="stk-mini-btn" title="Rotate right" aria-label="Rotate right" onClick={() => mapRef.current && rotateBy(mapRef.current, 45)}>
          <RotateCw size={13} />
        </button>
        <button
          type="button"
          className="stk-mini-btn"
          title="Tilt: flat, angled, steep"
          aria-label="Tilt the map"
          onClick={() => mapRef.current && writePrefs({ threeD: tiltStep(mapRef.current) })}
        >
          <Axis3d size={13} />
        </button>
      </div>
    </div>
  );
}
