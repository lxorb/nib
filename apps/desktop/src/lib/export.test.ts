import { describe, expect, test } from 'vitest'
import { buildHtml, localSources, PANDOC_FORMATS } from './export'

const NOTE = `---
title: Meta
---

# Handbook

Prose with **strong**, ==marked==, H~2~O and $E=mc^2$.

> [!NOTE]
> Careful.

| a | b |
| - | - |
| 1 | 2 |

Footnote[^1].

[^1]: The note.
`

describe('a styled export', () => {
  const html = buildHtml(NOTE, 'Handbook.md', { theme: 'light' })

  test('is a complete document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('</html>')
    expect(html).toContain('<meta charset="utf-8">')
  })

  test('takes its title from the first heading', () => {
    expect(html).toContain('<title>Handbook</title>')
  })

  test('carries the theme with it', () => {
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('--bg')
    expect(html).toContain('#write')
  })

  test('needs no network to render maths', () => {
    expect(html).toContain('katex')
    expect(html).not.toContain('cdn.jsdelivr')
  })

  test('renders every construct', () => {
    expect(html).toContain('<strong>strong</strong>')
    expect(html).toContain('<mark>marked</mark>')
    expect(html).toContain('<sub>2</sub>')
    expect(html).toContain('data-kind="note"')
    expect(html).toContain('<table>')
    expect(html).toContain('class="footnotes"')
  })

  test('leaves front matter out', () => {
    expect(html).not.toContain('title: Meta')
  })

  test('prints on white', () => {
    expect(html).toContain('@media print')
  })
})

describe('a bare export', () => {
  const html = buildHtml(NOTE, 'Handbook.md', { bare: true })

  test('carries no styles', () => {
    expect(html).not.toContain('<style>')
    expect(html).not.toContain('--bg')
  })

  test('still carries the content', () => {
    expect(html).toContain('<h1>Handbook</h1>')
    expect(html).toContain('<strong>strong</strong>')
  })
})

describe('pandoc formats', () => {
  test('cover what Typora offers', () => {
    const ids = PANDOC_FORMATS.map((format) => format.id)
    for (const expected of ['docx', 'odt', 'rtf', 'epub', 'latex', 'mediawiki', 'rst', 'textile', 'opml', 'revealjs']) {
      expect(ids).toContain(expected)
    }
  })

  test('each names the file extension it produces', () => {
    for (const format of PANDOC_FORMATS) {
      expect(format.extension).toMatch(/^[a-z]+$/)
    }
  })
})

describe('finding local images', () => {
  test('picks out the paths that are files', () => {
    const html =
      '<img src="a.png"><img src="assets/b.jpg" alt="x"><img src="https://e.com/c.png">' +
      '<img src="data:image/png;base64,AAA"><img src="//e.com/d.png">'

    expect(localSources(html)).toEqual(['a.png', 'assets/b.jpg'])
  })

  test('lists each path once', () => {
    expect(localSources('<img src="a.png"><img src="a.png">')).toEqual(['a.png'])
  })

  test('finds nothing in a page without images', () => {
    expect(localSources('<p>text</p>')).toEqual([])
  })
})
