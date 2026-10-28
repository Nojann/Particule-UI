import { z } from 'zod'

/**
 * An author or editor. The API stores them as free text, so the UI writes a fixed format
 * that can be read back: `Family, Given; Family, Given; Group name`.
 * A group (an organisation) has no comma and is never turned into initials; its name
 * lives in `family`, so switching between person and group keeps what was typed.
 */
export interface Contributor {
  kind: 'person' | 'group'
  family: string
  given: string
}

/** Same limit as the API's `authors` and `editors` columns */
export const CONTRIBUTORS_MAX_LENGTH = 1024

const SEPARATORS = /[;,]/
// Letters, spaces, hyphens, apostrophes and periods: enough for APA to derive initials
const GIVEN_PATTERN = /^[\p{L}\p{M}\s.'’-]*$/u

function clean(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export const contributorSchema = z
  .object({
    kind: z.enum(['person', 'group']),
    family: z.string().transform(clean),
    given: z.string().transform(clean),
  })
  .superRefine((value, ctx) => {
    if (!value.family) {
      ctx.addIssue({
        code: 'custom',
        path: ['family'],
        message: value.kind === 'group' ? 'Le nom du groupe est requis.' : 'Le nom est requis.',
      })
    } else if (SEPARATORS.test(value.family)) {
      ctx.addIssue({
        code: 'custom',
        path: ['family'],
        message: 'Les caractères ; et , ne sont pas autorisés dans un nom.',
      })
    }
    if (value.kind === 'person' && !GIVEN_PATTERN.test(value.given)) {
      ctx.addIssue({
        code: 'custom',
        path: ['given'],
        message:
          'Les prénoms ne peuvent contenir que des lettres, espaces, tirets, apostrophes et points.',
      })
    }
  })

export function emptyContributor(): Contributor {
  return { kind: 'person', family: '', given: '' }
}

export function parseContributors(text: string | null | undefined): Contributor[] {
  if (!text) return []
  return text
    .split(';')
    .map(clean)
    .filter(Boolean)
    .map((entry) => {
      const comma = entry.indexOf(',')
      if (comma === -1) return { kind: 'group', family: entry, given: '' }
      return {
        kind: 'person',
        family: clean(entry.slice(0, comma)),
        given: clean(entry.slice(comma + 1)),
      }
    })
}

export function serializeContributors(contributors: Contributor[]) {
  return contributors
    .map((c) => {
      const family = clean(c.family)
      if (c.kind === 'group') return family
      // The trailing comma keeps a person without given names from reading back as a group
      const given = clean(c.given)
      return given ? `${family}, ${given}` : `${family},`
    })
    .filter((entry) => entry && entry !== ',')
    .join('; ')
}

export type CslName = { family: string; given?: string } | { literal: string }

export function toCslName(contributor: Contributor): CslName {
  if (contributor.kind === 'group') return { literal: clean(contributor.family) }
  const given = clean(contributor.given)
  return given
    ? { family: clean(contributor.family), given }
    : { family: clean(contributor.family) }
}

/**
 * Short label for lists (`Feynman & Leighton, 1964`), computed without citation-js so
 * the particule list stays light. The full APA citation comes from lib/citation.ts.
 */
export function inTextLabel(source: {
  authors: string | null
  year: number | null
  title: string
}) {
  const names = parseContributors(source.authors).map((c) => c.family)
  // No-break space, as citation-js' fr-FR locale writes it
  const year = source.year ?? 's. d.'
  if (!names.length) return `${source.title}, ${year}`
  if (names.length === 1) return `${names[0]}, ${year}`
  if (names.length === 2) return `${names[0]} & ${names[1]}, ${year}`
  return `${names[0]} et al., ${year}`
}
