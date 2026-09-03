import { describe, expect, test } from 'vitest'
import { documentTitle, frontMatter, renderMarkdown, stripFrontMatter } from './index'

describe('front matter', () => {
  test('is not rendered', () => {
    expect(renderMarkdown('---\ntitle: Hi\n---\n\nBody.\n')).not.toContain('title: Hi')
    expect(renderMarkdown('---\ntitle: Hi\n---\n\nBody.\n')).toContain('Body.')
  })

  test('can be read on its own', () => {
    expect(frontMatter('---\ntitle: Hi\n---\n\nBody')).toBe('title: Hi')
    expect(frontMatter('No front matter')).toBeNull()
  })

  test('leaves a document without it alone', () => {
    expect(stripFrontMatter('# Title')).toBe('# Title')
  })
})

describe('titles', () => {
  test('reads the first heading', () => {
    expect(documentTitle('---\na: b\n---\n\n# Real title\n\ntext')).toBe('Real title')
  })

  test('is null when there is no heading', () => {
    expect(documentTitle('just text')).toBeNull()
  })
})

describe('GitHub-flavoured basics', () => {
  test('renders headings, emphasis and code', () => {
    const html = renderMarkdown('# H\n\n**b** *i* `c`')
    expect(html).toContain('<h1>H</h1>')
    expect(html).toContain('<strong>b</strong>')
    expect(html).toContain('<em>i</em>')
    expect(html).toContain('<code>c</code>')
  })

  test('renders tables', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  test('renders task lists', () => {
    const html = renderMarkdown('- [x] done\n- [ ] open')
    expect(html).toContain('checked')
  })

  test('renders strikethrough', () => {
    expect(renderMarkdown('~~gone~~')).toContain('<del>gone</del>')
  })
})

describe('Typora extensions', () => {
  test('highlights', () => {
    expect(renderMarkdown('a ==marked== b')).toContain('<mark>marked</mark>')
  })

  test('subscript and superscript', () => {
    const html = renderMarkdown('H~2~O and X^2^')
    expect(html).toContain('<sub>2</sub>')
    expect(html).toContain('<sup>2</sup>')
  })

  test('inline math', () => {
    const html = renderMarkdown('mass $E=mc^2$ here')
    expect(html).toContain('math-inline')
    expect(html).toContain('katex')
  })

  test('block math', () => {
    const html = renderMarkdown('$$\nE = mc^2\n$$\n')
    expect(html).toContain('math-block')
  })

  test('leaves a lone dollar alone', () => {
    expect(renderMarkdown('costs $5 and $9')).not.toContain('katex')
  })

  test('emoji shortcodes become characters', () => {
    expect(renderMarkdown('ship it :rocket:')).toContain('🚀')
    expect(renderMarkdown('ship it :rocket:')).not.toContain(':rocket:')
  })

  test('a lone colon is left alone', () => {
    expect(renderMarkdown('note: this stays')).toContain('note: this stays')
  })

  test('an unknown shortcode is left as written', () => {
    expect(renderMarkdown(':not_an_emoji_name:')).toContain(':not_an_emoji_name:')
  })

  test('callouts become labelled blocks', () => {
    const html = renderMarkdown('> [!WARNING]\n> Careful.\n')
    expect(html).toContain('data-kind="warning"')
    expect(html).toContain('Careful.')
    expect(html).not.toContain('[!WARNING]')
  })

  test('an ordinary quote stays a quote', () => {
    const html = renderMarkdown('> Just a quote.\n')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('callout')
  })

  test('footnotes link both ways', () => {
    const html = renderMarkdown('Text[^1].\n\n[^1]: The note.\n', { footnotes: true })
    expect(html).toContain('id="fnref-1"')
    expect(html).toContain('id="fn-1"')
    expect(html).toContain('<section class="footnotes">')
  })
})

describe('raw HTML', () => {
  // Typora passes inline HTML through, and so does this — embeds are a feature
  // of a local document.
  test('is preserved for local use', () => {
    expect(renderMarkdown('<u>underlined</u>')).toContain('<u>underlined</u>')
    expect(renderMarkdown('<video src="clip.mp4"></video>')).toContain('<video')
  })

  // A published note is served to strangers, and every blog on the shared
  // domain would otherwise be able to script every other one.
  test('is shown as text when publishing', () => {
    const html = renderMarkdown('<script>alert(1)</script>', { escapeHtml: true })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('escapes inline HTML too', () => {
    const html = renderMarkdown('text <img src=x onerror=alert(1)> more', { escapeHtml: true })
    expect(html).not.toContain('onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  test('markdown itself still renders when publishing', () => {
    const html = renderMarkdown('# Title\n\n**bold** and [a link](https://x.dev)', {
      escapeHtml: true,
    })
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('href="https://x.dev"')
  })
})
