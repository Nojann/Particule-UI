import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from '../auth'
import { ApiError } from '@/api/client'

const alice = {
  id: '6f1c',
  email: 'alice@example.com',
  full_name: 'Alice',
  is_active: true,
  is_superuser: false,
  created_at: '2026-10-21T08:30:00',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('auth store', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs in with a form-encoded body and loads the user', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse(200, alice))
    const auth = useAuthStore()

    await auth.login('alice@example.com', 'secret-password')

    const loginBody = fetchMock.mock.calls[0]![1]!.body
    expect(loginBody).toBeInstanceOf(URLSearchParams)
    expect((loginBody as URLSearchParams).get('username')).toBe('alice@example.com')

    const [, meInit] = fetchMock.mock.calls[1]!
    expect(new Headers(meInit?.headers).get('Authorization')).toBe('Bearer tok')

    expect(auth.token).toBe('tok')
    expect(auth.user).toEqual(alice)
    expect(auth.isAuthenticated).toBe(true)
  })

  it('throws an ApiError on wrong credentials and stays logged out', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { detail: 'Incorrect email or password' }))
    const auth = useAuthStore()

    await expect(auth.login('alice@example.com', 'wrong')).rejects.toMatchObject({
      status: 400,
      message: 'Incorrect email or password',
    })
    expect(auth.token).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('signs up then logs in', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, alice))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse(200, alice))
    const auth = useAuthStore()

    await auth.signup({ email: 'alice@example.com', password: 'secret-password' })

    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/users\/signup$/)
    expect(auth.user).toEqual(alice)
  })

  it('drops an expired token', async () => {
    localStorage.setItem('particule.token', 'expired')
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { detail: 'Could not validate credentials' }))
    const auth = useAuthStore()

    await auth.fetchUser()

    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
  })

  it('keeps the token when the API is unreachable', async () => {
    localStorage.setItem('particule.token', 'tok')
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const auth = useAuthStore()

    await expect(auth.fetchUser()).rejects.not.toBeInstanceOf(ApiError)
    expect(auth.token).toBe('tok')
  })
})
