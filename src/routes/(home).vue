<script setup lang="ts">
import { computed } from 'vue';
import { toast } from 'vue-sonner';
import {
  Copy,
  Download,
  Filter,
  FilterX,
  Search,
  SlidersHorizontal,
  SquareCheck,
} from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useServiceRegistry } from '@/composables/useServiceRegistry';
import {
  restrictionTypeLabels,
  type RestrictionType,
  type ServiceCategory,
} from '@/types/registry';

const {
  allCategories,
  clearFilters,
  clearSelection,
  filteredServices,
  getRouteCountForService,
  hasActiveFilters,
  isServiceSelected,
  mergedRoutes,
  mergedRoutesText,
  restrictionOptions,
  searchQuery,
  selectAllVisible,
  selectedCategories,
  selectedRestrictionTypes,
  selectedServices,
  setCategorySelection,
  setRestrictionSelection,
  setServiceSelection,
  toggleServiceSelection,
} = useServiceRegistry();

const hasMergedOutput = computed(() => mergedRoutesText.value.length > 0);
const activeFilterCount = computed(
  () => selectedCategories.value.length + selectedRestrictionTypes.value.length,
);

function categoryLabel(category: ServiceCategory): string {
  return category
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function restrictionBadgeVariant(type: RestrictionType): 'secondary' | 'destructive' {
  return type === 'rkn_blocked' ? 'destructive' : 'secondary';
}

async function copyMergedRoutes(): Promise<void> {
  if (!hasMergedOutput.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(mergedRoutesText.value);
    toast('Merged routes copied to clipboard');
  } catch {
    toast('Clipboard write failed in this browser context');
  }
}

function downloadMergedRoutes(): void {
  if (!hasMergedOutput.value) {
    return;
  }

  const exportDate = new Date();
  const fileDate = [
    exportDate.getFullYear(),
    String(exportDate.getMonth() + 1).padStart(2, '0'),
    String(exportDate.getDate()).padStart(2, '0'),
  ].join('-');

  const fileName = `rucens-routes-${fileDate}.bat`;
  const blob = new Blob([mergedRoutesText.value], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
  toast(`Downloaded ${fileName}`);
}
</script>

<template>
  <main
    class="min-h-screen bg-[radial-gradient(1200px_500px_at_0%_-10%,rgba(6,182,212,0.18),transparent),radial-gradient(900px_420px_at_100%_0%,rgba(34,197,94,0.16),transparent)] dark:bg-[radial-gradient(1200px_500px_at_0%_-10%,rgba(6,182,212,0.2),transparent),radial-gradient(900px_420px_at_100%_0%,rgba(34,197,94,0.2),transparent)]"
  >
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <section class="rounded-3xl border bg-card/80 p-6 shadow-lg backdrop-blur md:p-8">
        <p class="text-sm font-medium text-muted-foreground">Rucens Registry</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Build your custom route list for restricted services
        </h1>
        <p class="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          Search services, filter by category and restriction type, then select what you need. The
          app merges route ranges and exports a single Windows <code>.bat</code> file.
        </p>
      </section>

      <div class="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section class="space-y-6">
          <Card class="border bg-card/85 shadow-md backdrop-blur">
            <CardHeader class="pb-4">
              <CardTitle class="text-lg">Discover Services</CardTitle>
              <CardDescription>
                {{ filteredServices.length }} visible service{{
                  filteredServices.length === 1 ? '' : 's'
                }}
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-4">
              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <Search
                    class="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  />
                  <Input
                    v-model="searchQuery"
                    class="pl-9"
                    placeholder="Search by service name"
                    type="search"
                  />
                </div>

                <Popover>
                  <PopoverTrigger as-child>
                    <Button variant="outline" class="shrink-0">
                      <SlidersHorizontal class="size-4" />
                      Filters
                      <Badge
                        v-if="activeFilterCount > 0"
                        variant="secondary"
                        class="rounded-md px-1.5 py-0 text-[11px]"
                      >
                        {{ activeFilterCount }}
                      </Badge>
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    align="end"
                    class="w-[min(92vw,540px)] rounded-xl border bg-popover/95 p-0 backdrop-blur"
                  >
                    <div class="border-b px-4 py-3">
                      <p class="text-sm font-semibold">Filters</p>
                      <p class="text-muted-foreground text-xs">
                        Narrow results by category and restriction type
                      </p>
                    </div>

                    <div class="grid gap-4 p-4 md:grid-cols-2">
                      <div class="space-y-2">
                        <p class="flex items-center gap-2 text-sm font-medium">
                          <Filter class="size-4" />
                          Category
                        </p>
                        <ScrollArea class="h-64 rounded-md border bg-background/50 p-2">
                          <div class="grid gap-2 pr-2">
                            <label
                              v-for="category in allCategories"
                              :key="category"
                              class="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            >
                              <Checkbox
                                :model-value="selectedCategories.includes(category)"
                                @update:model-value="
                                  (checked) => setCategorySelection(category, checked === true)
                                "
                              />
                              <span>{{ categoryLabel(category) }}</span>
                            </label>
                          </div>
                        </ScrollArea>
                      </div>

                      <div class="space-y-2">
                        <p class="flex items-center gap-2 text-sm font-medium">
                          <Filter class="size-4" />
                          Restriction type
                        </p>
                        <ScrollArea class="h-64 rounded-md border bg-background/50 p-2">
                          <div class="grid gap-2 pr-2">
                            <label
                              v-for="restrictionType in restrictionOptions"
                              :key="restrictionType"
                              class="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            >
                              <Checkbox
                                :model-value="selectedRestrictionTypes.includes(restrictionType)"
                                @update:model-value="
                                  (checked) =>
                                    setRestrictionSelection(restrictionType, checked === true)
                                "
                              />
                              <span>{{ restrictionTypeLabels[restrictionType] }}</span>
                            </label>
                          </div>
                        </ScrollArea>
                      </div>
                    </div>

                    <div class="flex items-center justify-end border-t px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        :disabled="!hasActiveFilters"
                        @click="clearFilters"
                      >
                        <FilterX class="size-4" />
                        Clear filters
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  :disabled="filteredServices.length === 0"
                  @click="selectAllVisible"
                >
                  <SquareCheck class="size-4" />
                  Select all visible
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="selectedServices.length === 0"
                  @click="clearSelection"
                >
                  Clear selection
                </Button>
              </div>
            </CardContent>
          </Card>

          <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <Card
              v-for="service in filteredServices"
              :key="service.id"
              class="cursor-pointer border bg-card/90 py-0 transition hover:-translate-y-0.5 hover:shadow-lg"
              :class="{
                'ring-primary border-primary ring-2': isServiceSelected(service.id),
              }"
              @click="toggleServiceSelection(service.id)"
            >
              <CardHeader class="gap-3 border-b pb-4 pt-5">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle class="text-base">{{ service.name }}</CardTitle>
                    <CardDescription class="mt-1">
                      {{ restrictionTypeLabels[service.restrictionType] }}
                    </CardDescription>
                  </div>

                  <Checkbox
                    :model-value="isServiceSelected(service.id)"
                    @click.stop
                    @update:model-value="
                      (checked) => setServiceSelection(service.id, checked === true)
                    "
                  />
                </div>
              </CardHeader>

              <CardContent class="space-y-3 pb-4 pt-4">
                <div class="flex flex-wrap gap-2">
                  <Badge variant="outline">{{ categoryLabel(service.category) }}</Badge>
                  <Badge :variant="restrictionBadgeVariant(service.restrictionType)">
                    {{
                      service.restrictionType === 'rkn_blocked'
                        ? 'RKN blocked'
                        : 'Region restricted'
                    }}
                  </Badge>
                </div>

                <p class="text-muted-foreground text-sm">
                  {{ getRouteCountForService(service.id) }} route{{
                    getRouteCountForService(service.id) === 1 ? '' : 's'
                  }}
                  in source list
                </p>
              </CardContent>

              <CardFooter class="pb-5 pt-0">
                <Button
                  size="sm"
                  :variant="isServiceSelected(service.id) ? 'default' : 'outline'"
                  class="w-full"
                  @click.stop="toggleServiceSelection(service.id)"
                >
                  {{ isServiceSelected(service.id) ? 'Selected' : 'Select service' }}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        <aside class="xl:sticky xl:top-6 xl:self-start">
          <Card class="border bg-card/90 py-0 shadow-md backdrop-blur">
            <CardHeader class="border-b pb-4 pt-5">
              <CardTitle class="text-lg">Merged Output</CardTitle>
              <CardDescription>
                {{ selectedServices.length }} service{{
                  selectedServices.length === 1 ? '' : 's'
                }}
                selected
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-4 pb-5 pt-5">
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-lg border bg-background/70 p-3">
                  <p class="text-muted-foreground text-xs">Selected services</p>
                  <p class="mt-1 text-lg font-semibold">{{ selectedServices.length }}</p>
                </div>
                <div class="rounded-lg border bg-background/70 p-3">
                  <p class="text-muted-foreground text-xs">Merged routes</p>
                  <p class="mt-1 text-lg font-semibold">{{ mergedRoutes.length }}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p class="mb-2 text-sm font-medium">Preview</p>
                <ScrollArea class="h-72 rounded-lg border bg-background/75 p-3">
                  <pre
                    v-if="hasMergedOutput"
                    class="whitespace-pre-wrap break-all text-xs leading-relaxed"
                    >{{ mergedRoutesText }}</pre
                  >
                  <p v-else class="text-muted-foreground text-xs leading-relaxed">
                    No routes yet. Select one or more services from the list.
                  </p>
                </ScrollArea>
              </div>
            </CardContent>

            <CardFooter class="flex-col gap-2 border-t py-5">
              <Button class="w-full" :disabled="!hasMergedOutput" @click="copyMergedRoutes">
                <Copy class="size-4" />
                Copy merged text
              </Button>
              <Button
                class="w-full"
                variant="secondary"
                :disabled="!hasMergedOutput"
                @click="downloadMergedRoutes"
              >
                <Download class="size-4" />
                Download .bat
              </Button>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </div>
  </main>
</template>
