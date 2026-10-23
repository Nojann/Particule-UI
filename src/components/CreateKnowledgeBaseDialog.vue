<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useKnowledgeBasesStore } from '@/stores/knowledgeBases'

const open = defineModel<boolean>('open', { required: true })

const knowledgeBases = useKnowledgeBasesStore()
const router = useRouter()

const formSchema = toTypedSchema(
  z.object({
    name: z.string().trim().min(1, 'Nom requis').max(255, '255 caractères maximum'),
  }),
)

const { handleSubmit, isSubmitting, resetForm } = useForm({ validationSchema: formSchema })
const errorMessage = ref<string | null>(null)

// Start from an empty form every time the dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
    errorMessage.value = null
  }
})

const onSubmit = handleSubmit(async ({ name }) => {
  errorMessage.value = null
  try {
    const kb = await knowledgeBases.create(name)
    open.value = false
    await router.push({ name: 'knowledge-base', params: { kbId: kb.id } })
  } catch {
    errorMessage.value = 'Création impossible, réessayez plus tard.'
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit="onSubmit">
        <DialogHeader>
          <DialogTitle>Nouvelle base de connaissances</DialogTitle>
          <DialogDescription>Regroupez vos particules autour d'un même sujet.</DialogDescription>
        </DialogHeader>

        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Nom</FormLabel>
            <FormControl>
              <Input placeholder="Physique" autocomplete="off" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Annuler</Button>
          <Button type="submit" :disabled="isSubmitting">Créer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
