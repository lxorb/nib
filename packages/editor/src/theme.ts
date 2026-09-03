import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { markTags } from './markdown/extensions'

/** Chrome for the editor itself. Everything visual reads from the theme tokens,
 *  so swapping a theme restyles the editor without touching this file. */
export const nibTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontFamily: 'var(--font-content)',
    fontSize: 'var(--text-content)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'var(--leading-content)',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--accent-soft)',
    borderRadius: '3px',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--accent-soft)',
    outline: '1px solid var(--accent-line)',
    borderRadius: '3px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--accent)',
    color: '#fff',
  },
})

export const nibHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.92em', fontWeight: '620', lineHeight: '1.28' },
  { tag: tags.heading2, fontSize: '1.5em', fontWeight: '620', lineHeight: '1.3' },
  { tag: tags.heading3, fontSize: '1.22em', fontWeight: '620' },
  { tag: tags.heading4, fontSize: '1.06em', fontWeight: '620' },
  { tag: tags.heading5, fontSize: '1em', fontWeight: '620' },
  { tag: tags.heading6, fontSize: '0.94em', fontWeight: '620', color: 'var(--muted-strong)' },
  { tag: tags.strong, fontWeight: '650', color: 'var(--text-strong)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--muted)' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--muted)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.88em' },
  { tag: tags.quote, color: 'var(--muted-strong)' },
  { tag: tags.list, color: 'var(--text)' },
  { tag: tags.contentSeparator, color: 'var(--muted)' },
  { tag: tags.meta, color: 'var(--md-char-color)' },
  { tag: tags.processingInstruction, color: 'var(--md-char-color)' },
  { tag: markTags.highlight, background: 'var(--accent-soft)', color: 'var(--text-strong)' },
  { tag: markTags.math, fontFamily: 'var(--font-mono)', color: 'var(--muted-strong)' },
  { tag: markTags.footnote, color: 'var(--accent)', fontSize: '0.8em', verticalAlign: 'super' },
  { tag: markTags.frontMatter, fontFamily: 'var(--font-mono)', color: 'var(--muted)' },
])

// Code fences are coloured separately, in `code-theme.ts`, so the syntax theme
// can be chosen independently of the one the document is written in.
