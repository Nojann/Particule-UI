<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { FileText, Plus } from '@lucide/vue'

import ParticuleEditor from '@/components/ParticuleEditor.vue'
import ParticuleList from '@/components/ParticuleList.vue'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Skeleton } from '@/components/ui/skeleton'
import type { Particule } from '@/api/particules'
import { ApiError } from '@/api/client'
import { useParticulesStore } from '@/stores/particules'
import { useSourcesStore } from '@/stores/sources'

const props = defineProps<{ kbId: string; permalink?: string }>()

const particules = useParticulesStore()
const sources = useSourcesStore()
const route = useRoute()
const router = useRouter()
const isDesktop = useMediaQuery('(min-width: 768px)')

const loadError = ref<string | null>(null)

watch(
  () => props.kbId,
  async (kbId) => {
    loadError.value = null
    try {
      await particules.load(kbId)
    } catch (error) {
      loadError.value =
        error instanceof ApiError && error.status === 404
          ? 'Cette base de connaissances n’existe pas.'
          : 'Impossible de charger les particules, réessayez plus tard.'
    }
  },
  { immediate: true },
)

// Sources only label particules: the page works without them
onMounted(() => {
  if (!sources.loaded) sources.fetchAll().catch(() => {})
})

/** `?new` opens a draft */
const isDraft = computed(() => !props.permalink && 'new' in route.query)

/**
 * The particule the editor moved to a new permalink. The store already has the new
 * permalink while the URL still shows the old one, so it is also found by id meanwhile.
 */
const moved = ref<Particule | null>(null)

const current = computed(() => {
  if (!props.permalink) return undefined
  const byUrl = particules.byPermalink(props.permalink)
  if (byUrl || !moved.value) return byUrl
  return particules.items.find((p) => p.id === moved.value!.id)
})
const editorOpen = computed(() => isDraft.value || props.permalink !== undefined)

/**
 * The editor is re-created for each particule, except when its own particule
 * changes URL (draft created, permalink edited): it keeps focus and cursor.
 */
const editorKey = ref(0)
watch(
  () => [props.kbId, props.permalink, isDraft.value],
  () => {
    if (props.permalink !== undefined && props.permalink === moved.value?.permalink) return
    moved.value = null
    editorKey.value++
  },
)

function onMoved(particule: Particule) {
  moved.value = particule
  void router.replace({
    name: 'knowledge-base',
    params: { kbId: props.kbId, permalink: particule.permalink },
  })
}

const deleteError = ref<string | null>(null)

async function onDelete(particule: Particule | null) {
  deleteError.value = null
  let next: Particule | undefined
  if (particule) {
    const index = particules.items.findIndex((p) => p.id === particule.id)
    next = particules.items[index + 1] ?? particules.items[index - 1]
    try {
      await particules.remove(particule)
    } catch {
      deleteError.value = 'Suppression impossible, réessayez plus tard.'
      editorKey.value++ // The editor stopped saving: start a fresh one on the same particule
      return
    }
  }
  // Open the neighbour; on mobile, go back to the list instead
  const permalink = isDesktop.value ? next?.permalink : undefined
  void router.push({ name: 'knowledge-base', params: { kbId: props.kbId, permalink } })
}

function createParticule() {
  void router.push({ name: 'knowledge-base', params: { kbId: props.kbId }, query: { new: null } })
}
</script>

<template>
  <p v-if="loadError" class="p-6 text-sm text-destructive">{{ loadError }}</p>

  <ResizablePanelGroup
    v-else-if="isDesktop"
    direction="horizontal"
    auto-save-id="particule-panes"
    class="h-full"
  >
    <ResizablePanel :default-size="30" :min-size="20" :max-size="45">
      <ParticuleList :kb-id="kbId" :active-permalink="permalink" @create="createParticule" />
    </ResizablePanel>
    <ResizableHandle />
    <ResizablePanel :default-size="70" class="flex flex-col">
      <p
        v-if="deleteError"
        role="alert"
        class="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
      >
        {{ deleteError }}
      </p>
      <template v-if="editorOpen">
        <ParticuleEditor
          v-if="isDraft || current"
          class="min-h-0 flex-1"
          :key="editorKey"
          :kb-id="kbId"
          :particule="current ?? null"
          @moved="onMoved"
          @delete="onDelete"
        />
        <div
          v-else-if="!particules.loaded"
          class="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-20"
        >
          <Skeleton class="h-9 w-1/2" />
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-5/6" />
        </div>
        <p v-else class="p-10 text-center text-sm text-muted-foreground">
          Cette particule n’existe pas, ou plus.
        </p>
      </template>

      <div
        v-else
        class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground"
      >
        <FileText class="size-8" />
        <p class="text-sm">Sélectionnez une particule, ou créez-en une.</p>
        <Button size="sm" variant="outline" @click="createParticule">
          <Plus />
          Nouvelle particule
        </Button>
        <p class="text-xs">
          <kbd class="rounded border px-1 font-mono">/</kbd> pour filtrer,
          <kbd class="rounded border px-1 font-mono">↑</kbd>
          <kbd class="rounded border px-1 font-mono">↓</kbd> pour naviguer
        </p>
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>

  <!-- Mobile: one pane at a time -->
  <template v-else>
    <p
      v-if="deleteError"
      role="alert"
      class="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      {{ deleteError }}
    </p>
    <ParticuleEditor
      v-if="editorOpen && (isDraft || current)"
      :key="editorKey"
      :kb-id="kbId"
      :particule="current ?? null"
      show-back
      @moved="onMoved"
      @delete="onDelete"
    />
    <ParticuleList v-else :kb-id="kbId" :active-permalink="permalink" @create="createParticule" />
  </template>
</template>
