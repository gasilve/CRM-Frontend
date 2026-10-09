/**
 * House footprints and house numbers around an address, read straight from
 * Mapbox's vector tiles (the same buildings the 3D map draws). OpenStreetMap
 * misses most US houses, so the planner gets these to know which spots really
 * see the front door, and which house carries the address's number.
 */
import { stakeoutApi, type HouseNumber, type LatLng, type StakeoutPlan } from "@/lib/crm-api";
import { BUILDINGS } from "./basemaps";
import { pointsInTile, polygonsInTile, tileOf, type Ring } from "./mvt";

const ZOOM = 16;
/** Sheds and kiosks under this size do not hide a car. */
const MIN_AREA_M2 = 12;
const MAX_BUILDINGS = 3000;
const MAX_NUMBERS = 200;
/** Matches the server's search radius for spots, plus a margin for the houses around them. */
const PLAN_RADIUS_M = 380;
const HOUSE_NUMBERS = { layer: "housenum_label", property: "house_num" };

const areaM2 = (ring: Ring) => {
  const kx = 111_320 * Math.cos((ring[0][1] * Math.PI) / 180);
  const ky = 110_540;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * kx * ring[i][1] * ky - ring[i][0] * kx * ring[j][1] * ky;
  }
  return Math.abs(sum / 2);
};

/** The house number at the start of an address line ("214B Main St" → "214b"). */
const houseNumberOf = (line: string) => /^\s*(\d+[a-z]?)\b/i.exec(line)?.[1].toLowerCase() ?? null;

/**
 * Footprints within `radiusM` of `center`, plus the map's labels for `number`,
 * or null when the richer Mapbox buildings are not configured (the server
 * already has OpenStreetMap's).
 */
export async function mapHouses(
  center: LatLng,
  radiusM: number,
  number: string | null,
  signal?: AbortSignal,
): Promise<{ rings: Ring[]; numbers: HouseNumber[] } | null> {
  const template = BUILDINGS.source.tiles?.[0];
  if (!template?.includes("mapbox")) return null;

  const dLat = radiusM / 110_540;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const nw = tileOf(center.lat + dLat, center.lng - dLng, ZOOM);
  const se = tileOf(center.lat - dLat, center.lng + dLng, ZOOM);

  const jobs: Promise<{ rings: Ring[]; numbers: HouseNumber[] }>[] = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      const url = template.replace("{z}", String(ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));
      jobs.push(
        fetch(url, { signal })
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .then((buffer) => {
            if (!buffer) return { rings: [], numbers: [] };
            const data = new Uint8Array(buffer);
            const numbers = number
              ? pointsInTile(data, ZOOM, x, y, HOUSE_NUMBERS.layer, HOUSE_NUMBERS.property)
                  .filter((p) => p.value.trim().toLowerCase() === number)
                  .map((p) => ({ number: p.value, lat: p.lat, lng: p.lng }))
              : [];
            return { rings: polygonsInTile(data, ZOOM, x, y, BUILDINGS.sourceLayer), numbers };
          }),
      );
    }
  }

  const tiles = await Promise.all(jobs);
  const near = ([lng, lat]: [number, number]) => Math.abs(lat - center.lat) <= dLat && Math.abs(lng - center.lng) <= dLng;
  return {
    rings: tiles
      .flatMap((t) => t.rings)
      .filter((ring) => ring.some(near) && areaM2(ring) >= MIN_AREA_M2)
      .slice(0, MAX_BUILDINGS),
    numbers: tiles
      .flatMap((t) => t.numbers)
      .filter((p) => near([p.lng, p.lat]))
      .slice(0, MAX_NUMBERS),
  };
}

/**
 * The stakeout plan, judged against the map's real houses when they can be read.
 * The first (OpenStreetMap-only) plan places the address; if the map's houses or
 * the second request fail, that plan is still a usable answer.
 */
export async function loadStakeoutPlan(caseId: string, addressId?: string | null): Promise<StakeoutPlan> {
  const first = await stakeoutApi.plan(caseId, addressId);
  try {
    const houses = await mapHouses(first.plan.address, PLAN_RADIUS_M, houseNumberOf(first.address.line), AbortSignal.timeout(12_000));
    if (!houses || (!houses.rings.length && !houses.numbers.length)) return first;
    return await stakeoutApi.planWithBuildings(caseId, first.address.id, houses.rings, houses.numbers);
  } catch {
    return first;
  }
}
