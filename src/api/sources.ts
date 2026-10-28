import { listAll, request } from './client'

/** `other` is a catch-all (video, podcast, conversation…) with no APA reference */
export type SourceType = 'book' | 'journal_article' | 'book_chapter' | 'web_page' | 'other'

export interface SourceFields {
  type: SourceType
  title: string
  /**
   * Free text on the server; see lib/contributors.ts for the format the UI writes.
   * Required by every type but `other`.
   */
  authors: string | null
  editors: string | null
  /** Journal, book or site title */
  container_title: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  doi: string | null
  url: string | null
  /** YYYY-MM-DD */
  published_date: string | null
  /** YYYY-MM-DD */
  accessed_date: string | null
  /** null for an undated source; derived from published_date by the server when absent */
  year: number | null
  edition: string | null
  publisher: string | null
  /** The user's own words about the source */
  note: string | null
}

export interface Source extends SourceFields {
  id: string
  owner_id: string
}

export function listSources(token: string) {
  return listAll<Source>('/sources/', token)
}

export function createSource(token: string, fields: SourceFields) {
  return request<Source>('/sources/', { method: 'POST', token, json: fields })
}

export function updateSource(token: string, sourceId: string, fields: Partial<SourceFields>) {
  return request<Source>(`/sources/${sourceId}`, { method: 'PATCH', token, json: fields })
}

export function deleteSource(token: string, sourceId: string) {
  return request<void>(`/sources/${sourceId}`, { method: 'DELETE', token })
}
