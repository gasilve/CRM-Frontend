import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl, { type GeoJSONSource, type Map as MapLibre, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Layers, LocateFixed, Map as MapIcon, RefreshCw, RotateCw, Star, Trash2, X } from "lucide-react";
import {
  ApiError,
  stakeoutApi,
  type CaseAddress,
  type LatLng,
  type StakeoutAssessment,
  type StakeoutPlan,
  type StakeoutPosition,
  type StakeoutStatus,
} from "@/lib/crm-api";
import { BASEMAPS, BUILDINGS_ATTRIBUTION, BUILDINGS_SOURCE, basemapById, type Basemap, type BasemapId } from "./basemaps";
import "./stakeout-map.css";

type Selection = { kind: "suggestion"; index: number } | { kind: "position"; id: string } | { kind: "probe" } | null;
type Probe = LatLng & { assessment: StakeoutAssessment | null; loading: boolean; error?: string };
type Live = LatLng & { id: string; assessment: StakeoutAssessment | null };
type LayerKey = "burn" | "exits" | "sight" | "suggestions";

export const STAKEOUT_STATUS: Record<StakeoutStatus, { label: string; color: string }> = {
  proposed: { label: "Proposed", color: "#ffc857" },
  actual: { label: "Set up here", color: "#3ee08a" },
  nogo: { label: "No-go", color: "#ff5c63" },
};

const RISK_COLOR = { low: "#3ee08a", medium: "#ffc857", high: "#ff5c63" } as const;
const SIGHT = {
  clear: { label: "Clear view", color: "#3ee08a" },
  vegetation: { label: "Through trees", color: "#ffc857" },
  blocked: { label: "Blocked", color: "#ff5c63" },
} as const;
const KIND_LABEL = { street: "Street", parking: "Parking lot", "off-road": "Off road" } as const;
const SUGGESTION_COLOR = "#5aa9ff";
const PITCH_3D = 60;
const PREFS_KEY = "stakeout-map";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const scoreColor = (score: number) => (score >= 70 ? "#3ee08a" : score >= 50 ? "#ffc857" : score > 0 ? "#ff9f45" : "#ff5c63");

const errorText = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");

const readPrefs = (): { basemap?: BasemapId; threeD?: boolean } => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const ringCoords = (points: LatLng[]) => {
  const ring = points.map((p) => [p.lng, p.lat]);
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return first && (first[0] !== last[0] || first[1] !== last[1]) ? [...ring, first] : ring;
};

const rasterSource = (base: Basemap): maplibregl.RasterSourceSpecification => ({
  type: "raster",
  tiles: base.tiles ?? [],
  tileSize: base.tileSize,
  attribution: base.attribution,
  maxzoom: base.maxzoom,
});

const buildingColor = (base: Basemap) => (base.tone === "dark" ? "#2a3245" : "#d5d9e2");

const addressLine = (a: CaseAddress) => [a.line1, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

function pinElement(className: string, text: string, color: string, title: string) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `stk-pin ${className}`;
  el.style.setProperty("--pin", color);
  el.title = title;
  const label = document.createElement("span");
  label.textContent = text;
  el.appendChild(label);
  return el;
}

function targetElement(hasFront: boolean) {
  const el = document.createElement("div");
  el.className = "stk-target";
  el.title = "Front of the house: what the camera has to see";
  el.appendChild(document.createElement("i"));
  if (hasFront) {
    const arrow = document.createElement("b");
    el.appendChild(arrow);
  }
  return el;
}

function AssessmentView({ a }: { a: StakeoutAssessment }) {
  return (
    <div className="stk-assess">
      <div className="stk-scoreline">
        <div className="stk-score" style={{ ["--s" as string]: scoreColor(a.score), ["--p" as string]: `${a.score}%` }}>
          <b>{a.score}</b>
          <small>/100</small>
        </div>
        <div className="stk-facts">
          <span className="stk-chip" style={{ color: RISK_COLOR[a.burnRisk] }}>
            Burn risk {a.burnRisk}
          </span>
          <span className="stk-chip" style={{ color: SIGHT[a.lineOfSight].color }}>
            {SIGHT[a.lineOfSight].label}
          </span>
          <span className="stk-chip">{a.distanceM} m</span>
          <span className="stk-chip">{a.road ?? KIND_LABEL[a.kind]}</span>
        </div>
      </div>
      {a.facing && (
        <p className="stk-facing">
          Park facing <b>{a.facing}</b>
        </p>
      )}
      <ul className="stk-reasons">
        {a.good.map((r) => (
          <li key={`g-${r}`} className="good">
            {r}
          </li>
        ))}
        {a.bad.map((r) => (
          <li key={`b-${r}`} className="bad">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StakeoutMapModal({
  caseId,
  subjectName,
  addresses,
  canEdit,
  onClose,
  onChanged,
}: {
  caseId: string;
  subjectName?: string | null;
  addresses: CaseAddress[];
  canEdit: boolean;
  onClose: () => void;
  onChanged?: (positions: StakeoutPosition[]) => void;
}) {
  const prefs = useMemo(readPrefs, []);
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0] ?? null;

  const [addressId, setAddressId] = useState<string | null>(primary?.id ?? null);
  const [basemapId, setBasemapId] = useState<BasemapId>(basemapById(prefs.basemap).id);
  const [threeD, setThreeD] = useState(prefs.threeD ?? true);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ burn: true, exits: true, sight: true, suggestions: true });
  const [menu, setMenu] = useState<"basemap" | "layers" | null>(null);
  const [orbit, setOrbit] = useState(false);

  const [plan, setPlan] = useState<StakeoutPlan | null>(null);
  const [positions, setPositions] = useState<StakeoutPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selection, setSelection] = useState<Selection>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [live, setLive] = useState<Live | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const markers = useRef<{ target?: Marker; suggestions: Marker[]; positions: Map<string, Marker>; probe?: Marker }>({
    suggestions: [],
    positions: new Map(),
  });

  const watched = addresses.find((a) => a.id === addressId) ?? primary;
  const center: LatLng | null = plan?.plan.target ?? (watched?.lat != null && watched?.lng != null ? { lat: watched.lat, lng: watched.lng } : null);
  const basemap = basemapById(basemapId);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ basemap: basemapId, threeD }));
  }, [basemapId, threeD]);

  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) onChangedRef.current?.(positions);
  }, [positions]);

  // ── Data ─────────────────────────────────────────────────────────────

  const load = useCallback(
    async (forAddress: string | null) => {
      setLoading(true);
      setPlanError(null);
      setSelection(null);
      try {
        const data = await stakeoutApi.plan(caseId, forAddress);
        setPlan(data);
        setPositions(data.positions);
      } catch (err) {
        setPlan(null);
        setPlanError(errorText(err));
        try {
          setPositions((await stakeoutApi.list(caseId)).positions);
        } catch {
          // The plan error already says what is wrong.
        }
      } finally {
        loadedRef.current = true;
        setLoading(false);
      }
    },
    [caseId],
  );

  useEffect(() => {
    void load(addressId);
  }, [load, addressId]);

  const scoreSeq = useRef(0);
  const lastScoreAt = useRef(0);
  /** Scores a spot on the server. While dragging, calls are spaced out and stale answers dropped. */
  const scoreSpot = useCallback(
    async (spot: LatLng, final: boolean): Promise<StakeoutAssessment | null | undefined> => {
      const now = Date.now();
      if (!final && now - lastScoreAt.current < 250) return undefined;
      lastScoreAt.current = now;
      const seq = ++scoreSeq.current;
      const { assessment } = await stakeoutApi.score(caseId, { ...spot, addressId: plan?.address.id ?? addressId });
      return seq === scoreSeq.current ? assessment : undefined;
    },
    [caseId, plan?.address.id, addressId],
  );

  const replacePosition = (position: StakeoutPosition) =>
    setPositions((list) => list.map((p) => (p.id === position.id ? { ...position, assessment: position.assessment ?? p.assessment } : p)));

  const savePosition = async (spot: LatLng, source: "manual" | "suggested") => {
    setBusy(true);
    setActionError(null);
    try {
      const { position } = await stakeoutApi.add(caseId, {
        lat: spot.lat,
        lng: spot.lng,
        source,
        status: "proposed",
        addressId: plan?.address.id ?? addressId,
      });
      setPositions((list) => [...list, position]);
      setSelection({ kind: "position", id: position.id });
      if (source === "manual") setProbe(null);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const updatePosition = async (id: string, body: Parameters<typeof stakeoutApi.update>[2]) => {
    setActionError(null);
    try {
      const { position } = await stakeoutApi.update(caseId, id, body);
      replacePosition(position);
    } catch (err) {
      setActionError(errorText(err));
      setPositions((list) => [...list]);
    }
  };

  const removePosition = async (id: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await stakeoutApi.remove(caseId, id);
      setPositions((list) => list.filter((p) => p.id !== id));
      setSelection(null);
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Handlers the map calls; kept in refs so the map never holds a stale closure.
  const handlers = useRef({
    mapClick: (_spot: LatLng) => {},
    positionDrag: (_id: string, _spot: LatLng, _final: boolean) => {},
    probeDrag: (_spot: LatLng, _final: boolean) => {},
  });

  handlers.current.mapClick = (spot) => {
    setMenu(null);
    setProbe({ ...spot, assessment: null, loading: true });
    setSelection({ kind: "probe" });
    scoreSpot(spot, true)
      .then((assessment) => assessment !== undefined && setProbe((p) => (p ? { ...p, assessment, loading: false } : p)))
      .catch((err) => setProbe((p) => (p ? { ...p, loading: false, error: errorText(err) } : p)));
  };

  handlers.current.probeDrag = (spot, final) => {
    setProbe((p) => (p ? { ...p, ...spot, loading: true } : p));
    setSelection({ kind: "probe" });
    scoreSpot(spot, final)
      .then((assessment) => assessment !== undefined && setProbe((p) => (p ? { ...p, assessment, loading: false } : p)))
      .catch((err) => setProbe((p) => (p ? { ...p, loading: false, error: errorText(err) } : p)));
  };

  handlers.current.positionDrag = (id, spot, final) => {
    setSelection({ kind: "position", id });
    setLive((current) => ({ id, ...spot, assessment: current?.id === id ? current.assessment : null }));
    if (final) {
      void updatePosition(id, spot).finally(() => setLive(null));
      return;
    }
    scoreSpot(spot, false)
      .then((assessment) => assessment && setLive((current) => (current?.id === id ? { ...current, assessment } : current)))
      .catch(() => undefined);
  };

  // ── Map ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const start = center ?? { lat: 39.8, lng: -98.5 };
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          base: rasterSource(basemap),
          buildings: { type: "vector", url: BUILDINGS_SOURCE, attribution: BUILDINGS_ATTRIBUTION },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: [start.lng, start.lat],
      zoom: center ? 17 : 3,
      pitch: threeD ? PITCH_3D : 0,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      map.addLayer({
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "buildings",
        "source-layer": "building",
        minzoom: 14,
        layout: { visibility: threeD ? "visible" : "none" },
        paint: {
          "fill-extrusion-color": buildingColor(basemap),
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.82,
        },
      });
      for (const id of ["burn", "exits", "sight", "house"]) map.addSource(id, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "burn-fill",
        type: "fill",
        source: "burn",
        paint: {
          "fill-color": ["match", ["get", "level"], "high", "#ff5c63", "#ff9f45"],
          "fill-opacity": ["match", ["get", "level"], "high", 0.24, 0.1],
        },
      });
      map.addLayer({
        id: "burn-line",
        type: "line",
        source: "burn",
        paint: { "line-color": ["match", ["get", "level"], "high", "#ff5c63", "#ff9f45"], "line-width": 1.2, "line-dasharray": [2, 2], "line-opacity": 0.75 },
      });
      map.addLayer({
        id: "exits-glow",
        type: "line",
        source: "exits",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#b18cff", "line-width": 9, "line-opacity": 0.18 },
      });
      map.addLayer({
        id: "exits-line",
        type: "line",
        source: "exits",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#b18cff", "line-width": 2.5, "line-dasharray": [1.5, 1.4] },
      });
      map.addLayer({
        id: "house-3d",
        type: "fill-extrusion",
        source: "house",
        paint: { "fill-extrusion-color": "#ff9f45", "fill-extrusion-height": 9, "fill-extrusion-opacity": 0.9 },
      });
      map.addLayer({
        id: "sight-line",
        type: "line",
        source: "sight",
        layout: { "line-cap": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.95, "line-dasharray": [2, 1] },
      });
      setReady(true);
    });

    map.on("click", (e) => handlers.current.mapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
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
    map.removeLayer("base");
    map.removeSource("base");
    map.addSource("base", rasterSource(basemap));
    map.addLayer({ id: "base", type: "raster", source: "base" }, map.getStyle().layers[0]?.id);
    map.setPaintProperty("buildings-3d", "fill-extrusion-color", buildingColor(basemap));
  }, [basemap, ready]);

  const frontRef = useRef<StakeoutPlan["plan"]["front"]>(null);
  frontRef.current = plan?.plan.front ?? null;
  const firstPitch = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("buildings-3d", "visibility", threeD ? "visible" : "none");
    if (firstPitch.current) {
      firstPitch.current = false;
      return;
    }
    const front = frontRef.current;
    map.easeTo({ pitch: threeD ? PITCH_3D : 0, bearing: threeD ? (front ? (front.bearing + 180) % 360 : map.getBearing()) : 0, duration: 900 });
  }, [threeD, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const show = (ids: string[], on: boolean) => ids.forEach((id) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    show(["burn-fill", "burn-line"], layers.burn);
    show(["exits-glow", "exits-line"], layers.exits);
    show(["sight-line"], layers.sight);
  }, [layers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
    const p = plan?.plan;
    source("burn")?.setData({
      type: "FeatureCollection",
      features: (p?.burnZones ?? []).map((zone) => ({
        type: "Feature",
        properties: { level: zone.level },
        geometry: { type: "Polygon", coordinates: [ringCoords(zone.ring)] },
      })),
    });
    source("exits")?.setData({
      type: "FeatureCollection",
      features: (p?.exits ?? []).map((exit) => ({
        type: "Feature",
        properties: { name: exit.name },
        geometry: { type: "LineString", coordinates: exit.path.map((pt) => [pt.lng, pt.lat]) },
      })),
    });
    source("house")?.setData(
      p?.houseOutline
        ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ringCoords(p.houseOutline)] } }
        : EMPTY,
    );
  }, [plan, ready]);

  const flyTo = useCallback((spot: LatLng) => {
    const map = mapRef.current;
    if (!map) return;
    const narrow = map.getContainer().clientWidth < 900;
    map.easeTo({ center: [spot.lng, spot.lat], zoom: Math.max(map.getZoom(), 17.5), offset: narrow ? [0, 0] : [-200, 0], duration: 700 });
  }, []);

  const fitPlan = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const p = plan?.plan;
    if (!p) {
      if (center) map.flyTo({ center: [center.lng, center.lat], zoom: 17, pitch: threeD ? PITCH_3D : 0, duration: 800 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const spot of [p.target, ...p.suggestions, ...positions]) bounds.extend([spot.lng, spot.lat]);
    const bearing = threeD && p.front ? (p.front.bearing + 180) % 360 : 0;
    const narrow = map.getContainer().clientWidth < 900;
    const camera = map.cameraForBounds(bounds, {
      padding: { top: 90, bottom: 80, left: 80, right: narrow ? 80 : 440 },
      bearing,
      maxZoom: 18.5,
    });
    if (camera) map.flyTo({ ...camera, pitch: threeD ? PITCH_3D : 0, bearing, duration: 1400 });
    else map.flyTo({ center: [p.target.lng, p.target.lat], zoom: 17, pitch: threeD ? PITCH_3D : 0, bearing, duration: 1000 });
  }, [plan, positions, threeD, center]);

  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || loading) return;
    const key = plan ? `plan-${plan.address.id}` : `none-${addressId}`;
    if (fittedFor.current === key) return;
    fittedFor.current = key;
    fitPlan();
  }, [ready, loading, plan, addressId, fitPlan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const m = markers.current;
    m.target?.remove();
    m.suggestions.forEach((marker) => marker.remove());
    m.positions.forEach((marker) => marker.remove());
    m.target = undefined;
    m.suggestions = [];
    m.positions = new Map();

    const p = plan?.plan;
    if (p) {
      m.target = new maplibregl.Marker({
        element: targetElement(Boolean(p.front)),
        rotationAlignment: "map",
        pitchAlignment: "map",
        rotation: p.front?.bearing ?? 0,
      })
        .setLngLat([p.target.lng, p.target.lat])
        .addTo(map);
      if (layers.suggestions) {
        p.suggestions.forEach((spot, index) => {
          const el = pinElement("suggestion", String(index + 1), SUGGESTION_COLOR, `Suggestion ${index + 1} · ${spot.score}/100`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelection({ kind: "suggestion", index });
          });
          m.suggestions.push(new maplibregl.Marker({ element: el }).setLngLat([spot.lng, spot.lat]).addTo(map));
        });
      }
    }

    for (const position of positions) {
      const status = STAKEOUT_STATUS[position.status];
      const score = position.assessment?.score ?? position.score;
      const el = pinElement("position", score != null ? String(score) : "•", status.color, `${position.label} · ${status.label}`);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelection({ kind: "position", id: position.id });
      });
      const marker = new maplibregl.Marker({ element: el, draggable: canEdit }).setLngLat([position.lng, position.lat]).addTo(map);
      const report = (final: boolean) => {
        const at = marker.getLngLat();
        handlers.current.positionDrag(position.id, { lat: at.lat, lng: at.lng }, final);
      };
      marker.on("drag", () => report(false));
      marker.on("dragend", () => report(true));
      m.positions.set(position.id, marker);
    }
  }, [plan, positions, layers.suggestions, canEdit, ready]);

  useEffect(() => {
    const m = markers.current;
    m.suggestions.forEach((marker, i) =>
      marker.getElement().classList.toggle("is-selected", selection?.kind === "suggestion" && selection.index === i),
    );
    m.positions.forEach((marker, id) =>
      marker.getElement().classList.toggle("is-selected", selection?.kind === "position" && selection.id === id),
    );
    m.probe?.getElement().classList.toggle("is-selected", selection?.kind === "probe");
  }, [selection, plan, positions, layers.suggestions, probe]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const m = markers.current;
    if (!probe) {
      m.probe?.remove();
      m.probe = undefined;
      return;
    }
    if (!m.probe) {
      const el = pinElement("probe", "?", "#f4f6fb", "Test spot: drag it around");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelection({ kind: "probe" });
      });
      const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([probe.lng, probe.lat]).addTo(map);
      const report = (final: boolean) => {
        const at = marker.getLngLat();
        handlers.current.probeDrag({ lat: at.lat, lng: at.lng }, final);
      };
      marker.on("drag", () => report(false));
      marker.on("dragend", () => report(true));
      m.probe = marker;
    } else {
      m.probe.setLngLat([probe.lng, probe.lat]);
    }
    const el = m.probe.getElement();
    const text = el.querySelector("span");
    if (text) text.textContent = probe.assessment ? String(probe.assessment.score) : probe.loading ? "…" : "?";
    el.style.setProperty("--pin", probe.assessment ? scoreColor(probe.assessment.score) : "#f4f6fb");
  }, [probe, ready]);

  const selectedPosition = selection?.kind === "position" ? positions.find((p) => p.id === selection.id) ?? null : null;
  const selectedSuggestion = selection?.kind === "suggestion" ? plan?.plan.suggestions[selection.index] ?? null : null;
  const positionAssessment = selectedPosition
    ? live?.id === selectedPosition.id
      ? live.assessment ?? selectedPosition.assessment ?? null
      : selectedPosition.assessment ?? null
    : null;

  const sightFrom: (LatLng & { assessment: StakeoutAssessment | null }) | null = selectedSuggestion
    ? { ...selectedSuggestion, assessment: selectedSuggestion }
    : selection?.kind === "probe" && probe
      ? { lat: probe.lat, lng: probe.lng, assessment: probe.assessment }
      : selectedPosition
        ? live?.id === selectedPosition.id
          ? { lat: live.lat, lng: live.lng, assessment: positionAssessment }
          : { lat: selectedPosition.lat, lng: selectedPosition.lng, assessment: positionAssessment }
        : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("sight") as GeoJSONSource | undefined;
    const target = plan?.plan.target;
    if (!source) return;
    if (!sightFrom || !target) {
      source.setData(EMPTY);
      return;
    }
    source.setData({
      type: "Feature",
      properties: { color: sightFrom.assessment ? SIGHT[sightFrom.assessment.lineOfSight].color : "#f4f6fb" },
      geometry: {
        type: "LineString",
        coordinates: [
          [sightFrom.lng, sightFrom.lat],
          [target.lng, target.lat],
        ],
      },
    });
  }, [sightFrom?.lat, sightFrom?.lng, sightFrom?.assessment, plan, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!orbit || !map) return;
    let frame = 0;
    const target = plan?.plan.target ?? center;
    if (target) map.easeTo({ center: [target.lng, target.lat], pitch: PITCH_3D, zoom: Math.max(map.getZoom(), 17), duration: 700 });
    const timer = window.setTimeout(
      () => {
        const step = () => {
          map.setBearing((map.getBearing() + 0.15) % 360);
          frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      target ? 750 : 0,
    );
    const stop = () => setOrbit(false);
    const canvas = map.getCanvas();
    canvas.addEventListener("pointerdown", stop);
    canvas.addEventListener("wheel", stop, { passive: true });
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", stop);
      canvas.removeEventListener("wheel", stop);
    };
    // Only starting and stopping matter here.
  }, [orbit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.stopPropagation();
      if (menu) setMenu(null);
      else if (selection) setSelection(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [menu, selection, onClose]);

  const pick = (next: Selection, spot: LatLng) => {
    setSelection(next);
    flyTo(spot);
  };

  const suggestions = plan?.plan.suggestions ?? [];
  const front = plan?.plan.front;

  return createPortal(
    <div className="stk" role="dialog" aria-modal="true" aria-label="Investigator map">
      <button type="button" className="stk-backdrop" aria-label="Close the investigator map" onClick={onClose} />
      <div className="stk-frame">
        <div className="stk-map" ref={containerRef} />

        <div className="stk-tools">
          <div className="stk-menuwrap">
            <button type="button" className={cls("stk-tool", menu === "basemap" && "on")} onClick={() => setMenu(menu === "basemap" ? null : "basemap")}>
              <MapIcon size={14} /> {basemap.label}
            </button>
            {menu === "basemap" && (
              <div className="stk-menu" role="menu">
                {BASEMAPS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={b.id === basemapId}
                    className={cls(b.id === basemapId && "on")}
                    onClick={() => {
                      setBasemapId(b.id);
                      setMenu(null);
                    }}
                  >
                    <span className="t">
                      {b.label}
                      {b.recommended && <Star size={11} fill="currentColor" aria-label="Recommended" />}
                    </span>
                    <small>{b.hint}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="stk-seg" role="group" aria-label="View">
            <button type="button" className={cls(!threeD && "on")} onClick={() => setThreeD(false)}>
              2D
            </button>
            <button type="button" className={cls(threeD && "on")} onClick={() => setThreeD(true)}>
              <Box size={13} /> 3D
            </button>
          </div>

          <div className="stk-menuwrap">
            <button type="button" className={cls("stk-tool", menu === "layers" && "on")} onClick={() => setMenu(menu === "layers" ? null : "layers")}>
              <Layers size={14} /> Layers
            </button>
            {menu === "layers" && (
              <div className="stk-menu" role="menu">
                {(
                  [
                    ["suggestions", "Suggested spots"],
                    ["burn", "Burn zones"],
                    ["exits", "Ways out"],
                    ["sight", "Line of sight"],
                  ] as [LayerKey, string][]
                ).map(([key, label]) => (
                  <label key={key} className="stk-check">
                    <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="stk-tool" title="Back to the house" aria-label="Back to the house" onClick={fitPlan}>
            <LocateFixed size={14} />
          </button>
          <button
            type="button"
            className={cls("stk-tool", orbit && "on")}
            title="Orbit around the house"
            aria-label="Orbit around the house"
            onClick={() => {
              if (!orbit) setThreeD(true);
              setOrbit((o) => !o);
            }}
          >
            <RotateCw size={14} />
          </button>
        </div>

        <div className="stk-legend">
          <span><i style={{ background: "rgba(255,92,99,.55)" }} />Burn zone</span>
          <span><i className="dash" style={{ borderColor: "#b18cff" }} />Way out</span>
          <span><i className="dot" style={{ background: SUGGESTION_COLOR }} />Suggested</span>
          {(Object.keys(STAKEOUT_STATUS) as StakeoutStatus[]).map((s) => (
            <span key={s}>
              <i className="dot" style={{ background: STAKEOUT_STATUS[s].color }} />
              {STAKEOUT_STATUS[s].label}
            </span>
          ))}
        </div>

        <div className="stk-hint">Click the map to test any spot{canEdit ? " · drag markers to move them" : ""}</div>
        {loading && <div className="stk-loading">Reading the neighbourhood…</div>}

        <aside className="stk-panel">
          <header className="stk-head">
            <div>
              <div className="stk-kicker">Investigator map</div>
              <h2>{subjectName || "Subject"}</h2>
            </div>
            <button type="button" className="stk-icon" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </button>
          </header>

          {addresses.length > 1 ? (
            <select className="stk-select" value={addressId ?? ""} onChange={(e) => setAddressId(e.target.value)} aria-label="Address to watch">
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {addressLine(a)}
                </option>
              ))}
            </select>
          ) : (
            <p className="stk-addr">{plan?.address.line ?? (watched ? addressLine(watched) : "No address on file")}</p>
          )}
          {front && (
            <p className="stk-front">
              Front faces <b>{front.compass}</b>
              {front.road ? ` onto ${front.road}` : ""}
            </p>
          )}

          {planError && (
            <div className="stk-banner">
              <p>{planError}</p>
              <p className="stk-muted">Saved spots still work. Suggestions need the map data.</p>
              <button type="button" className="stk-btn" onClick={() => void load(addressId)}>
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          )}
          {plan?.source.stale && (
            <div className="stk-banner soft">
              OpenStreetMap is not answering. Using the copy from {new Date(plan.source.fetchedAt).toLocaleDateString()}.
            </div>
          )}
          {actionError && <div className="stk-banner">{actionError}</div>}

          <div className="stk-scroll">
            {selection ? (
              <section className="stk-detail">
                <button type="button" className="stk-back" onClick={() => setSelection(null)}>
                  ← All spots
                </button>

                {selectedSuggestion && selection.kind === "suggestion" && (
                  <>
                    <h3>Suggestion {selection.index + 1}</h3>
                    <AssessmentView a={selectedSuggestion} />
                    {canEdit && (
                      <button type="button" className="stk-btn primary" disabled={busy} onClick={() => void savePosition(selectedSuggestion, "suggested")}>
                        Save as proposed spot
                      </button>
                    )}
                  </>
                )}

                {selection.kind === "probe" && probe && (
                  <>
                    <h3>Test spot</h3>
                    <p className="stk-muted">Drag it around: the score follows.</p>
                    {probe.error ? (
                      <p className="stk-bad">{probe.error}</p>
                    ) : probe.assessment ? (
                      <AssessmentView a={probe.assessment} />
                    ) : (
                      <p className="stk-muted">Scoring…</p>
                    )}
                    <div className="stk-actions">
                      {canEdit && (
                        <button type="button" className="stk-btn primary" disabled={busy} onClick={() => void savePosition(probe, "manual")}>
                          Save this spot
                        </button>
                      )}
                      <button
                        type="button"
                        className="stk-btn"
                        onClick={() => {
                          setProbe(null);
                          setSelection(null);
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </>
                )}

                {selectedPosition && (
                  <PositionEditor
                    key={selectedPosition.id}
                    position={selectedPosition}
                    assessment={positionAssessment}
                    canEdit={canEdit}
                    busy={busy}
                    onUpdate={(body) => void updatePosition(selectedPosition.id, body)}
                    onRemove={() => void removePosition(selectedPosition.id)}
                  />
                )}
              </section>
            ) : (
              <>
                <section>
                  <div className="stk-sec">
                    Suggested spots <span>{suggestions.length}</span>
                  </div>
                  {plan && suggestions.length === 0 && (
                    <p className="stk-muted">No spot within 300 m has a clear and safe view. Click the map to test one by hand.</p>
                  )}
                  <ol className="stk-list">
                    {suggestions.map((s, i) => (
                      <li key={`${s.lat},${s.lng}`}>
                        <button type="button" onClick={() => pick({ kind: "suggestion", index: i }, s)}>
                          <span className="n" style={{ background: SUGGESTION_COLOR }}>
                            {i + 1}
                          </span>
                          <span className="main">
                            <b>{s.road ?? KIND_LABEL[s.kind]}</b>
                            <small>
                              {s.distanceM} m · {SIGHT[s.lineOfSight].label.toLowerCase()} · burn {s.burnRisk}
                            </small>
                          </span>
                          <span className="sc" style={{ color: scoreColor(s.score) }}>
                            {s.score}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>

                <section>
                  <div className="stk-sec">
                    Saved spots <span>{positions.length}</span>
                  </div>
                  {positions.length === 0 && (
                    <p className="stk-muted">Nothing saved yet. Save a suggestion, or click the map to test a spot and save it.</p>
                  )}
                  <ul className="stk-list">
                    {positions.map((p) => {
                      const score = p.assessment?.score ?? p.score;
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => pick({ kind: "position", id: p.id }, p)}>
                            <span className="n" style={{ background: STAKEOUT_STATUS[p.status].color }} />
                            <span className="main">
                              <b>{p.label}</b>
                              <small>{STAKEOUT_STATUS[p.status].label}{p.createdBy ? ` · ${p.createdBy.name}` : ""}</small>
                            </span>
                            {score != null && (
                              <span className="sc" style={{ color: scoreColor(score) }}>
                                {score}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {plan && (
                  <p className="stk-foot">
                    Map data © OpenStreetMap · {plan.plan.stats.buildings} buildings, {plan.plan.stats.roads} roads read
                  </p>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}

const cls = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

function PositionEditor({
  position,
  assessment,
  canEdit,
  busy,
  onUpdate,
  onRemove,
}: {
  position: StakeoutPosition;
  assessment: StakeoutAssessment | null;
  canEdit: boolean;
  busy: boolean;
  onUpdate: (body: { label?: string; notes?: string | null; status?: StakeoutStatus }) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(position.label);
  const [notes, setNotes] = useState(position.notes ?? "");

  return (
    <>
      {canEdit ? (
        <input
          className="stk-input title"
          value={label}
          maxLength={120}
          aria-label="Spot name"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== position.label && onUpdate({ label })}
        />
      ) : (
        <h3>{position.label}</h3>
      )}
      <div className="stk-status" role="radiogroup" aria-label="Status">
        {(Object.keys(STAKEOUT_STATUS) as StakeoutStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={position.status === s}
            disabled={!canEdit}
            className={cls(position.status === s && "on")}
            style={{ ["--c" as string]: STAKEOUT_STATUS[s].color }}
            onClick={() => s !== position.status && onUpdate({ status: s })}
          >
            {STAKEOUT_STATUS[s].label}
          </button>
        ))}
      </div>
      {assessment ? (
        <AssessmentView a={assessment} />
      ) : (
        <p className="stk-muted">No score yet: the map data was not available for this spot.</p>
      )}
      {canEdit ? (
        <textarea
          className="stk-input"
          rows={3}
          maxLength={500}
          placeholder="Notes: what you see from here, when it works best…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (position.notes ?? "") && onUpdate({ notes: notes.trim() || null })}
        />
      ) : (
        position.notes && <p className="stk-notes">{position.notes}</p>
      )}
      <p className="stk-muted">
        {position.source === "suggested" ? "From a suggestion" : "Placed by hand"}
        {position.createdBy ? ` · ${position.createdBy.name}` : ""}
      </p>
      {canEdit && (
        <button type="button" className="stk-btn danger" disabled={busy} onClick={onRemove}>
          <Trash2 size={13} /> Remove spot
        </button>
      )}
    </>
  );
}