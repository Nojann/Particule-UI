<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ListboxGroup, ListboxItem } from 'reka-ui'
import { ArrowLeft, BookOpen, Check, ChevronsUpDown, FileDown, Plus } from '@lucide/vue'

import SourceQuickAdd from '@/components/SourceQuickAdd.vue'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Source } from '@/api/sources'
import { extractDoi, isDoi } from '@/lib/doi'
import { emptySourceForm, payloadFromForm } from '@/lib/sourceForm'
import { cn } from '@/lib/utils'
import { sourceDetail, sourceLabel, useSourcesStore } from '@/stores/sources'

const model = defineModel<string | null>({ required: true })

const sources = useSourcesStore()
const open = ref(false)

/** The list to choose from, or the quick add to create a source and cite it */
const view = ref<'list' | 'add'>('list')
/** Prefills the quick add when the search held a DOI */
const doiToImport = ref<string | undefined>()

// The command list keeps its search to itself; the input event tells us what was typed
const query = ref('')
const trimmedQuery = computed(() => query.value.trim())
const queryDoi = computed(() =>
  isDoi(trimmedQuery.value) ? extractDoi(trimmedQuery.value) : null,
)
const knownDoiSource = computed(() =>
  queryDoi.value ? sources.findByDoi(queryDoi.value) : undefined,
)

watch(open, (isOpen) => {
  if (isOpen) return
  view.value = 'list'
  query.value = ''
  createError.value = false
})

function choose(sourceId: string | null) {
  model.value = sourceId
  open.value = false
}

function openQuickAdd(doi?: string) {
  doiToImport.value = doi
  view.value = 'add'
}

const creating = ref(false)
const createError = ref(false)

/** An explicit action: the typed text becomes an other source's title, cited at once */
async function createOther() {
  creating.value = true
  createError.value = false
  try {
    const source = await sources.create(
      payloadFromForm({ ...emptySourceForm('other'), title: trimmedQuery.value }),
    )
    choose(source.id)
  } catch {
    createError.value = true
  } finally {
    creating.value = false
  }
}

function onCited(source: Source) {
  choose(source.id)
}

// Same look as CommandItem
const ACTION_CLASS =
  'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=text-])]:text-muted-foreground'
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        role="combobox"
        :aria-expanded="open"
        :class="
          cn(
            'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-accent focus-visible:bg-accent',
            !model && 'text-muted-foreground',
          )
        "
      >
        <span class="truncate">
          {{ sources.byId(model) ? sourceLabel(sources.byId(model)!) : 'Aucune' }}
        </span>
        <ChevronsUpDown class="ml-auto size-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>

    <PopoverContent
      :class="cn('p-0', view === 'add' ? 'w-[min(28rem,calc(100vw-2rem))]' : 'w-72')"
      align="start"
    >
      <div v-if="view === 'add'" class="flex max-h-[70vh] flex-col overflow-y-auto">
        <div class="flex items-center gap-1 border-b px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            aria-label="Retour à la liste des sources"
            @click="view = 'list'"
          >
            <ArrowLeft />
          </Button>
          <h2 class="text-sm font-medium">Ajouter une source</h2>
        </div>
        <div class="p-4">
          <SourceQuickAdd
            cite
            :initial-doi="doiToImport"
            @created="onCited"
            @existing="onCited"
          />
        </div>
      </div>

      <template v-else>
        <Command>
          <CommandInput
            placeholder="Rechercher, ou coller un DOI…"
            @input="query = ($event.target as HTMLInputElement).value"
          />
          <CommandList>
            <CommandEmpty v-if="!trimmedQuery">Aucune source trouvée.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="none" @select="choose(null)">
                <Check :class="cn('size-4', model ? 'opacity-0' : 'opacity-100')" />
                <span class="text-muted-foreground">Aucune</span>
              </CommandItem>
              <CommandItem
                v-for="source in sources.items"
                :key="source.id"
                :value="source.id"
                @select="choose(source.id)"
              >
                <Check :class="cn('size-4', model === source.id ? 'opacity-100' : 'opacity-0')" />
                <div class="flex min-w-0 flex-col">
                  <span class="truncate">{{ sourceLabel(source) }}</span>
                  <span
                    v-if="sourceDetail(source)"
                    class="truncate text-xs text-muted-foreground"
                    >{{ sourceDetail(source) }}</span
                  >
                </div>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <!--
              Actions, shown whatever was typed: Reka's listbox parts keep them in the keyboard
              navigation, out of the command's text filter
            -->
            <ListboxGroup class="p-1" aria-label="Ajouter une source">
              <ListboxItem
                v-if="knownDoiSource"
                value="doi-known"
                :class="ACTION_CLASS"
                @select="choose(knownDoiSource.id)"
              >
                <Check class="size-4 opacity-0" />
                <span class="min-w-0 truncate">
                  Citer {{ sourceLabel(knownDoiSource) }} ({{ queryDoi }})
                </span>
              </ListboxItem>
              <ListboxItem
                v-else-if="queryDoi"
                value="doi-import"
                :class="ACTION_CLASS"
                @select="openQuickAdd(queryDoi)"
              >
                <FileDown class="size-4" />
                <span class="min-w-0 truncate">Importer le DOI {{ queryDoi }}</span>
              </ListboxItem>
              <ListboxItem
                v-else-if="trimmedQuery"
                value="create-other"
                :disabled="creating"
                :class="ACTION_CLASS"
                @select="createOther"
              >
                <Plus class="size-4" />
                <span class="min-w-0 truncate">
                  Créer « {{ trimmedQuery }} » comme autre source
                </span>
              </ListboxItem>
              <ListboxItem value="quick-add" :class="ACTION_CLASS" @select="openQuickAdd()">
                <Plus class="size-4" />
                <span>Ajouter une source</span>
              </ListboxItem>
            </ListboxGroup>
          </CommandList>
        </Command>
        <p v-if="createError" role="alert" class="border-t p-3 text-xs text-destructive">
          La création de la source a échoué, réessayez.
        </p>
        <RouterLink
          :to="{ name: 'sources' }"
          class="flex items-center gap-2 border-t p-3 text-xs outline-none hover:bg-accent focus-visible:bg-accent"
        >
          <BookOpen class="size-4" />
          Gérer les sources
        </RouterLink>
      </template>
    </PopoverContent>
  </Popover>
</template>
