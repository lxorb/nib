import { describe, expect, test } from 'vitest'
import { search, words } from './icons'

const NAMES = [
  'Book',
  'BookOpen',
  'BookmarkMinus',
  'Bookmark',
  'Briefcase',
  'Building2',
  'Calendar',
  'CalendarDays',
  'Laptop',
  'NotebookPen',
  'Notebook',
  'Star',
  'Sparkles',
  'GraduationCap',
]

describe('turning a name into words', () => {
  test('splits the humps', () => {
    expect(words('BookOpen')).toBe('book open')
    expect(words('CalendarDays')).toBe('calendar days')
  })

  test('keeps a run of capitals together', () => {
    expect(words('RSSFeed')).toBe('rss feed')
  })

  test('leaves a digit attached to its word', () => {
    expect(words('Building2')).toBe('building2')
  })
})

describe('searching the library', () => {
  test('puts the exact name first', () => {
    expect(search(NAMES, 'book')[0]).toBe('Book')
    expect(search(NAMES, 'star')[0]).toBe('Star')
  })

  test('finds the multi-word ones too', () => {
    expect(search(NAMES, 'book')).toContain('BookOpen')
    expect(search(NAMES, 'book open')[0]).toBe('BookOpen')
  })

  test('ranks a whole word above a fragment', () => {
    const found = search(NAMES, 'book')
    expect(found.indexOf('BookOpen')).toBeLessThan(found.indexOf('BookmarkMinus'))
  })

  test('understands words that are not icon names', () => {
    expect(search(NAMES, 'work')).toContain('Briefcase')
    expect(search(NAMES, 'uni')).toContain('GraduationCap')
    expect(search(NAMES, 'journal')).toContain('NotebookPen')
  })

  test('is not case sensitive', () => {
    expect(search(NAMES, 'BOOK')[0]).toBe('Book')
  })

  test('gives back the whole set for an empty query', () => {
    expect(search(NAMES, '  ').length).toBe(NAMES.length)
  })

  test('gives back nothing for a query that matches nothing', () => {
    expect(search(NAMES, 'zzzzz')).toEqual([])
  })

  test('honours the limit', () => {
    expect(search(NAMES, '', 3).length).toBe(3)
  })
})
