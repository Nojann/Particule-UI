/**
 * CSL-JSON as doi.org returns it, trimmed to the fields the import reads plus a few it
 * ignores. Modelled on real answers (October 2026): Crossref uses its own type names
 * (`journal-article`, `book-chapter`, `proceedings-article`) and lowercases DOIs, while
 * DataCite uses CSL types. The chapter and dataset are made up to cover more cases.
 */
import type { CslItem } from '@/lib/cslImport'

export const crossrefArticle: CslItem = {
  indexed: { 'date-parts': [[2026, 10, 24]] },
  publisher: 'American Physical Society (APS)',
  issue: '2',
  DOI: '10.1103/revmodphys.20.367',
  type: 'journal-article',
  page: '367-387',
  source: 'Crossref',
  title: 'Space-Time Approach to Non-Relativistic Quantum Mechanics',
  volume: '20',
  author: [{ given: 'R. P.', family: 'Feynman', sequence: 'first', affiliation: [] }],
  'container-title': 'Reviews of Modern Physics',
  'container-title-short': 'Rev. Mod. Phys.',
  URL: 'http://dx.doi.org/10.1103/RevModPhys.20.367',
  issued: { 'date-parts': [[1948, 4, 1]] },
}

export const crossrefChapter: CslItem = {
  type: 'book-chapter',
  DOI: '10.1007/978-3-030-00000-0_3',
  title: ['The <i>Zettelkasten</i> as a Thinking Tool'],
  'container-title': ['Knowledge Organization', 'Lecture Notes in Computer Science'],
  author: [
    { given: 'Niklas', family: 'Luhmann' },
    { given: 'Ludwig', family: 'Beethoven', 'non-dropping-particle': 'van' },
  ],
  editor: [{ given: 'Jean-Paul', family: 'Sartre' }],
  publisher: 'Springer International Publishing',
  page: '45-67',
  issued: { 'date-parts': [[2019]] },
  URL: 'http://link.springer.com/10.1007/978-3-030-00000-0_3',
}

export const conferencePaper: CslItem = {
  type: 'proceedings-article',
  DOI: '10.1145/3313831.3376518',
  title: 'Reinforcement Learning for the Adaptive Scheduling of Educational Activities',
  'container-title': 'Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems',
  author: [{ given: 'Jonathan', family: 'Bassen' }],
  publisher: 'ACM',
  issued: { 'date-parts': [[2020, 4]] },
  URL: 'http://dx.doi.org/10.1145/3313831.3376518',
}

export const dataciteDataset: CslItem = {
  type: 'dataset',
  id: 'https://doi.org/10.5281/zenodo.1234567',
  DOI: '10.5281/ZENODO.1234567',
  title: 'Survey of note-taking habits',
  author: [{ literal: 'Particule Research Group, Lyon' }],
  publisher: 'Zenodo',
  issued: { 'date-parts': [[2024, 1, 15]] },
  URL: 'https://zenodo.org/record/1234567',
}

/** DataCite, with a CSL type and a group author */
export const dataciteArticle: CslItem = {
  type: 'article-journal',
  DOI: '10.14454/FXWS-0523',
  title:
    'DataCite Metadata Schema for the Publication and Citation of Research Data and Other Research Outputs v4.4',
  'container-title': 'DataCite',
  author: [{ literal: 'DataCite Metadata Working Group' }],
  publisher: 'DataCite',
  issued: { 'date-parts': [[2021, 3, 30]] },
  URL: 'https://schema.datacite.org/meta/kernel-4.4/',
}
