/**
 * APA references through citation-js (CSL). This is the only module that imports it, and
 * only dynamically: citeproc is heavy, so it loads the first time a reference is shown.
 */

/** Follows the app locale once the UI is translated */
export const CSL_LOCALE = 'fr-FR'
const CSL_STYLE = 'apa'

/** A run of text with the formatting APA gives it */
export interface Segment {
  text: string
  italic?: boolean
  superscript?: boolean
}

type CiteClass = typeof import('@citation-js/core').Cite

let loading: Promise<CiteClass> | null = null

function loadCite() {
  loading ??= Promise.all([import('@citation-js/core'), import('@citation-js/plugin-csl')]).then(
    ([core]) => core.Cite,
    (error) => {
      // Let the next call try again, e.g. after a network hiccup
      loading = null
      throw error
    },
  )
  return loading
}

export async function formatReference(item: object): Promise<Segment[]> {
  const Cite = await loadCite()
  const html = new Cite(item).format('bibliography', {
    format: 'html',
    style: CSL_STYLE,
    lang: CSL_LOCALE,
  }) as string
  return segmentsFromHtml(html)
}

export async function formatInTextCitation(item: object): Promise<string> {
  const Cite = await loadCite()
  // The plugin's typings mark entry and citationsPre/Post as required; they are not
  const options = { format: 'text', style: CSL_STYLE, lang: CSL_LOCALE }
  return new Cite(item).format('citation', options as never) as string
}

const SKIPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE'])

/**
 * citeproc's HTML reduced to text and the formatting APA needs. Nothing else of the
 * markup survives, so the result can be rendered by Vue without v-html.
 */
export function segmentsFromHtml(html: string): Segment[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('.csl-entry') ?? doc.body
  const segments: Segment[] = []

  function walk(node: Node, italic: boolean, superscript: boolean) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (!text) return
      const last = segments[segments.length - 1]
      if (last && !!last.italic === italic && !!last.superscript === superscript) {
        last.text += text
      } else {
        segments.push({
          text,
          ...(italic && { italic: true }),
          ...(superscript && { superscript: true }),
        })
      }
      return
    }
    if (!(node instanceof Element) || SKIPPED.has(node.tagName)) return
    const style = node.getAttribute('style') ?? ''
    const isItalic =
      italic || ['I', 'EM'].includes(node.tagName) || /font-style:\s*italic/.test(style)
    const isSuperscript = superscript || node.tagName === 'SUP'
    node.childNodes.forEach((child) => walk(child, isItalic, isSuperscript))
  }

  walk(root, false, false)
  // citeproc indents its markup
  if (segments.length) {
    const first = segments[0]!
    const last = segments[segments.length - 1]!
    first.text = first.text.trimStart()
    last.text = last.text.trimEnd()
  }
  return segments.filter((s) => s.text)
}

export function segmentsToText(segments: Segment[]) {
  return segments.map((s) => s.text).join('')
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** For the clipboard only, so the italics survive a paste into a word processor */
export function segmentsToHtml(segments: Segment[]) {
  return segments
    .map((s) => {
      let html = escapeHtml(s.text)
      if (s.superscript) html = `<sup>${html}</sup>`
      if (s.italic) html = `<i>${html}</i>`
      return html
    })
    .join('')
}
