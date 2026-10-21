import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import router from '../index'

describe('browser tab title', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('uses the route title', async () => {
    await router.push('/login')
    expect(document.title).toBe('Connexion · Particule')
  })

  it('falls back to the app name', async () => {
    await router.push('/')
    expect(document.title).toBe('Particule')
  })
})
