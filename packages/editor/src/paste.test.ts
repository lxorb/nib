import { describe, expect, test } from 'vitest'
import { htmlToMarkdown } from './paste'

describe('pasting a web page', () => {
  test('headings and emphasis become markdown', () => {
    expect(htmlToMarkdown('<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p>')).toBe(
      '## Title\n\n**bold** and *italic*',
    )
  })

  test('links keep their target', () => {
    expect(htmlToMarkdown('<a href="https://x.dev">site</a>')).toBe('[site](https://x.dev)')
  })

  test('lists become markdown lists', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('-   one\n-   two')
  })

  test('code blocks keep their fence', () => {
    const markdown = htmlToMarkdown('<pre><code>let x = 1</code></pre>')
    expect(markdown).toContain('```')
    expect(markdown).toContain('let x = 1')
  })

  test('tables survive, via the GFM rules', () => {
    const markdown = htmlToMarkdown(
      '<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
    )
    expect(markdown).toContain('| a | b |')
    expect(markdown).toContain('| 1 | 2 |')
  })

  test('strikethrough survives', () => {
    expect(htmlToMarkdown('<del>gone</del>')).toBe('~~gone~~')
  })

  test('highlighted text keeps its markdown form', () => {
    expect(htmlToMarkdown('<mark>kept</mark>')).toBe('==kept==')
  })

  test('underline has no markdown, so the tag stays', () => {
    expect(htmlToMarkdown('<u>under</u>')).toBe('<u>under</u>')
  })

  test('scripts and styles are dropped', () => {
    const markdown = htmlToMarkdown('<p>text</p><script>alert(1)</script><style>p{}</style>')
    expect(markdown).toBe('text')
  })

  test('images become markdown images', () => {
    expect(htmlToMarkdown('<img src="a.png" alt="alt">')).toBe('![alt](a.png)')
  })
})
