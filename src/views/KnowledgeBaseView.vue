<script setup lang="ts">
import { ref, watch } from 'vue'
import { FileText } from '@lucide/vue'

import { Skeleton } from '@/components/ui/skeleton'
import * as kbApi from '@/api/knowledgeBases'
import type { Particule } from '@/api/knowledgeBases'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ kbId: string }>()

const auth = useAuthStore()

const particules = ref<Particule[] | null>(null)
const errorMessage = ref<string | null>(null)

// Reload when switching from one knowledge base to another in the sidebar
watch(
  () => props.kbId,
  async (kbId) => {
    particules.value = null
    errorMessage.value = null
    try {
      const result = await kbApi.listParticules(auth.token!, kbId)
      if (kbId === props.kbId) particules.value = result
    } catch (error) {
      errorMessage.value =
        error instanceof ApiError && error.status === 404
          ? 'Cette base de connaissances n’existe pas.'
          : 'Impossible de charger les particules, réessayez plus tard.'
    }
  },
  { immediate: true },
)
</script>

<template>
  <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

  <div v-else-if="particules === null" class="flex flex-col gap-2">
    <Skeleton v-for="n in 4" :key="n" class="h-14 w-full" />
  </div>

  <section
    v-else-if="particules.length === 0"
    class="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
  >
    <FileText class="size-8 text-muted-foreground" />
    <h1 class="font-heading text-xl font-semibold">Aucune particule</h1>
    <p class="text-muted-foreground">Cette base est vide pour l'instant.</p>
  </section>

  <ul v-else class="flex flex-col divide-y rounded-lg border">
    <li v-for="particule in particules" :key="particule.id" class="flex flex-col gap-1 p-4">
      <span class="font-medium">{{ particule.title }}</span>
      <span class="line-clamp-1 text-sm text-muted-foreground">{{ particule.content }}</span>
    </li>
  </ul>
</template>
