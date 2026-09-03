import { describe, expect, test } from 'vitest'
import { reformat } from './reformat'

describe('tidying a document', () => {
  test('settles on one bullet character', () => {
    expect(reformat('* one\n+ two\n- three\n')).toBe('- one\n- two\n- three\n')
  })

  test('keeps nesting intact', () => {
    expect(reformat('* one\n  * nested\n')).toBe('- one\n  - nested\n')
  })

  test('settles on one emphasis style', () => {
    expect(reformat('_italic_ and __bold__\n')).toBe('*italic* and **bold**\n')
  })

  test('leaves an underscore inside a word alone', () => {
    expect(reformat('snake_case_name stays\n')).toBe('snake_case_name stays\n')
  })

  test('drops trailing hashes from a heading', () => {
    expect(reformat('## Title ##\n')).toBe('## Title\n')
  })

  test('collapses runs of blank lines', () => {
    expect(reformat('a\n\n\n\nb\n')).toBe('a\n\nb\n')
  })

  test('strips trailing spaces', () => {
    expect(reformat('text   \n')).toBe('text\n')
  })

  test('ends with exactly one newline', () => {
    expect(reformat('text\n\n\n')).toBe('text\n')
    expect(reformat('text')).toBe('text\n')
  })

  test('re-aligns a table', () => {
    expect(reformat('|a|bb|\n|-|-|\n|cccc|d|\n')).toBe(
      ['| a    | bb  |', '| ---- | --- |', '| cccc | d   |', ''].join('\n'),
    )
  })

  test('leaves code fences exactly as written', () => {
    const source = '```js\nconst  x   =  1\n*  not a list\n```\n'
    expect(reformat(source)).toBe(source)
  })

  test('leaves a document that is already tidy unchanged', () => {
    const source = '# Title\n\n- one\n- two\n\n*emphasis* here\n'
    expect(reformat(source)).toBe(source)
  })

  test('does not disturb prose containing a pipe', () => {
    expect(reformat('a | b is not a table\n')).toBe('a | b is not a table\n')
  })
})
