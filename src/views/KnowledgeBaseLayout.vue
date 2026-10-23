<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppSidebar from '@/components/AppSidebar.vue'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useKnowledgeBasesStore } from '@/stores/knowledgeBases'

const knowledgeBases = useKnowledgeBasesStore()
const route = useRoute()

const loadError = ref(false)

const currentKb = computed(() =>
  typeof route.params.kbId === 'string' ? knowledgeBases.byId(route.params.kbId) : undefined,
)

onMounted(async () => {
  try {
    await knowledgeBases.fetchAll()
  } catch {
    loadError.value = true
  }
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <!-- Fixed height: the pages scroll inside, the particule panes each on their own -->
    <SidebarInset class="h-svh">
      <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
        <span class="truncate text-sm font-medium">
          {{ currentKb?.name ?? 'Bases de connaissances' }}
        </span>
      </header>

      <main class="min-h-0 flex-1 overflow-y-auto">
        <p v-if="loadError" class="p-6 text-sm text-destructive">
          Impossible de charger vos bases de connaissances, réessayez plus tard.
        </p>
        <RouterView v-else />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
