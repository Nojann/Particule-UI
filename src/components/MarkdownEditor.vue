<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { drawSelection, EditorView, keymap, placeholder as placeholderText } from '@codemirror/view'

import { markdownLivePreview } from '@/lib/markdownLivePreview'

const props = defineProps<{ placeholder?: string }>()
const model = defineModel<string>({ required: true })

const host = useTemplateRef<HTMLDivElement>('host')
let view: EditorView | null = null

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        history(),
        drawSelection(),
        // markdownKeymap continues lists and quotes on Enter
        keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
        // GFM flavour (strikethrough, tables…). Not markdown(): it bundles the HTML, CSS
        // and JS languages for embedded HTML, most of the editor's weight
        markdownLanguage,
        markdownLivePreview,
        EditorView.lineWrapping,
        placeholderText(props.placeholder ?? ''),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) model.value = update.state.doc.toString()
        }),
      ],
    }),
  })
})

// Only external changes reach the editor: typing already updated the model
watch(model, (value) => {
  if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  }
})

onBeforeUnmount(() => view?.destroy())

function focusEnd() {
  if (!view) return
  view.focus()
  view.dispatch({ selection: { anchor: view.state.doc.length } })
}

defineExpose({ focus: focusEnd })
</script>

<template>
  <!-- A click on the empty space under the text puts the cursor at the end -->
  <div ref="host" class="min-h-40 cursor-text" @click.self="focusEnd" />
</template>
