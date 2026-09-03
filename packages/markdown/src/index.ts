import { Marked } from 'marked'
import type { Tokens } from 'marked'
import { callouts, emoji, footnotes, highlight, maths, scripts } from './extensions'

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
  marked.use(maths, highlight, scripts, emoji, footnotes, callouts)

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
  const html = marked.parse(stripFrontMatter(source), { async: false })

  if (!options.footnotes) return html

  // Footnote definitions render as <li>; gather any trailing run into a list.
  return html.replace(
    /(?:<li id="fn-[\s\S]*?<\/li>\n?)+/g,
    (block) => `<section class="footnotes"><ol>${block}</ol></section>`,
  )
}

export { callouts, emoji, footnotes, highlight, maths, scripts } from './extensions'
