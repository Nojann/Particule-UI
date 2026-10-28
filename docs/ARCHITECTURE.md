# Architecture

Particule-UI is the web front end of **Particule**, a note-taking app organised in
*knowledge bases* that hold *particules*: short Markdown notes with a title, a
permalink, free-text origins and an optional bibliographic source.

It is a single-page app with no server of its own. Everything it shows
comes from the Particule REST API (FastAPI), documented in
[`specs/api.md`](../specs/api.md).

## Stack

| Concern         | Choice                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Framework       | Vue 3 (`<script setup>`, Composition API), TypeScript                   |
| Build / dev     | Vite, with the `@` alias pointing at `src/`                             |
| Routing         | vue-router (HTML5 history)                                              |
| State           | Pinia, setup-style stores                                               |
| UI kit          | shadcn-vue (Reka UI + Tailwind CSS v4), vendored in `src/components/ui` |
| Icons           | `@lucide/vue`                                                           |
| Forms           | vee-validate + zod                                                      |
| Markdown editor | CodeMirror 6 with a custom live-preview extension                       |
| Utilities       | `@vueuse/core` (localStorage, media queries, color mode, debounce…)     |
| Tests           | Vitest + jsdom (unit), Playwright (e2e)                                 |
| Lint / format   | oxlint, ESLint, Prettier                                                |

## Layers

```
 views/  layouts/  components/          ← presentation (Vue SFCs)
            │
            ▼
         stores/                         ← app state + business rules (Pinia)
            │
            ▼
          api/                           ← typed HTTP functions, one file per resource
            │
            ▼
       api/client.ts → fetch → Particule API (VITE_API_URL)
```

Dependencies only point downward: components read and mutate stores, stores call
`api/`, and only `api/client.ts` touches `fetch`. Components do not call `api/`
directly; they only import its *types* (`Particule`, `KnowledgeBase`…) and
`ApiError` to tell error cases apart.

## Directory layout

```
src/
├── main.ts              App bootstrap: Pinia, router, global CSS
├── App.vue              Picks the layout shell from route.meta.layout
├── style.css            Tailwind v4 entry, theme tokens (light/dark), base styles
├── api/                 HTTP layer
│   ├── client.ts        request<T>() + ApiError, paginated listAll()
│   ├── auth.ts          login, signup, getMe
│   ├── knowledgeBases.ts
│   ├── particules.ts
│   ├── sources.ts
│   └── doi.ts           DOI metadata from doi.org (the only third-party call)
├── stores/              Pinia stores
│   ├── auth.ts          token (localStorage) + current user
│   ├── knowledgeBases.ts
│   ├── particules.ts    particules of the open knowledge base
│   ├── sources.ts       the user's bibliographic sources
│   └── counter.ts       scaffold leftover, unused
├── router/index.ts      routes, auth guards, document titles
├── layouts/             PublicLayout, AuthLayout
├── views/               one component per route
├── components/          app components
│   └── ui/              shadcn-vue components (generated, see components.json)
└── lib/
    ├── slug.ts          slugify, PERMALINK_PATTERN, excerpt
    ├── markdownLivePreview.ts   CodeMirror extension
    ├── contributors.ts  authors/editors ↔ the API's free text, in-text labels
    ├── sourceForm.ts    source types, form schema, payload, diff, toCsl()
    ├── doi.ts           normalise, detect and extract DOIs
    ├── cslImport.ts     CSL-JSON (doi.org) → source fields
    ├── citation.ts      APA through citation-js, lazy-loaded
    └── utils.ts         cn() class merger
e2e/                     Playwright tests
specs/api.md             pointer to the API documentation
```

Unit tests live next to their code, in `__tests__/` folders.

## Bootstrapping and layouts

`main.ts` installs Pinia and the router, then mounts `App.vue`. `App.vue` contains
no page chrome itself. It wraps the matched route in one of three shells, chosen by
`route.meta.layout`:

| `layout`             | Shell                                    | Used by                       |
| -------------------- | ---------------------------------------- | ----------------------------- |
| `public` (default)   | `PublicLayout`: header, footer           | `/`, `/about`                 |
| `auth`               | `AuthLayout`: centred card               | `/login`, `/signup`           |
| `app`                | none; the route renders its own shell    | `/app/**`                     |

The `<Transition>` is keyed on the layout, so the fade plays only when switching
shells, not between pages within the same shell.

## Routing

Defined in `src/router/index.ts`. Every view is lazy-loaded.

| Path                      | Name               | Component                                    | Meta                       |
| ------------------------- | ------------------ | -------------------------------------------- | -------------------------- |
| `/`                       | `home`             | `HomeView`                                   | `guestOnly`                |
| `/about`                  | `about`            | `HomeView`                                   | reachable signed in        |
| `/login`                  | `login`            | `LoginView`                                  | `guestOnly`, `auth` layout |
| `/signup`                 | `signup`           | `SignupView`                                 | `guestOnly`, `auth` layout |
| `/app`                    | –                  | `KnowledgeBaseLayout` (parent)               | `requiresAuth`, `app`      |
| `/app/`                   | `knowledge-bases`  | `KnowledgeBasesView`                         |                            |
| `/app/sources/:sourceId?` | `sources`          | `SourcesView` (route params as props)        |                            |
| `/app/:kbId/:permalink?`  | `knowledge-base`   | `KnowledgeBaseView` (route params as props)  |                            |

`sources` is declared **before** `knowledge-base`, which would match `/app/sources` too.

`RouteMeta` is augmented with typed fields: `title`, `requiresAuth`, `guestOnly`,
`layout`.

**Guards**

- `beforeEach`: if a token is stored but no user is loaded (first navigation after a
  reload), it calls `auth.fetchUser()`. If the API is unreachable, the user
  continues as anonymous. Anonymous users on a `requiresAuth` route are sent to
  `login?redirect=<fullPath>`. Signed-in users on a `guestOnly` route are sent to
  `knowledge-bases`.
- `afterEach`: sets `document.title` to `"<title> · Particule"`.

**URL as state.** The open particule is part of the URL (`/app/<kbId>/<permalink>`),
and `?new` opens a new draft. The same goes for sources: `/app/sources/<id>`, `?new`
for the quick add, `?new&manual` for the full form. Selection, deep links,
back/forward and "copy link" therefore all go through the router. No store keeps a
separate "selected particule" or "selected source" field.

## API layer

`api/client.ts` exports a single `request<T>(path, { method, token, json, body })`:

- Base URL: `import.meta.env.VITE_API_URL`, defaulting to
  `http://localhost:8000/api/v1` (see `.env.example`; the API must allow this
  origin in its CORS configuration).
- `json` is serialised with a `Content-Type: application/json` header. `body` is
  sent as is, for example `URLSearchParams` for the OAuth2 password login.
- `token` becomes `Authorization: Bearer <token>`.
- Non-2xx responses throw `ApiError(status, detail)`. The message is extracted from
  FastAPI's `{"detail": ...}`, including the list form returned on 422. A 204
  response resolves to `undefined`.

The resource modules (`auth.ts`, `knowledgeBases.ts`, `particules.ts`, `sources.ts`)
are thin typed wrappers around `request`. Each one declares the API's response types
(snake_case, as the server sends them). `client.ts` has a `listAll()` helper that
follows the API's `skip`/`limit` pagination (pages of 100) until a page comes back
short.

**Third party: `api/doi.ts`.** It is the only module that calls a service other than
the Particule API. `lookupDoi(doi)` asks `https://doi.org/<doi>` for CSL-JSON
(`Accept: application/vnd.citationstyles.csl+json`; doi.org allows CORS), with plain
`fetch` and a 10 s timeout, and turns it into API-ready `SourceFields` through
`lib/cslImport.ts`. Failures throw `DoiError` (`invalid`, `not_found`,
`unreachable`); components may import it, like `ApiError`. DOI lookup belongs to the
front end by design: the Particule API has no endpoint for it.

## State (Pinia stores)

All stores use the setup syntax. Each one reads the token from `useAuthStore()` and
passes it to the API functions explicitly.

### `auth`

- `token` is persisted in localStorage under `particule.token` (`useLocalStorage`).
  `user` is kept in memory only. `isAuthenticated` is `user !== null`, so the user
  only counts as signed in once the token has been checked against `/users/me`.
- If `fetchUser()` gets 401/403/404, it logs the user out (expired token or deleted
  user). Other errors are rethrown.
- `signup()` creates the account and then logs in with the same credentials.

### `knowledgeBases`

The user's knowledge bases, sorted by name. It is loaded once by
`KnowledgeBaseLayout` and then updated locally from the API response to each
create, rename or delete, without fetching the list again.

### `particules`

Holds the particules of **one** knowledge base, the one currently open (`kbId`):

- `load(id)` resets the store and fetches every page. If another knowledge base was
  opened while the request was running, the response is discarded.
- `create()` handles permalink collisions. Permalinks are globally unique on the
  server, so when it gets a 409 it retries `slug-2`, `slug-3`… up to 20 attempts.
- `update()` and `remove()` patch the local list from the server's response. The
  list stays sorted by title.

### `sources`

The user's sources, shared by all their knowledge bases. They are loaded lazily, and
failing to load them is not fatal on the particules screen.

- `create()`, `update()` and `remove()` patch the local list, sorted as the server
  sorts it (title, then year, undated last). `remove()` also clears `source_id` on
  the loaded particules, as the server does.
- `findByDoi()` compares normalised, case-insensitive DOIs, so the quick add can
  offer an existing source instead of a duplicate.
- `lookupDoi()` delegates to `api/doi.ts`. It saves nothing.
- `draft` hands an imported source with no title from the quick add to the full form
  on the sources page.

There are two families of sources. **Academic** types (`book`, `journal_article`,
`book_chapter`, `web_page`) have authors and an APA reference. **`other`** (a video, a
podcast, a conversation…) has only a title, a link and a note. Every source has a
`note`: the user's own words about it.

## The knowledge-base screen

This is the core of the app:

```
KnowledgeBaseLayout            SidebarProvider + AppSidebar + header, loads KBs
└── RouterView
    ├── KnowledgeBasesView     list / empty state
    └── KnowledgeBaseView      loads particules for :kbId
        ├── ParticuleList      filter, ↑/↓ navigation, "/" shortcut
        └── ParticuleEditor    title, permalink, origins, source, content
            ├── SourcePicker   combobox over the sources store, creates sources too
            ├── SourceSheet    side sheet with the SourceEditor of the cited source
            └── MarkdownEditor (async) CodeMirror 6
```

- **Responsive.** On desktop (`≥ 768px`), the list and the editor sit side by side in
  a `ResizablePanelGroup`, and the pane sizes are saved under `particule-panes`. On
  mobile only one pane shows at a time, and the editor has a back button.
- **Filtering** happens on the client: the API has no search endpoint. It matches
  title and content, ignoring case and accents.
- **Sidebar** (`AppSidebar`): the knowledge-base list with create / rename / delete
  dialogs, a "Bibliothèque" section (Sources; Tags and Liens are marked "Bientôt", not
  built yet), and the account menu (theme, À propos, logout).

## The sources screen

```
SourcesView                    loads the sources, one pane at a time on mobile
├── SourceList                 filter, ↑/↓ navigation, "/" shortcut
├── SourceQuickAdd             ?new: « Académique » (DOI) or « Autre » (title, link, note)
└── SourceEditor               ?new&manual or :sourceId, autosaved
    ├── ApaReference           citation-js, lazy-loaded
    └── ContributorsField      ordered authors / editors
```

- **Quick add first.** Entering a full APA form is slow, so a new source starts from
  `SourceQuickAdd`. A pasted DOI is looked up, its APA reference shown and, on the
  sources page, the source added at once with its steps listed (an import with no title
  goes to the full form instead). The full form stays one link away, for a reference
  without a DOI. The same component runs in the `SourcePicker` popover, where adding
  also cites, so it waits for « Ajouter et citer ».
- **Reference first.** For an academic source, `SourceEditor` shows the reference,
  then the form in a collapsible « Corriger les informations ». It starts folded for a
  saved, valid source, and unfolds on its own when a save finds the form invalid. An
  `other` source gets a short form with no reference.
- **Saved only when valid.** `SourceEditor` autosaves like `ParticuleEditor` (1 s
  debounce, one save at a time, `PATCH` of the changed fields, save on unmount), but
  sends nothing while the zod schema refuses the form: a new source is created on the
  server the first time it is valid. As on the server, only the title is required;
  `missingForApa` lists what the APA reference still lacks, shown as a notice that
  never blocks the save.
- **citation-js** is only imported by `lib/citation.ts`, dynamically, the first time a
  reference is shown. Its HTML output is reduced to text and italics, and rendered
  without `v-html`.

### Editor save model

`ParticuleEditor` has no save button: it autosaves.

1. Edits update a local `fields` object. Each change sets the status to `pending`
   and schedules a debounced save (1 s).
2. `flush()` allows one save at a time. If edits arrive while a save is running, it
   sends one more save as soon as the current one finishes.
3. **Drafts** (`particule === null`) are created on the server only once they have a
   title. Until then, the permalink follows the slugified title. After creation the
   permalink no longer changes on its own, so existing links keep working.
4. **Existing particules** are saved with a `PATCH` that contains only the changed
   fields. If the server refuses a permalink as taken (409), the editor remembers it,
   shows an error, and saves the other fields without it.
5. When the particule's URL changes (a draft was created or the permalink was
   edited), the editor emits `moved`. The parent then calls `router.replace`, and
   keeps the same editor instance (`editorKey` does not change), so focus and cursor
   are preserved.
6. Unmounting the editor saves right away, and `beforeunload` warns the user while
   changes are unsaved. Deleting waits for any save in progress, then sets a `gone`
   flag so that a delayed save cannot bring the particule back. The parent performs
   the actual deletion and then opens the neighbouring particule.

Status shown in the header: `Enregistrement…` / `Enregistré` / `Échec` (with a
retry button) / `Brouillon`.

### Markdown editor

`MarkdownEditor.vue` wraps a CodeMirror `EditorView` and works with `v-model`:
document changes update the model, and only *external* model changes are dispatched
back into the editor.

- It is **lazy-loaded** with `defineAsyncComponent` (with loading/error components
  and one retry), because CodeMirror is most of the page's weight. Its packages are
  listed in `optimizeDeps.include` in `vite.config.ts`. Without that, Vite would
  only discover them on first use in dev, re-optimise, and the in-flight import
  would fail.
- It uses `markdownLanguage` (GFM) rather than `markdown()`, because `markdown()`
  bundles the HTML/CSS/JS languages used for embedded code.
- `lib/markdownLivePreview.ts` adds the "live preview" behaviour: Markdown syntax
  marks (heading `#`, emphasis, strikethrough, inline code, link brackets/URLs) are
  hidden, except on the lines that hold the cursor or selection.

## UI, theming and conventions

- **shadcn-vue**: components are generated into `src/components/ui` (style
  `new-york`, base color `taupe`, Lucide icons; see `components.json`). They are part
  of the project's code and can be edited. Classes are merged with `cn()` from
  `@/lib/utils`. The project skill in `.claude/skills/shadcn-vue` describes how to
  add or customise them.
- **Theme**: Tailwind v4 is configured in CSS only (`src/style.css`, there is no
  `tailwind.config`). Colour tokens are CSS variables, dark mode is triggered by a
  `.dark` class toggled through VueUse `useColorMode`, the font is Oxanium, and
  animations are turned off under `prefers-reduced-motion`.
- **Forms** (login, signup, knowledge-base dialogs) use vee-validate with zod
  schemas and the shadcn `Form*` components.
- **Language**: UI text is in French and code and comments are in English. API
  payload fields keep the server's snake_case.

## Testing

| Kind | Location                          | Command             | Notes                                                 |
| ---- | --------------------------------- | ------------------- | ----------------------------------------------------- |
| Unit | `src/**/__tests__/*.spec.ts`      | `npm run test:unit` | Vitest + jsdom; stores, router flow, titles, slug     |
| E2E  | `e2e/*.spec.ts`                   | `npm run test:e2e`  | Playwright against the dev server (5173) or preview on CI (4173) |

`vitest.config.ts` passes `--no-experimental-webstorage`: on Node 25+, Node's own
`localStorage` global would otherwise hide jsdom's.

## Build and configuration

- `npm run dev`: Vite dev server, with Vue DevTools enabled.
- `npm run build`: runs `vue-tsc --build` type-checking and `vite build` in parallel.
- `npm run lint`: oxlint, then ESLint. `npm run format`: Prettier.
- Environment: `VITE_API_URL` only (copy `.env.example` to `.env.local`).
- Node `^22.18.0 || >=24.12.0`.
