import type { IpRoutesBatSource } from '@/types/registry';

const batSources = import.meta.glob('/bat/*.bat', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

function normalizeBatPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function resolveIpRoutesBatSource(source: IpRoutesBatSource): string | null {
  const sourcePath = normalizeBatPath(source.path);

  return batSources[sourcePath] ?? null;
}
