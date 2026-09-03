import katex from 'katex'
// Chemical equations: `\ce{H2O}` and friends, as Typora supports.
import 'katex/contrib/mhchem'
import type { MarkedExtension, Tokens } from 'marked'
import { get } from 'node-emoji'

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

/** `:smile:` becomes the character it names. */
export const emoji: MarkedExtension = {
  extensions: [
    {
      name: 'emoji',
      level: 'inline',
      start: (src: string) => src.indexOf(':'),
      tokenizer(src: string) {
        const match = /^:([a-z0-9_+-]+):/i.exec(src)
        if (!match) return undefined

        const character = get(match[1])
        if (!character) return undefined

        return { type: 'emoji', raw: match[0], text: character }
      },
      renderer: (token: Tokens.Generic) => String(token.text),
    },
  ],
}

/** A term on one line, its meanings on the `:` lines under it:
 *
 *      Markdown
 *      : A way of writing formatted text.
 *      : Also the format itself.
 */
export const definitionLists: MarkedExtension = {
  extensions: [
    {
      name: 'definitionList',
      level: 'block',
      start: (src: string) => {
        const at = src.search(/\n[ \t]{0,3}:[ \t]+\S/)
        return at < 0 ? undefined : at
      },
      tokenizer(src: string) {
        const match = /^((?:[^\n:][^\n]*\n(?:[ \t]{0,3}:[ \t]+[^\n]*(?:\n|$))+)+)/.exec(src)
        if (!match) return undefined

        const items: { term: string; details: string[] }[] = []

        for (const line of match[1].split('\n')) {
          if (!line.trim()) continue

          const detail = /^[ \t]{0,3}:[ \t]+(.*)$/.exec(line)
          if (detail) items.at(-1)?.details.push(detail[1])
          else items.push({ term: line.trim(), details: [] })
        }

        // A term with nothing under it is a paragraph, not a definition list.
        if (!items.length || items.some((item) => !item.details.length)) return undefined

        // Tokenized here: the lexer is only reachable from the tokenizer.
        return {
          type: 'definitionList',
          raw: match[1],
          items: items.map((item) => ({
            term: this.lexer.inlineTokens(item.term),
            details: item.details.map((detail) => this.lexer.inlineTokens(detail)),
          })),
        }
      },
      renderer(token: Tokens.Generic) {
        const items = token.items as { term: Tokens.Generic[]; details: Tokens.Generic[][] }[]

        const body = items
          .map((item) => {
            const term = `<dt>${this.parser.parseInline(item.term)}</dt>`
            const details = item.details
              .map((detail) => `<dd>${this.parser.parseInline(detail)}</dd>`)
              .join('\n')

            return `${term}\n${details}`
          })
          .join('\n')

        return `<dl>\n${body}\n</dl>\n`
      },
    },
  ],
}

/** `*[HTML]: HyperText Markup Language` defines it; every later mention of
 *  `HTML` in the document then carries the expansion. */
export const abbreviations: MarkedExtension = {
  extensions: [
    {
      name: 'abbrDef',
      level: 'block',
      start: (src: string) => {
        const at = src.search(/\*\[[^\]\n]+\]:/)
        return at < 0 ? undefined : at
      },
      tokenizer(src: string) {
        const match = /^\*\[([^\]\n]+)\]:[ \t]*(.*)(?:\r?\n|$)/.exec(src)
        if (!match) return undefined

        return { type: 'abbrDef', raw: match[0], term: match[1], title: match[2].trim() }
      },
      // The definition itself is not shown; it only teaches the document a word.
      renderer: () => '',
    },
  ],
}

/** Collects the abbreviations a document defines, so the rendered HTML can be
 *  marked up afterwards — the definition may come after its first use. */
export function collectAbbreviations(source: string): Map<string, string> {
  const found = new Map<string, string>()

  for (const match of source.matchAll(/^\*\[([^\]\n]+)\]:[ \t]*(.*)$/gm)) {
    const term = match[1].trim()
    if (term) found.set(term, match[2].trim())
  }

  return found
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
