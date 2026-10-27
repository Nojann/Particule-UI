<script setup lang="ts">
import { Pencil } from '@lucide/vue'

import SourceEditor from '@/components/SourceEditor.vue'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { Source } from '@/api/sources'

defineProps<{ source: Source }>()
</script>

<template>
  <!-- Closing unmounts the editor, which saves pending changes; Reka returns focus to the trigger -->
  <Sheet>
    <SheetTrigger as-child>
      <Button variant="ghost" size="icon" class="size-8" aria-label="Modifier la source">
        <Pencil />
      </Button>
    </SheetTrigger>
    <SheetContent side="right" class="w-full gap-0 p-0 sm:max-w-xl">
      <SheetHeader class="border-b pr-12">
        <SheetTitle>Modifier la source</SheetTitle>
        <SheetDescription>Les modifications sont enregistrées automatiquement.</SheetDescription>
      </SheetHeader>
      <SourceEditor class="min-h-0 flex-1" :source="source" embedded />
    </SheetContent>
  </Sheet>
</template>
