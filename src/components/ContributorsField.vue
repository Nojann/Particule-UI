<script setup lang="ts">
import { useFieldArray, useFieldError } from 'vee-validate'
import { ArrowDown, ArrowUp, Plus, X } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { emptyContributor, type Contributor } from '@/lib/contributors'

const props = defineProps<{
  /** Form path: `authors` or `editors` */
  name: 'authors' | 'editors'
  legend: string
  addLabel: string
}>()

const { fields, push, remove, move } = useFieldArray<Contributor>(() => props.name)
const listError = useFieldError(() => props.name)
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-sm font-medium">{{ legend }}</legend>

    <ol class="flex flex-col gap-3">
      <li
        v-for="(field, index) in fields"
        :key="field.key"
        class="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-2 sm:grid-cols-[8.5rem_1fr_1fr_auto]"
      >
        <FormField v-slot="{ componentField }" :name="`${name}[${index}].kind`">
          <FormItem class="col-span-2 sm:col-span-1">
            <FormLabel class="sr-only">Nature</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="person">Personne</SelectItem>
                <SelectItem value="group">Groupe</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" :name="`${name}[${index}].family`">
          <FormItem
            :class="
              field.value.kind === 'group' ? 'col-span-2 sm:col-span-2' : 'col-span-2 sm:col-span-1'
            "
          >
            <FormLabel class="sr-only">
              {{ field.value.kind === 'group' ? 'Nom du groupe' : 'Nom' }}
            </FormLabel>
            <FormControl>
              <Input
                autocomplete="off"
                :placeholder="field.value.kind === 'group' ? 'Nom du groupe' : 'Nom'"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField
          v-if="field.value.kind === 'person'"
          v-slot="{ componentField }"
          :name="`${name}[${index}].given`"
        >
          <FormItem class="col-span-2 sm:col-span-1">
            <FormLabel class="sr-only">Prénoms</FormLabel>
            <FormControl>
              <Input autocomplete="off" placeholder="Prénoms" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div
          class="col-span-2 flex items-start justify-end gap-0.5 sm:col-span-1 sm:col-start-4 sm:row-start-1"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Monter"
            :disabled="index === 0"
            @click="move(index, index - 1)"
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Descendre"
            :disabled="index === fields.length - 1"
            @click="move(index, index + 1)"
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Retirer"
            @click="remove(index)"
          >
            <X />
          </Button>
        </div>
      </li>
    </ol>

    <p v-if="listError" class="text-sm text-destructive">{{ listError }}</p>

    <Button
      type="button"
      variant="outline"
      size="sm"
      class="self-start"
      @click="push(emptyContributor())"
    >
      <Plus />
      {{ addLabel }}
    </Button>
    <p class="text-xs text-muted-foreground">
      Dans l’ordre de la source. Une personne s’écrit nom et prénoms, un groupe (organisation,
      institution) sous son nom complet.
    </p>
  </fieldset>
</template>
