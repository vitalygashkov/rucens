const IPV4_SEGMENT_COUNT = 4;

export function ipToNumber(ip: string): number | null {
  const segments = ip.split('.');

  if (segments.length !== IPV4_SEGMENT_COUNT) {
    return null;
  }

  let value = 0;

  for (const segment of segments) {
    if (!/^\d+$/.test(segment)) {
      return null;
    }

    const octet = Number.parseInt(segment, 10);

    if (octet < 0 || octet > 255) {
      return null;
    }

    value = (value << 8) + octet;
  }

  return value >>> 0;
}
