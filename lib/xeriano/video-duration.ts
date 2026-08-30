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
