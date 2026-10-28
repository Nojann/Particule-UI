import { describe, it, expect } from 'vitest'

import { sourceFromCsl } from '../cslImport'
import { formFromSource, sourceFormSchema } from '../sourceForm'
import {
  conferencePaper,
  crossrefArticle,
  crossrefChapter,
  dataciteArticle,
  dataciteDataset,
} from './fixtures/csl'

const isValid = (fields: ReturnType<typeof sourceFromCsl>) =>
  sourceFormSchema.safeParse(formFromSource(fields)).success

describe('sourceFromCsl', () => {
  it('imports a Crossref journal article', () => {
    expect(sourceFromCsl(crossrefArticle)).toEqual({
      type: 'journal_article',
      // Case kept as registered: the user decides on APA's sentence case
      title: 'Space-Time Approach to Non-Relativistic Quantum Mechanics',
      authors: 'Feynman, R. P.',
      editors: null,
      container_title: 'Reviews of Modern Physics',
      volume: '20',
      issue: '2',
      pages: '367-387',
      // As Crossref registered it; lookupDoi puts back the user's spelling
      doi: '10.1103/revmodphys.20.367',
      // Only repeated the DOI
      url: null,
      published_date: '1948-04-01',
      accessed_date: null,
      year: 1948,
      edition: null,
      // A journal article's reference has no publisher
      publisher: null,
      note: null,
    })
  })

  it('imports a chapter, with its editors, and strips markup from the title', () => {
    const source = sourceFromCsl(crossrefChapter)

    expect(source).toMatchObject({
      type: 'book_chapter',
      title: 'The Zettelkasten as a Thinking Tool',
      container_title: 'Knowledge Organization',
      authors: 'Luhmann, Niklas; van Beethoven, Ludwig',
      editors: 'Sartre, Jean-Paul',
      publisher: 'Springer International Publishing',
      pages: '45-67',
      published_date: null,
      year: 2019,
      url: 'http://link.springer.com/10.1007/978-3-030-00000-0_3',
    })
  })

  it('cites a conference paper as a chapter of its proceedings', () => {
    expect(sourceFromCsl(conferencePaper)).toMatchObject({
      type: 'book_chapter',
      container_title:
        'Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems',
      // Year and month only: no full date
      published_date: null,
      year: 2020,
    })
  })

  it('reads the CSL types DataCite uses', () => {
    expect(sourceFromCsl(dataciteArticle)).toMatchObject({
      type: 'journal_article',
      authors: 'DataCite Metadata Working Group',
      container_title: 'DataCite',
      url: 'https://schema.datacite.org/meta/kernel-4.4/',
      published_date: '2021-03-30',
    })
  })

  it('falls back to a book for other types, with a group author', () => {
    expect(sourceFromCsl(dataciteDataset)).toMatchObject({
      type: 'book',
      authors: 'Particule Research Group Lyon',
      publisher: 'Zenodo',
      doi: '10.5281/ZENODO.1234567',
      published_date: '2024-01-15',
      year: 2024,
    })
  })

  it('gives sources the form accepts', () => {
    for (const item of [
      crossrefArticle,
      crossrefChapter,
      conferencePaper,
      dataciteDataset,
      dataciteArticle,
    ]) {
      expect(isValid(sourceFromCsl(item))).toBe(true)
    }
  })

  it('cleans names so they read back as the same people', () => {
    const source = sourceFromCsl({
      type: 'book',
      title: 'T',
      author: [{ family: 'Smith; Jones', given: 'R2-D2' }, { family: '', given: 'Nobody' }],
    })
    expect(source.authors).toBe('Smith Jones, R-D')
  })

  it('cites a chapter without its book as a book', () => {
    expect(sourceFromCsl({ type: 'chapter', title: 'T', author: [{ literal: 'X' }] }).type).toBe(
      'book',
    )
  })

  it('cuts fields to the API limits', () => {
    const source = sourceFromCsl({
      type: 'article-journal',
      title: 'x'.repeat(2000),
      'container-title': 'J',
      volume: '1'.repeat(100),
      author: Array.from({ length: 200 }, (_, i) => ({ family: `Author${i}`, given: 'A' })),
    })
    expect(source.title).toHaveLength(1024)
    expect(source.volume).toHaveLength(64)
    expect(source.authors!.length).toBeLessThanOrEqual(1024)
    expect(isValid(source)).toBe(true)
  })

  it('leaves authors empty when the metadata has none, and the source can still be added', () => {
    const source = sourceFromCsl({ ...crossrefArticle, author: undefined })
    expect(source.authors).toBeNull()
    expect(isValid(source)).toBe(true)
  })
})
