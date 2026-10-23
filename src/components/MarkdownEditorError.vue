<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import { Button } from '@/components/ui/button'

function reload() {
  window.location.reload()
}
</script>

<!-- Shown when the editor's code fails to load (network, or a new deploy / dev rebuild) -->
<template>
  <div
    role="alert"
    class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center"
  >
    <TriangleAlert class="size-6 text-destructive" />
    <p class="text-sm text-muted-foreground">L’éditeur n’a pas pu se charger.</p>
    <Button size="sm" variant="outline" @click="reload">Recharger la page</Button>
  </div>
</template>
