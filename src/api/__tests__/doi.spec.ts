import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { DoiError, lookupDoi } from '../doi'
import { crossrefArticle } from '@/lib/__tests__/fixtures/csl'

describe('lookupDoi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks doi.org for CSL-JSON and returns the fields of a source', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))

    const fields = await lookupDoi('https://doi.org/10.1103/RevModPhys.20.367')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://doi.org/10.1103/RevModPhys.20.367')
    expect(new Headers(init!.headers).get('Accept')).toBe(
      'application/vnd.citationstyles.csl+json',
    )
    expect(init!.signal).toBeInstanceOf(AbortSignal)
    expect(fields).toMatchObject({ type: 'journal_article', authors: 'Feynman, R. P.' })
  })

  it('keeps the DOI as the user wrote it, not as Crossref lowercases it', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    const fields = await lookupDoi('doi:10.1103/RevModPhys.20.367')
    expect(fields.doi).toBe('10.1103/RevModPhys.20.367')
  })

  it('encodes the parts of the DOI but keeps its slash', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(crossrefArticle))
    await lookupDoi('10.1002/(SICI)1097-4571#x')
    expect(fetchMock.mock.calls[0]![0]).toBe('https://doi.org/10.1002/(SICI)1097-4571%23x')
  })

  it('refuses a malformed DOI without a request', async () => {
    await expect(lookupDoi('not a doi')).rejects.toEqual(new DoiError('invalid'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['a 404', () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 })), 'not_found'],
    ['a landing page', () => fetchMock.mockResolvedValueOnce(new Response('<html>')), 'not_found'],
    ['a server error', () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 })), 'unreachable'],
    ['a network failure', () => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')), 'unreachable'],
    ['a timeout', () => fetchMock.mockRejectedValueOnce(new DOMException('', 'TimeoutError')), 'unreachable'],
  ])('maps %s to %s', async (_, respond, reason) => {
    respond()
    await expect(lookupDoi('10.1103/x')).rejects.toMatchObject({ reason })
  })
})
