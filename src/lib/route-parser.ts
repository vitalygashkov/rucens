import { ipToNumber } from '@/lib/ip';
import { resolveIpRoutesBatSource } from '@/lib/source-loader';
import type { IpRoutesBatSource, ServiceEntry } from '@/types/registry';

const ROUTE_LINE_PATTERN =
  /^route\s+add\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s+mask\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s+0\.0\.0\.0$/i;

export interface ParsedRoute {
  ip: string;
  mask: string;
  ipNum: number;
  maskNum: number;
  key: string;
}

export type ResolveSourceText = (source: IpRoutesBatSource) => string | null;

export function compareParsedRoutes(a: ParsedRoute, b: ParsedRoute): number {
  if (a.ipNum !== b.ipNum) {
    return a.ipNum - b.ipNum;
  }

  if (a.maskNum !== b.maskNum) {
    return a.maskNum - b.maskNum;
  }

  return a.key.localeCompare(b.key);
}

function createRoute(ip: string, mask: string): ParsedRoute | null {
  const ipNum = ipToNumber(ip);
  const maskNum = ipToNumber(mask);

  if (ipNum === null || maskNum === null) {
    return null;
  }

  return {
    ip,
    mask,
    ipNum,
    maskNum,
    key: `${ip}|${mask}`,
  };
}

export function parseBatRoutes(raw: string): ParsedRoute[] {
  const deduped = new Map<string, ParsedRoute>();
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const normalized = line.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      continue;
    }

    const match = normalized.match(ROUTE_LINE_PATTERN);

    if (!match) {
      continue;
    }

    const ip = match[1];
    const mask = match[2];

    if (!ip || !mask) {
      continue;
    }

    const route = createRoute(ip, mask);

    if (!route) {
      continue;
    }

    deduped.set(route.key, route);
  }

  return [...deduped.values()].sort(compareParsedRoutes);
}

export function mergeRoutes(
  services: ServiceEntry[],
  resolveSourceText: ResolveSourceText = resolveIpRoutesBatSource,
): ParsedRoute[] {
  const merged = new Map<string, ParsedRoute>();

  for (const service of services) {
    for (const source of service.sources) {
      if (source.kind !== 'ip_routes_bat') {
        continue;
      }

      const raw = resolveSourceText(source);

      if (!raw) {
        continue;
      }

      for (const route of parseBatRoutes(raw)) {
        merged.set(route.key, route);
      }
    }
  }

  return [...merged.values()].sort(compareParsedRoutes);
}

export function formatRoutesAsBat(routes: ParsedRoute[]): string {
  return routes.map((route) => `route add ${route.ip} mask ${route.mask} 0.0.0.0`).join('\n');
}
