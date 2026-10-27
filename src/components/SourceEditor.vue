<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  Trash2,
  TriangleAlert,
} from '@lucide/vue'

import ApaReference from '@/components/ApaReference.vue'
import ContributorsField from '@/components/ContributorsField.vue'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Source, SourceFields } from '@/api/sources'
import { ApiError } from '@/api/client'
import {
  ACADEMIC_TYPES,
  CONTAINER_TITLE_LABEL,
  FIELDS_BY_TYPE,
  REQUIRED_BY_TYPE,
  changedFields,
  emptySourceForm,
  formFromSource,
  isAcademic,
  payloadFromForm,
  sourceFormSchema,
  type OptionalField,
  type SourceFormValues,
} from '@/lib/sourceForm'
import { useSourcesStore } from '@/stores/sources'

const SAVE_DELAY_MS = 1000

const props = defineProps<{
  /** null opens a new source, created on the server once the form is valid */
  source: Source | null
  /** Back to the list, on mobile where only one pane shows */
  showBack?: boolean
  /** Opened from a particule: no deletion, and a link to the sources page */
  embedded?: boolean
  /** Prefills a new source, e.g. a DOI import that lacks a required field */
  initial?: SourceFields | null
}>()

const emit = defineEmits<{
  created: [source: Source]
  /** Delete confirmed; null discards a new source. The parent deletes, as for particules */
  delete: [source: Source | null]
}>()

const sources = useSourcesStore()

const { values, validate, setFieldValue } = useForm<SourceFormValues>({
  validationSchema: toTypedSchema(sourceFormSchema),
  initialValues: props.source
    ? formFromSource(props.source)
    : props.initial
      ? formFromSource(props.initial)
      : emptySourceForm(),
  // Fields hidden by a type change keep their value: switching back restores them, and the
  // schema still sees every key
  keepValuesOnUnmount: true,
})

/** Last version the server confirmed; null while the source is new */
let saved: Source | null = props.source

const academic = computed(() => isAcademic(values.type))

/**
 * The reference comes first; its details unfold to fix them. They start open when there is
 * something to fill in: a new source typed by hand, or one the form doesn't accept.
 */
const detailsOpen = ref(
  !props.source || !sourceFormSchema.safeParse(formFromSource(props.source)).success,
)

const visible = computed(() => new Set<OptionalField>(FIELDS_BY_TYPE[values.type]))
const required = computed(() => new Set<OptionalField>(REQUIRED_BY_TYPE[values.type]))

// A full date sets the year, as the server does
const yearFromDate = computed(() => Boolean(values.published_date))
watch(
  () => values.published_date,
  (date) => {
    if (date) setFieldValue('year', date.slice(0, 4))
  },
)

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error'
const status = ref<SaveStatus>(props.source ? 'saved' : 'idle')
const serverError = ref<string | null>(null)

async function save() {
  // Silent: errors show under the fields the user touched, not all at once
  const { valid } = await validate({ mode: 'silent' })
  if (!valid) {
    status.value = 'invalid'
    // The missing field may sit in the folded details
    detailsOpen.value = true
    return
  }
  const payload = payloadFromForm(values)
  serverError.value = null
  try {
    if (!saved) {
      status.value = 'saving'
      saved = await sources.create(payload)
      status.value = 'saved'
      emit('created', saved)
      return
    }
    const patch = changedFields(saved, payload)
    if (!Object.keys(patch).length) {
      status.value = 'saved'
      return
    }
    status.value = 'saving'
    saved = await sources.update(saved.id, patch)
    status.value = 'saved'
  } catch (error) {
    status.value = 'error'
    if (error instanceof ApiError && error.status === 422) {
      serverError.value = 'Le serveur a refusé cette source : vérifiez les champs requis.'
    }
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
  inFlight = save().finally(() => {
    inFlight = null
    if (saveAgain) {
      saveAgain = false
      void flush()
    }
  })
  return inFlight
}

const scheduleSave = useDebounceFn(flush, SAVE_DELAY_MS)

watch(
  values,
  () => {
    status.value = 'pending'
    void scheduleSave()
  },
  { deep: true },
)

const hasUnsavedChanges = computed(() => ['pending', 'saving', 'error'].includes(status.value))

// Leaving the source (another one, another page, closing the sheet) saves right away
onBeforeUnmount(() => {
  if (status.value === 'pending' || status.value === 'error') void flush()
})
useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) event.preventDefault()
})

const titleInput = useTemplateRef<{ $el: HTMLInputElement }>('titleInput')
onMounted(() => {
  if (!props.source) titleInput.value?.$el.focus()
})

/** Live preview: what would be saved now */
const preview = computed(() => payloadFromForm(values))

const deleteOpen = ref(false)

async function onDelete() {
  // Let a save in progress land first, so it can't arrive after the deletion
  await inFlight
  gone = true
  emit('delete', saved)
}

const TEXT_FIELDS: {
  name: Exclude<OptionalField, 'editors' | 'accessed_date'>
  label: string
  placeholder?: string
}[] = [
  { name: 'container_title', label: '' },
  { name: 'volume', label: 'Volume', placeholder: 'Ex. 20' },
  { name: 'issue', label: 'Numéro', placeholder: 'Ex. 2' },
  { name: 'pages', label: 'Pages', placeholder: 'Ex. 367-387' },
  { name: 'edition', label: 'Édition', placeholder: 'Ex. 2' },
  { name: 'publisher', label: 'Éditeur', placeholder: 'Ex. Addison-Wesley' },
  { name: 'doi', label: 'DOI', placeholder: 'Ex. 10.1103/RevModPhys.20.367' },
  { name: 'url', label: 'URL', placeholder: 'https://…' },
]
const textFields = computed(() => TEXT_FIELDS.filter((field) => visible.value.has(field.name)))
// Bound from the script: a literal `//` in the template trips vue-tsc's slot scoping
const URL_PLACEHOLDER = 'https://…'
</script>

<template>
  <article class="flex h-full flex-col">
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <Button v-if="showBack" variant="ghost" size="icon" class="-ml-2" as-child>
        <RouterLink :to="{ name: 'sources' }" aria-label="Retour à la liste">
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
        <template v-else-if="status === 'invalid'">
          <TriangleAlert class="size-3.5" />
          Champs requis manquants
        </template>
        <template v-else-if="status === 'error'">
          <TriangleAlert class="size-3.5 text-destructive" />
          <span class="text-destructive">Échec de l’enregistrement</span>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" @click="flush">
            Réessayer
          </Button>
        </template>
        <template v-else-if="!saved">Nouvelle source</template>
      </p>

      <Button v-if="embedded && saved" variant="ghost" size="sm" as-child>
        <RouterLink :to="{ name: 'sources', params: { sourceId: saved.id } }">
          <ExternalLink />
          Ouvrir dans Sources
        </RouterLink>
      </Button>

      <DropdownMenu v-if="!embedded">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" aria-label="Actions sur la source">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            @select="saved ? (deleteOpen = true) : onDelete()"
          >
            <Trash2 />
            {{ saved ? 'Supprimer' : 'Abandonner la source' }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div class="flex-1 overflow-y-auto">
      <form
        class="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8"
        novalidate
        @submit.prevent="flush"
      >
        <p v-if="serverError" role="alert" class="text-sm text-destructive">{{ serverError }}</p>

        <template v-if="academic">
          <ApaReference :source="preview" />

          <Collapsible v-model:open="detailsOpen" class="flex flex-col gap-5">
            <CollapsibleTrigger as-child>
              <Button variant="ghost" class="-ml-3 w-fit">
                <ChevronRight
                  class="transition-transform motion-reduce:transition-none"
                  :class="detailsOpen && 'rotate-90'"
                />
                Corriger les informations
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent class="flex flex-col gap-5">
              <FormField v-slot="{ componentField }" name="type">
                <FormItem>
                  <FormLabel>Type de source</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem v-for="type in ACADEMIC_TYPES" :key="type.value" :value="type.value">
                        {{ type.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="title">
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input
                      ref="titleInput"
                      autocomplete="off"
                      aria-required="true"
                      v-bind="componentField"
                    />
                  </FormControl>
                  <FormDescription>
                    Tel qu’il doit apparaître : en APA, seule la première lettre du titre et des noms
                    propres prend une majuscule. Les titres importés d’un DOI suivent souvent
                    l’usage de l’éditeur : corrigez-les au besoin.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>

              <ContributorsField name="authors" legend="Auteurs" add-label="Ajouter un auteur" />

              <ContributorsField
                v-if="visible.has('editors')"
                name="editors"
                legend="Directeurs de l’ouvrage"
                add-label="Ajouter un directeur"
              />

              <div class="grid gap-4 sm:grid-cols-2">
                <FormField v-slot="{ componentField }" name="published_date">
                  <FormItem>
                    <FormLabel>Date de publication</FormLabel>
                    <FormControl>
                      <Input type="date" v-bind="componentField" />
                    </FormControl>
                    <FormDescription>Facultative si l’année suffit.</FormDescription>
                    <FormMessage />
                  </FormItem>
                </FormField>

                <FormField v-slot="{ componentField }" name="year">
                  <FormItem>
                    <FormLabel>Année</FormLabel>
                    <FormControl>
                      <Input
                        inputmode="numeric"
                        autocomplete="off"
                        placeholder="s. d."
                        :readonly="yearFromDate"
                        v-bind="componentField"
                      />
                    </FormControl>
                    <FormDescription>
                      {{
                        yearFromDate
                          ? 'Tirée de la date de publication.'
                          : 'Vide pour une source sans date.'
                      }}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <FormField
                  v-for="field in textFields"
                  :key="field.name"
                  v-slot="{ componentField }"
                  :name="field.name"
                >
                  <FormItem
                    :class="
                      ['container_title', 'url', 'doi', 'publisher'].includes(field.name) &&
                      'sm:col-span-2'
                    "
                  >
                    <FormLabel>
                      {{
                        field.name === 'container_title'
                          ? CONTAINER_TITLE_LABEL[values.type]
                          : field.label
                      }}
                    </FormLabel>
                    <FormControl>
                      <Input
                        :type="field.name === 'url' ? 'url' : 'text'"
                        autocomplete="off"
                        :placeholder="field.placeholder"
                        :aria-required="required.has(field.name) ? 'true' : undefined"
                        v-bind="componentField"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>

                <FormField
                  v-if="visible.has('accessed_date')"
                  v-slot="{ componentField }"
                  name="accessed_date"
                >
                  <FormItem>
                    <FormLabel>Date de consultation</FormLabel>
                    <FormControl>
                      <Input type="date" v-bind="componentField" />
                    </FormControl>
                    <FormDescription>Pour une page dont le contenu change dans le temps.</FormDescription>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </template>

        <template v-else>
          <FormField v-slot="{ componentField }" name="title">
            <FormItem>
              <FormLabel>Titre</FormLabel>
              <FormControl>
                <Input
                  ref="titleInput"
                  autocomplete="off"
                  aria-required="true"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="url">
            <FormItem>
              <FormLabel>Lien</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  autocomplete="off"
                  :placeholder="URL_PLACEHOLDER"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <FormField v-slot="{ componentField }" name="note">
          <FormItem>
            <FormLabel>Note</FormLabel>
            <FormControl>
              <textarea
                rows="4"
                placeholder="Pourquoi cette source compte pour vous"
                class="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                v-bind="componentField"
              />
            </FormControl>
            <FormDescription>Vos propres mots sur cette source.</FormDescription>
          </FormItem>
        </FormField>
      </form>
    </div>

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {{ values.title || 'Sans titre' }} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les particules qui citent cette source seront conservées, sans source.
          </AlertDialogDescription>
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
