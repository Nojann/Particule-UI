<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'
</script>

<template>
  <div class="flex min-h-40 flex-col gap-2" aria-label="Chargement de l’éditeur">
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-5/6" />
    <Skeleton class="h-4 w-2/3" />
  </div>
</template>
