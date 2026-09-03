import { Tag, tags } from '@lezer/highlight'
import type { BlockContext, Line, MarkdownConfig } from '@lezer/markdown'

const DOLLAR = 36
const EQUALS = 61
const BRACKET_OPEN = 91
const BRACKET_CLOSE = 93
const CARET = 94
const BACKSLASH = 92
const NEWLINE = 10

/** Tags for the constructs CommonMark and GFM do not define. */
export const markTags = {
  highlight: Tag.define(),
  math: Tag.define(),
  footnote: Tag.define(),
  frontMatter: Tag.define(),
}

function isSpace(code: number): boolean {
  return code === 32 || code === 9 || code === NEWLINE || code === -1
}

// Lezer pairs opening and closing delimiters by object identity, so this has
// to be one shared instance rather than a literal built per call.
const HIGHLIGHT_DELIMITER = { resolve: 'Highlight', mark: 'HighlightMark' }

/** `==marked==`, Typora's highlight syntax. */
export const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: 'Highlight', style: markTags.highlight },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      after: 'Emphasis',
      parse(cx, next, pos) {
        if (next !== EQUALS || cx.char(pos + 1) !== EQUALS) return -1
        return cx.addDelimiter(HIGHLIGHT_DELIMITER, pos, pos + 2, true, true)
      },
    },
  ],
}

/** `$x$`. Requires non-space just inside the delimiters, so prices survive. */
export const InlineMath: MarkdownConfig = {
  defineNodes: [
    { name: 'InlineMath', style: markTags.math },
    { name: 'MathMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'InlineMath',
      before: 'Escape',
      parse(cx, next, pos) {
        if (next !== DOLLAR || cx.char(pos + 1) === DOLLAR) return -1
        if (isSpace(cx.char(pos + 1))) return -1

        for (let i = pos + 1; i < cx.end; i++) {
          const code = cx.char(i)
          if (code === NEWLINE) return -1
          if (code === BACKSLASH) {
            i++
            continue
          }
          if (code === DOLLAR && !isSpace(cx.char(i - 1))) {
            return cx.addElement(
              cx.elt('InlineMath', pos, i + 1, [
                cx.elt('MathMark', pos, pos + 1),
                cx.elt('MathMark', i, i + 1),
              ]),
            )
          }
        }
        return -1
      },
    },
  ],
}

/** A `$$` fence on its own line, closed by another. */
export const BlockMath: MarkdownConfig = {
  defineNodes: [{ name: 'BlockMath', block: true, style: markTags.math }],
  parseBlock: [
    {
      name: 'BlockMath',
      before: 'HorizontalRule',
      parse(cx: BlockContext, line: Line) {
        if (line.text.slice(line.pos).trim() !== '$$') return false

        const from = cx.lineStart + line.pos
        const marks = [cx.elt('MathMark', from, from + 2)]
        let to = from + 2

        while (cx.nextLine()) {
          if (line.text.slice(line.pos).trim() === '$$') {
            const close = cx.lineStart + line.pos
            marks.push(cx.elt('MathMark', close, close + 2))
            to = close + 2
            cx.nextLine()
            break
          }
          to = cx.lineStart + line.text.length
        }

        cx.addElement(cx.elt('BlockMath', from, to, marks))
        return true
      },
    },
  ],
}

/** `[^id]` in the text and `[^id]: …` at the bottom. */
export const Footnote: MarkdownConfig = {
  defineNodes: [
    { name: 'FootnoteRef', style: markTags.footnote },
    { name: 'FootnoteDef', block: true },
    { name: 'FootnoteMark', style: tags.processingInstruction },
    { name: 'FootnoteLabel', style: tags.labelName },
  ],
  parseInline: [
    {
      name: 'FootnoteRef',
      before: 'Link',
      parse(cx, next, pos) {
        if (next !== BRACKET_OPEN || cx.char(pos + 1) !== CARET) return -1

        for (let i = pos + 2; i < cx.end; i++) {
          const code = cx.char(i)
          if (code === NEWLINE || code === BRACKET_OPEN) return -1
          if (code === BRACKET_CLOSE) {
            if (i === pos + 2) return -1
            return cx.addElement(
              cx.elt('FootnoteRef', pos, i + 1, [
                cx.elt('FootnoteMark', pos, pos + 2),
                cx.elt('FootnoteLabel', pos + 2, i),
                cx.elt('FootnoteMark', i, i + 1),
              ]),
            )
          }
        }
        return -1
      },
    },
  ],
  parseBlock: [
    {
      name: 'FootnoteDef',
      before: 'LinkReference',
      parse(cx: BlockContext, line: Line) {
        const match = /^\[\^([^\]\s]+)\]:/.exec(line.text.slice(line.pos))
        if (!match) return false

        const from = cx.lineStart + line.pos
        const to = from + line.text.length - line.pos
        cx.addElement(
          cx.elt('FootnoteDef', from, to, [
            cx.elt('FootnoteMark', from, from + 2),
            cx.elt('FootnoteLabel', from + 2, from + 2 + match[1].length),
            cx.elt('FootnoteMark', from + 2 + match[1].length, from + match[0].length),
          ]),
        )
        cx.nextLine()
        return true
      },
    },
  ],
}

/** YAML metadata fenced by `---`, only at the very top of a document. */
export const FrontMatter: MarkdownConfig = {
  defineNodes: [
    { name: 'FrontMatter', block: true, style: markTags.frontMatter },
    { name: 'FrontMatterMark', style: tags.processingInstruction },
  ],
  parseBlock: [
    {
      name: 'FrontMatter',
      before: 'HorizontalRule',
      parse(cx: BlockContext, line: Line) {
        if (cx.lineStart !== 0 || line.text.trim() !== '---') return false
        // A document may legitimately open with a horizontal rule. Require the
        // next line to look like YAML before committing, since a block parser
        // cannot rewind once it has consumed lines.
        if (!/^\s*[\w.$-]+\s*:/.test(cx.peekLine())) return false

        const marks = [cx.elt('FrontMatterMark', 0, 3)]
        let to = 3

        while (cx.nextLine()) {
          if (line.text.trim() === '---') {
            marks.push(cx.elt('FrontMatterMark', cx.lineStart, cx.lineStart + 3))
            to = cx.lineStart + 3
            cx.nextLine()
            break
          }
          to = cx.lineStart + line.text.length
        }

        cx.addElement(cx.elt('FrontMatter', 0, to, marks))
        return true
      },
    },
  ],
}

export const nibMarkdownExtensions = [Highlight, InlineMath, BlockMath, Footnote, FrontMatter]
