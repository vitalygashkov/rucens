<script setup lang="ts">
import 'vue-sonner/style.css';
import { RouterView } from 'vue-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { messages } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

const { resolvedTheme } = useTheme();
</script>

<template>
  <div class="min-h-screen w-full">
    <TooltipProvider>
      <RouterView />
    </TooltipProvider>
    <Toaster :theme="resolvedTheme" :container-aria-label="messages.notifications" />
  </div>
</template>
