import { describe, expect, it } from 'vitest';
import { mergeDnsEntries } from '@/lib/dns-parser';
import type { ServiceEntry } from '@/types/registry';

describe('DNS routing lists', () => {
  it('merges domains and CIDRs, deduplicates, and ignores other or missing sources', () => {
    const services: ServiceEntry[] = ['first', 'second'].map((id) => ({
      id,
      name: id,
      category: 'video',
      restrictionType: 'rkn_blocked',
      sources: [
        { kind: 'domain_list_txt', path: id },
        { kind: 'domain_list_txt', path: 'missing' },
        { kind: 'ip_routes_bat', path: 'legacy' },
      ],
    }));
    const sources: Record<string, string> = {
      first: ' tiktok.com \r\n\r\n2.16.0.0/12\r\n# comment\r\ntiktok.com',
      second: 'youtube.com\ntiktok.com\n2001:db8::/32',
      legacy: 'route add 2.16.0.0 mask 255.255.0.0 0.0.0.0',
    };
    const resolver = (source: { path: string }) => sources[source.path] ?? null;
    const expected = ['2.16.0.0/12', '2001:db8::/32', 'tiktok.com', 'youtube.com'];
    expect(mergeDnsEntries(services, resolver)).toEqual(expected);
    expect(mergeDnsEntries([...services].reverse(), resolver)).toEqual(expected);
    expect(mergeDnsEntries([], resolver)).toEqual([]);
  });
});
