import { describe, expect, it } from 'vitest';
import { useServiceRegistry } from '@/composables/useServiceRegistry';

describe('useServiceRegistry', () => {
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

  it('filters by restriction type', () => {
    const registry = useServiceRegistry();

    registry.setRestrictionSelection('region_not_supported', true);

    const filteredIds = registry.filteredServices.value.map((service) => service.id);

    expect(filteredIds).toEqual(['gemini', 'grok', 'notion', 'tiktok']);
  });

  it('supports select all visible, selection clearing, and merged output generation', () => {
    const registry = useServiceRegistry();

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
