<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const formSchema = toTypedSchema(
  z.object({
    email: z.string().email('Adresse email invalide'),
    password: z.string().min(1, 'Mot de passe requis'),
  }),
)

const { handleSubmit, isSubmitting } = useForm({ validationSchema: formSchema })
const errorMessage = ref<string | null>(null)

// Only follow same-site paths, never `//other-site.com`
function redirectTarget() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/'
}

const onSubmit = handleSubmit(async ({ email, password }) => {
  errorMessage.value = null
  try {
    await auth.login(email, password)
    await router.push(redirectTarget())
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 400
        ? 'Email ou mot de passe incorrect.'
        : 'Connexion impossible, réessayez plus tard.'
  }
})
</script>

<template>
  <Card class="mx-auto w-full max-w-sm">
    <CardHeader>
      <CardTitle>Connexion</CardTitle>
      <CardDescription>Connectez-vous pour accéder à vos bases de connaissances.</CardDescription>
    </CardHeader>

    <form @submit="onSubmit">
      <CardContent class="flex flex-col gap-4">
        <FormField v-slot="{ componentField }" name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" autocomplete="email" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="password">
          <FormItem>
            <FormLabel>Mot de passe</FormLabel>
            <FormControl>
              <Input type="password" autocomplete="current-password" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <p v-if="errorMessage" role="alert" class="text-sm text-destructive">{{ errorMessage }}</p>
      </CardContent>

      <CardFooter class="mt-6 flex flex-col gap-3">
        <Button type="submit" class="w-full" :disabled="isSubmitting">
          {{ isSubmitting ? 'Connexion…' : 'Se connecter' }}
        </Button>
        <p class="text-sm text-muted-foreground">
          Pas encore de compte ?
          <RouterLink to="/signup" class="text-foreground underline underline-offset-4">
            Créer un compte
          </RouterLink>
        </p>
      </CardFooter>
    </form>
  </Card>
</template>
