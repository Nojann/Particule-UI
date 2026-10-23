import { ref } from 'vue'
import { defineStore } from 'pinia'

import * as particulesApi from '@/api/particules'
import type { Particule, ParticuleFields } from '@/api/particules'
import { ApiError } from '@/api/client'
import { useAuthStore } from './auth'

const MAX_PERMALINK_ATTEMPTS = 20

function sortByTitle(list: Particule[]) {
  return list.sort((a, b) => a.title.localeCompare(b.title))
}

/** The particules of the knowledge base currently open */
export const useParticulesStore = defineStore('particules', () => {
  const auth = useAuthStore()

  const kbId = ref<string | null>(null)
  const items = ref<Particule[]>([])
  const loaded = ref(false)

  async function load(id: string) {
    kbId.value = id
    items.value = []
    loaded.value = false
    const list = await particulesApi.listParticules(auth.token!, id)
    // Ignore the answer if another knowledge base was opened meanwhile
    if (kbId.value !== id) return
    items.value = sortByTitle(list)
    loaded.value = true
  }

  function byPermalink(permalink: string) {
    return items.value.find((p) => p.permalink === permalink)
  }

  /**
   * Permalinks are unique across every knowledge base and user, so a taken one
   * is retried as `entropy-2`, `entropy-3`…
   */
  async function create(id: string, fields: ParticuleFields) {
    for (let attempt = 1; ; attempt++) {
      const permalink = attempt === 1 ? fields.permalink : `${fields.permalink}-${attempt}`
      try {
        const particule = await particulesApi.createParticule(auth.token!, id, {
          ...fields,
          permalink,
        })
        if (kbId.value === id) items.value = sortByTitle([...items.value, particule])
        return particule
      } catch (error) {
        const taken = error instanceof ApiError && error.status === 409
        if (!taken || attempt === MAX_PERMALINK_ATTEMPTS) throw error
      }
    }
  }

  async function update(particule: Particule, fields: Partial<ParticuleFields>) {
    const updated = await particulesApi.updateParticule(
      auth.token!,
      particule.knowledge_base_id,
      particule.id,
      fields,
    )
    items.value = sortByTitle(items.value.map((p) => (p.id === updated.id ? updated : p)))
    return updated
  }

  async function remove(particule: Particule) {
    await particulesApi.deleteParticule(auth.token!, particule.knowledge_base_id, particule.id)
    items.value = items.value.filter((p) => p.id !== particule.id)
  }

  return { kbId, items, loaded, load, byPermalink, create, update, remove }
})
