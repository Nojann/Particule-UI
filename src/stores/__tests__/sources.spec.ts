import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useSourcesStore } from '../sources'
import { useAuthStore } from '../auth'
import { useParticulesStore } from '../particules'
import type { Source } from '@/api/sources'

function source(id: string, title: string, year: number | null): Source {
  return {
    id,
    owner_id: '6f1c',
    type: 'book',
    title,
    authors: 'Feynman, Richard',
    editors: null,
    container_title: null,
    volume: null,
    issue: null,
    pages: null,
    doi: null,
    url: null,
    published_date: null,
    accessed_date: null,
    year,
    edition: null,
    publisher: null,
    note: null,
  }
}

const lectures = source('s1', 'Lectures', 1964)
const qed = source('s2', 'QED', 1985)

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('sources store', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useAuthStore().token = 'tok'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the sources with the token, sorted by title then year, undated last', async () => {
    const undated = source('s3', 'Lectures', null)
    const older = source('s4', 'Lectures', 1963)
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [qed, undated, lectures, older]))
    const store = useSourcesStore()

    await store.fetchAll()

    expect(store.items.map((s) => s.id)).toEqual(['s4', 's1', 's3', 's2'])
    expect(store.loaded).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/sources\/\?skip=0&limit=100$/)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('creates a source and keeps the list sorted', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [qed]))
      .mockResolvedValueOnce(jsonResponse(201, lectures))
    const store = useSourcesStore()
    await store.fetchAll()

    const { id, owner_id, ...fields } = lectures
    void id
    void owner_id
    await store.create(fields)

    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toMatch(/\/sources\/$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init!.body as string)).toEqual(fields)
    expect(store.items.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('patches a source and replaces it in the list', async () => {
    const renamed = { ...qed, title: 'Albert' }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [lectures, qed]))
      .mockResolvedValueOnce(jsonResponse(200, renamed))
    const store = useSourcesStore()
    await store.fetchAll()

    await store.update('s2', { title: 'Albert' })

    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toMatch(/\/sources\/s2$/)
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init!.body as string)).toEqual({ title: 'Albert' })
    expect(store.items.map((s) => s.title)).toEqual(['Albert', 'Lectures'])
  })

  it('deletes a source and unlinks the loaded particules citing it', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [lectures, qed]))
      .mockResolvedValueOnce(jsonResponse(204))
    const store = useSourcesStore()
    await store.fetchAll()
    const particules = useParticulesStore()
    const base = { knowledge_base_id: 'kb1', content: '', origins: '' }
    particules.items = [
      { ...base, id: 'p1', title: 'A', permalink: 'a', source_id: 's1' },
      { ...base, id: 'p2', title: 'B', permalink: 'b', source_id: 's2' },
    ]

    await store.remove('s1')

    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toMatch(/\/sources\/s1$/)
    expect(init?.method).toBe('DELETE')
    expect(store.items.map((s) => s.id)).toEqual(['s2'])
    expect(particules.items.map((p) => p.source_id)).toEqual([null, 's2'])
  })

  it('finds a source by its DOI, whatever its spelling', async () => {
    const withDoi = { ...qed, doi: '10.5281/ZENODO.1' }
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [lectures, withDoi]))
    const store = useSourcesStore()
    await store.fetchAll()

    expect(store.findByDoi('https://doi.org/10.5281/zenodo.1')?.id).toBe('s2')
    expect(store.findByDoi('10.5281/zenodo.2')).toBeUndefined()
  })

  it('creates an other source without authors', async () => {
    const other = { ...source('s5', 'Conférence', null), type: 'other' as const, authors: null }
    fetchMock.mockResolvedValueOnce(jsonResponse(201, other))
    const store = useSourcesStore()
    const { id: _, owner_id: __, ...fields } = other

    await store.create(fields)

    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(init!.body as string)).toMatchObject({ type: 'other', authors: null })
    expect(store.items.map((s) => s.id)).toEqual(['s5'])
  })
})
