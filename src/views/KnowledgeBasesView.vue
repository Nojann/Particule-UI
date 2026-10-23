<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Database, Plus } from '@lucide/vue'

import CreateKnowledgeBaseDialog from '@/components/CreateKnowledgeBaseDialog.vue'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useKnowledgeBasesStore } from '@/stores/knowledgeBases'

const knowledgeBases = useKnowledgeBasesStore()
const createOpen = ref(false)

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
</script>

<template>
  <div v-if="!knowledgeBases.loaded" />

  <!-- First launch: nothing in the sidebar yet, so the page carries the call to action -->
  <section
    v-else-if="knowledgeBases.items.length === 0"
    class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
  >
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <Database class="size-6 text-muted-foreground" />
    </div>
    <h1 class="font-heading text-2xl font-semibold">Aucune base de connaissances</h1>
    <p class="text-muted-foreground">
      Une base regroupe les particules d'un même sujet. Créez la première pour commencer.
    </p>
    <Button @click="createOpen = true">
      <Plus />
      Créer une base
    </Button>
  </section>

  <section v-else class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-4">
      <h1 class="font-heading text-2xl font-semibold">Vos bases</h1>
      <Button size="sm" @click="createOpen = true">
        <Plus />
        Nouvelle base
      </Button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="kb in knowledgeBases.items"
        :key="kb.id"
        :to="{ name: 'knowledge-base', params: { kbId: kb.id } }"
        class="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card class="h-full transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Database class="size-4 text-muted-foreground" />
              <span class="truncate">{{ kb.name }}</span>
            </CardTitle>
            <CardDescription>
              Créée le {{ dateFormat.format(new Date(kb.created_at)) }}
            </CardDescription>
          </CardHeader>
        </Card>
      </RouterLink>
    </div>
  </section>

  <CreateKnowledgeBaseDialog v-model:open="createOpen" />
</template>
