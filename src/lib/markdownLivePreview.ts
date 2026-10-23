import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type EditorState } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'

const hidden = Decoration.replace({})

/** Lines holding a cursor or selection, where the Markdown syntax stays visible */
function activeLines(state: EditorState) {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) lines.add(n)
  }
  return lines
}

function buildDecorations(view: EditorView) {
  const { state } = view
  const active = view.hasFocus ? activeLines(state) : new Set<number>()
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        const parent = node.node.parent?.name ?? ''
        let hideTo = node.to

        switch (node.name) {
          case 'HeaderMark':
            // Only `# Title` headings, with the space after the hashes
            if (!parent.startsWith('ATXHeading')) return
            if (state.sliceDoc(hideTo, hideTo + 1) === ' ') hideTo++
            break
          case 'EmphasisMark':
          case 'StrikethroughMark':
            break
          case 'CodeMark':
            // Inline `code` only; fenced code blocks keep their ```
            if (parent !== 'InlineCode') return
            break
          case 'LinkMark':
            if (parent !== 'Link') return
            break
          case 'URL':
            if (parent !== 'Link') return
            break
          default:
            return
        }

        if (active.has(state.doc.lineAt(node.from).number)) return
        builder.add(node.from, hideTo, hidden)
      },
    })
  }
  return builder.finish()
}

const hideSyntax = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

const markdownStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700' },
  { tag: tags.heading2, fontSize: '1.35em', fontWeight: '700' },
  { tag: tags.heading3, fontSize: '1.15em', fontWeight: '600' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted-foreground)' },
  { tag: tags.quote, color: 'var(--muted-foreground)', fontStyle: 'italic' },
  {
    tag: tags.monospace,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.9em',
    backgroundColor: 'var(--muted)',
    borderRadius: '3px',
  },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--muted-foreground)' },
])

// Colors come from the app's CSS variables, so the editor follows light / dark mode
const theme = EditorView.theme({
  // The negative margin cancels the lines' padding, so the text lines up with the title
  '&': {
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
    fontSize: '1rem',
    margin: '0 -2px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
  '.cm-content': { padding: '0', caretColor: 'var(--foreground)' },
  // Without some padding, the cursor at the start of a line is clipped by the scroller
  '.cm-line': { padding: '0 2px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
    { backgroundColor: 'color-mix(in oklch, var(--ring) 35%, transparent)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
})

/** Obsidian-like live preview: styled Markdown, syntax shown only on the cursor's lines */
export const markdownLivePreview = [syntaxHighlighting(markdownStyle), hideSyntax, theme]
