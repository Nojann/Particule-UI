<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { onKeyStroke } from '@vueuse/core'
import { BookOpen, Plus, Search } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { sourceTypeLabel } from '@/lib/sourceForm'
import { cn } from '@/lib/utils'
import { sourceDetail, sourceLabel, useSourcesStore } from '@/stores/sources'

const props = defineProps<{ activeId?: string }>()
const emit = defineEmits<{ create: [] }>()

const sources = useSourcesStore()
const router = useRouter()

const filter = ref('')
const filterInput = useTemplateRef<HTMLInputElement>('filterInput')

// Case and accent insensitive: "ecole" finds "École"
function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const rows = computed(() =>
  sources.items.map((source) => ({
    source,
    label: sourceLabel(source),
    detail: sourceDetail(source),
    type: sourceTypeLabel(source.type),
    searchText: normalize(
      `${source.authors ?? ''} ${source.title} ${source.container_title ?? ''} ${source.url ?? ''}`,
    ),
  })),
)

const visibleRows = computed(() => {
  const query = normalize(filter.value.trim())
  return query ? rows.value.filter((row) => row.searchText.includes(query)) : rows.value
})

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

// "/" jumps to the filter from anywhere but a text field
onKeyStroke('/', (event) => {
  if (isTyping(event.target)) return
  event.preventDefault()
  filterInput.value?.focus()
})

// ↑ / ↓ from the filter or the list open the previous / next source
function move(step: 1 | -1) {
  const list = visibleRows.value
  if (!list.length) return
  const index = list.findIndex((row) => row.source.id === props.activeId)
  const target = list[Math.min(Math.max(index + step, 0), list.length - 1)]!
  void router.push({ name: 'sources', params: { sourceId: target.source.id } })
}
</script>

<template>
  <section
    class="flex h-full flex-col"
    aria-label="Sources"
    @keydown.down.prevent="move(1)"
    @keydown.up.prevent="move(-1)"
  >
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref="filterInput"
          v-model="filter"
          type="search"
          placeholder="Filtrer…"
          aria-label="Filtrer les sources"
          aria-keyshortcuts="/"
          class="h-8 w-full rounded-md bg-transparent pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground hover:bg-accent focus:bg-accent"
          @keydown.esc="filter = ''"
        />
      </div>
      <Button variant="ghost" size="icon" aria-label="Nouvelle source" @click="emit('create')">
        <Plus />
      </Button>
    </header>

    <div v-if="!sources.loaded" class="flex flex-col gap-3 p-3">
      <div v-for="n in 5" :key="n" class="flex flex-col gap-1.5">
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-3 w-full" />
      </div>
    </div>

    <div
      v-else-if="!sources.items.length"
      class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <BookOpen class="size-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">Vous n’avez encore aucune source.</p>
      <Button size="sm" @click="emit('create')">
        <Plus />
        Ajouter une source
      </Button>
    </div>

    <template v-else>
      <p v-if="!visibleRows.length" class="p-6 text-center text-sm text-muted-foreground">
        Aucune source ne correspond à « {{ filter }} ».
      </p>

      <ul class="flex-1 overflow-y-auto p-1.5">
        <li v-for="row in visibleRows" :key="row.source.id">
          <RouterLink
            :to="{ name: 'sources', params: { sourceId: row.source.id } }"
            :aria-current="row.source.id === activeId ? 'page' : undefined"
            :class="
              cn(
                'flex flex-col gap-0.5 rounded-md px-3 py-2 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
                row.source.id === activeId && 'bg-accent',
              )
            "
          >
            <span class="truncate text-sm font-medium">{{ row.label }}</span>
            <span v-if="row.detail" class="line-clamp-1 text-xs text-muted-foreground">{{
              row.detail
            }}</span>
            <span class="text-xs text-muted-foreground/80">{{ row.type }}</span>
          </RouterLink>
        </li>
      </ul>

      <p class="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">
        {{ sources.items.length === 1 ? '1 source' : `${sources.items.length} sources` }}
      </p>
    </template>
  </section>
</template>
