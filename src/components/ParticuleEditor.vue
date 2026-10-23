<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { ArrowLeft, Check, Link, LoaderCircle, MoreHorizontal, Trash2, TriangleAlert } from '@lucide/vue'

import MarkdownEditorError from '@/components/MarkdownEditorError.vue'
import MarkdownEditorLoading from '@/components/MarkdownEditorLoading.vue'
import SourcePicker from '@/components/SourcePicker.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Particule, ParticuleFields } from '@/api/particules'
import { ApiError } from '@/api/client'
import { PERMALINK_PATTERN, slugify } from '@/lib/slug'
import { useParticulesStore } from '@/stores/particules'

const SAVE_DELAY_MS = 1000

// CodeMirror is most of this page's weight: load it on its own, after the list
const MarkdownEditor = defineAsyncComponent({
  loader: () => import('@/components/MarkdownEditor.vue'),
  loadingComponent: MarkdownEditorLoading,
  errorComponent: MarkdownEditorError,
  delay: 150,
  // One retry for a flaky network before showing the error
  onError(_error, retry, fail, attempts) {
    if (attempts <= 1) retry()
    else fail()
  },
})

const props = defineProps<{
  kbId: string
  /** null opens a draft, created on the server once it has a title */
  particule: Particule | null
  /** Back to the list, on mobile where only one pane shows */
  showBack?: boolean
}>()

const emit = defineEmits<{
  /** The particule now lives at a new permalink: on creation, or after editing it */
  moved: [particule: Particule]
  /**
   * Delete confirmed; null discards a draft. The parent deletes: removing the particule
   * from the store unmounts this editor, and an unmounted component can't emit any more.
   */
  delete: [particule: Particule | null]
}>()

const particules = useParticulesStore()
const router = useRouter()

const fields = reactive<ParticuleFields>({
  title: props.particule?.title ?? '',
  permalink: props.particule?.permalink ?? '',
  content: props.particule?.content ?? '',
  origins: props.particule?.origins ?? '',
  source_id: props.particule?.source_id ?? null,
})

/** Last version the server confirmed; null while the particule is a draft */
let saved: Particule | null = props.particule

// The permalink follows the title until the particule exists, then stays put so links don't break
const permalinkFollowsTitle = ref(props.particule === null)
watch(
  () => fields.title,
  (title) => {
    if (permalinkFollowsTitle.value) fields.permalink = slugify(title)
  },
)

const permalinkError = ref<string | null>(null)
/** Permalink the server refused as taken: not resent until it changes */
let takenPermalink: string | null = null

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
const status = ref<SaveStatus>('idle')

function changes(): Partial<ParticuleFields> {
  if (!saved) return {}
  const patch: Partial<ParticuleFields> = {}
  const title = fields.title.trim()
  if (title && title !== saved.title) patch.title = title
  if (fields.content !== saved.content) patch.content = fields.content
  if (fields.origins !== saved.origins) patch.origins = fields.origins
  if (fields.source_id !== saved.source_id) patch.source_id = fields.source_id

  permalinkError.value = null
  if (fields.permalink !== saved.permalink) {
    if (!PERMALINK_PATTERN.test(fields.permalink)) {
      permalinkError.value = 'Lettres minuscules, chiffres et tirets uniquement.'
    } else if (fields.permalink === takenPermalink) {
      permalinkError.value = 'Ce permalink est déjà utilisé.'
    } else {
      patch.permalink = fields.permalink
    }
  }
  return patch
}

async function createDraft() {
  const title = fields.title.trim()
  if (!title) {
    status.value = 'idle'
    return
  }
  if (fields.permalink && !PERMALINK_PATTERN.test(fields.permalink)) {
    permalinkError.value = 'Lettres minuscules, chiffres et tirets uniquement.'
    status.value = 'error'
    return
  }
  permalinkError.value = null
  status.value = 'saving'
  try {
    saved = await particules.create(props.kbId, {
      ...fields,
      title,
      permalink: fields.permalink || slugify(title) || 'particule',
    })
    permalinkFollowsTitle.value = false
    fields.permalink = saved.permalink
    status.value = 'saved'
    emit('moved', saved)
  } catch {
    status.value = 'error'
  }
}

async function saveChanges() {
  const patch = changes()
  if (!Object.keys(patch).length) {
    status.value = permalinkError.value ? 'error' : 'saved'
    return
  }
  status.value = 'saving'
  const previous = saved!
  try {
    saved = await particules.update(previous, patch)
    status.value = 'saved'
    if (saved.permalink !== previous.permalink) emit('moved', saved)
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && patch.permalink) {
      // Save the other fields without the refused permalink
      takenPermalink = patch.permalink
      return saveChanges()
    }
    status.value = 'error'
  }
}

// One save at a time; changes made during a save are sent right after it
let inFlight: Promise<void> | null = null
let saveAgain = false
/** Set once deleted or discarded, so a delayed save can't resurrect it */
let gone = false

function flush(): Promise<void> {
  if (gone) return Promise.resolve()
  if (inFlight) {
    saveAgain = true
    return inFlight
  }
  inFlight = (saved ? saveChanges() : createDraft()).finally(() => {
    inFlight = null
    if (saveAgain) {
      saveAgain = false
      void flush()
    }
  })
  return inFlight
}

const scheduleSave = useDebounceFn(flush, SAVE_DELAY_MS)

watch(fields, () => {
  status.value = 'pending'
  void scheduleSave()
})

const hasUnsavedChanges = computed(() => ['pending', 'saving', 'error'].includes(status.value))

// Leaving the particule (another one, another page) saves right away
onBeforeUnmount(() => {
  if (status.value === 'pending' || status.value === 'error') void flush()
})
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) event.preventDefault()
})

const titleInput = useTemplateRef<HTMLTextAreaElement>('titleInput')
const contentEditor = useTemplateRef<{ focus: () => void }>('contentEditor')

onMounted(() => {
  if (!props.particule) titleInput.value?.focus()
})

// Enter in the title moves on to the content (and creates a draft without waiting)
function onTitleEnter() {
  void flush()
  contentEditor.value?.focus()
}

function onPermalinkInput() {
  permalinkFollowsTitle.value = false
}

async function copyLink() {
  if (!saved) return
  const { href } = router.resolve({
    name: 'knowledge-base',
    params: { kbId: props.kbId, permalink: saved.permalink },
  })
  await navigator.clipboard.writeText(new URL(href, window.location.origin).toString())
}

const deleteOpen = ref(false)

async function onDelete() {
  // Let a save in progress land first, so it can't arrive after the deletion
  await inFlight
  gone = true
  emit('delete', saved)
}
</script>

<template>
  <article class="flex h-full flex-col">
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Button v-if="showBack" variant="ghost" size="icon" class="-ml-2" as-child>
        <RouterLink :to="{ name: 'knowledge-base', params: { kbId } }" aria-label="Retour à la liste">
          <ArrowLeft />
        </RouterLink>
      </Button>

      <p class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <template v-if="status === 'pending' || status === 'saving'">
          <LoaderCircle class="size-3.5 animate-spin" />
          Enregistrement…
        </template>
        <template v-else-if="status === 'saved'">
          <Check class="size-3.5" />
          Enregistré
        </template>
        <template v-else-if="status === 'error'">
          <TriangleAlert class="size-3.5 text-destructive" />
          <span class="text-destructive">Échec de l’enregistrement</span>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="flush">
            Réessayer
          </Button>
        </template>
        <template v-else-if="!saved">Brouillon</template>
      </p>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" aria-label="Actions sur la particule">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem :disabled="!saved" @select="copyLink">
            <Link />
            Copier le lien
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            @select="saved ? (deleteOpen = true) : onDelete()"
          >
            <Trash2 />
            {{ saved ? 'Supprimer' : 'Abandonner le brouillon' }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
        <textarea
          ref="titleInput"
          v-model="fields.title"
          rows="1"
          placeholder="Sans titre"
          aria-label="Titre"
          class="field-sizing-content resize-none bg-transparent font-heading text-3xl font-bold outline-none placeholder:text-muted-foreground/60"
          @keydown.enter.prevent="onTitleEnter"
        />

        <dl class="grid grid-cols-[7rem_1fr] items-center gap-x-2 gap-y-0.5 text-sm">
          <dt class="text-muted-foreground"><label for="particule-permalink">Permalink</label></dt>
          <dd class="min-w-0">
            <input
              id="particule-permalink"
              v-model.trim="fields.permalink"
              autocomplete="off"
              spellcheck="false"
              placeholder="genere-depuis-le-titre"
              :aria-invalid="permalinkError ? true : undefined"
              class="h-8 w-full rounded-md bg-transparent px-2 font-mono text-[0.8rem] outline-none placeholder:text-muted-foreground/60 hover:bg-accent focus:bg-accent aria-invalid:text-destructive"
              @input="onPermalinkInput"
            />
          </dd>
          <template v-if="permalinkError || permalinkFollowsTitle">
            <dd class="col-start-2 px-2 text-xs" :class="permalinkError ? 'text-destructive' : 'text-muted-foreground'">
              {{ permalinkError ?? 'Suit le titre jusqu’à la création, puis ne change plus.' }}
            </dd>
          </template>

          <dt class="text-muted-foreground"><label for="particule-origins">Origines</label></dt>
          <dd class="min-w-0">
            <input
              id="particule-origins"
              v-model="fields.origins"
              autocomplete="off"
              placeholder="Ex. Cours de thermodynamique"
              class="h-8 w-full rounded-md bg-transparent px-2 outline-none placeholder:text-muted-foreground/60 hover:bg-accent focus:bg-accent"
            />
          </dd>

          <dt class="text-muted-foreground">Source</dt>
          <dd class="min-w-0">
            <SourcePicker v-model="fields.source_id" />
          </dd>
        </dl>

        <hr />

        <MarkdownEditor
          ref="contentEditor"
          v-model="fields.content"
          placeholder="Écrivez en Markdown…"
        />
      </div>
    </div>

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ fields.title || 'Sans titre' }} » ?</AlertDialogTitle>
          <AlertDialogDescription>Cette particule sera supprimée définitivement.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            @click="onDelete"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </article>
</template>
