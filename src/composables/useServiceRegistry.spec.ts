import { describe, expect, it } from 'vitest';
import { useServiceRegistry } from '@/composables/useServiceRegistry';

describe('useServiceRegistry', () => {
  it('makes every DNS source selectable and exportable', () => {
    const registry = useServiceRegistry();
    const dnsPaths = Object.keys(import.meta.glob('/dns/*.txt')).sort();
    const registeredPaths = registry.filteredServices.value.flatMap((service) =>
      service.sources.flatMap((source) => (source.kind === 'domain_list_txt' ? [source.path] : [])),
    );

    expect([...new Set(registeredPaths)].sort()).toEqual(dnsPaths);

    const dnsOnlyIds = registry.filteredServices.value
      .filter((service) => service.sources.every((source) => source.kind === 'domain_list_txt'))
      .map((service) => service.id);

    for (const serviceId of dnsOnlyIds) {
      registry.clearSelection();
      registry.setServiceSelection(serviceId, true);
      expect(registry.mergedEntryCount.value).toBeGreaterThan(0);
      expect(registry.mergedRoutesText.value.length).toBeGreaterThan(0);
    }

    registry.outputFormat.value = 'bat';
    expect(registry.filteredServices.value.some((service) => dnsOnlyIds.includes(service.id))).toBe(
      false,
    );
    expect(registry.mergedRoutesText.value).toBe('');
  });

  it('filters by search query and category', () => {
    const registry = useServiceRegistry();

    registry.searchQuery.value = 'gram';
    expect(registry.filteredServices.value.map((service) => service.id)).toEqual([
      'instagram',
      'telegram',
    ]);

    registry.setCategorySelection('messenger', true);
    expect(registry.filteredServices.value.map((service) => service.id)).toEqual(['telegram']);
  });

  it.each(['dns', 'bat'] as const)('filters by restriction type in %s format', (format) => {
    const registry = useServiceRegistry();

    registry.outputFormat.value = format;
    registry.setRestrictionSelection('region_not_supported', true);

    const filteredIds = registry.filteredServices.value.map((service) => service.id);
    const expectedIds = registry.allServices.value
      .filter(
        (service) =>
          service.restrictionType === 'region_not_supported' &&
          service.sources.some(
            (source) => source.kind === (format === 'dns' ? 'domain_list_txt' : 'ip_routes_bat'),
          ),
      )
      .map((service) => service.id);

    expect(filteredIds).toEqual(expectedIds);
    expect(filteredIds.length).toBeGreaterThan(0);
  });

  it('supports select all visible, selection clearing, and merged output generation', () => {
    const registry = useServiceRegistry();

    registry.outputFormat.value = 'bat';
    registry.searchQuery.value = 'git';
    const visibleIds = registry.filteredServices.value.map((service) => service.id);

    expect(visibleIds).toEqual(expect.arrayContaining(['copilot', 'github']));
    expect(visibleIds).toHaveLength(2);

    registry.selectAllVisible();
    expect(registry.selectedServiceIds.value.sort()).toEqual(visibleIds.sort());
    expect(registry.mergedRoutes.value.length).toBeGreaterThan(0);
    expect(registry.mergedRoutesText.value).toContain('route add ');

    registry.clearSelection();
    expect(registry.selectedServiceIds.value).toEqual([]);
    expect(registry.mergedRoutes.value).toEqual([]);
  });

  it('defaults to DNS and switches output without losing selections', () => {
    const registry = useServiceRegistry();
    expect(registry.outputFormat.value).toBe('dns');
    expect(registry.outputExtension.value).toBe('txt');
    expect(registry.filteredServices.value.some((service) => service.id === 'copilot')).toBe(false);
    registry.setServiceSelection('tiktok', true);
    expect(registry.mergedRoutesText.value).toContain('tiktok.com');
    expect(registry.mergedRoutesText.value).toContain('2.16.0.0/12');
    expect(registry.mergedRoutesText.value).not.toContain('route add');
    expect(registry.mergedEntryCount.value).toBe(registry.getRouteCountForService('tiktok'));

    registry.outputFormat.value = 'bat';
    expect(registry.outputExtension.value).toBe('bat');
    expect(registry.mergedRoutesText.value).toContain('route add');
    expect(registry.mergedEntryCount.value).toBe(registry.getRouteCountForService('tiktok'));
    registry.setServiceSelection('copilot', true);
    registry.outputFormat.value = 'dns';
    expect(registry.selectedServices.value.map((service) => service.id)).toEqual(['tiktok']);
    registry.outputFormat.value = 'bat';
    expect(registry.selectedServices.value.map((service) => service.id)).toEqual([
      'copilot',
      'tiktok',
    ]);
    registry.clearSelection();
    registry.outputFormat.value = 'dns';
    expect(registry.mergedRoutesText.value).toBe('');
    expect(registry.mergedEntryCount.value).toBe(0);
  });

  it('resets filters with clearFilters()', () => {
    const registry = useServiceRegistry();

    registry.searchQuery.value = 'tik';
    registry.setCategorySelection('video', true);
    registry.setRestrictionSelection('region_not_supported', true);

    expect(registry.hasActiveFilters.value).toBe(true);

    registry.clearFilters();

    expect(registry.searchQuery.value).toBe('');
    expect(registry.selectedCategories.value).toEqual([]);
    expect(registry.selectedRestrictionTypes.value).toEqual([]);
    expect(registry.hasActiveFilters.value).toBe(false);
  });
});
