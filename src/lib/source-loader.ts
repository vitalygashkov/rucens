import type { DomainListSource, IpRoutesBatSource } from '@/types/registry';

const batSources = import.meta.glob<string>('/bat/*.bat', {
  eager: true,
  import: 'default',
  query: '?raw',
});

function normalizeBatPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function resolveIpRoutesBatSource(source: IpRoutesBatSource): string | null {
  const sourcePath = normalizeBatPath(source.path);

  return batSources[sourcePath] ?? null;
}

const dnsSources = import.meta.glob<string>('/dns/*.txt', {
  eager: true,
  import: 'default',
  query: '?raw',
});

export const resolveDomainListSource = (source: DomainListSource): string | null => {
  const sourcePath = source.path.startsWith('/') ? source.path : `/${source.path}`;
  return dnsSources[sourcePath] ?? null;
};
