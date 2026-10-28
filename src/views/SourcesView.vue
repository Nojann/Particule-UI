<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { ArrowLeft, BookOpen, Plus } from '@lucide/vue'

import SourceEditor from '@/components/SourceEditor.vue'
import SourceList from '@/components/SourceList.vue'
import SourceQuickAdd from '@/components/SourceQuickAdd.vue'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Skeleton } from '@/components/ui/skeleton'
import type { Source, SourceFields } from '@/api/sources'
import { useSourcesStore } from '@/stores/sources'

const props = defineProps<{ sourceId?: string }>()

const sources = useSourcesStore()
const route = useRoute()
const router = useRouter()
const isDesktop = useMediaQuery('(min-width: 768px)')

const loadError = ref(false)

onMounted(async () => {
  try {
    await sources.fetchAll()
  } catch {
    loadError.value = true
  }
})

/** `?new` opens the quick add; `?new&manual` the full form, for a reference without a DOI */
const isNew = computed(() => !props.sourceId && 'new' in route.query)
const isManual = computed(() => isNew.value && 'manual' in route.query)

/** What the quick add imported but couldn't save: it prefills the full form */
const draft = ref<SourceFields | null>(null)
watch(
  isManual,
  (manual) => {
    if (!manual) return
    draft.value = sources.draft
    sources.draft = null
  },
  { immediate: true },
)
const current = computed(() => sources.byId(props.sourceId))
const editorOpen = computed(() => isNew.value || props.sourceId !== undefined)

/**
 * The editor is re-created for each source, except when its own new source gets its id:
 * it keeps focus and cursor.
 */
const editorKey = ref(0)
let createdId: string | null = null
watch(
  () => [props.sourceId, isNew.value, isManual.value],
  () => {
    if (props.sourceId !== undefined && props.sourceId === createdId) return
    createdId = null
    editorKey.value++
  },
)

function onCreated(source: Source) {
  createdId = source.id
  void router.replace({ name: 'sources', params: { sourceId: source.id } })
}

const deleteError = ref<string | null>(null)

async function onDelete(source: Source | null) {
  deleteError.value = null
  let next: Source | undefined
  if (source) {
    const index = sources.items.findIndex((s) => s.id === source.id)
    next = sources.items[index + 1] ?? sources.items[index - 1]
    try {
      await sources.remove(source.id)
    } catch {
      deleteError.value = 'Suppression impossible, réessayez plus tard.'
      editorKey.value++ // The editor stopped saving: start a fresh one on the same source
      return
    }
  }
  // Open the neighbour; on mobile, go back to the list instead
  const sourceId = isDesktop.value ? next?.id : undefined
  void router.push({ name: 'sources', params: { sourceId } })
}

function openSource(source: Source) {
  void router.push({ name: 'sources', params: { sourceId: source.id } })
}

function onQuickAdded(source: Source) {
  createdId = null
  void router.replace({ name: 'sources', params: { sourceId: source.id } })
}

function createSource() {
  void router.push({ name: 'sources', query: { new: null } })
}
</script>

<template>
  <p v-if="loadError" class="p-6 text-sm text-destructive">
    Impossible de charger vos sources, réessayez plus tard.
  </p>

  <ResizablePanelGroup
    v-else-if="isDesktop"
    direction="horizontal"
    auto-save-id="source-panes"
    class="h-full"
  >
    <ResizablePanel :default-size="30" :min-size="20" :max-size="45">
      <SourceList :active-id="sourceId" @create="createSource" />
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
        <div v-if="isNew && !isManual" class="flex-1 overflow-y-auto">
          <section class="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
            <h2 class="text-lg font-medium">Nouvelle source</h2>
            <SourceQuickAdd :key="editorKey" @created="onQuickAdded" @existing="openSource" />
          </section>
        </div>
        <SourceEditor
          v-else-if="isNew || current"
          class="min-h-0 flex-1"
          :key="editorKey"
          :source="current ?? null"
          :initial="draft"
          @created="onCreated"
          @delete="onDelete"
        />
        <div
          v-else-if="!sources.loaded"
          class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-20"
        >
          <Skeleton class="h-9 w-1/2" />
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-5/6" />
        </div>
        <p v-else class="p-10 text-center text-sm text-muted-foreground">
          Cette source n’existe pas, ou plus.
        </p>
      </template>

      <div
        v-else
        class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground"
      >
        <BookOpen class="size-8" />
        <p class="text-sm">Sélectionnez une source, ou ajoutez-en une.</p>
        <Button size="sm" variant="outline" @click="createSource">
          <Plus />
          Nouvelle source
        </Button>
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
    <section v-if="isNew && !isManual" class="flex flex-col gap-4 px-4 py-6">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" class="-ml-2" as-child>
          <RouterLink :to="{ name: 'sources' }" aria-label="Retour à la liste">
            <ArrowLeft />
          </RouterLink>
        </Button>
        <h2 class="text-lg font-medium">Nouvelle source</h2>
      </div>
      <SourceQuickAdd :key="editorKey" @created="onQuickAdded" @existing="openSource" />
    </section>
    <SourceEditor
      v-else-if="editorOpen && (isNew || current)"
      :key="editorKey"
      :source="current ?? null"
      :initial="draft"
      show-back
      @created="onCreated"
      @delete="onDelete"
    />
    <p
      v-else-if="editorOpen && sources.loaded"
      class="p-10 text-center text-sm text-muted-foreground"
    >
      Cette source n’existe pas, ou plus.
    </p>
    <SourceList v-else :active-id="sourceId" @create="createSource" />
  </template>
</template>
