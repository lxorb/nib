import { describe, expect, test } from 'vitest'
import { englishLabel, LABEL_KEYS } from '@nib/editor'
import { de } from '../locales/de'
import { fr } from '../locales/fr'
import { gsw } from '../locales/gsw'
import { ja } from '../locales/ja'
import { type Dictionary, LANGUAGES } from './i18n.svelte'

/** The same substitution `t()` performs, tested without the reactive wrapper. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  )
}

const TRANSLATIONS: [string, Dictionary][] = [
  ['de', de],
  ['gsw', gsw],
  ['fr', fr],
  ['ja', ja],
]

describe.each(TRANSLATIONS)('the %s dictionary', (language, dictionary) => {
  test('has a translation for every entry', () => {
    // A few words carry over unchanged - Code, Name, Export - so an entry that
    // matches its key is fine; an empty one never is.
    for (const [english, translated] of Object.entries(dictionary)) {
      expect(translated.trim(), english).not.toBe('')
    }
  })

  test('translates most of what it holds', () => {
    const changed = Object.entries(dictionary).filter(([english, one]) => english !== one)
    expect(changed.length).toBeGreaterThan(Object.keys(dictionary).length * 0.9)
  })

  test('keeps every placeholder the English string uses', () => {
    for (const [english, translated] of Object.entries(dictionary)) {
      const wanted = [...english.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
      const got = [...translated.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

      expect(got, english).toEqual(wanted)
    }
  })

  test('survived the file encoding', () => {
    // A mangled UTF-8 round trip shows up as these sequences.
    for (const translated of Object.values(dictionary)) {
      expect(translated).not.toMatch(/Ã|â€| Â/)
    }
  })

  test('covers the same ground as the German one', () => {
    const missing = Object.keys(de).filter((key) => !(key in dictionary))
    expect(missing, language).toEqual([])
  })

  test('translates every label the editor shows', () => {
    for (const key of LABEL_KEYS) {
      expect(dictionary[englishLabel(key)], `${language}: ${key}`).toBeDefined()
    }
  })

  test('writes no em dashes', () => {
    for (const translated of Object.values(dictionary)) {
      expect(translated).not.toContain(String.fromCharCode(0x2014))
    }
  })
})

describe('the dictionaries between them', () => {
  test('keep their own spelling', () => {
    expect(de.Delete).toBe('Löschen')
    expect(fr.Delete).toBe('Supprimer')
    expect(ja.Delete).toBe('削除')
  })

  test('Swiss German never uses an eszett', () => {
    for (const [english, swiss] of Object.entries(gsw)) {
      expect(swiss, english).not.toContain('ß')
    }
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

describe('the language list', () => {
  test('offers the system default first', () => {
    expect(LANGUAGES[0].id).toBe('system')
  })

  test('has a dictionary for every language it offers', () => {
    const named = LANGUAGES.map((language) => language.id).filter(
      (id) => id !== 'system' && id !== 'en',
    )

    expect(named.sort()).toEqual(TRANSLATIONS.map(([id]) => id).sort())
  })
})
