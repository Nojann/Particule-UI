<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <section class="flex flex-col items-start gap-4">
    <h1 class="font-heading text-3xl font-bold tracking-tight">Particule</h1>
    <p class="max-w-prose text-muted-foreground">
      Organisez vos connaissances en particules, reliées entre elles par des tags, des liens et
      des sources.
    </p>
    <div class="flex gap-2">
      <Button>Commencer</Button>
      <Button variant="outline">En savoir plus</Button>
    </div>
  </section>
</template>
