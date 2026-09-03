import { describe, expect, test } from 'vitest'
import { englishLabel, LABEL_KEYS } from '@nib/editor'
import { de } from '../locales/de'
import { LANGUAGES } from './i18n.svelte'

/** The same substitution `t()` performs, tested without the reactive wrapper. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  )
}

describe('the German dictionary', () => {
  test('has a translation for every entry', () => {
    // A few words carry over unchanged — Code, Name, Export — so an entry that
    // matches its key is fine; an empty one never is.
    for (const [english, german] of Object.entries(de)) {
      expect(german.trim(), english).not.toBe('')
    }
  })

  test('translates most of what it holds', () => {
    const changed = Object.entries(de).filter(([english, german]) => english !== german)
    expect(changed.length).toBeGreaterThan(Object.keys(de).length * 0.9)
  })

  test('keeps every placeholder the English string uses', () => {
    for (const [english, german] of Object.entries(de)) {
      const wanted = [...english.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
      const got = [...german.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

      expect(got, english).toEqual(wanted)
    }
  })

  test('survived the file encoding', () => {
    // A mangled UTF-8 round trip shows up as these sequences.
    for (const german of Object.values(de)) {
      expect(german).not.toMatch(/Ã|â€| Â/)
    }
    expect(de.Delete).toBe('Löschen')
  })
})

describe('filling in placeholders', () => {
  test('substitutes what it is given', () => {
    expect(fill('Undo deleting {name}', { name: 'Note.md' })).toBe('Undo deleting Note.md')
  })

  test('leaves an unknown placeholder alone', () => {
    expect(fill('{a} and {b}', { a: '1' })).toBe('1 and {b}')
  })

  test('takes numbers', () => {
    expect(fill('Digit {number}', { number: 3 })).toBe('Digit 3')
  })
})

describe("the editor's own labels", () => {
  test('are all translated, so no widget is left in English', () => {
    for (const key of LABEL_KEYS) {
      expect(de[englishLabel(key)], key).toBeDefined()
    }
  })
})

describe('the language list', () => {
  test('offers the system default first', () => {
    expect(LANGUAGES[0].id).toBe('system')
  })

  test('has a dictionary for every language it offers', () => {
    const named = LANGUAGES.map((language) => language.id).filter(
      (id) => id !== 'system' && id !== 'en',
    )

    expect(named).toEqual(['de'])
  })
})
