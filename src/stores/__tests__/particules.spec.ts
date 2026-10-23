import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useParticulesStore } from '../particules'
import { useAuthStore } from '../auth'

function particule(id: string, title: string) {
  return {
    id,
    knowledge_base_id: 'kb1',
    title,
    permalink: title.toLowerCase(),
    content: '',
    origins: '',
    source_id: null,
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fields = { title: 'Entropy', permalink: 'entropy', content: '', origins: '', source_id: null }

describe('particules store', () => {
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

  it('loads every page of a knowledge base', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => particule(`p${i}`, `P${i}`))
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, firstPage))
      .mockResolvedValueOnce(jsonResponse(200, [particule('last', 'Last')]))
    const store = useParticulesStore()

    await store.load('kb1')

    expect(store.items).toHaveLength(101)
    expect(String(fetchMock.mock.calls[1]![0])).toContain('skip=100&limit=100')
  })

  it('ignores a list that arrives after switching knowledge base', async () => {
    let resolveFirst: (r: Response) => void = () => {}
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(jsonResponse(200, [particule('b', 'From kb2')]))
    const store = useParticulesStore()

    const first = store.load('kb1')
    await store.load('kb2')
    resolveFirst(jsonResponse(200, [particule('a', 'From kb1')]))
    await first

    expect(store.items.map((p) => p.title)).toEqual(['From kb2'])
  })

  it('retries a taken permalink with a suffix', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(409, { detail: 'Permalink already exists' }))
      .mockResolvedValueOnce(jsonResponse(201, { ...particule('p1', 'Entropy'), permalink: 'entropy-2' }))
    const store = useParticulesStore()
    await store.load('kb1')

    const created = await store.create('kb1', fields)

    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string).permalink).toBe('entropy')
    expect(JSON.parse(fetchMock.mock.calls[2]![1]!.body as string).permalink).toBe('entropy-2')
    expect(created.permalink).toBe('entropy-2')
    expect(store.items).toHaveLength(1)
  })

  it('does not retry other errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, []))
      .mockResolvedValueOnce(jsonResponse(422, { detail: 'Invalid' }))
    const store = useParticulesStore()
    await store.load('kb1')

    await expect(store.create('kb1', fields)).rejects.toThrow('Invalid')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends only the changed fields and keeps the list sorted', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, [particule('a', 'Alpha'), particule('b', 'Beta')]))
      .mockResolvedValueOnce(jsonResponse(200, particule('a', 'Zeta')))
    const store = useParticulesStore()
    await store.load('kb1')

    await store.update(store.items[0]!, { title: 'Zeta' })

    const [url, init] = fetchMock.mock.calls[1]!
    expect(String(url)).toMatch(/\/knowledge-bases\/kb1\/particules\/a$/)
    expect(init!.method).toBe('PATCH')
    expect(JSON.parse(init!.body as string)).toEqual({ title: 'Zeta' })
    expect(store.items.map((p) => p.title)).toEqual(['Beta', 'Zeta'])
  })
})
