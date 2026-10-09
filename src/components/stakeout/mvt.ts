/**
 * Just enough of the Mapbox Vector Tile format to read building outlines:
 * the polygons of one layer, as [lng, lat] rings. Holes are dropped.
 */

export type Ring = [number, number][];

class Reader {
  pos = 0;
  constructor(readonly buf: Uint8Array) {}
  get done() {
    return this.pos >= this.buf.length;
  }
  varint(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.buf[this.pos++];
      result += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return result;
      shift += 7;
    }
  }
  bytes(): Reader {
    const len = this.varint();
    const sub = new Reader(this.buf.subarray(this.pos, this.pos + len));
    this.pos += len;
    return sub;
  }
  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
  }
  string(): string {
    return new TextDecoder().decode(this.bytes().buf);
  }
  packed(): number[] {
    const sub = this.bytes();
    const out: number[] = [];
    while (!sub.done) out.push(sub.varint());
    return out;
  }
}

const zigzag = (n: number) => (n % 2 === 1 ? -(n + 1) / 2 : n / 2);

/** Outer rings of a polygon geometry, in tile units. */
const outerRings = (commands: number[]): Ring[] => {
  const rings: Ring[] = [];
  let x = 0;
  let y = 0;
  let ring: Ring = [];
  for (let i = 0; i < commands.length; ) {
    const id = commands[i] & 0x7;
    const count = commands[i] >> 3;
    i++;
    if (id === 7) {
      // Exterior rings wind clockwise in tile space (y down), so their area is positive.
      let area = 0;
      for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) area += ring[j][0] * ring[k][1] - ring[k][0] * ring[j][1];
      if (area > 0 && ring.length >= 3) rings.push([...ring, ring[0]]);
      ring = [];
      continue;
    }
    for (let c = 0; c < count; c++) {
      x += zigzag(commands[i++]);
      y += zigzag(commands[i++]);
      if (id === 1) ring = [];
      ring.push([x, y]);
    }
  }
  return rings;
};

type Feature = { type: number; geometry: number[]; tags: number[] };

const readLayer = (tile: Uint8Array, name: string) => {
  const top = new Reader(tile);
  while (!top.done) {
    const key = top.varint();
    if (key >> 3 !== 3) {
      top.skip(key & 0x7);
      continue;
    }
    const layer = top.bytes();
    let layerName = "";
    let extent = 4096;
    const features: Feature[] = [];
    const keys: string[] = [];
    const values: string[] = [];
    while (!layer.done) {
      const k = layer.varint();
      const field = k >> 3;
      if (field === 1) layerName = layer.string();
      else if (field === 5) extent = layer.varint();
      else if (field === 3) keys.push(layer.string());
      else if (field === 4) {
        const value = layer.bytes();
        let text = "";
        while (!value.done) {
          const vk = value.varint();
          if (vk >> 3 === 1) text = value.string();
          else if (vk >> 3 === 7) text = value.varint() ? "true" : "false";
          else value.skip(vk & 0x7);
        }
        values.push(text);
      } else if (field === 2) {
        const f = layer.bytes();
        const feature: Feature = { type: 0, geometry: [], tags: [] };
        while (!f.done) {
          const fk = f.varint();
          if (fk >> 3 === 2) feature.tags = f.packed();
          else if (fk >> 3 === 3) feature.type = f.varint();
          else if (fk >> 3 === 4) feature.geometry = f.packed();
          else f.skip(fk & 0x7);
        }
        features.push(feature);
      } else layer.skip(k & 0x7);
    }
    if (layerName === name) return { extent, features, keys, values };
  }
  return null;
};

export const tileOf = (lat: number, lng: number, z: number) => {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
};

const lngLatIn = (z: number, x: number, y: number, extent: number) => {
  const n = 2 ** z;
  return (px: number, py: number): [number, number] => {
    const lng = ((x + px / extent) / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))) * 180) / Math.PI;
    return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
  };
};

/** Points of `layerName` in tile z/x/y with their `property` value, e.g. house numbers. */
export const pointsInTile = (
  data: Uint8Array,
  z: number,
  x: number,
  y: number,
  layerName: string,
  property: string,
): { value: string; lng: number; lat: number }[] => {
  const layer = readLayer(data, layerName);
  if (!layer) return [];
  const toLngLat = lngLatIn(z, x, y, layer.extent);
  const points: { value: string; lng: number; lat: number }[] = [];
  for (const feature of layer.features) {
    if (feature.type !== 1) continue;
    let value = "";
    for (let i = 0; i < feature.tags.length; i += 2) {
      if (layer.keys[feature.tags[i]] === property) value = layer.values[feature.tags[i + 1]];
    }
    if (!value) continue;
    let px = 0;
    let py = 0;
    const g = feature.geometry;
    for (let i = 0; i < g.length; ) {
      const count = g[i++] >> 3;
      for (let c = 0; c < count; c++) {
        px += zigzag(g[i++]);
        py += zigzag(g[i++]);
        const [lng, lat] = toLngLat(px, py);
        points.push({ value, lng, lat });
      }
    }
  }
  return points;
};

/** Polygon outlines of `layerName` in tile z/x/y, skipping parts tagged underground. */
export const polygonsInTile = (data: Uint8Array, z: number, x: number, y: number, layerName: string): Ring[] => {
  const layer = readLayer(data, layerName);
  if (!layer) return [];
  const toLngLat = lngLatIn(z, x, y, layer.extent);
  const rings: Ring[] = [];
  for (const feature of layer.features) {
    if (feature.type !== 3) continue;
    let underground = false;
    for (let i = 0; i < feature.tags.length; i += 2) {
      if (layer.keys[feature.tags[i]] === "underground" && layer.values[feature.tags[i + 1]] === "true") underground = true;
    }
    if (underground) continue;
    for (const ring of outerRings(feature.geometry)) rings.push(ring.map(([px, py]) => toLngLat(px, py)));
  }
  return rings;
};
