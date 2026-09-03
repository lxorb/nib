import { describe, expect, test } from 'vitest'
import { inCodeSpan, smartReplacement } from './typography'

/** Applies the rule the way the editor would, so tests read as typed text. */
function type(line: string, character: string): string {
  const before = line + character
  const replacement = smartReplacement(before)
  if (!replacement) return before

  return before.slice(0, before.length - replacement.consumed) + replacement.insert
}

describe('quotes', () => {
  test('opens at the start of a line', () => {
    expect(type('', '"')).toBe('“')
  })

  test('opens after a space', () => {
    expect(type('he said ', '"')).toBe('he said “')
  })

  test('closes after a word', () => {
    expect(type('he said “hello', '"')).toBe('he said “hello”')
  })

  test('opens after a bracket', () => {
    expect(type('(', '"')).toBe('(“')
  })

  test('handles single quotes the same way', () => {
    expect(type('', "'")).toBe('‘')
    expect(type('‘hello', "'")).toBe('‘hello’')
  })

  test('makes an apostrophe, not an opening quote', () => {
    expect(type('don', "'")).toBe('don’')
  })
})

describe('dashes', () => {
  test('two hyphens become an en dash', () => {
    expect(type('a -', '-')).toBe('a –')
  })

  test('three become an em dash', () => {
    expect(type('a –', '-')).toBe('a —')
  })

  test('a lone hyphen is left alone', () => {
    expect(type('a', '-')).toBe('a-')
  })
})

describe('ellipsis', () => {
  test('three dots collapse', () => {
    expect(type('wait..', '.')).toBe('wait…')
  })

  test('two dots do not', () => {
    expect(type('wait.', '.')).toBe('wait..')
  })
})

describe('code spans', () => {
  test('inside backticks nothing is substituted', () => {
    expect(inCodeSpan('run `echo ', 10)).toBe(true)
  })

  test('after the closing backtick it resumes', () => {
    expect(inCodeSpan('run `echo` ', 11)).toBe(false)
  })

  test('an indented code block is left alone', () => {
    expect(inCodeSpan('    let x = "y"', 12)).toBe(true)
  })

  test('a fence is left alone', () => {
    expect(inCodeSpan('```js', 5)).toBe(true)
  })
})
