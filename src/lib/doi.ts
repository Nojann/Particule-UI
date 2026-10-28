/** `10.…`, `doi:10.…` and `https://doi.org/10.…` all become `10.…` */
export function normalizeDoi(doi: string) {
  return doi.trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '')
}

// Crossref's recommended pattern: a "10." prefix with a registrant code, then any suffix
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/

export function isDoi(text: string) {
  return DOI_PATTERN.test(normalizeDoi(text))
}

/**
 * The DOI inside pasted text, e.g. a doi.org link or a reference copied from a PDF.
 * Trailing punctuation is left out: it usually ends the sentence, not the DOI.
 */
export function extractDoi(text: string): string | null {
  const match = /\b10\.\d{4,9}\/\S+/.exec(decodeURIComponentSafe(text))
  return match ? match[0].replace(/[.,;:)\]}>"'’»]+$/, '') : null
}

// Links copied from a browser may encode the "/" of the DOI
function decodeURIComponentSafe(text: string) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Two spellings of the same DOI compare equal: DOIs are case-insensitive */
export function sameDoi(a: string, b: string) {
  return normalizeDoi(a).toLowerCase() === normalizeDoi(b).toLowerCase()
}
