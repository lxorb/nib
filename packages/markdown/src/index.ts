import { Marked } from 'marked'
import type { Tokens } from 'marked'
import {
  abbreviations,
  callouts,
  collectAbbreviations,
  definitionLists,
  emoji,
  footnotes,
  highlight,
  maths,
  scripts,
} from './extensions'

export interface RenderOptions {
  /** Gather footnote definitions into a list at the end. */
  footnotes?: boolean
  /** Render raw HTML as visible text instead of markup. Used when publishing:
   *  a note is authored content, and a public page must not run its scripts. */
  escapeHtml?: boolean
}

function escape(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )
}

/** One renderer, shared by export and the published blog, so a note looks the
 *  same wherever it is read. */
function renderer(escapeHtml: boolean) {
  const marked = new Marked({ gfm: true, breaks: false })
  marked.use(maths, highlight, scripts, emoji, footnotes, callouts, definitionLists, abbreviations)

  if (escapeHtml) {
    marked.use({
      renderer: {
        html: (token: Tokens.HTML | Tokens.Tag) => escape(token.text),
      },
    })
  }

  return marked
}

const trusting = renderer(false)
const publishing = renderer(true)

/** Strips YAML front matter, which is metadata rather than content. */
export function stripFrontMatter(source: string): string {
  return source.startsWith('---')
    ? source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    : source
}

export function frontMatter(source: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)
  return match ? match[1] : null
}

/** The first heading, or null when the note has none. */
export function documentTitle(source: string): string | null {
  const match = /^#\s+(.+)$/m.exec(stripFrontMatter(source))
  return match ? match[1].trim() : null
}

export function renderMarkdown(source: string, options: RenderOptions = {}): string {
  const marked = options.escapeHtml ? publishing : trusting
  const body = stripFrontMatter(source)
  let html = marked.parse(body, { async: false })

  html = markAbbreviations(html, collectAbbreviations(body))

  if (!options.footnotes) return html

  // Footnote definitions render as <li>; gather any trailing run into a list.
  return html.replace(
    /(?:<li id="fn-[\s\S]*?<\/li>\n?)+/g,
    (block) => `<section class="footnotes"><ol>${block}</ol></section>`,
  )
}

/** Wraps each defined abbreviation in `<abbr>`, in text only - never inside a
 *  tag, an attribute, or a code element. */
function markAbbreviations(html: string, terms: Map<string, string>): string {
  if (!terms.size) return html

  // Longest first, so `HTML5` wins over `HTML` where both are defined.
  const pattern = [...terms.keys()]
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  const skip = /<(code|pre|abbr|script|style)\b[\s\S]*?<\/\1>|<[^>]+>/g
  const word = new RegExp(`\\b(${pattern})\\b`, 'g')

  let out = ''
  let last = 0

  for (const match of html.matchAll(skip)) {
    out += text(html.slice(last, match.index))
    out += match[0]
    last = match.index + match[0].length
  }

  return out + text(html.slice(last))

  function text(chunk: string): string {
    return chunk.replace(word, (term) => `<abbr title="${escape(terms.get(term)!)}">${term}</abbr>`)
  }
}

export {
  abbreviations,
  callouts,
  definitionLists,
  emoji,
  footnotes,
  highlight,
  maths,
  scripts,
} from './extensions'
