import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useKnowledgeBasesStore } from '../knowledgeBases'
import { useAuthStore } from '../auth'

const physics = { id: 'kb1', name: 'Physics', owner_id: '6f1c', created_at: '2026-10-21T08:30:00' }
const biology = { id: 'kb2', name: 'Biology', owner_id: '6f1c', created_at: '2026-10-22T08:30:00' }

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('knowledgeBases store', () => {
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

  it('loads the knowledge bases with the token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [physics]))
    const store = useKnowledgeBasesStore()

    await store.fetchAll()

    expect(store.items).toEqual([physics])
    expect(store.loaded).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/knowledge-bases\/$/)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('keeps the list sorted by name after a creation', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [physics]))
      .mockResolvedValueOnce(jsonResponse(201, biology))
    const store = useKnowledgeBasesStore()
    await store.fetchAll()

    await store.create('Biology')

    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual({ name: 'Biology' })
    expect(store.items.map((kb) => kb.name)).toEqual(['Biology', 'Physics'])
  })

  it('renames a knowledge base and keeps the list sorted', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [biology, physics]))
      .mockResolvedValueOnce(jsonResponse(200, { ...physics, name: 'Astronomy' }))
    const store = useKnowledgeBasesStore()
    await store.fetchAll()

    await store.rename('kb1', 'Astronomy')

    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toMatch(/\/knowledge-bases\/kb1$/)
    expect(init!.method).toBe('PATCH')
    expect(JSON.parse(init!.body as string)).toEqual({ name: 'Astronomy' })
    expect(store.items.map((kb) => kb.name)).toEqual(['Astronomy', 'Biology'])
  })

  it('removes a deleted knowledge base from the list', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [biology, physics]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const store = useKnowledgeBasesStore()
    await store.fetchAll()

    await store.remove('kb1')

    expect(fetchMock.mock.calls[1]![1]!.method).toBe('DELETE')
    expect(store.items).toEqual([biology])
  })
})
