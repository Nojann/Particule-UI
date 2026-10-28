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

  it('adds the source as soon as its DOI is found, showing each step', async () => {
    const created = { ...crossrefArticle, id: 's1', owner_id: 'u1' }
    let respond!: (response: Response) => void
    fetchMock
      .mockResolvedValueOnce(Response.json(crossrefArticle))
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)))
    const { wrapper } = await mountQuickAdd()

    await pasteDoi(wrapper, `https://doi.org/${DOI}`)

    expect(String(fetchMock.mock.calls[0]![0])).toBe(`https://doi.org/${DOI}`)
    expect(wrapper.find('apa-reference-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('Référence trouvée')
    expect(wrapper.text()).toContain('Ajout de la source…')
    expect(button(wrapper, 'Ajouter')).toBeUndefined()

    const [url, init] = apiCalls(fetchMock)[0]!
    expect(String(url)).toMatch(/\/sources\/$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init!.body as string)).toMatchObject({
      type: 'journal_article',
      authors: 'Feynman, R. P.',
      doi: DOI,
    })

    respond(jsonResponse(201, created))
    await flushPromises()

    expect(apiCalls(fetchMock)).toHaveLength(1)
    expect(wrapper.emitted('created')?.[0]).toEqual([created])
    // The new source has this DOI now, but it must not read as « already exists »
    expect(wrapper.text()).toContain('Source ajoutée')
    expect(wrapper.text()).not.toContain('Cette source existe déjà.')
  })

  it('offers to retry an automatic add that failed', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json(crossrefArticle))
      .mockResolvedValueOnce(jsonResponse(500, { detail: 'Boom' }))
    const { wrapper } = await mountQuickAdd()
    await pasteDoi(wrapper, DOI)

    expect(wrapper.get('[role="alert"]').text()).toBe('L’ajout de la source a échoué.')
    expect(wrapper.emitted('created')).toBeUndefined()

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ...crossrefArticle, id: 's1' }))
    await button(wrapper, 'Réessayer')!.trigger('click')
    await flushPromises()

    expect(apiCalls(fetchMock)).toHaveLength(2)
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('never adds from a lookup the user has since replaced', async () => {
    let respond!: (response: Response) => void
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    const { wrapper } = await mountQuickAdd()

    await pasteDoi(wrapper, DOI)
    await pasteDoi(wrapper, '10.9999/inconnu')
    respond(Response.json(crossrefArticle))
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Ce DOI est introuvable.')
    expect(apiCalls(fetchMock)).toHaveLength(0)
  })

  it('waits for « Ajouter et citer » in the picker, since citing changes the particule', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    const { wrapper } = await mountQuickAdd({ cite: true })

    await pasteDoi(wrapper, DOI)
    expect(apiCalls(fetchMock)).toHaveLength(0)

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ...crossrefArticle, id: 's1' }))
    await button(wrapper, 'Ajouter et citer')!.trigger('click')
    await flushPromises()

    expect(apiCalls(fetchMock)[0]![1]?.method).toBe('POST')
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('says so when the DOI is already a source, and offers it instead', async () => {
    const known = { id: 's9', doi: DOI.toLowerCase(), type: 'journal_article' } as Source
    useSourcesStore().items = [known]
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    const { wrapper } = await mountQuickAdd({ cite: true })

    await pasteDoi(wrapper, DOI)

    expect(apiCalls(fetchMock)).toHaveLength(0)
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

  it('adds an import that lacks its authors, to be completed later', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ ...crossrefArticle, author: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { ...crossrefArticle, id: 's1', authors: null }))
    const { wrapper } = await mountQuickAdd()
    await pasteDoi(wrapper, DOI)

    const [, init] = apiCalls(fetchMock)[0]!
    expect(JSON.parse(init!.body as string)).toMatchObject({ doi: DOI, authors: null })
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('offers « Ajouter et citer » for an incomplete import in the picker', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...crossrefArticle, author: [] }))
    const { wrapper } = await mountQuickAdd({ cite: true })
    await pasteDoi(wrapper, DOI)

    expect(apiCalls(fetchMock)).toHaveLength(0)
    expect(button(wrapper, 'Ajouter et citer')).toBeDefined()
  })

  it('hands an import without a title to the full form', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...crossrefArticle, title: [] }))
    const { wrapper, router } = await mountQuickAdd()
    await pasteDoi(wrapper, DOI)

    expect(apiCalls(fetchMock)).toHaveLength(0)
    expect(wrapper.text()).toContain('Cette référence n’a pas de titre')
    await button(wrapper, 'Compléter la référence')!.trigger('click')
    await flushPromises()

    expect(useSourcesStore().draft).toMatchObject({ doi: DOI, title: '' })
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
    fetchMock
      .mockResolvedValueOnce(Response.json(crossrefArticle))
      .mockResolvedValueOnce(jsonResponse(201, { ...crossrefArticle, id: 's1' }))
    const { wrapper } = await mountQuickAdd()
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')

    await wrapper.get('input[type="url"]').setValue(`https://doi.org/${DOI}`)
    await button(wrapper, `Importer le DOI ${DOI}`)!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Académique')
    expect(wrapper.find('apa-reference-stub').exists()).toBe(true)
  })
})
