<script setup lang="ts">
import { RouterView } from 'vue-router'

import AuthLayout from '@/layouts/AuthLayout.vue'
import PublicLayout from '@/layouts/PublicLayout.vue'
</script>

<template>
  <!-- The key is the layout, so the fade only plays when switching layouts, not between pages -->
  <RouterView v-slot="{ Component, route }">
    <Transition name="fade" mode="out-in">
      <!-- Wrapped: the app shell's root (SidebarProvider) is not a DOM element, it can't fade -->
      <div v-if="route.meta.layout === 'app'" key="app">
        <component :is="Component" />
      </div>
      <AuthLayout v-else-if="route.meta.layout === 'auth'" key="auth">
        <component :is="Component" />
      </AuthLayout>
      <PublicLayout v-else key="public">
        <component :is="Component" />
      </PublicLayout>
    </Transition>
  </RouterView>
</template>
