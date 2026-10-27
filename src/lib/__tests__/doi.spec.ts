import { describe, it, expect } from 'vitest'

import { extractDoi, isDoi, normalizeDoi, sameDoi } from '../doi'

describe('normalizeDoi', () => {
  it.each([
    '10.1/x',
    ' doi:10.1/x ',
    'DOI: 10.1/x',
    'https://doi.org/10.1/x',
    'http://dx.doi.org/10.1/x',
  ])('turns %j into a bare DOI', (doi) => {
    expect(normalizeDoi(doi)).toBe('10.1/x')
  })
})

describe('isDoi', () => {
  it('accepts a DOI, with or without its prefix', () => {
    expect(isDoi('10.1103/RevModPhys.20.367')).toBe(true)
    expect(isDoi('https://doi.org/10.1103/RevModPhys.20.367')).toBe(true)
  })

  it('refuses text that is not a DOI', () => {
    expect(isDoi('Feynman lectures')).toBe(false)
    expect(isDoi('10.12/x')).toBe(false) // registrant code too short
    expect(isDoi('10.1103/with space')).toBe(false)
  })
})

describe('extractDoi', () => {
  it('finds the DOI in a link or in text around it', () => {
    expect(extractDoi('https://doi.org/10.1103/RevModPhys.20.367')).toBe(
      '10.1103/RevModPhys.20.367',
    )
    expect(extractDoi('https://dx.doi.org/10.1103%2FRevModPhys.20.367')).toBe(
      '10.1103/RevModPhys.20.367',
    )
    expect(extractDoi('Rev. Mod. Phys. 20, 367 (doi:10.1103/RevModPhys.20.367).')).toBe(
      '10.1103/RevModPhys.20.367',
    )
  })

  it('returns null when there is no DOI', () => {
    expect(extractDoi('https://www.youtube.com/watch?v=1')).toBeNull()
    expect(extractDoi('%E0%A4%A')).toBeNull()
  })
})

describe('sameDoi', () => {
  it('ignores case and prefixes', () => {
    expect(sameDoi('10.5281/ZENODO.1', 'https://doi.org/10.5281/zenodo.1')).toBe(true)
    expect(sameDoi('10.5281/zenodo.1', '10.5281/zenodo.2')).toBe(false)
  })
})
