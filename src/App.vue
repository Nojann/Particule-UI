<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useColorMode } from '@vueuse/core'
import { LogOut, Moon, Sun } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'

const navLinks = [{ to: '/', label: 'Accueil' }]

const auth = useAuthStore()
const router = useRouter()
const colorMode = useColorMode()

function toggleColorMode() {
  colorMode.value = colorMode.value === 'dark' ? 'light' : 'dark'
}

async function logout() {
  auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <RouterLink to="/" class="font-heading text-lg font-semibold">Particule</RouterLink>

        <nav class="flex items-center gap-1">
          <Button v-for="link in navLinks" :key="link.to" variant="ghost" size="sm" as-child>
            <RouterLink :to="link.to" active-class="bg-accent text-accent-foreground">
              {{ link.label }}
            </RouterLink>
          </Button>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <template v-if="auth.user">
            <span class="hidden text-sm text-muted-foreground sm:inline">
              {{ auth.user.full_name || auth.user.email }}
            </span>
            <Button variant="ghost" size="sm" @click="logout">
              <LogOut />
              Déconnexion
            </Button>
          </template>
          <template v-else>
            <Button variant="ghost" size="sm" as-child>
              <RouterLink to="/login">Connexion</RouterLink>
            </Button>
            <Button size="sm" as-child>
              <RouterLink to="/signup">Créer un compte</RouterLink>
            </Button>
          </template>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Basculer le thème clair / sombre"
            @click="toggleColorMode"
          >
            <Sun v-if="colorMode === 'dark'" />
            <Moon v-else />
          </Button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <RouterView />
    </main>

    <footer class="border-t">
      <div class="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
        © {{ new Date().getFullYear() }} Particule
      </div>
    </footer>
  </div>
</template>
