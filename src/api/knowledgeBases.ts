import { request } from './client'

export interface KnowledgeBase {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Particule {
  id: string
  knowledge_base_id: string
  title: string
  permalink: string
  content: string
  origins: string
  source_id: string | null
}

export function listKnowledgeBases(token: string) {
  return request<KnowledgeBase[]>('/knowledge-bases/', { token })
}

export function createKnowledgeBase(token: string, name: string) {
  return request<KnowledgeBase>('/knowledge-bases/', { method: 'POST', token, json: { name } })
}

export function renameKnowledgeBase(token: string, kbId: string, name: string) {
  return request<KnowledgeBase>(`/knowledge-bases/${kbId}`, {
    method: 'PATCH',
    token,
    json: { name },
  })
}

export function deleteKnowledgeBase(token: string, kbId: string) {
  return request<void>(`/knowledge-bases/${kbId}`, { method: 'DELETE', token })
}

export function listParticules(token: string, kbId: string) {
  return request<Particule[]>(`/knowledge-bases/${kbId}/particules/`, { token })
}
