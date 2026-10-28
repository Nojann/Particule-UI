# Sources: management and APA references

- **Status:** draft, to be validated
- **Branch:** `feat/sources`
- **Issue:** _to be created, links to this spec_
- **API:** [Sources](https://github.com/Nojann/Particule/blob/main/docs/api.md#sources)
  (back end commit `0f8f967`, "add source bibliographic field")

## Goal

A particule can cite a source, but today sources can only be listed: there is no way to
create, edit or delete one in the UI, and the sidebar entry "Sources" is a "Bientôt"
placeholder. The front end also still uses the old `Source` shape (`authors`, `year`,
`edition`, `publisher`).

This feature lets users:
- manage their sources, from a sources page and from the particule they are writing;
- get the **APA 7 reference** of each source, in French, ready to copy into their own
  writing.

Sources belong to the user, not to a knowledge base: the same source can be cited from
every knowledge base.

**Entering a source must be fast.** A first version used a single, long APA form for every
source, and that proved too laborious. Sources now come in two families:

- **Academic sources** are generated from a **DOI**: the user pastes it, and on the sources
  page the source is added as soon as it is found, with each step shown. The detailed form is still there, folded, to fix what
  the DOI's metadata got wrong, or to enter a reference without a DOI by hand.
- **Other sources** (a video, a podcast, a conversation, a web page…) are minimal: a title,
  an optional link and an optional note. They have no APA reference.

A source can be created from the sources page and from the particule being written, without
leaving it.

This is also the first feature translated with **vue-i18n**.

**AI:** none. The reference is computed by citation-js (CSL) from what the user typed or
imported. A DOI import fills fields from the publisher's metadata, not from a model. On the
sources page, pasting the DOI is the user's request to add it; from a particule, nothing is
created before the user clicks « Ajouter et citer ».

## API

`GET/POST /sources/`, `GET/PATCH/DELETE /sources/{source_id}`.

| Field             | Type                                                    | Required                          |
| ----------------- | ------------------------------------------------------- | --------------------------------- |
| `type`            | `book`, `journal_article`, `book_chapter`, `web_page`, `other` | yes                        |
| `title`           | string ≤ 1024                                           | yes                               |
| `authors`         | free text ≤ 1024                                        | no                                |
| `editors`         | free text ≤ 1024                                        | no                                |
| `container_title` | journal, book or site title ≤ 1024                      | no                                |
| `volume`, `issue`, `pages` | string ≤ 64                                    | no                                |
| `doi`             | string ≤ 255                                            | no                                |
| `url`             | string ≤ 2048                                           | no                                |
| `published_date`, `accessed_date` | `YYYY-MM-DD`                            | no                                |
| `year`            | integer, `null` when undated                            | no                                |
| `edition`, `publisher` | string ≤ 255                                       | no                                |
| `note`            | free text                                               | no                                |

Since back end commit `a9e189a` ("require only title on sources", branch
`feat/source-title-only`), only `type` and `title` are required, for every type, so a
source can be recorded before every detail is known. **This front end change ships once
that branch is merged.**

Server rules the client must respect:

- `year` must match `published_date` when both are sent. A `published_date` sent without
  `year` sets the year.
- A `PATCH` is validated on the merged source. A refused one (422) changes nothing.
- The list is sorted by title, then year, with undated sources last.
- Duplicates are allowed (no 409).
- Deleting a source keeps the particules that cite it, with `source_id` set to `null`.

### Other sources and notes

Added by back end commit `99c87ad` ("add other type in source"):

| Change           | Detail                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| `type: "other"`  | a catch-all that needs only `title`. The front end sends `url` and `note`, and `null` for every other field |
| `authors`        | nullable; optional on every type since `a9e189a`                          |
| `note`           | free text with no length limit, nullable, on **every** type: the user's own words about the source |

## DOI resolution

**Mechanism.** A DOI is registered with an agency (Crossref for most articles and chapters,
DataCite for datasets and theses…) together with the publisher's metadata.
`GET https://doi.org/<doi>` with `Accept: application/vnd.citationstyles.csl+json` returns
that metadata as **CSL-JSON**, whatever the agency. doi.org allows CORS. The front end maps
the CSL-JSON to the API's `SourceFields`, and citation-js renders APA from the stored source
as for any other.

**Where it runs.** In the browser, by design: the API has no DOI endpoint. The lookup lives
in `src/api/doi.ts`, the only module that talks to doi.org, and returns API-ready
`SourceFields`.

**Mapping CSL-JSON to a source.**

DataCite answers with CSL types. Crossref answers with its own type names
(`journal-article`, `book-chapter`, `proceedings-article`…) and lowercases the DOI. Both are
mapped:

| `type` received                                                                   | Source type       |
| --------------------------------------------------------------------------------- | ----------------- |
| `article-journal`, `article`, `journal-article`                                   | `journal_article` |
| `chapter`, `paper-conference`, `book-chapter`, `proceedings-article`… with a `container-title` | `book_chapter` |
| anything else (`book`, `report`, `thesis`, `dataset`…)                            | `book`            |

- Names: `{family, given}` becomes a person and `{literal}` a group. `;` and `,` are removed
  from family and group names, and given names keep only the characters the form allows, so
  the imported source passes the [name constraints](#names-apa-constraints-on-the-front-end).
- Titles: markup (JATS `<i>`, `<sub>`…) is stripped to text. When `title` or
  `container-title` is a list, the first one is used. **Case is not changed**: publishers
  often register titles in Title Case, and the user fixes it if they want APA's sentence
  case.
- `issued` gives `published_date` when it has a year, month and day, else `year`.
- `page` → `pages`; `volume`, `issue`, `publisher`, `edition` as they are. Every field is
  cut to the API's length limit.
- The DOI keeps the user's spelling (Crossref's is lowercased; DOIs are case-insensitive).
  `URL` is dropped when it only points to the DOI.
- Known limit: for some chapters, Crossref gives the series as `container-title` (e.g.
  « Use R! ») instead of the book's title. The user fixes it in « Corriger les
  informations ».
- An import that lacks what APA needs (often the authors) is added all the same, and the
  editor says what to complete. Only an import with no title can't be added: « Compléter
  la référence » opens the full form, prefilled.

## Names: APA constraints on the front end

The API stores `authors` and `editors` as free text. The front end gives them a structure,
so that APA can be applied (initials, order, `&`, group authors). That structure is
serialised to the text the server stores.

### In the form

Authors (and editors, for a chapter) are entered as an **ordered list of contributors**.
Each contributor is one of two kinds:

- **Person.** A **family name** (`Nom`, required) and **given names** (`Prénoms`,
  optional). Particles stay in the family name: `de Beauvoir` / `Simone`.
- **Group.** A single **name** (`Nom du groupe`, required), e.g.
  `Organisation mondiale de la santé`. It is never turned into initials.

The contributor list supports:

- adding a contributor;
- removing a contributor;
- reordering contributors, with « Monter » / « Descendre » buttons that work from the
  keyboard (order matters in APA).

### Validation (zod)

- Authors and editors are optional: the API only needs a title. What APA still lacks is
  listed by `missingForApa`, which asks for it without blocking the save.
- A person needs a family name; a group needs a name.
- Each name part is trimmed. Spaces inside a part are collapsed.
- `;` is forbidden in every part, and `,` in a family name or a group name: these are the
  separators of the stored text. The message says so: « Les caractères ; et , ne sont pas
  autorisés dans un nom. »
- Given names hold letters, spaces, hyphens, apostrophes and periods only. This lets APA
  derive initials: `Jean-Paul` → `J.-P.`, `R. P.` stays `R. P.`.
- The serialised text must stay within 1024 characters.

### Serialisation

The text sent to the API is built like this:

- Contributors are joined with `; `.
- A person is written `Family, Given`. A person with no given names is written
  `Family, `, so it stays a person and does not read as a group.
- A group is written as its name alone, with no comma.

Example: `Feynman, Richard P.; Leighton, Robert; Organisation mondiale de la santé`.

When reading an existing source, the parser works the other way:

- It splits the text on `;`.
- Each entry is cut at its first `,`: what comes before is the family name, what comes
  after is the given names. An entry with no comma is a group.
- Empty entries are ignored.

Writing then reading back gives the same contributors. Text typed before this feature
(e.g. `Richard Feynman`) reads as a group. The user can turn it into a person.

### Mapping to CSL-JSON

citation-js takes contributors in CSL-JSON:

- a person becomes `{ family, given }`;
- a group becomes `{ literal }`.

## Routes and URL

Route names, paths and query parameters are in English.

| Route name | Path                    | Opens                                    |
| ---------- | ----------------------- | ---------------------------------------- |
| `sources`  | `/app/sources/:sourceId?` | the list, plus the source `sourceId`   |
| `sources`  | `/app/sources?new`      | a new source                             |

- The route is declared **before** `/app/:kbId/:permalink?`.
- For consistency, the particules' draft parameter `?nouvelle` becomes `?new` (router,
  `KnowledgeBaseView`, tests, `docs/ARCHITECTURE.md`).

## User journeys

1. **Browse.** From the sidebar, « Sources » opens the sources page: a list of sources and,
   once one is chosen, its editor.
2. **Add from a DOI.** « Nouvelle source » opens the quick add, on « Académique ». The user
   pastes a DOI (or a doi.org link). The APA reference shows, the source is added right
   away (« Référence trouvée », « Ajout de la source… ») and opens.
3. **Add another source.** In the quick add, « Autre » asks for a title, a link and a note,
   then « Ajouter ».
4. **Add by hand.** For an academic source with no DOI, « Saisir la référence à la main »
   opens the full form, with no author row yet. The source is created on the server as
   soon as it has a title, without a save button.
5. **Edit.** Every change is saved automatically. An academic source shows its APA
   reference first; « Corriger les informations » unfolds the form, and the reference
   updates as the user types.
6. **Copy.** « Copier la référence » copies the APA reference, keeping its italics when
   pasted into a word processor.
7. **Delete.** After confirmation, the source is deleted. The particules that cited it keep
   their content and lose the link.
8. **Cite.** In the particule editor, the source picker lists the sources with their in-text
   label and title, and links to the sources page.
9. **Edit from the particule.** Next to the chosen source, « Modifier la source » opens the
   source editor in a side panel, without leaving the particule. Changes save
   automatically. Closing the panel returns focus to the particule.

## Acceptance criteria

### Navigation

- [ ] The sidebar entry « Sources » links to `/app/sources` and is marked active there.
      « Tags » and « Liens » stay "Bientôt".
- [ ] `/app/sources/:sourceId` opens a source and `/app/sources?new` opens a new one. These
      URLs are never taken for a knowledge base.
- [ ] Particule drafts open with `?new`. `?nouvelle` is no longer used.
- [ ] The tab title is « Sources · Particule » and the header shows « Sources ».
- [ ] An unknown source id shows « Cette source n’existe pas, ou plus. »

### List

- [ ] Each row shows the in-text label (`Feynman & Leighton, 1964`), the title and the type.
      An other source shows its title, the link's host (`youtube.com`) and « Autre ».
- [ ] The filter runs on the client. It ignores case and accents and searches authors,
      title and container title.
- [ ] Keyboard: `/` focuses the filter, and `↑` / `↓` move between sources.
- [ ] States: a loading skeleton, an empty state with « Ajouter une source », and a
      « no match » message.

### Quick add

- [ ] `/app/sources?new` opens the quick add, with a choice « Académique » / « Autre »
      (`role="radiogroup"`, arrow keys). « Académique » is selected and its field focused.
- [ ] **Académique.** One field, « DOI ou lien doi.org ».
  - Pasting, or Enter, starts the lookup. A DOI is found inside pasted text or a
    `doi.org` / `dx.doi.org` link.
  - While it loads, a skeleton shows.
  - Then the APA reference shows. On the sources page, a complete import that no source
    has yet is **added at once**, with its steps listed in the `aria-live` status region:
    « Référence trouvée », then « Ajout de la source… », then « Source ajoutée ». A failed
    add shows « L’ajout de la source a échoué. » with « Réessayer ». A lookup the user has
    replaced never creates a source.
  - In the picker, adding also cites, which changes the particule: the reference shows with
    « Ajouter et citer », and **nothing is created before that click**.
  - An import that lacks authors or a journal is added all the same (« Ajouter et citer »
    in the picker). Only an import with no title isn't: « Cette référence n’a pas de
    titre : complétez-la avant de l’ajouter. » with « Compléter la référence ».
  - If a source already has this DOI: « Cette source existe déjà. » with « Ouvrir cette
    source » (« Citer cette source » in the picker), and no « Ajouter ».
  - Errors: « Ce n’est pas un DOI valide. », « Ce DOI est introuvable. », « Impossible de
    joindre doi.org, réessayez plus tard. » Each one offers « Saisir la référence à la
    main ».
- [ ] **Autre.** « Titre » (required), « Lien » (a valid URL) and « Note », then
      « Ajouter ». Pasting a DOI in the title or the link offers to switch to « Académique ».
- [ ] « Saisir la référence à la main » opens the full form (`/app/sources?new&manual`), as
      the first version did.
- [ ] Once added, the URL switches to the new source's id and its editor opens.

### Editor

- [ ] **Academic source.** The APA reference comes first. The form below sits in a
      collapsible « Corriger les informations »:
  - folded for a saved, valid source;
  - unfolded for a new source typed by hand, or an invalid one;
  - it hints that APA wants sentence case, since imported titles often use Title Case.
- [ ] **Other source.** A short form: « Titre », « Lien », « Note ». No type, authors, date
      or APA reference.
- [ ] Every source has a « Note », outside the collapsible.
- [ ] The type (academic sources only) is chosen first. The form only shows the fields
      that type uses:

      | Type               | Fields shown on top of title, authors, date              |
      | ------------------ | -------------------------------------------------------- |
      | Livre              | edition, publisher, DOI, URL                             |
      | Article de revue   | journal, volume, issue, pages, DOI, URL                  |
      | Chapitre d’ouvrage | editors, book title, edition, pages, publisher, DOI, URL |
      | Page web           | site name, URL, accessed date                            |

- [ ] Authors and editors follow the [name constraints](#names-apa-constraints-on-the-front-end).
- [ ] Only the title is required, as on the server. A missing title or an invalid value
      shows its message under the field once it has been touched.
- [ ] **Incomplete reference.** When an academic source lacks what APA needs (authors; the
      journal or book title for an article or chapter; the URL for a web page), a notice
      above the reference reads « Référence incomplète. Pour une référence APA complète,
      renseignez : » with the list of the missing fields' labels (`role="status"`). The
      source still saves, and « Corriger les informations » starts unfolded.
- [ ] Changing the type keeps the values already typed.
- [ ] Date: either a year or a full publication date. When `published_date` is set, the
      year is derived from it and can't be edited. With neither, the date reads « s.d. ».
- [ ] Autosave follows the particule editor:
  - it saves 1 s after the last change;
  - one save runs at a time;
  - the `PATCH` holds only the changed fields;
  - leaving the editor saves at once;
  - the browser warns before closing with unsaved changes.
- [ ] Nothing is sent while the form is invalid:
  - an invalid form (no title, or a malformed value) shows « Champs requis manquants »
    instead of « Enregistré »;
  - a server error shows « Échec de l’enregistrement » with « Réessayer ».
- [ ] A new source is created on the server when it first becomes valid. The URL then
      switches to its id without losing focus.
- [ ] Deleting asks for confirmation: « Les particules qui citent cette source seront
      conservées, sans source. » A new source that was never saved is discarded without a
      dialog.

### APA reference (citation-js)

- [ ] The reference is produced by citation-js:
  - the bundled `apa` CSL template;
  - the French CSL locale `fr-FR`, vendored in the repo and registered once;
  - the source mapped to CSL-JSON.

      | Source type       | CSL type            | Notable mappings                                   |
      | ----------------- | ------------------- | -------------------------------------------------- |
      | `book`            | `book`              | `edition`, `publisher`                             |
      | `journal_article` | `article-journal`   | `container_title`, `volume`, `issue`, `pages` → `page` |
      | `book_chapter`    | `chapter`           | `editors` → `editor`, `container_title`, `page`    |
      | `web_page`        | `webpage`           | `container_title` as site name, `accessed_date` → `accessed` |

      Every type maps `published_date` (or `year`) → `issued`, `doi` → `DOI` and
      `url` → `URL`.
- [ ] citation-js and citeproc are **lazy-loaded**: only when a reference is shown or
      copied (sources editor, source sheet), never just by opening the particules page,
      and never in the main bundle. Their packages
      are listed in `optimizeDeps.include`.
- [ ] While they load, a skeleton shows. If they fail to load, the message reads
      « Impossible de générer la référence. »
- [ ] The reference is shown above the form and updates live, with APA's italics.
- [ ] **No raw HTML.** citation-js produces HTML, which is parsed with `DOMParser`. Only its
      text and its italics (`<i>`, `<em>`, `font-style: italic`) are kept, as segments
      `{ text, italic }[]`. Vue renders those segments without `v-html`.
- [ ] Expected output (French locale), checked in tests:
  - **Livre:** `Feynman, R. P., & Leighton, R. (1964). *The Feynman lectures on physics*
    (2ᵉ éd.). Addison-Wesley.`
  - **Article de revue:** `Feynman, R. P. (1948). Space-time approach to non-relativistic
    quantum mechanics. *Reviews of Modern Physics*, *20*(2), 367‑387.
    https://doi.org/10.1103/RevModPhys.20.367`
  - **Chapitre d’ouvrage**, with editors and pages.
  - **Page web**, with a group author, a full date and an access date.

  The exact punctuation and typography are those of the CSL style and locale; tests pin
  the actual output.
- [ ] A DOI typed as `10.…`, `doi:10.…` or `https://doi.org/10.…` is normalised to `10.…`
      before it is passed to CSL.
- [ ] Titles are shown as typed: case is not changed.
- [ ] Beside the reference, the editor shows the APA in-text citation (`(Feynman &
      Leighton, 1964)`), also produced by citation-js.
- [ ] « Copier la référence » copies the reference:
  - it writes `text/html` (rebuilt from the segments, text escaped) and `text/plain`;
  - when rich copy is unavailable, it falls back to plain text;
  - it confirms « Référence copiée » through an `aria-live` region.

### In-text label in lists

- [ ] Lists show a short label: the particule list, the source list and the source picker.
- [ ] The label is computed without citation-js, so lists stay light. It uses the
      structured names:
  - one author: `Feynman, 1964`;
  - two: `Feynman & Leighton, 1964`;
  - three or more: `Feynman et al., 1964`;
  - no date: `s.d.`;
  - a group author keeps its full name.

### Editing from a particule

- [ ] In the particule editor, when a source is chosen, a « Modifier la source » button
      appears next to the picker.
- [ ] The button opens the source editor in a `Sheet`:
  - on the right on desktop;
  - full width on mobile.

  It holds the same form, autosave and APA reference as the sources page.
- [ ] The sheet does not offer deletion. Deleting a source is done on the sources page,
      and a « Ouvrir dans Sources » link leads there.
- [ ] Closing the sheet saves pending changes at once, and focus returns to the button.
- [ ] Changes show right away in the picker and the particule list, through the store.
- [ ] The particule's own autosave is not affected.

### Citing from a particule

- [ ] The source picker shows the in-text label and, on a second line, the title.
- [ ] The picker has a « Gérer les sources » link to the sources page.
- [ ] **Creating from the picker**, without leaving the particule:
  - when the search text is a DOI that no source has: « Importer le DOI {doi} » opens the
    quick add in the popover, with the lookup started; its button reads « Ajouter et
    citer »;
  - when the search text is not empty: « Créer « {title} » comme autre source » creates it
    with that title and cites it at once;
  - « Ajouter une source » opens the quick add in the popover, with a back button.
- [ ] Once created, the source is chosen, the popover closes and focus returns to the
      picker. The particule's autosave saves the new `source_id`.
- [ ] After a source is deleted, particules already loaded show no source, without a
      reload.

### Internationalisation (vue-i18n)

- [ ] vue-i18n is installed and configured:
  - Composition API (`legacy: false`);
  - locale `fr`, with `fr` as the fallback;
  - messages in `src/locales/fr.json`.
- [ ] Every string of this feature goes through `t()`. That covers the sources page, list
      and editor, the contributor list, the reference, the sheet, the picker, the sidebar
      entry, validation messages and the route title.
- [ ] Each message is a complete phrase. Counts use plural forms (`1 source` /
      `3 sources`) and variables use named interpolation (`{name}`), never concatenation.
- [ ] The CSL locale follows the app locale (`fr` → `fr-FR`), so a future locale only
      needs its messages file and its CSL locale.
- [ ] Strings outside this feature stay as they are. Migrating them is a follow-up.

### Across the feature

- [ ] Mobile (< 768px): one pane at a time, with a back button from the editor to the list.
- [ ] Keyboard only: every action can be reached, including reordering contributors, and
      focus stays visible.
- [ ] Every field has a label, and each error message is linked to its field.
- [ ] Light and dark themes are both readable.

## Out of scope

Recorded as follow-up issues:

- Migrating the rest of the UI to vue-i18n, and adding a second language.
- Importing from an ISBN, and BibTeX / CSL-JSON import or export.
- Pre-filling an other source from its link's metadata (title, site): the page can't be
  read from the browser because of CORS, so it needs the back end.
- Turning an other source into an academic one, or the reverse.
- Changing an imported title to sentence case automatically.
- APA in English, and other citation styles.
- Structured names in the API (a list of `{family, given}` / `{literal}` instead of free
  text).
- A shared autosave composable for `ParticuleEditor` and `SourceEditor`.
- Showing, on a source, the particules that cite it (the API has no route for it).

## Technical notes

- **New dependencies** (approved): `@citation-js/core`, `@citation-js/plugin-csl` (brings
  `citeproc`) and `vue-i18n`.
- **Vendored file:** the CSL locale `src/assets/csl/locales-fr-FR.xml`, from
  `citation-style-language/locales`, under its CC BY-SA licence. It is loaded with `?raw`
  inside the lazy chunk.
- **`src/api/sources.ts`:**
  - holds the `Source` types and the five calls;
  - `Source` and `listSources` leave `src/api/particules.ts`;
  - the paginated `listAll` helper is shared;
  - `SourceType` gains `other`, `note` is added and `authors` becomes nullable.
- **`src/lib/contributors.ts`:**
  - `Contributor` type: `{ kind: 'person', family, given } | { kind: 'group', name }`;
  - `parseContributors`, `serializeContributors`, `toCslName`;
  - the zod schema of one contributor;
  - `inTextLabel` for the lists.
- **`src/lib/sourceForm.ts`:**
  - the fields per type and the zod schema of the form;
  - converting form values to an API payload: empty strings become `null`, `year` comes
    from `published_date`, and contributors are serialised;
  - the diff used by the `PATCH`;
  - `toCsl(source)`.
- **`src/lib/citation.ts`:** the only module that imports citation-js, and it does so
  dynamically.
  - It registers the `fr-FR` locale.
  - `formatReference(csl, locale)` → `Promise<Segment[]>`.
  - `formatInTextCitation(csl, locale)` → `Promise<string>`.
  - `segmentsFromHtml`, `segmentsToHtml`, `segmentsToText`.
- **`src/stores/sources.ts`:**
  - gains `create`, `update` and `remove`;
  - re-sorts as the server does;
  - `remove` clears `source_id` on the loaded particules.
  - gains `lookupDoi` (delegates to `api/doi.ts`) and `findByDoi` (normalised DOIs).
- **`src/api/doi.ts`:** the only module that calls doi.org. `lookupDoi(doi)` →
  `Promise<SourceFields>`, with plain `fetch` (not `client.ts`), a 10 s timeout, and a
  `DoiError` whose `reason` is `invalid`, `not_found` or `unreachable`.
- **`src/lib/doi.ts`:** `normalizeDoi` (moved from `sourceForm.ts`), `isDoi`,
  `extractDoi`.
- **`src/lib/cslImport.ts`:** `sourceFromCsl(item)` → `SourceFields`, following
  [the mapping](#doi-resolution).
- **`src/lib/sourceForm.ts`:** the `other` type, `ACADEMIC_TYPES` for the type select, the
  `note` field; only the title is required, and `missingForApa` lists what the APA
  reference lacks.
- **New components:**
  - `SourcesView` and `SourceList`;
  - `SourceQuickAdd`, used on the page and in the picker;
  - `SourceEditor`, used both on the page and in the sheet;
  - `ContributorsField`, `ApaReference` and `SourceSheet`.
- **New UI components:** shadcn-vue `select` and `collapsible`. They are generated code,
  and Reka UI is already a dependency.
- **Docs:** update `docs/ARCHITECTURE.md` (i18n, sources route and its order, `?new`,
  citation-js loading, the "save only when valid" rule) and the "Current scope" line of
  `CLAUDE.md`.

## Test plan

### Unit (Vitest)

- `src/lib/__tests__/contributors.spec.ts`
  - serialise → parse round trip, for persons, groups and persons without given names;
  - parsing old free text: `Richard Feynman` reads as a group; extra spaces, a trailing `;`
    and empty entries;
  - validation: forbidden `;` and `,`, empty family name, given names with digits;
  - `inTextLabel` for 1, 2 and 3+ authors, a group author and an undated source.
- `src/lib/__tests__/sourceForm.spec.ts`
  - only the title is required, for every type; `missingForApa` per type;
  - the payload: empty strings become `null`, `year` comes from `published_date`,
    contributors are serialised;
  - the diff holds only the changed fields;
  - `toCsl` for each type, including DOI normalisation.
- `src/lib/__tests__/citation.spec.ts`, with the real citation-js and the `fr-FR` locale
  - one reference per type, with the output pinned;
  - italics kept as segments;
  - in-text citation;
  - `segmentsFromHtml` drops any tag other than italics (e.g. `<script>`, `<a>`) and keeps
    the text;
  - `segmentsToHtml` escapes `<`, `&` and quotes.
- `src/stores/__tests__/sources.spec.ts`, with the `fetchMock` pattern
  - list, create, update and remove: method, URL, body and `Authorization` header;
  - sorting by title then year, undated sources last;
  - `remove` clears `source_id` on the loaded particules.
- `src/router/__tests__/flow.spec.ts`
  - `/app/sources` and `/app/sources/:id` resolve to `sources`;
  - a particule draft opens with `?new`.
- `src/components/__tests__/SourceEditor.spec.ts`
  - no request while the form is invalid;
  - a `POST` once it is valid, then a `PATCH` with only the changed fields;
  - the fields shown follow the type.
- `src/components/__tests__/ContributorsField.spec.ts`
  - add, remove and reorder contributors;
  - switch between person and group.
- `src/lib/__tests__/doi.spec.ts`
  - `normalizeDoi`, `isDoi` and `extractDoi` on `10.…`, `doi:`, `https://doi.org/…`,
    `dx.doi.org` and a DOI inside text.
- `src/lib/__tests__/cslImport.spec.ts`, on fixtures modelled on real doi.org answers (Crossref and DataCite)
  - a Crossref article, a chapter, a conference paper, and a DataCite dataset that falls
    back to `book`;
  - literal authors, names with `,` or `;`, markup in titles, list titles, partial dates
    and over-long fields;
  - every imported source passes the form schema.
- `src/api/__tests__/doi.spec.ts`, with a mocked `fetch`
  - URL and `Accept` header;
  - 404 → `not_found`; network failure or timeout → `unreachable`; malformed DOI →
    `invalid` without a request.
- `src/stores/__tests__/sources.spec.ts`: `findByDoi`; creating an other source sends
  `type: 'other'` and `authors: null`.
- `src/lib/__tests__/sourceForm.spec.ts`: an other source is valid without authors; `note`
  in the payload and the diff.
- `src/components/__tests__/SourceQuickAdd.spec.ts`
  - on the sources page, a found DOI is created without a click, with its steps shown;
  - a failed add offers « Réessayer »; a replaced lookup never creates;
  - in the picker, no `POST` before « Ajouter et citer »;
  - the « already exists » message;
  - each lookup error;
  - « Autre » requires a title.
- `src/components/__tests__/SourceEditor.spec.ts`: the collapsible is folded for a valid
  saved source and unfolded for a new one; an other source shows only title, link and note.

### End to end (Playwright, API mocked with `page.route`)

doi.org is mocked with `page.route('https://doi.org/**')`, returning CSL-JSON modelled on a real answer.

- `e2e/sources.spec.ts`
  1. Open « Sources » from the sidebar.
  2. « Nouvelle source », paste a DOI, see the APA reference; the source is added without
     a click and the URL now holds its id.
  3. « Corriger les informations »: fix the title's case and see the reference change.
  4. Copy the reference (clipboard permission granted).
  5. Add an « Autre » source with a title and a link.
  6. « Saisir la référence à la main »: create a book with two authors.
  7. Delete a source.
  8. Run the DOI journey on a 375 px wide viewport.
- `e2e/particule-source.spec.ts`
  1. In a particule, choose a source.
  2. « Modifier la source » opens the sheet. Fix an author and close the sheet.
  3. The picker and the list show the new label, and the particule's content is unchanged.
  4. Type a DOI in the picker, « Importer le DOI », « Ajouter et citer »: the particule
     cites the new source.
  5. Type a title, « Créer … comme autre source »: the particule cites it.

### Manual check

Against the local API (`npm run dev`):

- the four types;
- real DOIs against doi.org: `10.1103/RevModPhys.20.367` (article), a book chapter, a
  DataCite DOI, a DOI that doesn't exist, and offline;
- an other source;
- legacy sources whose names are free text;
- editing a source from a particule;
- deleting a cited source;
- mobile;
- dark theme;
- keyboard only;
- the network tab, which must show that citation-js does not load on the particules page
  until the sheet opens.
