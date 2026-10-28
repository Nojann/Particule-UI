import { describe, it, expect } from 'vitest'

import {
  contributorSchema,
  inTextLabel,
  parseContributors,
  serializeContributors,
  toCslName,
  type Contributor,
} from '../contributors'

const feynman: Contributor = { kind: 'person', family: 'Feynman', given: 'Richard P.' }
const leighton: Contributor = { kind: 'person', family: 'Leighton', given: 'Robert' }
const who: Contributor = { kind: 'group', family: 'Organisation mondiale de la santé', given: '' }

describe('serializeContributors / parseContributors', () => {
  it('writes the format the API stores', () => {
    expect(serializeContributors([feynman, leighton, who])).toBe(
      'Feynman, Richard P.; Leighton, Robert; Organisation mondiale de la santé',
    )
  })

  it('reads back what it wrote', () => {
    const list = [feynman, leighton, who, { kind: 'person', family: 'Platon', given: '' } as const]
    expect(parseContributors(serializeContributors(list))).toEqual(list)
  })

  it('keeps a person without given names a person', () => {
    const text = serializeContributors([{ kind: 'person', family: 'Platon', given: '' }])
    expect(text).toBe('Platon,')
    expect(parseContributors(text)).toEqual([{ kind: 'person', family: 'Platon', given: '' }])
  })

  it('reads legacy free text as a group', () => {
    expect(parseContributors('Richard Feynman')).toEqual([
      { kind: 'group', family: 'Richard Feynman', given: '' },
    ])
  })

  it('ignores extra spaces and empty entries', () => {
    expect(parseContributors('  Feynman ,  Richard   P. ;; ;')).toEqual([feynman])
    expect(parseContributors(null)).toEqual([])
    expect(parseContributors('')).toEqual([])
  })

  it('drops entries left empty in the form', () => {
    expect(serializeContributors([feynman, { kind: 'person', family: ' ', given: '' }])).toBe(
      'Feynman, Richard P.',
    )
  })
})

describe('contributorSchema', () => {
  function errors(contributor: Contributor) {
    const result = contributorSchema.safeParse(contributor)
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
  }

  it('accepts persons and groups', () => {
    expect(errors(feynman)).toEqual([])
    expect(errors({ kind: 'person', family: 'de Beauvoir', given: 'Simone' })).toEqual([])
    expect(errors({ kind: 'person', family: 'Sartre', given: 'Jean-Paul' })).toEqual([])
    expect(errors({ kind: 'person', family: 'O’Neil', given: 'Cathy' })).toEqual([])
    expect(errors(who)).toEqual([])
  })

  it('requires a family name', () => {
    expect(errors({ kind: 'person', family: '  ', given: 'Richard' })).toEqual(['family'])
    expect(errors({ kind: 'group', family: '', given: '' })).toEqual(['family'])
  })

  it('refuses the separators of the stored text', () => {
    expect(errors({ kind: 'person', family: 'Feynman; Leighton', given: '' })).toEqual(['family'])
    expect(errors({ kind: 'group', family: 'MIT, Physics', given: '' })).toEqual(['family'])
    expect(errors({ kind: 'person', family: 'Feynman', given: 'Richard; Robert' })).toEqual([
      'given',
    ])
  })

  it('refuses given names APA cannot turn into initials', () => {
    expect(errors({ kind: 'person', family: 'Feynman', given: 'R2D2' })).toEqual(['given'])
  })

  it('ignores the given names of a group', () => {
    expect(errors({ kind: 'group', family: 'CNRS', given: '123' })).toEqual([])
  })
})

describe('toCslName', () => {
  it('maps persons and groups to CSL names', () => {
    expect(toCslName(feynman)).toEqual({ family: 'Feynman', given: 'Richard P.' })
    expect(toCslName({ kind: 'person', family: 'Platon', given: '' })).toEqual({ family: 'Platon' })
    expect(toCslName(who)).toEqual({ literal: 'Organisation mondiale de la santé' })
  })
})

describe('inTextLabel', () => {
  const source = (authors: string, year: number | null = 1964) => ({ authors, year, title: 'T' })

  it('follows APA for one, two and more authors', () => {
    expect(inTextLabel(source('Feynman, Richard'))).toBe('Feynman, 1964')
    expect(inTextLabel(source('Feynman, Richard; Leighton, Robert'))).toBe(
      'Feynman & Leighton, 1964',
    )
    expect(inTextLabel(source('Feynman, R.; Leighton, R.; Sands, M.'))).toBe('Feynman et al., 1964')
  })

  it('keeps a group name whole and marks undated sources', () => {
    expect(inTextLabel(source('Organisation mondiale de la santé', null))).toBe(
      'Organisation mondiale de la santé, s. d.',
    )
  })
})
