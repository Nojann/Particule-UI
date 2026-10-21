<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useColorMode } from '@vueuse/core'
import { Moon, Sun } from '@lucide/vue'

import { Button } from '@/components/ui/button'

const navLinks = [{ to: '/', label: 'Accueil' }]

const colorMode = useColorMode()

function toggleColorMode() {
  colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <RouterLink to="/" class="font-heading text-lg font-semibold">Particule</RouterLink>

        <nav class="flex items-center gap-1">
          <Button v-for="link in navLinks" :key="link.to" variant="ghost" size="sm" as-child>
            <RouterLink :to="link.to" active-class="bg-accent text-accent-foreground">
              {{ link.label }}
            </RouterLink>
          </Button>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          class="ml-auto"
          aria-label="Basculer le thème clair / sombre"
          @click="toggleColorMode"
        >
          <Sun v-if="colorMode === 'dark'" />
          <Moon v-else />
        </Button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <RouterView />
    </main>

    <footer class="border-t">
      <div class="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
        © {{ new Date().getFullYear() }} Particule
      </div>
    </footer>
  </div>
</template>
