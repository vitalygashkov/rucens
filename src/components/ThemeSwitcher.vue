<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import { messages as t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

const { theme } = useTheme();
</script>

<template>
  <fieldset class="inline-flex max-w-full flex-wrap gap-1 rounded-lg border p-1">
    <legend class="sr-only">{{ t.theme }}</legend>
    <label
      v-for="option in [
        { value: 'auto', label: t.systemTheme, icon: Monitor },
        { value: 'light', label: t.lightTheme, icon: Sun },
        { value: 'dark', label: t.darkTheme, icon: Moon },
      ]"
      :key="option.value"
      class="relative inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs sm:gap-1.5 sm:px-2.5 sm:text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
      :class="
        theme === option.value
          ? 'bg-secondary text-secondary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      "
    >
      <input v-model="theme" type="radio" name="theme" :value="option.value" class="sr-only" />
      <component :is="option.icon" class="size-4" aria-hidden="true" />
      {{ option.label }}
    </label>
  </fieldset>
</template>
