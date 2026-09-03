import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { describe, expect, test } from 'vitest'
import { nibMarkdownExtensions } from './extensions'

function tree(doc: string): string {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage, extensions: nibMarkdownExtensions })],
  })

  const out: string[] = []
  syntaxTree(state).iterate({
    enter: (node) => {
      let indent = 0
      for (let parent = node.node.parent; parent; parent = parent.parent) indent++
      out.push(`${'  '.repeat(indent)}${node.name} ${JSON.stringify(doc.slice(node.from, node.to))}`)
    },
  })
  return out.join('\n')
}

/** Every node the parser produced, flat, for presence checks. */
function names(doc: string): string[] {
  return tree(doc)
    .split('\n')
    .map((line) => line.trim().split(' ')[0])
}

describe('highlight', () => {
  test('parses ==marked==', () => {
    expect(names('a ==marked== b')).toContain('Highlight')
    expect(names('a ==marked== b').filter((n) => n === 'HighlightMark')).toHaveLength(2)
  })

  test('leaves a lone equals alone', () => {
    expect(names('a = b')).not.toContain('Highlight')
  })
})

describe('inline math', () => {
  test('parses $x^2$', () => {
    expect(names('see $x^2$ here')).toContain('InlineMath')
  })

  test('ignores prices with spaces', () => {
    expect(names('costs $5 and $9 total')).not.toContain('InlineMath')
  })

  test('ignores a dollar at end of line', () => {
    expect(names('a $ b')).not.toContain('InlineMath')
  })
})

describe('block math', () => {
  test('parses a $$ fence', () => {
    expect(tree('$$\nE = mc^2\n$$\n')).toMatchInlineSnapshot(`
      "Document "$$\\nE = mc^2\\n$$\\n"
        BlockMath "$$\\nE = mc^2\\n$$"
          MathMark "$$"
          MathMark "$$""
    `)
  })
})

describe('footnotes', () => {
  test('parses a reference', () => {
    expect(names('text[^1] more')).toContain('FootnoteRef')
  })

  test('parses a definition', () => {
    expect(names('[^1]: the note')).toContain('FootnoteDef')
  })

  test('does not swallow ordinary links', () => {
    expect(names('[label](url)')).not.toContain('FootnoteRef')
  })
})

describe('front matter', () => {
  test('parses YAML at the top of the document', () => {
    expect(tree('---\ntitle: Hi\n---\n\nbody')).toMatchInlineSnapshot(`
      "Document "---\\ntitle: Hi\\n---\\n\\nbody"
        FrontMatter "---\\ntitle: Hi\\n---"
          FrontMatterMark "---"
          FrontMatterMark "---"
        Paragraph "body""
    `)
  })

  test('leaves a leading horizontal rule alone', () => {
    expect(names('---\n\njust a rule')).not.toContain('FrontMatter')
  })

  test('ignores YAML that is not at the top', () => {
    expect(names('intro\n\n---\ntitle: Hi\n---\n')).not.toContain('FrontMatter')
  })
})
