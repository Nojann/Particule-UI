import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import SourceQuickAdd from '../SourceQuickAdd.vue'
import type { Source } from '@/api/sources'
import { crossrefArticle } from '@/lib/__tests__/fixtures/csl'
import { useAuthStore } from '@/stores/auth'
import { useSourcesStore } from '@/stores/sources'

const DOI = '10.1103/RevModPhys.20.367'

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function apiCalls(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchMock.mock.calls.filter(([url]) => !String(url).startsWith('https://doi.org/'))
}

async function mountQuickAdd(props: { cite?: boolean } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/sources/:sourceId?', name: 'sources', component: { template: '<div />' } },
    ],
  })
  await router.push('/app/sources?new')
  const wrapper = mount(SourceQuickAdd, {
    props,
    attachTo: document.body,
    global: { plugins: [router], stubs: { ApaReference: true } },
  })
  return { wrapper, router }
}

async function pasteDoi(wrapper: Awaited<ReturnType<typeof mountQuickAdd>>['wrapper'], text: string) {
  const input = wrapper.get('#quick-add-doi')
  await input.setValue(text)
  await input.trigger('paste')
  await flushPromises()
}

const button = (wrapper: Awaited<ReturnType<typeof mountQuickAdd>>['wrapper'], text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

describe('SourceQuickAdd', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'tok'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('looks up a pasted DOI, and creates the source only on « Ajouter »', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    const { wrapper } = await mountQuickAdd()

    await pasteDoi(wrapper, `https://doi.org/${DOI}`)

    expect(String(fetchMock.mock.calls[0]![0])).toBe(`https://doi.org/${DOI}`)
    expect(wrapper.find('apa-reference-stub').exists()).toBe(true)
    expect(apiCalls(fetchMock)).toHaveLength(0)

    const created = { ...crossrefArticle, id: 's1', owner_id: 'u1' }
    fetchMock.mockResolvedValueOnce(jsonResponse(201, created))
    await button(wrapper, 'Ajouter')!.trigger('click')
    await flushPromises()

    const [url, init] = apiCalls(fetchMock)[0]!
    expect(String(url)).toMatch(/\/sources\/$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init!.body as string)).toMatchObject({
      type: 'journal_article',
      authors: 'Feynman, R. P.',
      doi: DOI,
    })
    expect(wrapper.emitted('created')?.[0]).toEqual([created])
  })

  it('says so when the DOI is already a source, and offers it instead', async () => {
    const known = { id: 's9', doi: DOI.toLowerCase(), type: 'journal_article' } as Source
    useSourcesStore().items = [known]
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    const { wrapper } = await mountQuickAdd({ cite: true })

    await pasteDoi(wrapper, DOI)

    expect(wrapper.text()).toContain('Cette source existe déjà.')
    expect(button(wrapper, 'Ajouter et citer')).toBeUndefined()
    await button(wrapper, 'Citer cette source')!.trigger('click')
    expect(wrapper.emitted('existing')?.[0]).toEqual([known])
  })

  it('refuses text that holds no DOI, without a request', async () => {
    const { wrapper } = await mountQuickAdd()
    await pasteDoi(wrapper, 'Feynman 1948')

    expect(wrapper.get('[role="alert"]').text()).toBe('Ce n’est pas un DOI valide.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [() => fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 })), 'Ce DOI est introuvable.'],
    [
      () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')),
      'Impossible de joindre doi.org, réessayez plus tard.',
    ],
  ])('shows why a lookup failed', async (respond, message) => {
    respond()
    const { wrapper } = await mountQuickAdd()
    await pasteDoi(wrapper, DOI)

    expect(wrapper.get('[role="alert"]').text()).toBe(message)
    expect(button(wrapper, 'Saisir la référence à la main')).toBeDefined()
  })

  it('hands an incomplete import to the full form', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...crossrefArticle, author: [] }))
    const { wrapper, router } = await mountQuickAdd()
    await pasteDoi(wrapper, DOI)

    expect(button(wrapper, 'Ajouter')).toBeUndefined()
    await button(wrapper, 'Compléter la référence')!.trigger('click')
    await flushPromises()

    expect(useSourcesStore().draft).toMatchObject({ doi: DOI, authors: null })
    expect(router.currentRoute.value.query).toEqual({ new: null, manual: null })
  })

  it('creates an other source with a title, a link and a note', async () => {
    const { wrapper } = await mountQuickAdd()
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')

    await wrapper.get('form').trigger('submit')
    // vee-validate shows its messages after a short timer of its own
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()
    expect(wrapper.text()).toContain('Le titre est requis.')
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 's2', type: 'other' }))
    await wrapper.get('input[aria-required="true"]').setValue('Conférence')
    await wrapper.get('input[type="url"]').setValue('https://www.youtube.com/watch?v=1')
    await wrapper.get('textarea').setValue('À revoir')
    await wrapper.get('form').trigger('submit')
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()

    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toMatchObject({
      type: 'other',
      title: 'Conférence',
      authors: null,
      url: 'https://www.youtube.com/watch?v=1',
      note: 'À revoir',
    })
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('offers to import a DOI typed as an other source', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    const { wrapper } = await mountQuickAdd()
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')

    await wrapper.get('input[type="url"]').setValue(`https://doi.org/${DOI}`)
    await button(wrapper, `Importer le DOI ${DOI}`)!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Académique')
    expect(wrapper.find('apa-reference-stub').exists()).toBe(true)
  })
})
