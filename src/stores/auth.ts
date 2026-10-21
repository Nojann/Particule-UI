import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import * as authApi from '@/api/auth'
import type { SignupPayload, User } from '@/api/auth'
import { ApiError } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const token = useLocalStorage<string | null>('particule.token', null)
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  // An expired or invalid token answers 401/403, a deleted user 404
  async function fetchUser() {
    if (!token.value) return
    try {
      user.value = await authApi.getMe(token.value)
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) logout()
      else throw error
    }
  }

  async function login(email: string, password: string) {
    const { access_token } = await authApi.login(email, password)
    token.value = access_token
    await fetchUser()
  }

  async function signup(payload: SignupPayload) {
    await authApi.signup(payload)
    await login(payload.email, payload.password)
  }

  function logout() {
    token.value = null
    user.value = null
  }

  return { token, user, isAuthenticated, fetchUser, login, signup, logout }
})
