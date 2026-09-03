import { describe, expect, test } from 'vitest'
import { nameFromContent } from './note-name'

describe('naming a note after its first line', () => {
  test('takes a heading without its hashes', () => {
    expect(nameFromContent('# Shopping list\n\nmilk\n')).toBe('Shopping list')
    expect(nameFromContent('### Deep heading\n')).toBe('Deep heading')
  })

  test('takes plain prose', () => {
    expect(nameFromContent('Meeting notes for Tuesday\n')).toBe('Meeting notes for Tuesday')
  })

  test('skips the blank lines above it', () => {
    expect(nameFromContent('\n\n  \n# Real title\n')).toBe('Real title')
  })

  test('drops a leading bullet or quote', () => {
    expect(nameFromContent('- first item\n')).toBe('first item')
    expect(nameFromContent('> quoted\n')).toBe('quoted')
  })

  test('replaces what a filesystem would refuse', () => {
    expect(nameFromContent('report: q1/q2\n')).toBe('report q1 q2')
    expect(nameFromContent('a<b>c|d*e"f\n')).toBe('a b c d e f')
  })

  test('has nothing to offer for an empty note', () => {
    expect(nameFromContent('')).toBeNull()
    expect(nameFromContent('\n\n   \n')).toBeNull()
  })

  test('has nothing to offer when only markup is left', () => {
    expect(nameFromContent('# \n')).toBeNull()
    expect(nameFromContent('///\n')).toBeNull()
  })

  test('keeps it short enough to be a filename', () => {
    expect(nameFromContent(`# ${'word '.repeat(40)}\n`)!.length).toBeLessThanOrEqual(60)
  })

  test('keeps letters other languages use', () => {
    expect(nameFromContent('# Notizen über Bücher\n')).toBe('Notizen über Bücher')
  })
})
