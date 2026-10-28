/**
 * DOI metadata, read from doi.org by the browser: doi.org answers CORS requests and returns
 * CSL-JSON for Crossref and DataCite DOIs alike.
 *
 * This is the only module that calls a third party, and DOI lookup stays in the front end
 * by design. It returns API-ready fields, so callers never see the CSL-JSON.
 */
import type { SourceFields } from './sources'
import { sourceFromCsl, type CslItem } from '@/lib/cslImport'
import { isDoi, normalizeDoi } from '@/lib/doi'

const DOI_RESOLVER = 'https://doi.org/'
const TIMEOUT_MS = 10_000

export type DoiErrorReason = 'invalid' | 'not_found' | 'unreachable'

export class DoiError extends Error {
  constructor(readonly reason: DoiErrorReason) {
    super(`DOI lookup failed: ${reason}`)
    this.name = 'DoiError'
  }
}

export async function lookupDoi(doi: string): Promise<SourceFields> {
  if (!isDoi(doi)) throw new DoiError('invalid')

  // Each part is encoded, but not the "/" between prefix and suffix
  const path = normalizeDoi(doi).split('/').map(encodeURIComponent).join('/')
  let response: Response
  try {
    response = await fetch(DOI_RESOLVER + path, {
      headers: { Accept: 'application/vnd.citationstyles.csl+json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new DoiError('unreachable')
  }
  if (response.status === 404) throw new DoiError('not_found')
  if (!response.ok) throw new DoiError('unreachable')

  let item: CslItem
  try {
    item = (await response.json()) as CslItem
  } catch {
    // A registration agency without CSL support answers with a landing page instead
    throw new DoiError('not_found')
  }
  // Crossref lowercases DOIs; they are case-insensitive, so keep the user's more readable one
  return { ...sourceFromCsl(item), doi: normalizeDoi(doi).slice(0, 255) }
}
