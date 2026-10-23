import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import router from '../index'
import { useAuthStore } from '@/stores/auth'

const alice = {
  id: '6f1c',
  email: 'alice@example.com',
  full_name: 'Alice',
  is_active: true,
  is_superuser: false,
  created_at: '2026-10-21T08:30:00',
}

describe('public site / app flow', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    // Start every test from a page both visitors and users can open
    await router.push('/about')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function signIn() {
    useAuthStore().token = 'tok'
    fetchMock.mockResolvedValue(new Response(JSON.stringify(alice), { status: 200 }))
  }

  it('shows the home page to anonymous visitors', async () => {
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('sends signed-in users from the home page to the app', async () => {
    signIn()
    await router.push('/')
    expect(router.currentRoute.value.fullPath).toBe('/app')
  })

  it('sends signed-in users from login to the app', async () => {
    signIn()
    await router.push('/login')
    expect(router.currentRoute.value.fullPath).toBe('/app')
  })

  it('keeps the about page reachable once signed in', async () => {
    signIn()
    await router.push('/')
    await router.push('/about')
    expect(router.currentRoute.value.name).toBe('about')
  })

  it('asks anonymous visitors to log in before opening the app', async () => {
    await router.push('/app/kb1')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/app/kb1')
  })
})
