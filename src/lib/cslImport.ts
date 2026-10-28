/**
 * CSL-JSON, as doi.org returns it, turned into the fields of a source. The publisher's
 * metadata is taken as it is (case included), only cleaned so it passes the form's rules.
 */
import type { SourceFields, SourceType } from '@/api/sources'
import { CONTRIBUTORS_MAX_LENGTH, serializeContributors, type Contributor } from './contributors'
import { normalizeDoi } from './doi'
import { formFromSource, payloadFromForm } from './sourceForm'

type CslValue = string | number | (string | number)[] | undefined

interface CslName {
  family?: string
  given?: string
  literal?: string
  'non-dropping-particle'?: string
  /** Crossref adds `sequence`, `affiliation`, `ORCID`… which the import ignores */
  [key: string]: unknown
}

export interface CslItem {
  type?: string
  title?: CslValue
  'container-title'?: CslValue
  author?: CslName[]
  editor?: CslName[]
  issued?: { 'date-parts'?: (string | number)[][] }
  volume?: CslValue
  issue?: CslValue
  page?: CslValue
  edition?: CslValue
  publisher?: CslValue
  DOI?: string
  URL?: string
  [key: string]: unknown
}

// DataCite answers with CSL types, Crossref with its own (`journal-article`, `book-chapter`…)
const ARTICLE_TYPES = new Set(['article-journal', 'article', 'journal-article'])
const CHAPTER_TYPES = new Set([
  'chapter',
  'paper-conference',
  'entry-encyclopedia',
  'book-chapter',
  'book-section',
  'book-part',
  'proceedings-article',
  'reference-entry',
])

function cslType(item: CslItem, hasContainer: boolean): SourceType {
  if (ARTICLE_TYPES.has(item.type ?? '')) return 'journal_article'
  // A chapter without its book's title can't be cited as one
  if (CHAPTER_TYPES.has(item.type ?? '')) return hasContainer ? 'book_chapter' : 'book'
  // Reports, theses, datasets… are standalone works, cited like books in APA
  return 'book'
}

/** Plain text: Crossref titles may hold JATS markup such as `<i>` or `<sub>` */
function text(value: CslValue, max: number) {
  const first = Array.isArray(value) ? value[0] : value
  if (first === undefined || first === null) return ''
  const raw = String(first)
  const plain = /<[a-z!/]/i.test(raw)
    ? (new DOMParser().parseFromString(raw, 'text/html').body.textContent ?? '')
    : raw
  return plain.replace(/\s+/g, ' ').trim().slice(0, max)
}

const SEPARATORS = /[;,]/g
const NOT_GIVEN = /[^\p{L}\p{M}\s.'’-]/gu

function contributor(name: CslName): Contributor | null {
  if (name.literal) {
    const family = name.literal.replace(SEPARATORS, ' ')
    return { kind: 'group', family, given: '' }
  }
  // "de", "van der"… belong to the family name, as the form expects
  const family = [name['non-dropping-particle'], name.family]
    .filter(Boolean)
    .join(' ')
    .replace(SEPARATORS, ' ')
  if (!family.trim()) return null
  return { kind: 'person', family, given: (name.given ?? '').replace(NOT_GIVEN, '') }
}

/** Serialised names, dropping the last ones if the list exceeds the API's limit */
function names(list: CslName[] | undefined) {
  const contributors = (list ?? []).map(contributor).filter((c) => c !== null)
  while (
    contributors.length &&
    serializeContributors(contributors).length > CONTRIBUTORS_MAX_LENGTH
  ) {
    contributors.pop()
  }
  return serializeContributors(contributors)
}

function issued(item: CslItem) {
  const [year, month, day] = (item.issued?.['date-parts']?.[0] ?? []).map(Number)
  if (!year) return { published_date: null, year: null }
  if (!month || !day) return { published_date: null, year }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { published_date: `${year}-${pad(month)}-${pad(day)}`, year }
}

export function sourceFromCsl(item: CslItem): SourceFields {
  const containerTitle = text(item['container-title'], 1024)
  const doi = item.DOI ? normalizeDoi(item.DOI).slice(0, 255) : ''
  // The DOI already leads to the work; a doi.org URL would only repeat it
  const url = item.URL && !/^https?:\/\/(dx\.)?doi\.org\//i.test(item.URL) ? item.URL : ''

  const fields: SourceFields = {
    type: cslType(item, Boolean(containerTitle)),
    title: text(item.title, 1024),
    authors: names(item.author) || null,
    editors: names(item.editor) || null,
    container_title: containerTitle || null,
    volume: text(item.volume, 64) || null,
    issue: text(item.issue, 64) || null,
    pages: text(item.page, 64) || null,
    doi: doi || null,
    url: url.length <= 2048 ? url || null : null,
    ...issued(item),
    accessed_date: null,
    edition: text(item.edition, 255) || null,
    publisher: text(item.publisher, 255) || null,
    note: null,
  }
  // Through the form, so the fields the type doesn't use are dropped as on every save
  return payloadFromForm(formFromSource(fields))
}
