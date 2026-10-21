<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
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
const router = useRouter()

// Password limits mirror the API: 8 to 128 characters
const formSchema = toTypedSchema(
  z
    .object({
      full_name: z.string().trim().max(255).optional(),
      email: z.string().email('Adresse email invalide'),
      password: z
        .string()
        .min(8, 'Au moins 8 caractères')
        .max(128, '128 caractères maximum'),
      confirmPassword: z.string(),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: 'Les mots de passe ne correspondent pas',
      path: ['confirmPassword'],
    }),
)

const { handleSubmit, isSubmitting } = useForm({ validationSchema: formSchema })
const errorMessage = ref<string | null>(null)

const onSubmit = handleSubmit(async ({ full_name, email, password }) => {
  errorMessage.value = null
  try {
    await auth.signup({ email, password, full_name: full_name || undefined })
    await router.push('/')
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError && error.status === 400
        ? 'Cette adresse email est déjà utilisée.'
        : 'Inscription impossible, réessayez plus tard.'
  }
})
</script>

<template>
  <Card class="mx-auto w-full max-w-sm">
    <CardHeader>
      <CardTitle>Créer un compte</CardTitle>
      <CardDescription>Commencez à organiser vos connaissances en particules.</CardDescription>
    </CardHeader>

    <form @submit="onSubmit">
      <CardContent class="flex flex-col gap-4">
        <FormField v-slot="{ componentField }" name="full_name">
          <FormItem>
            <FormLabel>Nom (facultatif)</FormLabel>
            <FormControl>
              <Input autocomplete="name" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

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
              <Input type="password" autocomplete="new-password" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="confirmPassword">
          <FormItem>
            <FormLabel>Confirmer le mot de passe</FormLabel>
            <FormControl>
              <Input type="password" autocomplete="new-password" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <p v-if="errorMessage" role="alert" class="text-sm text-destructive">{{ errorMessage }}</p>
      </CardContent>

      <CardFooter class="mt-6 flex flex-col gap-3">
        <Button type="submit" class="w-full" :disabled="isSubmitting">
          {{ isSubmitting ? 'Création…' : 'Créer mon compte' }}
        </Button>
        <p class="text-sm text-muted-foreground">
          Déjà inscrit ?
          <RouterLink to="/login" class="text-foreground underline underline-offset-4">
            Se connecter
          </RouterLink>
        </p>
      </CardFooter>
    </form>
  </Card>
</template>
