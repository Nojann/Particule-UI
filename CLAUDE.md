# Particule-UI

Web front end of **Particule**: Vue 3 + TypeScript SPA talking to the Particule REST API
(FastAPI, repo `Nojann/Particule`, also maintained by the owner of this repo).

Reply to the user in **French**. Write code, comments, commits and docs in **English**.

## Product

Particule builds **hybrid knowledge bases**:

1. **Human side.** Personal notes, written with methods that stimulate cognition so
   that the user covers a subject themselves.
2. **Machine side.** Generative AI, embeddings, vector similarity and knowledge
   discovery.
3. **Balance.** The split between cognitive stimulation and agentic automation must be
   deliberate and precise (see [AI features](#ai-features)).
4. **Notions.** Notes are modelled as *particules*, inspired by Zettelkasten. In time
   they should get a model of their own, so avoid hard-coding Zettelkasten assumptions.
5. **Lasting use.** A knowledge base is built to be used again and again, not just as a
   place to take notes.
6. **Publishing.** A knowledge base can be published publicly. This is planned and not
   built yet.

Current scope: auth, knowledge-base CRUD, particule list + autosaving Markdown editor,
sources (read-only). Tags, links and the Sources page are placeholders ("Bientôt").

## AI features

- The AI part will live in **both** the back end (embeddings, vector search, agents) and
  the front end (some lightweight calls/computations).
- **The user comes first.** The AI suggests and never acts in the user's place. The user
  writes; the AI questions, links, points out gaps and surfaces related particules.
  Never write AI output into a particule without an explicit user action, and keep
  AI-produced content distinguishable from the user's own.
- When designing an AI feature, state how it stimulates the user's thinking rather than
  replacing it.

## Docs & references

- `docs/ARCHITECTURE.md`: layers, routing, stores, editor save model, conventions.
  **Read it before structural changes and keep it up to date.**
- API: https://github.com/Nojann/Particule/blob/main/docs/api.md (linked from
  `specs/api.md`).
- `.claude/skills/shadcn-vue`: how to add and customise UI components.

## Architecture (summary)

`views/ layouts/ components/` → `stores/` (Pinia) → `api/` → `api/client.ts` (`fetch`).
Components never call `api/` directly. They use stores and only import API types and
`ApiError`. The URL holds the selection (`/app/:kbId/:permalink?`, `?nouvelle` for a
draft). Details are in `docs/ARCHITECTURE.md`.

## Implementation rules

- Vue `<script setup lang="ts">`, Composition API, setup-style Pinia stores, `@/` imports.
- Match the existing style: short comments that explain *why*, and VueUse helpers over
  hand-rolled code.
- UI kit: shadcn-vue in `src/components/ui` (generated code, editable), `cn()` from
  `@/lib/utils`, Lucide icons. Tailwind v4 is configured in `src/style.css` (there is no
  `tailwind.config`).
- Forms use vee-validate + zod.
- API payloads keep the server's snake_case.
- When the front end needs something the API lacks, propose the back-end change instead
  of working around it in the client.
- **i18n.** The UI is in French and will become multilingual. Keep the strings in
  French for now, but write each one as a complete phrase, without concatenating
  fragments, and keep them easy to extract later for vue-i18n.
- `src/stores/counter.ts` is a scaffold leftover and is unused.

## Build & run

```sh
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # vue-tsc type-check + vite build
npm run type-check
npm run lint         # oxlint then eslint (with --fix)
npm run format       # prettier on src/
```

## Testing

```sh
npm run test:unit    # Vitest + jsdom, src/**/__tests__/*.spec.ts
npm run test:e2e     # Playwright, e2e/ (needs the dev server; preview on CI)
```

Every feature ships with **unit tests** (stores, router, lib, and component logic) and
**at least one Playwright scenario** per user journey.

## Configuration & environment

- `VITE_API_URL` (copy `.env.example` to `.env.local`). The default is
  `http://localhost:8000/api/v1`, and the API must allow this origin in CORS.
- Node `^22.18.0 || >=24.12.0`.

## DevOps

Deployment is not defined yet. There is no CI config in the repo.

## Development process

- **Git.** Use one branch per feature or task, merged through a pull request. Do not
  work directly on `main`. Commit messages are short, imperative and in English.
- **What Claude may do without asking:** run type-check, lint and tests, and start the
  app (dev server, Playwright) to verify a change.
- **Ask first** before committing, pushing, opening a PR or adding a dependency.

## Project management (autonomous programming)

The method is still being defined. Current baseline:

- **Backlog.** Use both a GitHub issue to track a task and a spec file in `specs/` for
  the details: goal, acceptance criteria, out of scope, test plan. The issue links to
  the spec.
- **Cycle for an autonomous task:**
  1. **Spec.** Write or complete the spec with the user and get it validated.
  2. **Plan.** Propose the implementation plan and get it validated.
  3. **Code.** Implement it on a dedicated branch.
  4. **Test.** Write the unit and e2e tests listed in the spec's test plan.
  5. **Verify.** Run type-check, lint and tests, and run the app to check the
     acceptance criteria.
  6. **PR.** Open a PR that links the issue and the spec, with the user's approval.
- Do not expand the scope beyond the spec. Record follow-ups as new issues.

## Maintenance

- Keep `docs/ARCHITECTURE.md` in sync with structural changes.
- Fix the cause of a bug and add a regression test.

## Performance

- Lazy-load routes and heavy dependencies. CodeMirror is loaded only with the editor,
  and its packages are listed in `optimizeDeps.include` in `vite.config.ts`.
- Filtering runs on the client over loaded particules (the API has no search). Revisit
  this when knowledge bases grow or when vector search arrives.

## Security

- The token is stored in localStorage (`particule.token`). **This will be reviewed
  together with public publishing.** Do not change the auth model before then.
- Any future rendering of Markdown or AI output to HTML must be sanitised (XSS),
  especially on public pages.

## UI/UX

- **Mobile complete.** Every feature must be usable on a phone. Below 768px the app
  shows one pane at a time.
- **No friction.** Autosave, no "Save" buttons, few modals, sensible defaults.
- **Accessibility.** Use correct roles and ARIA, keep focus visible, respect
  `prefers-reduced-motion`, ensure contrast in both light and dark themes.
