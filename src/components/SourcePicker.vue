<script setup lang="ts">
import { ref } from 'vue'
import { Check, ChevronsUpDown } from '@lucide/vue'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { sourceLabel, useSourcesStore } from '@/stores/sources'

const model = defineModel<string | null>({ required: true })

const sources = useSourcesStore()
const open = ref(false)

function choose(sourceId: string | null) {
  model.value = sourceId
  open.value = false
}
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

    <PopoverContent class="w-72 p-0" align="start">
      <Command>
        <CommandInput placeholder="Rechercher une source…" />
        <CommandList>
          <CommandEmpty>Aucune source trouvée.</CommandEmpty>
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
                <span class="truncate text-xs text-muted-foreground">
                  {{ source.publisher }}, {{ source.edition }}
                </span>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <p v-if="sources.loaded && !sources.items.length" class="border-t p-3 text-xs text-muted-foreground">
        Vous n’avez encore aucune source.
      </p>
    </PopoverContent>
  </Popover>
</template>
