<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { LogOut } from '@lucide/vue'

import AppLogo from '@/components/AppLogo.vue'
import ColorModeToggle from '@/components/ColorModeToggle.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <RouterLink to="/" class="flex items-center gap-2 font-heading text-lg font-semibold">
          <AppLogo class="size-7" />
          Particule
        </RouterLink>

        <div class="ml-auto flex items-center gap-2">
          <!-- Signed-in users only land here through « À propos » -->
          <template v-if="auth.user">
            <Button size="sm" as-child>
              <RouterLink :to="{ name: 'knowledge-bases' }">Ouvrir l'application</RouterLink>
            </Button>
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

          <ColorModeToggle />
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>

    <footer class="border-t">
      <div class="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
        © {{ new Date().getFullYear() }} Particule
      </div>
    </footer>
  </div>
</template>
