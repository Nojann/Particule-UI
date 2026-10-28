import { describe, it, expect } from 'vitest'

import {
  formatInTextCitation,
  formatReference,
  segmentsFromHtml,
  segmentsToHtml,
  segmentsToText,
} from '../citation'
import { toCsl } from '../sourceForm'
import type { SourceFields } from '@/api/sources'

const none = {
  editors: null,
  container_title: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  url: null,
  published_date: null,
  accessed_date: null,
  year: null,
  edition: null,
  publisher: null,
  note: null,
}

async function reference(source: SourceFields) {
  return segmentsToText(await formatReference(toCsl(source)))
}

// Pins citation-js' APA output with the fr-FR locale; typography is the CSL style's
describe('formatReference (citation-js, APA, fr-FR)', () => {
  it('formats a book, with italics and the edition', async () => {
    const segments = await formatReference(
      toCsl({
        ...none,
        type: 'book',
        title: 'The Feynman lectures on physics',
        authors: 'Feynman, Richard P.; Leighton, Robert',
        year: 1964,
        edition: '2',
        publisher: 'Addison-Wesley',
      }),
    )
    expect(segmentsToText(segments)).toBe(
      'Feynman, R. P., & Leighton, R. (1964). The Feynman lectures on physics (2e éd.). Addison-Wesley.',
    )
    expect(segments).toContainEqual({ text: 'The Feynman lectures on physics', italic: true })
    expect(segments).toContainEqual({ text: 'e', superscript: true })
  })

  it('formats a journal article with its DOI', async () => {
    expect(
      await reference({
        ...none,
        type: 'journal_article',
        title: 'Space-time approach to non-relativistic quantum mechanics',
        authors: 'Feynman, Richard P.',
        container_title: 'Reviews of Modern Physics',
        volume: '20',
        issue: '2',
        pages: '367-387',
        doi: 'https://doi.org/10.1103/RevModPhys.20.367',
        published_date: '1948-04-01',
        year: 1948,
      }),
    ).toBe(
      'Feynman, R. P. (1948). Space-time approach to non-relativistic quantum mechanics. Reviews of Modern Physics, 20(2), 367‑387. https://doi.org/10.1103/RevModPhys.20.367',
    )
  })

  it('formats a book chapter with its editors', async () => {
    expect(
      await reference({
        ...none,
        type: 'book_chapter',
        title: 'Titre du chapitre',
        authors: 'Dupont, Jean-Paul',
        editors: 'Martin, Claire; Durand, Luc',
        container_title: 'Titre de l’ouvrage',
        pages: '10-25',
        edition: '2',
        publisher: 'Éditeur',
        year: 2010,
      }),
    ).toBe(
      'Dupont, J.-P. (2010). Titre du chapitre. In C. Martin & L. Durand (Éds.), Titre de l’ouvrage (2e éd., p. 10‑25). Éditeur.',
    )
  })

  it('formats a web page by a group author', async () => {
    expect(
      await reference({
        ...none,
        type: 'web_page',
        title: 'Titre de la page',
        authors: 'Organisation mondiale de la santé',
        container_title: 'Nom du site',
        url: 'https://example.org/page',
        published_date: '2024-03-03',
        year: 2024,
      }),
    ).toBe(
      'Organisation mondiale de la santé. (2024, mars 3). Titre de la page. Nom du site. https://example.org/page',
    )
  })

  it('marks an undated source', async () => {
    // The locale writes « s. d. » with a no-break space
    expect(await reference({ ...none, type: 'book', title: 'Titre', authors: 'X, Y' })).toBe(
      'X, Y. (s. d.). Titre.',
    )
  })

  // citeproc reads a few tags in titles (<i>, <b>, <sup>) as CSL rich text; anything else
  // stays text, and segments never carry markup
  it('keeps what the user typed as text', async () => {
    const segments = await formatReference(
      toCsl({
        ...none,
        type: 'book',
        title: '<script>alert(1)</script> <b>b</b>',
        authors: 'X, Y',
      }),
    )
    expect(segmentsToText(segments)).toBe('X, Y. (s. d.). <script>alert(1)</script> b.')
  })
})

describe('formatInTextCitation', () => {
  it('gives the APA in-text citation', async () => {
    const item = toCsl({
      ...none,
      type: 'book',
      title: 'T',
      authors: 'Feynman, R.; Leighton, R.; Sands, M.',
      year: 1964,
    })
    expect(await formatInTextCitation(item)).toBe('(Feynman et al., 1964)')
  })
})

describe('segments', () => {
  it('keep only text, italics and superscripts', () => {
    const html =
      '<div class="csl-entry">A <i>b</i> <span style="font-style: italic">c</span><sup>e</sup>' +
      '<script>alert(1)</script><a href="javascript:x">d</a></div>'
    expect(segmentsFromHtml(html)).toEqual([
      { text: 'A ' },
      { text: 'b', italic: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: 'e', superscript: true },
      { text: 'd' },
    ])
  })

  it('escape text when rebuilt as HTML for the clipboard', () => {
    expect(segmentsToHtml([{ text: '<a href="x">&\'' }, { text: 'T', italic: true }])).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;<i>T</i>',
    )
  })
})
