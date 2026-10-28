<p align="center">
  <img src="public/favicon.svg" alt="Particule" width="96" height="96">
</p>

<h1 align="center">Particule-UI</h1>

<p align="center">
  <strong>The web interface of Particule: a knowledge base you build yourself, with an AI that makes you think instead of thinking for you.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/vue-3-42b883" alt="Vue 3">
  <img src="https://img.shields.io/badge/node-22.18%2B%20%7C%2024.12%2B-blue" alt="Node 22.18+ or 24.12+">
  <img src="https://img.shields.io/badge/status-early%20development-orange" alt="Status: early development">
</p>

## How it works

**Particules.** Each note is a _particule_: a small, self-contained piece of knowledge,
written in Markdown. The editor saves as you type: there is no "Save" button.

**Knowledge bases.** Particules live in knowledge bases, one per subject or project. A
knowledge base is meant to be reopened, reread and extended over years, not filled once
and forgotten.

**Sources.** Books, articles, chapters, web pages, podcasts, conversations. Import a
reference from its DOI or enter what you know now, then attach it to a particule. References
are shown in APA style.

**A human side and a machine side.** Writing methods that push you to cover a subject
yourself, combined with embeddings, vector similarity and knowledge discovery. The balance
between the two is deliberate: the AI suggests, questions and links, but never writes in
your place.

## Status

Particule is in early development. This repository is the web front end. The back-end API
lives in [**Particule**](https://github.com/Nojann/Particule).

| Available now                                      | Planned                                        |
| -------------------------------------------------- | ---------------------------------------------- |
| Sign up, log in                                    | Tags and links between particules              |
| Knowledge bases: create, rename, delete            | Semantic search across your particules         |
| Particule list with filtering and an autosaving Markdown editor | AI suggestions: questions, gaps, related notes |
| Sources: DOI import, APA references, quick creation from a particule | Public publishing of a knowledge base |
| Light and dark themes, usable on a phone           |                                                |

## Getting started

You need Node `^22.18.0 || >=24.12.0` and a running
[Particule API](https://github.com/Nojann/Particule#getting-started).

```bash
npm install                  # install dependencies
cp .env.example .env.local   # then adjust VITE_API_URL if needed
npm run dev                  # start the Vite dev server
```

The app runs at http://localhost:5173.

### Configuration

| Variable       | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `VITE_API_URL` | Base URL of the API (`http://localhost:8000/api/v1` by default)   |

The API must allow the app's origin in `BACKEND_CORS_ORIGINS`.

## Development

### Tests

```bash
npm run test:unit            # Vitest + jsdom
npx playwright install       # first run only: download the browsers
npm run test:e2e             # Playwright, against a mocked API
```

### Stack

[Vue 3](https://vuejs.org/) with TypeScript, [Vite](https://vite.dev/) for the build,
[Pinia](https://pinia.vuejs.org/) for state, [Vue Router](https://router.vuejs.org/),
[shadcn-vue](https://www.shadcn-vue.com/) and [Tailwind CSS v4](https://tailwindcss.com/)
for the UI, [CodeMirror](https://codemirror.net/) for the editor,
[vee-validate](https://vee-validate.logaretm.com/) and [zod](https://zod.dev/) for forms,
[citation-js](https://citation.js.org/) for references.

### Project structure

```
src/
├── api/          # REST client and typed endpoints
├── components/   # app components; ui/ holds shadcn-vue components
├── layouts/      # page layouts
├── lib/          # pure helpers: citations, DOI, slugs, editor extensions
├── router/       # routes and auth guards
├── stores/       # Pinia stores, the only callers of api/
├── views/        # routed pages
├── main.ts       # application entry point
└── style.css     # Tailwind configuration and theme
e2e/              # Playwright scenarios
docs/             # documentation
specs/            # feature specs
```

More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): layers, routing, stores, the
editor save model and conventions.

### Useful commands

```bash
npm run build                # type-check and build for production
npm run preview              # serve the production build
npm run type-check           # vue-tsc only
npm run lint                 # oxlint then eslint, with --fix
npm run format               # prettier on src/
```

## License

MIT, see [LICENSE](LICENSE).
