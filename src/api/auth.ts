import { request } from './client'

export interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
}

export interface SignupPayload {
  email: string
  password: string
  full_name?: string
}

interface AccessToken {
  access_token: string
  token_type: string
}

// OAuth2 password flow: form-encoded body, the email goes in `username`
export function login(email: string, password: string) {
  return request<AccessToken>('/login/access-token', {
    method: 'POST',
    body: new URLSearchParams({ username: email, password }),
  })
}

export function signup(payload: SignupPayload) {
  return request<User>('/users/signup', { method: 'POST', json: payload })
}

export function getMe(token: string) {
  return request<User>('/users/me', { token })
}
