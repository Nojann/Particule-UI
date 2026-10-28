import { describe, it, expect } from 'vitest'

import type { SourceFields } from '@/api/sources'
import {
  changedFields,
  emptySourceForm,
  formFromSource,
  missingForApa,
  payloadFromForm,
  sourceFormSchema,
  toCsl,
  type SourceFormValues,
} from '../sourceForm'
import { normalizeDoi } from '../doi'

const article: SourceFields = {
  type: 'journal_article',
  title: 'Space-time approach to non-relativistic quantum mechanics',
  authors: 'Feynman, Richard P.',
  editors: null,
  container_title: 'Reviews of Modern Physics',
  volume: '20',
  issue: '2',
  pages: '367-387',
  doi: '10.1103/RevModPhys.20.367',
  url: null,
  published_date: '1948-04-01',
  accessed_date: null,
  year: 1948,
  edition: null,
  publisher: null,
  note: null,
}

function form(values: Partial<SourceFormValues>): SourceFormValues {
  return {
    ...emptySourceForm(),
    title: 'Titre',
    authors: [{ kind: 'person', family: 'Feynman', given: 'Richard' }],
    ...values,
  }
}

function errorPaths(values: SourceFormValues) {
  const result = sourceFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('sourceFormSchema', () => {
  it('requires only a title, as the API does', () => {
    expect(errorPaths(form({ title: ' ', authors: [] }))).toEqual(['title'])
    for (const type of ['book', 'journal_article', 'book_chapter', 'web_page'] as const) {
      expect(errorPaths(form({ type, authors: [] }))).toEqual([])
    }
  })

  it('starts a new source without an author row, so a title alone saves', () => {
    expect(emptySourceForm().authors).toEqual([])
    expect(errorPaths({ ...emptySourceForm(), title: 'Lectures' })).toEqual([])
  })

  it('checks years, dates and URLs', () => {
    expect(errorPaths(form({ year: '19a4' }))).toEqual(['year'])
    expect(errorPaths(form({ published_date: '1948-4' }))).toEqual(['published_date'])
    expect(errorPaths(form({ url: 'pas une adresse' }))).toEqual(['url'])
  })

  it('checks every contributor', () => {
    const authors = [{ kind: 'person' as const, family: 'A;B', given: '' }]
    expect(errorPaths(form({ authors }))).toEqual(['authors.0.family'])
  })
})

describe('payloadFromForm / formFromSource', () => {
  it('reads back a stored source', () => {
    expect(payloadFromForm(formFromSource(article))).toEqual(article)
  })

  it('sends empty fields as null and the year as a number', () => {
    const payload = payloadFromForm(form({ year: '1964', publisher: '  ' }))
    expect(payload.year).toBe(1964)
    expect(payload.publisher).toBeNull()
    expect(payload.published_date).toBeNull()
  })

  it('derives the year from the publication date', () => {
    expect(payloadFromForm(form({ year: '1900', published_date: '1948-04-01' })).year).toBe(1948)
  })

  it('leaves out the fields the type does not use', () => {
    const payload = payloadFromForm(
      form({
        type: 'book',
        container_title: 'Revue',
        editors: [{ kind: 'person', family: 'Martin', given: 'Claire' }],
      }),
    )
    expect(payload.container_title).toBeNull()
    expect(payload.editors).toBeNull()
  })

  it('serialises contributors', () => {
    const payload = payloadFromForm(
      form({
        type: 'book_chapter',
        container_title: 'Ouvrage',
        editors: [{ kind: 'person', family: 'Martin', given: 'Claire' }],
      }),
    )
    expect(payload.authors).toBe('Feynman, Richard')
    expect(payload.editors).toBe('Martin, Claire')
  })
})

describe('changedFields', () => {
  it('only holds what changed', () => {
    expect(
      changedFields(article, { ...article, volume: '21', url: 'https://example.org' }),
    ).toEqual({
      volume: '21',
      url: 'https://example.org',
    })
    expect(changedFields(article, { ...article })).toEqual({})
  })
})

describe('toCsl', () => {
  it('maps a journal article', () => {
    expect(toCsl({ ...article, id: 's1' })).toEqual({
      id: 's1',
      type: 'article-journal',
      title: article.title,
      author: [{ family: 'Feynman', given: 'Richard P.' }],
      'container-title': 'Reviews of Modern Physics',
      volume: '20',
      issue: '2',
      page: '367-387',
      DOI: '10.1103/RevModPhys.20.367',
      issued: { 'date-parts': [[1948, 4, 1]] },
    })
  })

  it('maps a chapter, a web page and an undated book', () => {
    const chapter = toCsl({
      ...article,
      type: 'book_chapter',
      editors: 'Martin, Claire; CNRS',
      published_date: null,
      year: 2010,
    })
    expect(chapter.type).toBe('chapter')
    expect(chapter.editor).toEqual([{ family: 'Martin', given: 'Claire' }, { literal: 'CNRS' }])
    expect(chapter.issued).toEqual({ 'date-parts': [[2010]] })

    const page = toCsl({ ...article, type: 'web_page', accessed_date: '2025-05-05' })
    expect(page.type).toBe('webpage')
    expect(page.accessed).toEqual({ 'date-parts': [[2025, 5, 5]] })

    const book = toCsl({ ...article, type: 'book', published_date: null, year: null })
    expect(book.issued).toBeUndefined()
  })
})

describe('normalizeDoi', () => {
  it('accepts the usual forms of a DOI', () => {
    for (const doi of [
      '10.1/x',
      'doi:10.1/x',
      'DOI: 10.1/x',
      'https://doi.org/10.1/x',
      'http://dx.doi.org/10.1/x',
    ]) {
      expect(normalizeDoi(doi)).toBe('10.1/x')
    }
  })
})

describe('missingForApa', () => {
  it('lists what the reference of each type lacks, in form order', () => {
    expect(missingForApa(form({ type: 'book' }))).toEqual([])
    expect(missingForApa(form({ type: 'book', authors: [] }))).toEqual(['authors'])
    expect(missingForApa(form({ type: 'journal_article', authors: [] }))).toEqual([
      'authors',
      'container_title',
    ])
    expect(missingForApa(form({ type: 'book_chapter', container_title: ' ' }))).toEqual([
      'container_title',
    ])
    expect(missingForApa(form({ type: 'web_page', container_title: 'Wikipédia' }))).toEqual([
      'url',
    ])
  })

  it('asks nothing of an other source', () => {
    expect(missingForApa({ ...emptySourceForm('other'), title: 'Conférence' })).toEqual([])
  })
})

describe('other sources', () => {
  const other = (values: Partial<SourceFormValues>) => ({
    ...emptySourceForm('other'),
    title: 'Conférence',
    ...values,
  })

  it('start without authors, and are valid with a title only', () => {
    expect(emptySourceForm('other').authors).toEqual([])
    expect(errorPaths(other({}))).toEqual([])
    expect(errorPaths(other({ title: '' }))).toEqual(['title'])
  })

  it('are sent without authors, dates or bibliographic fields', () => {
    const payload = payloadFromForm(
      other({
        url: ' https://www.youtube.com/watch?v=1 ',
        note: '  À revoir ',
        year: '1964',
        publisher: 'Ignoré',
        authors: [{ kind: 'person', family: 'Feynman', given: '' }],
      }),
    )
    expect(payload).toMatchObject({
      type: 'other',
      authors: null,
      url: 'https://www.youtube.com/watch?v=1',
      note: 'À revoir',
      year: null,
      published_date: null,
      publisher: null,
    })
  })
})

describe('note', () => {
  it('is kept for every type, and sent in the diff when it changes', () => {
    const payload = payloadFromForm({ ...formFromSource(article), note: 'Lu en 2026' })
    expect(payload.note).toBe('Lu en 2026')
    expect(changedFields(article, payload)).toEqual({ note: 'Lu en 2026' })
  })
})
