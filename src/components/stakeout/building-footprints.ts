/**
 * House footprints around an address, read straight from Mapbox's vector tiles
 * (the same buildings the 3D map draws). OpenStreetMap misses most US houses,
 * so the planner gets these to know which spots really see the front door.
 */
import { stakeoutApi, type LatLng, type StakeoutPlan } from "@/lib/crm-api";
import { BUILDINGS } from "./basemaps";
import { polygonsInTile, tileOf, type Ring } from "./mvt";

const ZOOM = 16;
/** Sheds and kiosks under this size do not hide a car. */
const MIN_AREA_M2 = 12;
const MAX_BUILDINGS = 3000;
/** Matches the server's search radius for spots, plus a margin for the houses around them. */
const PLAN_RADIUS_M = 380;

const areaM2 = (ring: Ring) => {
  const kx = 111_320 * Math.cos((ring[0][1] * Math.PI) / 180);
  const ky = 110_540;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * kx * ring[i][1] * ky - ring[i][0] * kx * ring[j][1] * ky;
  }
  return Math.abs(sum / 2);
};

/**
 * Footprints within `radiusM` of `center`, or null when the richer Mapbox
 * buildings are not configured (the server already has OpenStreetMap's).
 */
export async function buildingFootprints(center: LatLng, radiusM: number, signal?: AbortSignal): Promise<Ring[] | null> {
  const template = BUILDINGS.source.tiles?.[0];
  if (!template?.includes("mapbox")) return null;

  const dLat = radiusM / 110_540;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const nw = tileOf(center.lat + dLat, center.lng - dLng, ZOOM);
  const se = tileOf(center.lat - dLat, center.lng + dLng, ZOOM);

  const jobs: Promise<Ring[]>[] = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      const url = template.replace("{z}", String(ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));
      jobs.push(
        fetch(url, { signal })
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .then((data) => (data ? polygonsInTile(new Uint8Array(data), ZOOM, x, y, BUILDINGS.sourceLayer) : [])),
      );
    }
  }

  const near = (ring: Ring) => ring.some(([lng, lat]) => Math.abs(lat - center.lat) <= dLat && Math.abs(lng - center.lng) <= dLng);
  const all = (await Promise.all(jobs)).flat().filter((ring) => near(ring) && areaM2(ring) >= MIN_AREA_M2);
  return all.slice(0, MAX_BUILDINGS);
}

/**
 * The stakeout plan, judged against the map's real houses when they can be read.
 * The first (OpenStreetMap-only) plan places the address; if the footprints or
 * the second request fail, that plan is still a usable answer.
 */
export async function loadStakeoutPlan(caseId: string, addressId?: string | null): Promise<StakeoutPlan> {
  const first = await stakeoutApi.plan(caseId, addressId);
  try {
    const rings = await buildingFootprints(first.plan.address, PLAN_RADIUS_M, AbortSignal.timeout(12_000));
    if (!rings?.length) return first;
    return await stakeoutApi.planWithBuildings(caseId, first.address.id, rings);
  } catch {
    return first;
  }
}
