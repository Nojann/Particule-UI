import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Only reached through the lazy-loaded MarkdownEditor: without this, Vite discovers
    // them on first use, re-optimizes, and the import in flight fails (504) until a reload
    include: [
      '@codemirror/commands',
      '@codemirror/lang-markdown',
      '@codemirror/language',
      '@codemirror/state',
      '@codemirror/view',
      '@lezer/highlight',
      // Only reached through lib/citation.ts, imported dynamically, for the same reason
      '@citation-js/core',
      '@citation-js/plugin-csl',
    ],
  },
})
