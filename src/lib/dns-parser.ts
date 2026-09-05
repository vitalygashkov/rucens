import { resolveDomainListSource } from '@/lib/source-loader';
import type { DomainListSource, ServiceEntry } from '@/types/registry';

// Preserve domains and CIDRs as authored, removing blank lines and duplicate entries.
export const mergeDnsEntries = (
  services: ServiceEntry[],
  resolveSourceText: (source: DomainListSource) => string | null = resolveDomainListSource,
): string[] => {
  const entries = new Set<string>();

  for (const service of services) {
    for (const source of service.sources) {
      if (source.kind !== 'domain_list_txt') continue;
      const raw = resolveSourceText(source);
      if (!raw) continue;

      for (const line of raw.split(/\r?\n/)) {
        const entry = line.trim();
        if (entry && !entry.startsWith('#')) entries.add(entry);
      }
    }
  }

  return [...entries].sort();
};
