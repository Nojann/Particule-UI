<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import ColorModeToggle from '@/components/ColorModeToggle.vue'
</script>

<!-- Login and signup stand alone, a step between the public site and the app -->
<template>
  <div class="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-4">
    <ColorModeToggle class="absolute top-4 right-4" />

    <RouterLink to="/" class="flex items-center gap-2 font-heading text-lg font-semibold">
      <AppLogo class="size-8" />
      Particule
    </RouterLink>

    <slot />
  </div>
</template>
