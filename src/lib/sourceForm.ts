import { z } from 'zod'

import type { SourceFields, SourceType } from '@/api/sources'
import {
  CONTRIBUTORS_MAX_LENGTH,
  contributorSchema,
  parseContributors,
  serializeContributors,
  toCslName,
  type Contributor,
} from './contributors'
import { normalizeDoi } from './doi'

export const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: 'book', label: 'Livre' },
  { value: 'journal_article', label: 'Article de revue' },
  { value: 'book_chapter', label: 'Chapitre d’ouvrage' },
  { value: 'web_page', label: 'Page web' },
  { value: 'other', label: 'Autre' },
]

/** Types with an APA reference, offered by the type select; `other` is chosen at creation */
export const ACADEMIC_TYPES = SOURCE_TYPES.filter((t) => t.value !== 'other')

export function isAcademic(type: SourceType) {
  return type !== 'other'
}

export function sourceTypeLabel(type: SourceType) {
  return SOURCE_TYPES.find((t) => t.value === type)!.label
}

/** Fields shown on top of type, title, authors and date */
export type OptionalField =
  | 'editors'
  | 'container_title'
  | 'volume'
  | 'issue'
  | 'pages'
  | 'doi'
  | 'url'
  | 'accessed_date'
  | 'edition'
  | 'publisher'

export const FIELDS_BY_TYPE: Record<SourceType, readonly OptionalField[]> = {
  book: ['edition', 'publisher', 'doi', 'url'],
  journal_article: ['container_title', 'volume', 'issue', 'pages', 'doi', 'url'],
  book_chapter: ['editors', 'container_title', 'edition', 'pages', 'publisher', 'doi', 'url'],
  web_page: ['container_title', 'url', 'accessed_date'],
  other: ['url'],
}

/** Mirrors the API's REQUIRED_BY_TYPE */
export const REQUIRED_BY_TYPE: Record<SourceType, readonly OptionalField[]> = {
  book: [],
  journal_article: ['container_title'],
  book_chapter: ['container_title'],
  web_page: ['url'],
  other: [],
}

/** `container_title` means a different thing for each type */
export const CONTAINER_TITLE_LABEL: Record<SourceType, string> = {
  book: 'Titre du contenant',
  journal_article: 'Revue',
  book_chapter: 'Titre de l’ouvrage',
  web_page: 'Nom du site',
  other: '',
}

/** Form values: text inputs hold strings, empty meaning "not set" */
export interface SourceFormValues {
  type: SourceType
  title: string
  authors: Contributor[]
  editors: Contributor[]
  container_title: string
  volume: string
  issue: string
  pages: string
  doi: string
  url: string
  published_date: string
  accessed_date: string
  year: string
  edition: string
  publisher: string
  note: string
}

const text = (max: number) => z.string().trim().max(max, `${max} caractères maximum.`)
const date = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Date invalide.')

export const sourceFormSchema = z
  .object({
    type: z.enum(['book', 'journal_article', 'book_chapter', 'web_page', 'other']),
    title: text(1024).min(1, 'Le titre est requis.'),
    authors: z.array(contributorSchema),
    editors: z.array(contributorSchema),
    container_title: text(1024),
    volume: text(64),
    issue: text(64),
    pages: text(64),
    doi: text(255),
    url: text(2048).refine((value) => !value || URL.canParse(value), 'Adresse invalide.'),
    published_date: date,
    accessed_date: date,
    year: z
      .string()
      .trim()
      .regex(/^(\d{1,4})?$/, 'Année invalide.'),
    edition: text(255),
    publisher: text(255),
    note: z.string(),
  })
  .superRefine((values, ctx) => {
    if (isAcademic(values.type) && !values.authors.length) {
      ctx.addIssue({ code: 'custom', path: ['authors'], message: 'Ajoutez au moins un auteur.' })
    }
    for (const field of REQUIRED_BY_TYPE[values.type]) {
      if (!values[field])
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Ce champ est requis pour ce type de source.',
        })
    }
    for (const field of ['authors', 'editors'] as const) {
      if (serializeContributors(values[field]).length > CONTRIBUTORS_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'La liste des noms est trop longue.',
        })
      }
    }
  })

export function emptySourceForm(type: SourceType = 'book'): SourceFormValues {
  return {
    type,
    title: '',
    authors: isAcademic(type) ? [{ kind: 'person', family: '', given: '' }] : [],
    editors: [],
    container_title: '',
    volume: '',
    issue: '',
    pages: '',
    doi: '',
    url: '',
    published_date: '',
    accessed_date: '',
    year: '',
    edition: '',
    publisher: '',
    note: '',
  }
}

export function formFromSource(source: SourceFields): SourceFormValues {
  return {
    type: source.type,
    title: source.title,
    authors: parseContributors(source.authors),
    editors: parseContributors(source.editors),
    container_title: source.container_title ?? '',
    volume: source.volume ?? '',
    issue: source.issue ?? '',
    pages: source.pages ?? '',
    doi: source.doi ?? '',
    url: source.url ?? '',
    published_date: source.published_date ?? '',
    accessed_date: source.accessed_date ?? '',
    year: source.year === null ? '' : String(source.year),
    edition: source.edition ?? '',
    publisher: source.publisher ?? '',
    note: source.note ?? '',
  }
}

/**
 * API payload. Fields the type doesn't use are sent as null: the form keeps them while
 * the user switches types, but the stored source only holds what its reference shows.
 */
export function payloadFromForm(values: SourceFormValues): SourceFields {
  const used = new Set<OptionalField>(FIELDS_BY_TYPE[values.type])
  const optional = (field: Exclude<OptionalField, 'editors'>) =>
    (used.has(field) && values[field].trim()) || null
  const authors = isAcademic(values.type) ? serializeContributors(values.authors) : ''
  const editors = used.has('editors') ? serializeContributors(values.editors) : ''
  // Other sources have no reference, so no date
  const publishedDate = isAcademic(values.type) ? values.published_date : ''
  const year = publishedDate
    ? Number(publishedDate.slice(0, 4))
    : isAcademic(values.type) && values.year.trim()
      ? Number(values.year)
      : null

  return {
    type: values.type,
    title: values.title.trim(),
    authors: authors || null,
    editors: editors || null,
    container_title: optional('container_title'),
    volume: optional('volume'),
    issue: optional('issue'),
    pages: optional('pages'),
    doi: optional('doi'),
    url: optional('url'),
    published_date: publishedDate || null,
    accessed_date: optional('accessed_date'),
    year,
    edition: optional('edition'),
    publisher: optional('publisher'),
    note: values.note.trim() || null,
  }
}

/** The fields of `next` that differ from the saved source, for a PATCH */
export function changedFields(saved: SourceFields, next: SourceFields): Partial<SourceFields> {
  const patch: Partial<Record<keyof SourceFields, unknown>> = {}
  for (const key of Object.keys(next) as (keyof SourceFields)[]) {
    if (next[key] !== saved[key]) patch[key] = next[key]
  }
  return patch as Partial<SourceFields>
}

const CSL_TYPES: Record<Exclude<SourceType, 'other'>, string> = {
  book: 'book',
  journal_article: 'article-journal',
  book_chapter: 'chapter',
  web_page: 'webpage',
}

function dateParts(isoDate: string) {
  return { 'date-parts': [isoDate.split('-').map(Number)] }
}

/** CSL-JSON item, the input of citation-js. Other sources have no reference: callers skip them */
export function toCsl(source: SourceFields & { id?: string }): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: source.id ?? 'source',
    type: source.type === 'other' ? 'document' : CSL_TYPES[source.type],
    title: source.title,
    author: parseContributors(source.authors).map(toCslName),
  }
  const editors = parseContributors(source.editors)
  if (editors.length) item.editor = editors.map(toCslName)
  if (source.container_title) item['container-title'] = source.container_title
  if (source.volume) item.volume = source.volume
  if (source.issue) item.issue = source.issue
  if (source.pages) item.page = source.pages
  if (source.edition) item.edition = source.edition
  if (source.publisher) item.publisher = source.publisher
  if (source.doi) item.DOI = normalizeDoi(source.doi)
  if (source.url) item.URL = source.url
  if (source.published_date) item.issued = dateParts(source.published_date)
  else if (source.year !== null) item.issued = { 'date-parts': [[source.year]] }
  if (source.accessed_date) item.accessed = dateParts(source.accessed_date)
  return item
}
