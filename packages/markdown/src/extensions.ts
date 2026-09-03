import katex from 'katex'
import type { MarkedExtension, Tokens } from 'marked'

/** Renders TeX, or shows the source when it will not parse. */
function math(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' })
  } catch {
    const escaped = tex.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
    return display ? `<pre class="math-error">${escaped}</pre>` : `<code>${escaped}</code>`
  }
}

/** `==marked==` */
export const highlight: MarkedExtension = {
  extensions: [
    {
      name: 'highlight',
      level: 'inline',
      start: (src: string) => src.indexOf('=='),
      tokenizer(src: string) {
        const match = /^==(?=\S)([\s\S]*?\S)==/.exec(src)
        if (!match) return undefined

        return {
          type: 'highlight',
          raw: match[0],
          text: match[1],
          tokens: this.lexer.inlineTokens(match[1]),
        }
      },
      renderer(token: Tokens.Generic) {
        return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`
      },
    },
  ],
}

/** `H~2~O` and `X^2^` */
export const scripts: MarkedExtension = {
  extensions: [
    {
      name: 'subscript',
      level: 'inline',
      start: (src: string) => src.indexOf('~'),
      tokenizer(src: string) {
        const match = /^~(?!~)([^~\s][^~]*)~/.exec(src)
        if (!match) return undefined
        return { type: 'subscript', raw: match[0], text: match[1] }
      },
      renderer: (token: Tokens.Generic) => `<sub>${token.text}</sub>`,
    },
    {
      name: 'superscript',
      level: 'inline',
      start: (src: string) => src.indexOf('^'),
      tokenizer(src: string) {
        const match = /^\^([^^\s][^^]*)\^/.exec(src)
        if (!match) return undefined
        return { type: 'superscript', raw: match[0], text: match[1] }
      },
      renderer: (token: Tokens.Generic) => `<sup>${token.text}</sup>`,
    },
  ],
}

/** `$inline$` and a `$$` block on its own lines. */
export const maths: MarkedExtension = {
  extensions: [
    {
      name: 'blockMath',
      level: 'block',
      start: (src: string) => src.indexOf('$$'),
      tokenizer(src: string) {
        const match = /^\$\$\r?\n([\s\S]+?)\r?\n\$\$(?:\r?\n|$)/.exec(src)
        if (!match) return undefined
        return { type: 'blockMath', raw: match[0], text: match[1] }
      },
      renderer: (token: Tokens.Generic) =>
        `<div class="math-block">${math(token.text ?? '', true)}</div>`,
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src: string) => src.indexOf('$'),
      tokenizer(src: string) {
        const match = /^\$(?!\s)((?:\\.|[^$\\])+?)(?<!\s)\$/.exec(src)
        if (!match) return undefined
        return { type: 'inlineMath', raw: match[0], text: match[1] }
      },
      renderer: (token: Tokens.Generic) =>
        `<span class="math-inline">${math(token.text ?? '', false)}</span>`,
    },
  ],
}

const CALLOUT = /^\s*\[!(note|tip|important|warning|caution)\]\s*/i
const CALLOUT_TEXT = /\[!(?:note|tip|important|warning|caution)\]\s*(?:<br\s*\/?>)?\s*/i

/** GitHub-style alerts: a blockquote whose first line names a kind. */
export const callouts: MarkedExtension = {
  renderer: {
    blockquote(token: Tokens.Blockquote) {
      const first = token.tokens?.[0]
      const raw = first && 'text' in first ? String(first.text) : ''
      const match = CALLOUT.exec(raw)

      if (!match) return `<blockquote>\n${this.parser.parse(token.tokens ?? [])}</blockquote>\n`

      const kind = match[1].toLowerCase()
      const label = kind.charAt(0).toUpperCase() + kind.slice(1)

      // The marker becomes the heading, so drop it from the rendered body.
      const body = this.parser.parse(token.tokens ?? []).replace(CALLOUT_TEXT, '')

      return `<div class="callout" data-kind="${kind}"><p class="callout-label">${label}</p>\n${body}</div>\n`
    },
  },
}

/** `[^1]` in the text, `[^1]: …` at the bottom. */
export const footnotes: MarkedExtension = {
  extensions: [
    {
      name: 'footnoteDef',
      level: 'block',
      start: (src: string) => src.indexOf('[^'),
      tokenizer(src: string) {
        const match = /^\[\^([^\]\s]+)\]:\s*(.+)(?:\r?\n|$)/.exec(src)
        if (!match) return undefined

        return {
          type: 'footnoteDef',
          raw: match[0],
          id: match[1],
          tokens: this.lexer.inlineTokens(match[2]),
        }
      },
      renderer(token: Tokens.Generic) {
        const id = String(token.id)
        return `<li id="fn-${id}"><a class="footnote-back" href="#fnref-${id}">${id}</a> ${this.parser.parseInline(token.tokens ?? [])}</li>\n`
      },
    },
    {
      name: 'footnoteRef',
      level: 'inline',
      start: (src: string) => src.indexOf('[^'),
      tokenizer(src: string) {
        const match = /^\[\^([^\]\s]+)\]/.exec(src)
        if (!match) return undefined
        return { type: 'footnoteRef', raw: match[0], id: match[1] }
      },
      renderer: (token: Tokens.Generic) =>
        `<sup class="footnote-ref" id="fnref-${token.id}"><a href="#fn-${token.id}">${token.id}</a></sup>`,
    },
  ],
}
