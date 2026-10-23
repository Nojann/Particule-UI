import { describe, it, expect } from 'vitest'

import { excerpt, PERMALINK_PATTERN, slugify } from '../slug'

describe('slugify', () => {
  it('strips accents, case and punctuation', () => {
    expect(slugify('Énergie cinétique !')).toBe('energie-cinetique')
    expect(slugify("  L'entropie (S)  ")).toBe('l-entropie-s')
  })

  it('returns an empty string when nothing is left', () => {
    expect(slugify('?!')).toBe('')
  })

  it('produces valid permalinks', () => {
    expect(slugify('Loi de Hooke, 1678')).toMatch(PERMALINK_PATTERN)
  })
})

describe('excerpt', () => {
  it('removes Markdown syntax', () => {
    expect(excerpt('# Titre\n\nUn **mot** et [un lien](https://x.org), voir [[energie]].')).toBe(
      'Titre Un mot et un lien, voir energie.',
    )
  })

  it('removes the marker of every list item', () => {
    expect(excerpt('- un\n- deux\n1. trois')).toBe('un deux trois')
  })

  it('truncates long text', () => {
    expect(excerpt('a'.repeat(200), 10)).toBe('aaaaaaaaaa…')
  })
})
