<script setup lang="ts">
import { useId } from 'vue'

// Same drawing as public/favicon.svg, in currentColor so it follows the app theme
const maskId = `orbit-gap-${useId()}`
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <defs>
      <mask :id="maskId">
        <rect width="32" height="32" fill="white" />
        <circle cx="24.5" cy="7.5" r="6" fill="black" />
      </mask>
    </defs>
    <circle
      cx="16"
      cy="16"
      r="12"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      :mask="`url(#${maskId})`"
    />
    <circle cx="16" cy="16" r="5" />
    <circle cx="24.5" cy="7.5" r="3.75" />
  </svg>
</template>
