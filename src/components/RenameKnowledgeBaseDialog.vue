<script setup lang="ts">
import { ref, watch } from 'vue'
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
import type { KnowledgeBase } from '@/api/knowledgeBases'
import { useKnowledgeBasesStore } from '@/stores/knowledgeBases'

const props = defineProps<{ knowledgeBase: KnowledgeBase | null }>()
const open = defineModel<boolean>('open', { required: true })

const knowledgeBases = useKnowledgeBasesStore()

const formSchema = toTypedSchema(
  z.object({
    name: z.string().trim().min(1, 'Nom requis').max(255, '255 caractères maximum'),
  }),
)

const { handleSubmit, isSubmitting, resetForm } = useForm({ validationSchema: formSchema })
const errorMessage = ref<string | null>(null)

// Start from the current name every time the dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    resetForm({ values: { name: props.knowledgeBase?.name ?? '' } })
    errorMessage.value = null
  }
})

const onSubmit = handleSubmit(async ({ name }) => {
  if (!props.knowledgeBase) return
  errorMessage.value = null
  try {
    if (name !== props.knowledgeBase.name) await knowledgeBases.rename(props.knowledgeBase.id, name)
    open.value = false
  } catch {
    errorMessage.value = 'Renommage impossible, réessayez plus tard.'
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit="onSubmit">
        <DialogHeader>
          <DialogTitle>Renommer la base</DialogTitle>
          <DialogDescription>Ses particules ne changent pas.</DialogDescription>
        </DialogHeader>

        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Nom</FormLabel>
            <FormControl>
              <Input autocomplete="off" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Annuler</Button>
          <Button type="submit" :disabled="isSubmitting">Renommer</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
