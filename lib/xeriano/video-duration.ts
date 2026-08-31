/**
 * Bounded ISO-BMFF duration reader for customer credit authority. It reads the
 * movie header (mvhd) from uploaded MP4/MOV bytes; browser metadata is never
 * financial authority. Unsupported containers fail closed.
 */
export function readIsoBmffDurationSeconds(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  function uint64(offset: number): number | null {
    if (offset + 8 > view.byteLength) return null;
    const high = view.getUint32(offset);
    const low = view.getUint32(offset + 4);
    const value = high * 2 ** 32 + low;
    return Number.isSafeInteger(value) ? value : null;
  }

  function scan(start: number, end: number, depth: number): number | null {
    if (depth > 4) return null;
    let offset = start;
    while (offset + 8 <= end && offset + 8 <= view.byteLength) {
      let size = view.getUint32(offset);
      const type = String.fromCharCode(
        bytes[offset + 4]!,
        bytes[offset + 5]!,
        bytes[offset + 6]!,
        bytes[offset + 7]!,
      );
      let header = 8;
      if (size === 1) {
        const extended = uint64(offset + 8);
        if (!extended) return null;
        size = extended;
        header = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < header || offset + size > end || offset + size > view.byteLength) {
        return null;
      }
      const payload = offset + header;
      if (type === "mvhd") {
        if (payload + 4 > offset + size) return null;
        const version = view.getUint8(payload);
        const timescaleOffset = version === 1 ? payload + 20 : payload + 12;
        const durationOffset = version === 1 ? payload + 24 : payload + 16;
        if (timescaleOffset + 4 > offset + size) return null;
        const timescale = view.getUint32(timescaleOffset);
        const duration = version === 1
          ? uint64(durationOffset)
          : durationOffset + 4 <= offset + size
            ? view.getUint32(durationOffset)
            : null;
        if (!timescale || duration === null || duration <= 0) return null;
        const seconds = duration / timescale;
        return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
      }
      if (type === "moov") {
        const nested = scan(payload, offset + size, depth + 1);
        if (nested !== null) return nested;
      }
      offset += size;
    }
    return null;
  }

  return scan(0, view.byteLength, 0);
}

export function requireTrustedCustomerMotionDuration(input: {
  bytes: Uint8Array;
  mimeType: string;
}): number {
  if (!["video/mp4", "video/quicktime", "video/x-m4v"].includes(input.mimeType.toLowerCase())) {
    throw new Error("CUSTOMER_VIDEO_DURATION_UNSUPPORTED");
  }
  const duration = readIsoBmffDurationSeconds(input.bytes);
  if (!duration) throw new Error("CUSTOMER_VIDEO_DURATION_UNREADABLE");
  return duration;
}

type IsoBox = {
  offset: number;
  size: number;
  headerSize: number;
  type: string;
};

function isoBoxes(bytes: Uint8Array, start: number, end: number): IsoBox[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: IsoBox[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error("CUSTOMER_VIDEO_CLIP_INVALID");
      const high = view.getUint32(offset + 8);
      const low = view.getUint32(offset + 12);
      size = high * 2 ** 32 + low;
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > end) {
      throw new Error("CUSTOMER_VIDEO_CLIP_INVALID");
    }
    boxes.push({ offset, size, headerSize, type });
    offset += size;
  }
  return boxes;
}

function writeUint64(view: DataView, offset: number, value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("CUSTOMER_VIDEO_CLIP_DURATION_INVALID");
  }
  view.setUint32(offset, Math.floor(value / 2 ** 32));
  view.setUint32(offset + 4, value >>> 0);
}

/**
 * Applies a zero-start ISO-BMFF presentation clip on the server. Movie and all
 * audio/video track durations are bounded together, so the exact bytes sent to
 * the provider represent the selected duration without browser authority or a
 * platform-specific ffmpeg binary.
 */
export function clipIsoBmffFromStart(input: {
  bytes: Uint8Array;
  mimeType: string;
  durationSeconds: number;
}): Uint8Array {
  const sourceDuration = requireTrustedCustomerMotionDuration(input);
  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > sourceDuration + 0.05
  ) {
    throw new Error("CUSTOMER_VIDEO_CLIP_DURATION_INVALID");
  }

  const output = new Uint8Array(input.bytes);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  let movieTimescale: number | null = null;
  let movieHeaders = 0;
  let trackHeaders = 0;

  function setDuration(payload: number, boxEnd: number, kind: "mvhd" | "tkhd" | "mdhd") {
    const version = view.getUint8(payload);
    if (version !== 0 && version !== 1) throw new Error("CUSTOMER_VIDEO_CLIP_INVALID");
    const timescaleOffset =
      kind === "mvhd" || kind === "mdhd"
        ? version === 1
          ? payload + 20
          : payload + 12
        : null;
    const durationOffset =
      kind === "tkhd"
        ? version === 1
          ? payload + 28
          : payload + 20
        : version === 1
          ? payload + 24
          : payload + 16;
    const timescale = timescaleOffset === null
      ? movieTimescale
      : timescaleOffset + 4 <= boxEnd
        ? view.getUint32(timescaleOffset)
        : null;
    const durationBytes = version === 1 ? 8 : 4;
    if (!timescale || durationOffset + durationBytes > boxEnd) {
      throw new Error("CUSTOMER_VIDEO_CLIP_INVALID");
    }
    const duration = Math.max(1, Math.round(input.durationSeconds * timescale));
    if (version === 1) writeUint64(view, durationOffset, duration);
    else view.setUint32(durationOffset, duration);
    if (kind === "mvhd") {
      movieTimescale = timescale;
      movieHeaders += 1;
    } else {
      trackHeaders += 1;
    }
  }

  const containers = new Set(["moov", "trak", "mdia"]);
  function walk(start: number, end: number) {
    for (const box of isoBoxes(output, start, end)) {
      const payload = box.offset + box.headerSize;
      const boxEnd = box.offset + box.size;
      if (box.type === "mvhd") setDuration(payload, boxEnd, "mvhd");
      else if (box.type === "tkhd") setDuration(payload, boxEnd, "tkhd");
      else if (box.type === "mdhd") setDuration(payload, boxEnd, "mdhd");
      else if (containers.has(box.type)) walk(payload, boxEnd);
    }
  }

  // Resolve the movie timescale before track headers, regardless of box order.
  const moov = isoBoxes(output, 0, output.byteLength).find((box) => box.type === "moov");
  if (!moov) throw new Error("CUSTOMER_VIDEO_CLIP_INVALID");
  const moovChildren = isoBoxes(
    output,
    moov.offset + moov.headerSize,
    moov.offset + moov.size,
  );
  const mvhd = moovChildren.find((box) => box.type === "mvhd");
  if (!mvhd) throw new Error("CUSTOMER_VIDEO_CLIP_INVALID");
  setDuration(mvhd.offset + mvhd.headerSize, mvhd.offset + mvhd.size, "mvhd");
  for (const box of moovChildren) {
    if (box.type === "trak") walk(box.offset + box.headerSize, box.offset + box.size);
  }
  if (movieHeaders !== 1 || trackHeaders < 2) {
    throw new Error("CUSTOMER_VIDEO_CLIP_TRACKS_MISSING");
  }
  const clippedDuration = readIsoBmffDurationSeconds(output);
  if (!clippedDuration || Math.abs(clippedDuration - input.durationSeconds) > 0.01) {
    throw new Error("CUSTOMER_VIDEO_CLIP_VERIFICATION_FAILED");
  }
  return output;
}
