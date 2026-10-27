<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { FileText, GraduationCap, LoaderCircle, Search } from '@lucide/vue'

import ApaReference from '@/components/ApaReference.vue'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Source, SourceFields } from '@/api/sources'
import { DoiError, type DoiErrorReason } from '@/api/doi'
import { extractDoi } from '@/lib/doi'
import { emptySourceForm, formFromSource, payloadFromForm, sourceFormSchema } from '@/lib/sourceForm'
import { cn } from '@/lib/utils'
import { useSourcesStore } from '@/stores/sources'

const props = defineProps<{
  /** Opened from a particule: the source is cited once added */
  cite?: boolean
  /** Looked up right away, e.g. a DOI typed in the picker's search */
  initialDoi?: string
}>()

const emit = defineEmits<{
  /** A new source, saved on the server */
  created: [source: Source]
  /** The DOI belongs to a source the user already has */
  existing: [source: Source]
}>()

const sources = useSourcesStore()
const router = useRouter()

type Mode = 'academic' | 'other'
const mode = ref<Mode>('academic')
const MODES: { value: Mode; label: string; icon: typeof GraduationCap }[] = [
  { value: 'academic', label: 'Académique', icon: GraduationCap },
  { value: 'other', label: 'Autre', icon: FileText },
]

// Radio group: arrow keys move the choice, as with native radios
const modeButtons = useTemplateRef<HTMLButtonElement[]>('modeButtons')
function onModeKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  mode.value = mode.value === 'academic' ? 'other' : 'academic'
  void nextTick(() => modeButtons.value?.[mode.value === 'academic' ? 0 : 1]?.focus())
}

// Académique: one field, looked up on paste or Enter

const doiInput = ref(props.initialDoi ?? '')
const doiField = useTemplateRef<{ $el: HTMLInputElement }>('doiField')

type Lookup =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'found'; fields: SourceFields }
  | { state: 'error'; reason: DoiErrorReason }
const lookup = ref<Lookup>({ state: 'idle' })

const LOOKUP_ERRORS: Record<DoiErrorReason, string> = {
  invalid: 'Ce n’est pas un DOI valide.',
  not_found: 'Ce DOI est introuvable.',
  unreachable: 'Impossible de joindre doi.org, réessayez plus tard.',
}

/** Ignores the answer of a lookup the user has since replaced */
let lookupId = 0

async function runLookup() {
  const doi = extractDoi(doiInput.value)
  const id = ++lookupId
  if (!doi) {
    lookup.value = { state: 'error', reason: 'invalid' }
    return
  }
  lookup.value = { state: 'loading' }
  try {
    const fields = await sources.lookupDoi(doi)
    if (id === lookupId) lookup.value = { state: 'found', fields }
  } catch (error) {
    if (id !== lookupId) return
    lookup.value = {
      state: 'error',
      reason: error instanceof DoiError ? error.reason : 'unreachable',
    }
  }
}

function onDoiPaste() {
  // The pasted text lands in the model on the next tick
  void nextTick(runLookup)
}

const found = computed(() => (lookup.value.state === 'found' ? lookup.value.fields : null))
const existing = computed(() => (found.value?.doi ? sources.findByDoi(found.value.doi) : undefined))
/** Publishers' metadata may lack what the type needs, e.g. authors */
const complete = computed(
  () => !!found.value && sourceFormSchema.safeParse(formFromSource(found.value)).success,
)

const adding = ref(false)
const addError = ref(false)

async function add(fields: SourceFields) {
  adding.value = true
  addError.value = false
  try {
    emit('created', await sources.create(fields))
  } catch {
    addError.value = true
  } finally {
    adding.value = false
  }
}

/** The full form, on the sources page, prefilled with what the DOI gave if anything */
function openManual(fields: SourceFields | null = null) {
  sources.draft = fields
  void router.push({ name: 'sources', query: { new: null, manual: null } })
}

// Autre: title, link, note

const otherSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis.').max(1024, '1024 caractères maximum.'),
  url: z
    .string()
    .trim()
    .max(2048, '2048 caractères maximum.')
    .refine((value) => !value || URL.canParse(value), 'Adresse invalide.'),
  note: z.string(),
})

const otherForm = useForm({
  validationSchema: toTypedSchema(otherSchema),
  initialValues: { title: '', url: '', note: '' },
})

/** A DOI pasted where it doesn't belong: offer to import it instead */
const strayDoi = computed(
  () => extractDoi(otherForm.values.url ?? '') ?? extractDoi(otherForm.values.title ?? ''),
)

function importStrayDoi() {
  doiInput.value = strayDoi.value!
  mode.value = 'academic'
  void runLookup()
}

const submitOther = otherForm.handleSubmit((values) =>
  add(payloadFromForm({ ...emptySourceForm('other'), ...values })),
)

const otherTitle = useTemplateRef<{ $el: HTMLInputElement }>('otherTitle')
watch(mode, (value) => {
  addError.value = false
  void nextTick(() => (value === 'academic' ? doiField : otherTitle).value?.$el.focus())
})

onMounted(() => {
  doiField.value?.$el.focus()
  if (props.initialDoi) void runLookup()
})
// Bound from the script: a literal `//` in the template trips vue-tsc's slot scoping
const URL_PLACEHOLDER = 'https://…'
</script>

<template>
  <div class="flex flex-col gap-5">
    <div
      role="radiogroup"
      aria-label="Type de source"
      class="inline-flex w-fit gap-1 rounded-lg bg-muted p-1"
      @keydown="onModeKey"
    >
      <button
        v-for="option in MODES"
        ref="modeButtons"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="mode === option.value"
        :tabindex="mode === option.value ? 0 : -1"
        :class="
          cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mode === option.value && 'bg-background text-foreground shadow-sm',
          )
        "
        @click="mode = option.value"
      >
        <component :is="option.icon" class="size-4" />
        {{ option.label }}
      </button>
    </div>

    <template v-if="mode === 'academic'">
      <form class="flex flex-col gap-2" novalidate @submit.prevent="runLookup">
        <label for="quick-add-doi" class="text-sm font-medium">DOI ou lien doi.org</label>
        <div class="flex gap-2">
          <Input
            id="quick-add-doi"
            ref="doiField"
            v-model="doiInput"
            autocomplete="off"
            spellcheck="false"
            placeholder="Ex. 10.1103/RevModPhys.20.367"
            :aria-invalid="lookup.state === 'error' ? 'true' : undefined"
            aria-describedby="quick-add-doi-status"
            @paste="onDoiPaste"
          />
          <Button type="submit" variant="outline" :disabled="lookup.state === 'loading'">
            <LoaderCircle v-if="lookup.state === 'loading'" class="animate-spin" />
            <Search v-else />
            Rechercher
          </Button>
        </div>
      </form>

      <div id="quick-add-doi-status" aria-live="polite" class="flex flex-col gap-3">
        <div v-if="lookup.state === 'loading'" class="flex flex-col gap-2 rounded-lg border p-4">
          <span class="sr-only">Recherche du DOI…</span>
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-2/3" />
        </div>

        <template v-else-if="lookup.state === 'error'">
          <p role="alert" class="text-sm text-destructive">{{ LOOKUP_ERRORS[lookup.reason] }}</p>
        </template>

        <template v-else-if="found">
          <ApaReference :source="found" />

          <template v-if="existing">
            <p class="text-sm">Cette source existe déjà.</p>
            <Button class="w-fit" @click="emit('existing', existing)">
              {{ cite ? 'Citer cette source' : 'Ouvrir cette source' }}
            </Button>
          </template>
          <template v-else-if="complete">
            <Button class="w-fit" :disabled="adding" @click="add(found)">
              <LoaderCircle v-if="adding" class="animate-spin" />
              {{ cite ? 'Ajouter et citer' : 'Ajouter' }}
            </Button>
          </template>
          <template v-else>
            <p class="text-sm">
              Il manque des informations à cette référence, comme les auteurs : complétez-la
              avant de l’ajouter.
            </p>
            <Button class="w-fit" @click="openManual(found)">Compléter la référence</Button>
          </template>
        </template>
      </div>

      <Button
        v-if="lookup.state !== 'found'"
        variant="link"
        class="h-auto w-fit p-0 text-sm"
        @click="openManual()"
      >
        Saisir la référence à la main
      </Button>
    </template>

    <form v-else class="flex flex-col gap-4" novalidate @submit="submitOther">
      <FormField v-slot="{ componentField }" name="title">
        <FormItem>
          <FormLabel>Titre</FormLabel>
          <FormControl>
            <Input
              ref="otherTitle"
              autocomplete="off"
              aria-required="true"
              placeholder="Ex. Conférence de Richard Feynman sur la mesure"
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

      <p v-if="strayDoi" class="flex flex-wrap items-center gap-x-2 text-sm">
        Vous avez saisi un DOI.
        <Button type="button" variant="link" class="h-auto p-0" @click="importStrayDoi">
          Importer le DOI {{ strayDoi }}
        </Button>
      </p>

      <FormField v-slot="{ componentField }" name="note">
        <FormItem>
          <FormLabel>Note</FormLabel>
          <FormControl>
            <textarea
              rows="3"
              placeholder="Pourquoi cette source compte pour vous"
              class="min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              v-bind="componentField"
            />
          </FormControl>
        </FormItem>
      </FormField>

      <Button type="submit" class="w-fit" :disabled="adding">
        <LoaderCircle v-if="adding" class="animate-spin" />
        {{ cite ? 'Ajouter et citer' : 'Ajouter' }}
      </Button>
    </form>

    <p v-if="addError" role="alert" class="text-sm text-destructive">
      L’ajout de la source a échoué, réessayez.
    </p>
  </div>
</template>
