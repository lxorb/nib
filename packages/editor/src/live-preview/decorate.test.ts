import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, test } from 'vitest'
import { buildDecorations } from './decorate'

/** Somewhere to park the caret that is outside every construct under test. */
const PARK = '\n\nx'

function state(doc: string, cursor: number) {
  return EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
    extensions: [markdown({ base: markdownLanguage })],
  })
}

/** Text the reader never sees. Without a cursor, the caret parks off the sample. */
function concealed(doc: string, cursor?: number): string[] {
  const full = cursor === undefined ? doc + PARK : doc
  const pos = cursor ?? full.length
  const { atomic } = buildDecorations(state(full, pos))

  const out: string[] = []
  atomic.between(0, full.length, (from, to) => {
    out.push(full.slice(from, to))
  })
  return out
}

/** Syntax shown as characters, tagged for the ink-bleed animation. */
function revealedMeta(doc: string, cursor: number): string[] {
  const { decorations } = buildDecorations(state(doc, cursor))
  const out: string[] = []
  decorations.between(0, doc.length, (from, to, value) => {
    if (value.spec.class === 'md-meta') out.push(doc.slice(from, to))
  })
  return out
}

describe('headings', () => {
  test('hides the hash and its trailing space when the caret is elsewhere', () => {
    expect(concealed('# Title')).toEqual(['# '])
  })

  test('reveals the hash when the caret is on the heading line', () => {
    expect(concealed('# Title\n\nbody', 3)).toEqual([])
    expect(revealedMeta('# Title\n\nbody', 3)).toEqual(['# '])
  })

  test('covers all six levels', () => {
    expect(concealed('###### Six')).toEqual(['###### '])
  })
})

describe('inline emphasis', () => {
  test('hides both markers of an inactive bold span', () => {
    expect(concealed('a **bold** b')).toEqual(['**', '**'])
  })

  test('reveals only the span the caret sits in', () => {
    const doc = '**one** and **two**'
    expect(revealedMeta(doc, 3)).toEqual(['**', '**'])
    expect(concealed(doc, 3)).toEqual(['**', '**'])
  })

  test('handles italic, strikethrough, subscript and superscript', () => {
    expect(concealed('_i_ ~~s~~ H~2~O X^2^')).toEqual([
      '_',
      '_',
      '~~',
      '~~',
      '~',
      '~',
      '^',
      '^',
    ])
  })
})

describe('links', () => {
  test('leaves only the label visible', () => {
    expect(concealed('see [docs](https://x.dev "t") now')).toEqual([
      '[',
      ']',
      '(',
      'https://x.dev',
      '"t"',
      ')',
    ])
  })
})

describe('code', () => {
  test('hides inline backticks', () => {
    expect(concealed('run `npm i` first')).toEqual(['`', '`'])
  })

  test('hides fence markers and the language tag', () => {
    expect(concealed('```js\nlet x\n```')).toEqual(['```', 'js', '```'])
  })

  test('reveals only the fence marker whose line holds the caret', () => {
    expect(revealedMeta('```js\nlet x\n```\n', 2)).toEqual(['```', 'js'])
  })
})

describe('blocks', () => {
  test('hides the quote marker', () => {
    expect(concealed('> quoted')).toEqual(['> '])
  })

  test('replaces a horizontal rule', () => {
    expect(concealed('a\n\n---')).toEqual(['---'])
  })

  test('replaces a bullet marker', () => {
    expect(concealed('- one\n- two')).toEqual(['-', '-'])
  })

  test('replaces the task marker and the bullet before it', () => {
    expect(concealed('- [x] done')).toEqual(['- ', '[x]'])
  })

  test('hides the table alignment row', () => {
    expect(concealed('| a |\n| - |\n| 1 |')).toEqual(['| - |'])
  })
})

describe('images', () => {
  test('replaces the whole image with a rendered widget', () => {
    expect(concealed('![alt](pic.png)')).toEqual(['![alt](pic.png)'])
  })

  test('shows the source once the caret enters it', () => {
    expect(concealed('![alt](pic.png)', 3)).toEqual([])
    expect(revealedMeta('![alt](pic.png)', 3)).toEqual(['![', ']', '(', 'pic.png', ')'])
  })
})

describe('document integrity', () => {
  test('decorating never rewrites the document', () => {
    const doc = '# H\n\n**b** _i_ `c` [l](u)\n\n- [ ] t\n\n> q\n\n---\n\n```js\nx\n```\n'
    const before = state(doc, 0)
    buildDecorations(before)
    expect(before.doc.toString()).toBe(doc)
  })

  test('concealed ranges never overlap', () => {
    const doc = '# H\n\n![a](b) **c** `d`\n\n- [x] e\n\n| f |\n| - |\n| g |\n'
    const { atomic } = buildDecorations(state(doc, doc.length - 1))

    let previousEnd = -1
    atomic.between(0, doc.length, (from, to) => {
      expect(from).toBeGreaterThanOrEqual(previousEnd)
      previousEnd = to
    })
  })
})
