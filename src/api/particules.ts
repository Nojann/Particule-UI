import { request } from './client'

export interface Particule {
  id: string
  knowledge_base_id: string
  title: string
  permalink: string
  content: string
  origins: string
  source_id: string | null
}

export type ParticuleFields = Pick<
  Particule,
  'title' | 'permalink' | 'content' | 'origins' | 'source_id'
>

export interface Source {
  id: string
  authors: string
  year: number
  edition: string
  publisher: string
  owner_id: string
}

const PAGE_SIZE = 100

// The API pages lists by `skip` / `limit`: fetch pages until one comes back short
async function listAll<T>(path: string, token: string) {
  const all: T[] = []
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await request<T[]>(`${path}?skip=${skip}&limit=${PAGE_SIZE}`, { token })
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
  }
}

export function listParticules(token: string, kbId: string) {
  return listAll<Particule>(`/knowledge-bases/${kbId}/particules/`, token)
}

export function createParticule(token: string, kbId: string, fields: ParticuleFields) {
  return request<Particule>(`/knowledge-bases/${kbId}/particules/`, {
    method: 'POST',
    token,
    json: fields,
  })
}

export function updateParticule(
  token: string,
  kbId: string,
  particuleId: string,
  fields: Partial<ParticuleFields>,
) {
  return request<Particule>(`/knowledge-bases/${kbId}/particules/${particuleId}`, {
    method: 'PATCH',
    token,
    json: fields,
  })
}

export function deleteParticule(token: string, kbId: string, particuleId: string) {
  return request<void>(`/knowledge-bases/${kbId}/particules/${particuleId}`, {
    method: 'DELETE',
    token,
  })
}

export function listSources(token: string) {
  return listAll<Source>('/sources/', token)
}
