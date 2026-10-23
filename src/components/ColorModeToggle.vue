<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import { Moon, Sun } from '@lucide/vue'

import { Button } from '@/components/ui/button'

const colorMode = useColorMode()

function toggleColorMode() {
  colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    aria-label="Basculer le thème clair / sombre"
    @click="toggleColorMode"
  >
    <Sun v-if="colorMode === 'dark'" />
    <Moon v-else />
  </Button>
</template>
