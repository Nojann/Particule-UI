import { request } from './client'

export interface KnowledgeBase {
  id: string
  name: string
  owner_id: string
  created_at: string
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
