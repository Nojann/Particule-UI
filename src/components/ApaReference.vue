<script setup lang="ts">
import { ref } from 'vue'
import { useClipboard, useTimeoutFn, watchDebounced } from '@vueuse/core'
import { Check, Copy } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { SourceFields } from '@/api/sources'
import {
  formatInTextCitation,
  formatReference,
  segmentsToHtml,
  segmentsToText,
  type Segment,
} from '@/lib/citation'
import { toCsl } from '@/lib/sourceForm'

const props = defineProps<{ source: SourceFields }>()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const segments = ref<Segment[]>([])
const citation = ref('')

// Formatting is cheap once citeproc is loaded, but not free: wait for a pause in typing
watchDebounced(
  () => props.source,
  async (source) => {
    try {
      const item = toCsl(source)
      ;[segments.value, citation.value] = await Promise.all([
        formatReference(item),
        formatInTextCitation(item),
      ])
      state.value = 'ready'
    } catch {
      state.value = 'error'
    }
  },
  { debounce: 200, deep: true, immediate: true },
)

const { copy: copyText } = useClipboard({ legacy: true })
const copied = ref(false)
const { start: hideCopied } = useTimeoutFn(() => (copied.value = false), 2000, { immediate: false })

async function copyReference() {
  const text = segmentsToText(segments.value)
  try {
    // Rich copy keeps the italics when pasted into a word processor
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([segmentsToHtml(segments.value)], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } catch {
    await copyText(text)
  }
  copied.value = true
  hideCopied()
}
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4"
    aria-labelledby="apa-heading"
  >
    <div class="flex items-center gap-2">
      <h2 id="apa-heading" class="text-sm font-medium">Référence APA</h2>
      <Button
        variant="outline"
        size="sm"
        class="ml-auto"
        :disabled="state !== 'ready'"
        @click="copyReference"
      >
        <Check v-if="copied" />
        <Copy v-else />
        Copier la référence
      </Button>
    </div>

    <div v-if="state === 'loading'" class="flex flex-col gap-2">
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-2/3" />
    </div>
    <p v-else-if="state === 'error'" class="text-sm text-destructive">
      Impossible de générer la référence.
    </p>
    <template v-else>
      <!-- APA hanging indent -->
      <p class="pl-8 -indent-8 text-sm leading-relaxed break-words" data-testid="apa-reference">
        <template v-for="(segment, index) in segments" :key="index">
          <em v-if="segment.italic && segment.superscript"
            ><sup>{{ segment.text }}</sup></em
          >
          <em v-else-if="segment.italic">{{ segment.text }}</em>
          <sup v-else-if="segment.superscript">{{ segment.text }}</sup>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>
      <p class="text-xs text-muted-foreground">
        Citation dans le texte : <span class="text-foreground">{{ citation }}</span>
      </p>
    </template>

    <p class="sr-only" aria-live="polite">{{ copied ? 'Référence copiée' : '' }}</p>
  </section>
</template>
