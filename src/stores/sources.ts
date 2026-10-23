import { ref } from 'vue'
import { defineStore } from 'pinia'

import * as particulesApi from '@/api/particules'
import type { Source } from '@/api/particules'
import { useAuthStore } from './auth'

export function sourceLabel(source: Source) {
  return `${source.authors}, ${source.year}`
}

export const useSourcesStore = defineStore('sources', () => {
  const auth = useAuthStore()

  const items = ref<Source[]>([])
  const loaded = ref(false)

  async function fetchAll() {
    if (!auth.token) return
    items.value = await particulesApi.listSources(auth.token)
    loaded.value = true
  }

  function byId(id: string | null) {
    return id === null ? undefined : items.value.find((s) => s.id === id)
  }

  return { items, loaded, fetchAll, byId }
})
