import { computed, ref } from 'vue';
import servicesJson from '@/data/services.json';
import { formatRoutesAsBat, mergeRoutes, type ParsedRoute } from '@/lib/route-parser';
import {
  restrictionTypes,
  type RestrictionType,
  type ServiceCategory,
  type ServiceEntry,
} from '@/types/registry';

const services = servicesJson as ServiceEntry[];

function withAdded<T extends string>(values: T[], value: T): T[] {
  if (values.includes(value)) {
    return values;
  }

  return [...values, value];
}

function withRemoved<T extends string>(values: T[], value: T): T[] {
  return values.filter((entry) => entry !== value);
}

function sortByName(entries: ServiceEntry[]): ServiceEntry[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

export function useServiceRegistry() {
  const searchQuery = ref('');
  const selectedCategories = ref<ServiceCategory[]>([]);
  const selectedRestrictionTypes = ref<RestrictionType[]>([]);
  const selectedServiceIds = ref<string[]>([]);

  const allServices = computed(() => sortByName(services));

  const allCategories = computed(() => {
    const categories = new Set<ServiceCategory>();

    for (const service of allServices.value) {
      categories.add(service.category);
    }

    return [...categories].sort((a, b) => a.localeCompare(b));
  });

  const restrictionOptions = computed(() => [...restrictionTypes]);

  const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());

  const filteredServices = computed(() => {
    return allServices.value.filter((service) => {
      const matchesSearch =
        normalizedSearchQuery.value.length === 0 ||
        service.name.toLowerCase().includes(normalizedSearchQuery.value);

      const matchesCategory =
        selectedCategories.value.length === 0 ||
        selectedCategories.value.includes(service.category);

      const matchesRestriction =
        selectedRestrictionTypes.value.length === 0 ||
        selectedRestrictionTypes.value.includes(service.restrictionType);

      return matchesSearch && matchesCategory && matchesRestriction;
    });
  });

  const routeCountByServiceId = computed(() => {
    const routeCountMap = new Map<string, number>();

    for (const service of allServices.value) {
      routeCountMap.set(service.id, mergeRoutes([service]).length);
    }

    return routeCountMap;
  });

  const selectedServices = computed(() => {
    if (selectedServiceIds.value.length === 0) {
      return [] as ServiceEntry[];
    }

    const selectedIdSet = new Set(selectedServiceIds.value);

    return allServices.value.filter((service) => selectedIdSet.has(service.id));
  });

  const mergedRoutes = computed<ParsedRoute[]>(() => mergeRoutes(selectedServices.value));

  const mergedRoutesText = computed(() => formatRoutesAsBat(mergedRoutes.value));

  const hasActiveFilters = computed(() => {
    return (
      searchQuery.value.trim().length > 0 ||
      selectedCategories.value.length > 0 ||
      selectedRestrictionTypes.value.length > 0
    );
  });

  function isServiceSelected(serviceId: string): boolean {
    return selectedServiceIds.value.includes(serviceId);
  }

  function setServiceSelection(serviceId: string, selected: boolean): void {
    selectedServiceIds.value = selected
      ? withAdded(selectedServiceIds.value, serviceId)
      : withRemoved(selectedServiceIds.value, serviceId);
  }

  function toggleServiceSelection(serviceId: string): void {
    setServiceSelection(serviceId, !isServiceSelected(serviceId));
  }

  function setCategorySelection(category: ServiceCategory, selected: boolean): void {
    selectedCategories.value = selected
      ? withAdded(selectedCategories.value, category)
      : withRemoved(selectedCategories.value, category);
  }

  function setRestrictionSelection(restrictionType: RestrictionType, selected: boolean): void {
    selectedRestrictionTypes.value = selected
      ? withAdded(selectedRestrictionTypes.value, restrictionType)
      : withRemoved(selectedRestrictionTypes.value, restrictionType);
  }

  function clearSelection(): void {
    selectedServiceIds.value = [];
  }

  function selectAllVisible(): void {
    const visibleIds = filteredServices.value.map((service) => service.id);
    const selectedIdSet = new Set(selectedServiceIds.value);

    for (const serviceId of visibleIds) {
      selectedIdSet.add(serviceId);
    }

    selectedServiceIds.value = [...selectedIdSet];
  }

  function clearFilters(): void {
    searchQuery.value = '';
    selectedCategories.value = [];
    selectedRestrictionTypes.value = [];
  }

  function getRouteCountForService(serviceId: string): number {
    return routeCountByServiceId.value.get(serviceId) ?? 0;
  }

  return {
    allCategories,
    allServices,
    clearFilters,
    clearSelection,
    filteredServices,
    getRouteCountForService,
    hasActiveFilters,
    isServiceSelected,
    mergedRoutes,
    mergedRoutesText,
    normalizedSearchQuery,
    restrictionOptions,
    searchQuery,
    selectAllVisible,
    selectedCategories,
    selectedRestrictionTypes,
    selectedServiceIds,
    selectedServices,
    setCategorySelection,
    setRestrictionSelection,
    setServiceSelection,
    toggleServiceSelection,
  };
}
