<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { KnowledgeBase } from '@/api/knowledgeBases'
import { useKnowledgeBasesStore } from '@/stores/knowledgeBases'

const props = defineProps<{ knowledgeBase: KnowledgeBase | null }>()
const open = defineModel<boolean>('open', { required: true })

const knowledgeBases = useKnowledgeBasesStore()
const route = useRoute()
const router = useRouter()

const confirmation = ref('')
const isDeleting = ref(false)
const errorMessage = ref<string | null>(null)

// Deleting also deletes every particule, so the name must be typed back
const canDelete = computed(
  () => props.knowledgeBase !== null && confirmation.value === props.knowledgeBase.name,
)

watch(open, (isOpen) => {
  if (isOpen) {
    confirmation.value = ''
    errorMessage.value = null
  }
})

async function onDelete() {
  if (!props.knowledgeBase || !canDelete.value) return
  const kbId = props.knowledgeBase.id
  isDeleting.value = true
  errorMessage.value = null
  try {
    await knowledgeBases.remove(kbId)
    open.value = false
    if (route.params.kbId === kbId) await router.push({ name: 'knowledge-bases' })
  } catch {
    errorMessage.value = 'Suppression impossible, réessayez plus tard.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <form class="flex flex-col gap-4" @submit.prevent="onDelete">
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ knowledgeBase?.name }} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Toutes les particules de cette base seront supprimées définitivement. Les tags, liens
            et sources sont conservés.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div class="flex flex-col gap-2">
          <Label for="delete-kb-confirmation">
            Tapez <strong>{{ knowledgeBase?.name }}</strong> pour confirmer
          </Label>
          <Input id="delete-kb-confirmation" v-model="confirmation" autocomplete="off" />
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <AlertDialogFooter>
          <AlertDialogCancel type="button">Annuler</AlertDialogCancel>
          <Button type="submit" variant="destructive" :disabled="!canDelete || isDeleting">
            Supprimer
          </Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>
</template>
