import { listAll, request } from './client'

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
