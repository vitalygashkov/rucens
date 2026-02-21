import { describe, expect, it } from 'vitest';
import { formatRoutesAsBat, mergeRoutes, parseBatRoutes } from '@/lib/route-parser';
import type { ServiceEntry } from '@/types/registry';

const baseService = {
  category: 'video',
  restrictionType: 'rkn_blocked',
} as const;

describe('route parser', () => {
  it('parses valid lines, ignores invalid lines, deduplicates, and sorts deterministically', () => {
    const raw = [
      'route add 10.0.0.0 mask 255.0.0.0 0.0.0.0',
      'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0',
      'route add 10.0.0.0 mask 255.0.0.0 0.0.0.0',
      'route add 999.0.0.1 mask 255.255.255.0 0.0.0.0',
      'route ADD 9.0.0.0 mask 255.0.0.0 0.0.0.0',
      'invalid line',
      '',
    ].join('\n');

    const routes = parseBatRoutes(raw);

    expect(routes.map((route) => route.key)).toEqual([
      '2.16.0.0|255.255.0.0',
      '9.0.0.0|255.0.0.0',
      '10.0.0.0|255.0.0.0',
    ]);
  });

  it('merges services with cross-service deduplication and stable sorting', () => {
    const tiktok: ServiceEntry = {
      ...baseService,
      id: 'tiktok',
      name: 'TikTok',
      sources: [{ kind: 'ip_routes_bat', path: '/bat/tiktok.bat' }],
    };

    const youtube: ServiceEntry = {
      ...baseService,
      id: 'youtube',
      name: 'YouTube',
      sources: [{ kind: 'ip_routes_bat', path: '/bat/youtube.bat' }],
    };

    const sourceMap: Record<string, string> = {
      '/bat/tiktok.bat': [
        'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0',
        'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0',
        'route add 18.66.0.0 mask 255.255.0.0 0.0.0.0',
      ].join('\n'),
      '/bat/youtube.bat': [
        'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0',
        'route add 20.0.0.0 mask 255.0.0.0 0.0.0.0',
      ].join('\n'),
    };

    const resolver = (source: { path: string }) => sourceMap[source.path] ?? null;

    const mergedA = mergeRoutes([tiktok, youtube], resolver);
    const mergedB = mergeRoutes([youtube, tiktok], resolver);

    expect(mergedA.map((route) => route.key)).toEqual([
      '2.16.0.0|255.255.0.0',
      '18.66.0.0|255.255.0.0',
      '20.0.0.0|255.0.0.0',
    ]);
    expect(mergedA).toEqual(mergedB);
  });

  it('formats merged routes in Windows .bat route format', () => {
    const routes = parseBatRoutes(
      'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0\nroute add 3.0.0.0 mask 255.0.0.0 0.0.0.0',
    );

    expect(formatRoutesAsBat(routes)).toBe(
      [
        'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0',
        'route add 3.0.0.0 mask 255.0.0.0 0.0.0.0',
      ].join('\n'),
    );
  });
});
