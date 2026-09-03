import { describe, expect, test } from 'vitest'
import { DEFAULT_PAGE_SETUP, fill, length, pageCss, pageSetupFor, runningMarkup } from './page-setup'

const withMatter = (body: string) => `---\n${body}\n---\n\n# Note\n`

describe('reading page setup from a note', () => {
  test('falls back to the app settings when there is no front matter', () => {
    expect(pageSetupFor('# Note\n')).toEqual(DEFAULT_PAGE_SETUP)
  })

  test('falls back when the front matter says nothing about export', () => {
    expect(pageSetupFor(withMatter('title: Note'))).toEqual(DEFAULT_PAGE_SETUP)
  })

  test('reads paper, orientation and margin', () => {
    const setup = pageSetupFor(
      withMatter('export:\n  paper: Letter\n  orientation: landscape\n  margin: 15mm'),
    )

    expect(setup.paper).toBe('Letter')
    expect(setup.orientation).toBe('landscape')
    expect(setup.margin).toBe('15mm')
  })

  test('matches a paper name whatever its case', () => {
    expect(pageSetupFor(withMatter('export:\n  paper: a5')).paper).toBe('A5')
  })

  test('ignores a paper it cannot print', () => {
    expect(pageSetupFor(withMatter('export:\n  paper: Papyrus')).paper).toBe('A4')
  })

  test('reads a bare margin as millimetres', () => {
    expect(pageSetupFor(withMatter('export:\n  margin: 25')).margin).toBe('25mm')
  })

  test('keeps header and footer templates, quotes stripped', () => {
    const setup = pageSetupFor(withMatter('export:\n  header: "${title}"\n  footer: ${date}'))

    expect(setup.header).toBe('${title}')
    expect(setup.footer).toBe('${date}')
  })

  test('stops at the end of the export block', () => {
    const setup = pageSetupFor(withMatter('export:\n  paper: Legal\ntitle: Elsewhere\nmargin: 99mm'))

    expect(setup.paper).toBe('Legal')
    expect(setup.margin).toBe('20mm')
  })

  test('overrides only what the note mentions', () => {
    const base = { ...DEFAULT_PAGE_SETUP, margin: '5mm', header: 'kept' }
    const setup = pageSetupFor(withMatter('export:\n  paper: A3'), base)

    expect(setup).toEqual({ ...base, paper: 'A3' })
  })
})

describe('lengths', () => {
  test('accepts the units a stylesheet understands', () => {
    expect(length('1in')).toBe('1in')
    expect(length('2.5 cm')).toBe('2.5cm')
    expect(length('12')).toBe('12mm')
  })

  test('refuses anything that is not a length', () => {
    expect(length('20mm; } body { display: none')).toBeNull()
    expect(length('auto')).toBeNull()
  })
})

describe('running text', () => {
  test('fills in the placeholders', () => {
    expect(fill('${title} - ${date}', 'Notes', '2026-09-03')).toBe('Notes - 2026-09-03')
    expect(fill('© ${year}', 'Notes', '2026-09-03')).toBe('© 2026')
  })

  test('leaves an unknown placeholder alone', () => {
    expect(fill('${pages}', 'Notes', '2026-09-03')).toBe('${pages}')
  })
})

describe('the print stylesheet', () => {
  test('states the paper and the margin', () => {
    expect(pageCss(DEFAULT_PAGE_SETUP, 'Notes', '2026-09-03')).toBe(
      '@page { size: A4 portrait; margin: 20mm; }',
    )
  })

  test('adds running text only when there is some', () => {
    const css = pageCss({ ...DEFAULT_PAGE_SETUP, footer: '${title}' }, 'Notes', '2026-09-03')

    expect(css).toContain('.nib-running-footer::after')
    expect(css).toContain('Notes')
    expect(css).not.toContain('nib-running-header')
  })

  test('a title cannot close the string it sits in', () => {
    const css = pageCss({ ...DEFAULT_PAGE_SETUP, header: '${title}' }, 'a" } body { x: y', '2026')

    expect(css).toContain('content: "a\\" } body { x: y";')
  })

  test('a newline cannot break out of the rule', () => {
    const css = pageCss({ ...DEFAULT_PAGE_SETUP, footer: 'one\ntwo' }, 'Notes', '2026')

    expect(css).toContain('content: "one two";')
  })

  test('falls back to the default margin rather than emitting a bad one', () => {
    const css = pageCss({ ...DEFAULT_PAGE_SETUP, margin: 'red' }, 'Notes', '2026')

    expect(css).toContain('margin: 20mm')
  })
})

describe('running markup', () => {
  test('is empty when nothing is configured', () => {
    expect(runningMarkup(DEFAULT_PAGE_SETUP)).toBe('')
  })

  test('carries one element per configured slot', () => {
    const markup = runningMarkup({ ...DEFAULT_PAGE_SETUP, header: 'a', footer: 'b' })

    expect(markup).toContain('nib-running-header')
    expect(markup).toContain('nib-running-footer')
  })
})
