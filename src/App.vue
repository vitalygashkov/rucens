<script setup lang="ts">
import 'vue-sonner/style.css';
import { RouterView } from 'vue-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/lib/theme';

useTheme();
</script>

<template>
  <div class="min-h-screen w-full">
    <TooltipProvider>
      <RouterView />
    </TooltipProvider>
    <Toaster />
  </div>
</template>
