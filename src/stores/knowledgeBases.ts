import { ref } from 'vue'
import { defineStore } from 'pinia'

import * as kbApi from '@/api/knowledgeBases'
import type { KnowledgeBase } from '@/api/knowledgeBases'
import { useAuthStore } from './auth'

export const useKnowledgeBasesStore = defineStore('knowledgeBases', () => {
  const auth = useAuthStore()

  const items = ref<KnowledgeBase[]>([])
  const loaded = ref(false)

  async function fetchAll() {
    if (!auth.token) return
    items.value = await kbApi.listKnowledgeBases(auth.token)
    loaded.value = true
  }

  function sortByName(list: KnowledgeBase[]) {
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function create(name: string) {
    const kb = await kbApi.createKnowledgeBase(auth.token!, name)
    items.value = sortByName([...items.value, kb])
    return kb
  }

  async function rename(kbId: string, name: string) {
    const kb = await kbApi.renameKnowledgeBase(auth.token!, kbId, name)
    items.value = sortByName(items.value.map((item) => (item.id === kbId ? kb : item)))
    return kb
  }

  async function remove(kbId: string) {
    await kbApi.deleteKnowledgeBase(auth.token!, kbId)
    items.value = items.value.filter((kb) => kb.id !== kbId)
  }

  function byId(kbId: string) {
    return items.value.find((kb) => kb.id === kbId)
  }

  return { items, loaded, fetchAll, create, rename, remove, byId }
})
