---
name: shadcn-vue
description: Add, customize, theme and compose shadcn-vue components (Reka UI + Tailwind CSS v4) in the Particule-UI Vue 3 + Vite project. Use this skill whenever the user wants to add a UI component (button, dialog, form, table, dropdown, sidebar, toast…), build a page or layout from shadcn-vue blocks, change colors/fonts/radius/dark mode, create a custom variant, or fix anything involving components.json, src/components/ui, `cn`, Reka UI or Tailwind in this repo — even if they don't say "shadcn" explicitly (e.g. "ajoute une modale", "fais un formulaire de login", "change le thème").
---

# shadcn-vue in Particule-UI

shadcn-vue is not a dependency you import from: its CLI **copies component source into the repo**, and from then on the code is ours. Components are built on **Reka UI** (headless, accessible primitives) and styled with **Tailwind CSS v4** utility classes and CSS variables.

## Project facts (check before assuming)

| Thing | Where / value |
|---|---|
| CLI config | `components.json` (style `new-york`, base color `taupe`, font `oxanium`, icons `lucide`, CSS variables on) |
| Generated components | `src/components/ui/<name>/` (alias `@/components/ui`) |
| `cn()` helper | `src/lib/utils.ts` → re-exports `cn` from the `cn` package (replaces clsx + tailwind-merge) |
| Tailwind entry + theme tokens | `src/style.css` (Tailwind v4 CSS-first: **no `tailwind.config.js`**) |
| Vite plugin | `@tailwindcss/vite` in `vite.config.ts` |
| Icons | `@lucide/vue` |
| Path alias | `@/*` → `src/*` (in `vite.config.ts` and `tsconfig.json`) |

Read `components.json` and `src/style.css` when the task touches styling — the values above can change.

**Known setup gaps:**
- `src/main.ts` must contain `import './style.css'`, otherwise no Tailwind/theme styles apply.
- The CLI does not write color tokens for base color `taupe` (it reports "Updating CSS variables" but writes nothing). The `:root` / `.dark` variables and their `@theme inline` mapping in `src/style.css` were added by hand (shadcn "stone" palette). Don't expect `init`/`add` to maintain them; if they disappear, `@apply border-border` breaks the build.
- shadcn components have single-word names (`Button`, `Dialog`…); `eslint.config.ts` turns off `vue/multi-word-component-names` for `src/components/ui/**` only. Components written in `src/components/` still need multi-word names.

## Adding components

```sh
npx shadcn-vue@latest add button dialog   # one or several
npx shadcn-vue@latest add                 # interactive list
```

The CLI writes files under `src/components/ui/` and installs their npm dependencies (e.g. `reka-ui`, `@vueuse/core`, `vee-validate`). Then import them from the folder's `index.ts`:

```vue
<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
</script>
```

Prefer the CLI over hand-writing a component that exists in the registry: the generated code already handles accessibility, focus, keyboard and `data-slot` attributes.

### After every CLI run — check package.json

The CLI's npm install has broken this repo before. Run `git diff package.json` and confirm:

- `@vue/eslint-config-typescript` is still `^14.9.0`. Version 14.0.1 only accepts ESLint 9, the repo uses ESLint 10 → `ERESOLVE` on every install. If it was reverted, put `^14.9.0` back and re-run `npm install`.
- Nothing unexpected was removed.

If the CLI's install fails with `ERESOLVE`, the component files may be written but the dependencies missing. Fix the conflict, then install the deps it listed. **Never** use `--force` or `--legacy-peer-deps`, and never `npm audit fix --force` (it downgrades the ESLint config back to 14.0.1). The remaining `braces` audit warnings are dev-tooling only.

## Customizing components

Because we own the code, customize in this order — least invasive first:

1. **Per usage:** pass `class` — every component merges it with `cn()`, so later Tailwind classes win: `<Button class="w-full rounded-full">`.
2. **New variant:** edit the `cva(...)` definition in `src/components/ui/<name>/index.ts` (add to `variants.variant` / `variants.size`). Its `VariantProps` type updates automatically.
3. **Wrapper component:** for a project-specific component (e.g. `AppSubmitButton`), create it in `src/components/` (not in `ui/`) and compose the ui primitives.
4. **Edit the generated `.vue` file** only when behavior must change. Note it: re-running `add <name> --overwrite` would erase the change.

Patterns to preserve when editing or writing components in the same style:

```vue
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogContent, type DialogContentEmits, type DialogContentProps, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()
const delegated = reactiveOmit(props, 'class')          // don't forward `class` twice
const forwarded = useForwardPropsEmits(delegated, emits) // forward everything else to Reka
</script>

<template>
  <DialogContent data-slot="dialog-content" v-bind="forwarded" :class="cn('base classes…', props.class)">
    <slot />
  </DialogContent>
</template>
```

- Accept `class?: HTMLAttributes['class']` and merge with `cn(..., props.class)`.
- Forward props/emits to the Reka primitive (`useForwardProps` / `useForwardPropsEmits`).
- Keep `data-slot` attributes — styles and parents target them.
- Use `as-child` to render a ui trigger as another element/component (e.g. `<DialogTrigger as-child><Button>…</Button></DialogTrigger>`) instead of nesting buttons.

## Theming

All colors are CSS variables in `src/style.css`, used through Tailwind tokens (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, `ring-ring`…).

- Change a color: edit the variable in `:root` **and** in `.dark`. Keep the existing color format (usually `oklch(...)`).
- New token: declare `--my-token` in `:root`/`.dark`, then map it in `@theme inline { --color-my-token: var(--my-token); }` → usable as `bg-my-token`.
- Radius: `--radius`. Font: `--font-sans` / `--font-heading`.
- Dark mode is class-based (`@custom-variant dark (&:is(.dark *))`): toggle `.dark` on `<html>`, e.g. with `useColorMode()` from `@vueuse/core`.
- Use semantic tokens in app code rather than raw palette colors (`bg-primary`, not `bg-blue-600`) so themes and dark mode keep working.

## Forms

shadcn-vue forms use **vee-validate + zod** (`npx shadcn-vue@latest add form`, plus `zod` and `@vee-validate/zod` if missing). Define the schema with `toTypedSchema(z.object({...}))`, wrap fields in `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormMessage`. Check the generated `src/components/ui/form/` for the exact API before writing usage code.

## Verify before finishing

```sh
npm run type-check
npm run lint
npm run test:unit -- --run
npm run build
```

If a change touches `App.vue`, `src/__tests__/App.spec.ts` may assert on its content — update it. For visual changes, run `npm run dev` and look at the page.

## Reference

Component APIs and examples: https://www.shadcn-vue.com/docs/components — fetch the specific component page when unsure of its sub-components or props, rather than guessing from the React shadcn/ui docs (names and APIs differ in places).
