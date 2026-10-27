import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import SourceEditor from '../SourceEditor.vue'
import type { Source } from '@/api/sources'
import { useAuthStore } from '@/stores/auth'

const article: Source = {
  id: 's1',
  owner_id: '6f1c',
  type: 'journal_article',
  title: 'Space-time approach',
  authors: 'Feynman, Richard P.',
  editors: null,
  container_title: 'Reviews of Modern Physics',
  volume: '20',
  issue: '2',
  pages: '367-387',
  doi: null,
  url: null,
  published_date: null,
  accessed_date: null,
  year: 1948,
  edition: null,
  publisher: null,
  note: null,
}

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const otherSource: Source = {
  ...article,
  id: 's2',
  type: 'other',
  title: 'Conférence sur la mesure',
  authors: null,
  container_title: null,
  volume: null,
  issue: null,
  pages: null,
  year: null,
  url: 'https://www.youtube.com/watch?v=1',
  note: 'À revoir',
}

/** The details of an academic source fold behind « Corriger les informations » */
async function openDetails(wrapper: ReturnType<typeof mountEditor>) {
  const trigger = wrapper.findAll('button').find((b) => b.text() === 'Corriger les informations')!
  if (trigger.attributes('aria-expanded') !== 'true') await trigger.trigger('click')
  await flushPromises()
}

function mountEditor(source: Source | null, initial: Source | null = null) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/sources/:sourceId?', name: 'sources', component: { template: '<div />' } },
    ],
  })
  return mount(SourceEditor, {
    props: { source, initial },
    attachTo: document.body,
    global: {
      plugins: [router],
      // The reference has its own tests, with citation-js
      stubs: { ApaReference: true },
    },
  })
}

async function waitForSave() {
  await vi.advanceTimersByTimeAsync(1000)
  // vee-validate debounces validation with its own short timer, started after the save's
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(20)
    await flushPromises()
  }
}

describe('SourceEditor', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    setActivePinia(createPinia())
    useAuthStore().token = 'tok'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('sends nothing while the new source is invalid', async () => {
    const wrapper = mountEditor(null)

    await wrapper.get('[aria-required="true"]').setValue('The Feynman lectures on physics')
    await waitForSave()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Champs requis manquants')
  })

  it('creates the source once it is valid, then patches only what changed', async () => {
    const created = {
      ...article,
      id: 's2',
      type: 'book' as const,
      title: 'Lectures',
      authors: 'Feynman, Richard',
      container_title: null,
      volume: null,
      issue: null,
      pages: null,
      year: null,
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, created))
      .mockResolvedValueOnce(jsonResponse(200, { ...created, publisher: 'Addison-Wesley' }))
    const wrapper = mountEditor(null)

    await wrapper.get('[aria-required="true"]').setValue('Lectures')
    await wrapper.get('input[placeholder="Nom"]').setValue('Feynman')
    await wrapper.get('input[placeholder="Prénoms"]').setValue('Richard')
    await waitForSave()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, post] = fetchMock.mock.calls[0]!
    expect(post?.method).toBe('POST')
    expect(JSON.parse(post!.body as string)).toMatchObject({
      type: 'book',
      title: 'Lectures',
      authors: 'Feynman, Richard',
      year: null,
    })
    expect(wrapper.emitted('created')?.[0]).toEqual([created])

    await wrapper.get('input[placeholder="Ex. Addison-Wesley"]').setValue('Addison-Wesley')
    await waitForSave()

    const [url, patch] = fetchMock.mock.calls[1]!
    expect(String(url)).toMatch(/\/sources\/s2$/)
    expect(patch?.method).toBe('PATCH')
    expect(JSON.parse(patch!.body as string)).toEqual({ publisher: 'Addison-Wesley' })
  })

  // Regression: vee-validate dropped the values of fields hidden by a type change, so the
  // schema refused the form and nothing was saved any more
  it('still saves after the type hides fields that were filled in', async () => {
    const book: Source = {
      ...article,
      type: 'book',
      title: 'Space-time approach',
      container_title: null,
      volume: null,
      issue: null,
      pages: null,
      publisher: 'Addison-Wesley',
    }
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...book, type: 'journal_article' }))
    const wrapper = mountEditor(book)
    await openDetails(wrapper)

    // Choose the type from the keyboard, as a user can
    await wrapper.get('[role="combobox"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find((o) =>
      o.textContent?.includes('Article de revue'),
    )!
    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    await wrapper.get('input[placeholder="Ex. 20"]').setValue('20')
    await waitForSave()
    expect(wrapper.text()).toContain('Champs requis manquants')

    const journalLabel = wrapper.findAll('label').find((l) => l.text() === 'Revue')!
    await wrapper.get(`#${journalLabel.attributes('for')}`).setValue('Physics Today')
    await waitForSave()

    expect(wrapper.text()).not.toContain('Champs requis manquants')
    const [, patch] = fetchMock.mock.calls[0]!
    expect(JSON.parse(patch!.body as string)).toEqual({
      type: 'journal_article',
      container_title: 'Physics Today',
      volume: '20',
      publisher: null,
    })
  })

  it('shows the fields of the source type', async () => {
    const wrapper = mountEditor(article)
    await openDetails(wrapper)
    const labels = wrapper.findAll('label').map((label) => label.text())

    expect(labels).toEqual(
      expect.arrayContaining(['Revue', 'Volume', 'Numéro', 'Pages', 'DOI', 'URL']),
    )
    expect(labels).not.toContain('Éditeur')
    expect(labels).not.toContain('Date de consultation')
  })

  it('folds the details of a valid saved source, and unfolds them for a new one', async () => {
    const saved = mountEditor(article)
    const trigger = (w: typeof saved) =>
      w.findAll('button').find((b) => b.text() === 'Corriger les informations')!
    expect(trigger(saved).attributes('aria-expanded')).toBe('false')
    expect(saved.findAll('label').map((l) => l.text())).not.toContain('Titre')
    saved.unmount()

    const fresh = mountEditor(null)
    await flushPromises()
    expect(trigger(fresh).attributes('aria-expanded')).toBe('true')
    expect(fresh.findAll('label').map((l) => l.text())).toContain('Titre')
  })

  it('unfolds the details of an imported source that lacks a required field', async () => {
    const wrapper = mountEditor(null, { ...article, authors: null })
    await flushPromises()
    const titleInput = wrapper.get<HTMLInputElement>('input[aria-required="true"]')
    expect(titleInput.element.value).toBe('Space-time approach')
  })

  it('shows only title, link and note for an other source, and saves it without authors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...otherSource, title: 'Conférence' }))
    const wrapper = mountEditor(otherSource)
    const labels = wrapper.findAll('label').map((label) => label.text())

    expect(labels).toEqual(['Titre', 'Lien', 'Note'])
    expect(wrapper.text()).not.toContain('Corriger les informations')

    await wrapper.get('input[aria-required="true"]').setValue('Conférence')
    await waitForSave()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/sources\/s2$/)
    expect(JSON.parse(init!.body as string)).toEqual({ title: 'Conférence' })
  })
})
