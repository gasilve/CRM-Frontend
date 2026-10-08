const MAC_EPOCH = Date.UTC(1904, 0, 1);
const CONTAINERS = new Set(["moov", "trak", "mdia", "udta"]);

type Found = { labeled: Date | null; mvhd: Date | null; mdhd: Date | null };

/** Recording time from the container. Null when the file does not carry one. */
export async function readRecordedAt(file: Blob): Promise<Date | null> {
  const found: Found = { labeled: null, mvhd: null, mdhd: null };
  try {
    await scan(file, 0, file.size, 0, found);
  } catch {
    return null;
  }
  return found.labeled ?? found.mvhd ?? found.mdhd;
}

async function scan(file: Blob, start: number, end: number, depth: number, found: Found) {
  if (depth > 6 || start >= end) return;
  let offset = start;
  let guard = 0;
  while (offset + 8 <= end && guard++ < 2000) {
    const box = await header(file, offset);
    if (!box) break;
    const size = box.size === 0 ? end - offset : box.size;
    const boxEnd = offset + size;
    if (size < box.header || boxEnd <= offset || boxEnd > end) break;
    const payload = offset + box.header;

    if (box.type === "mvhd" || box.type === "mdhd") {
      const date = await mediaHeaderDate(file, payload);
      if (date) {
        if (box.type === "mvhd") found.mvhd ??= date;
        else found.mdhd ??= date;
      }
    } else if (box.type === "meta") {
      const child = await metaChildStart(file, payload, boxEnd);
      await findLabeledDate(file, payload, boxEnd, found);
      await scan(file, child, boxEnd, depth + 1, found);
    } else if (CONTAINERS.has(box.type)) {
      if (box.type === "udta") await findLabeledDate(file, payload, boxEnd, found);
      await scan(file, payload, boxEnd, depth + 1, found);
    }

    if (found.labeled && found.mvhd) return;
    offset = boxEnd;
  }
}

async function header(file: Blob, offset: number) {
  const bytes = await readBytes(file, offset, 16);
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(0);
  const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  let headerSize = 8;
  if (size === 1) {
    if (bytes.length < 16) return null;
    size = view.getUint32(8) * 0x100000000 + view.getUint32(12);
    headerSize = 16;
  }
  return { size, type, header: headerSize };
}

async function metaChildStart(file: Blob, payload: number, boxEnd: number) {
  const bytes = await readBytes(file, payload, 8);
  if (bytes.length < 8) return payload + 4;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(0);
  const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  const looksLikeBox = /^[\x20-\x7e]{4}$/.test(type) && size >= 8 && payload + size <= boxEnd;
  return looksLikeBox ? payload : payload + 4;
}

async function mediaHeaderDate(file: Blob, payload: number) {
  const bytes = await readBytes(file, payload, 20);
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = bytes[0];
  const seconds = version === 1 && bytes.length >= 12
    ? view.getUint32(4) * 0x100000000 + view.getUint32(8)
    : view.getUint32(4);
  return fromTimestamp(seconds);
}

async function findLabeledDate(file: Blob, payload: number, boxEnd: number, found: Found) {
  if (found.labeled) return;
  const length = Math.min(boxEnd - payload, 256 * 1024);
  if (length < 12) return;
  const bytes = await readBytes(file, payload, length);
  const text = new TextDecoder("latin1").decode(bytes);
  const at = text.toLowerCase().indexOf("creationdate");
  if (at < 0) return;
  const nearby = text.slice(at, at + 160);
  const timed = /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/.exec(nearby);
  if (timed) {
    const zone = timed[3] ? timed[3].replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : "";
    const date = new Date(zone ? `${timed[1]}T${timed[2]}${zone}` : `${timed[1]}T${timed[2]}`);
    if (plausible(date)) found.labeled = date;
    return;
  }
  const day = /(\d{4}-\d{2}-\d{2})/.exec(nearby);
  if (!day) return;
  const date = new Date(`${day[1]}T12:00:00`);
  if (plausible(date)) found.labeled = date;
}

function fromTimestamp(seconds: number) {
  if (seconds < 1) return null;
  const mac = new Date(MAC_EPOCH + seconds * 1000);
  if (plausible(mac)) return mac;
  const unix = new Date(seconds * 1000);
  if (plausible(unix)) return unix;
  return null;
}

function plausible(date: Date) {
  const year = date.getFullYear();
  return year >= 1990 && year <= new Date().getFullYear() + 1;
}

async function readBytes(file: Blob, offset: number, length: number) {
  const end = Math.min(file.size, offset + length);
  if (offset < 0 || offset >= file.size || end <= offset) return new Uint8Array();
  return new Uint8Array(await file.slice(offset, end).arrayBuffer());
}
