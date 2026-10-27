import { ref } from 'vue'
import { defineStore } from 'pinia'

import * as doiApi from '@/api/doi'
import * as sourcesApi from '@/api/sources'
import type { Source, SourceFields } from '@/api/sources'
import { inTextLabel } from '@/lib/contributors'
import { sameDoi } from '@/lib/doi'
import { isAcademic } from '@/lib/sourceForm'
import { useAuthStore } from './auth'
import { useParticulesStore } from './particules'

/** Short label for lists, e.g. `Feynman & Leighton, 1964`; an other source shows its title */
export function sourceLabel(source: Source) {
  return isAcademic(source.type) ? inTextLabel(source) : source.title
}

/** Second line under the label: the title, or the link's host for an other source */
export function sourceDetail(source: Source) {
  if (isAcademic(source.type)) return source.title
  return source.url && URL.canParse(source.url) ? new URL(source.url).host.replace(/^www\./, '') : ''
}

// Same order as the server: by title, then year, undated sources last
function sortSources(list: Source[]) {
  return list.sort(
    (a, b) => a.title.localeCompare(b.title) || (a.year ?? Infinity) - (b.year ?? Infinity),
  )
}

export const useSourcesStore = defineStore('sources', () => {
  const auth = useAuthStore()

  const items = ref<Source[]>([])
  const loaded = ref(false)

  async function fetchAll() {
    if (!auth.token) return
    items.value = sortSources(await sourcesApi.listSources(auth.token))
    loaded.value = true
  }

  function byId(id: string | null | undefined) {
    return id ? items.value.find((s) => s.id === id) : undefined
  }

  function findByDoi(doi: string) {
    return items.value.find((s) => s.doi && sameDoi(s.doi, doi))
  }

  /** Fields read from a DOI's metadata, ready to create; nothing is saved */
  function lookupDoi(doi: string) {
    return doiApi.lookupDoi(doi)
  }

  /**
   * An imported source that needs completing before it can be saved: the quick add hands
   * it to the full form on the sources page
   */
  const draft = ref<SourceFields | null>(null)

  async function create(fields: SourceFields) {
    const source = await sourcesApi.createSource(auth.token!, fields)
    items.value = sortSources([...items.value, source])
    return source
  }

  async function update(sourceId: string, fields: Partial<SourceFields>) {
    const source = await sourcesApi.updateSource(auth.token!, sourceId, fields)
    items.value = sortSources(items.value.map((s) => (s.id === sourceId ? source : s)))
    return source
  }

  async function remove(sourceId: string) {
    await sourcesApi.deleteSource(auth.token!, sourceId)
    items.value = items.value.filter((s) => s.id !== sourceId)
    // The server keeps the particules that cited it, without a source
    const particules = useParticulesStore()
    particules.items = particules.items.map((p) =>
      p.source_id === sourceId ? { ...p, source_id: null } : p,
    )
  }

  return { items, loaded, draft, fetchAll, byId, findByDoi, lookupDoi, create, update, remove }
})
