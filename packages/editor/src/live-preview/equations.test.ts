import { afterEach, describe, expect, test } from 'vitest'
import { prepare, recordEquationLabel, resetEquationLabels } from './render'

afterEach(resetEquationLabels)

describe('equation labels', () => {
  test('a label is bookkeeping, not something to render', () => {
    expect(prepare('E = mc^2 \\label{eq:mass}')).toBe('E = mc^2 ')
  })

  test('a reference resolves to the number it was given', () => {
    recordEquationLabel('E = mc^2 \\label{eq:mass}', 3)
    expect(prepare('see \\eqref{eq:mass}')).toBe('see (3)')
  })

  test('the short form works too', () => {
    recordEquationLabel('x \\label{one}', 1)
    expect(prepare('\\ref{one}')).toBe('(1)')
  })

  test('an unknown reference is left as written', () => {
    expect(prepare('\\eqref{missing}')).toBe('\\eqref{missing}')
  })

  test('equations without a label record nothing', () => {
    recordEquationLabel('E = mc^2', 1)
    expect(prepare('\\eqref{eq:mass}')).toBe('\\eqref{eq:mass}')
  })

  test('resetting forgets earlier documents', () => {
    recordEquationLabel('x \\label{a}', 1)
    resetEquationLabels()
    expect(prepare('\\eqref{a}')).toBe('\\eqref{a}')
  })

  test('ordinary maths passes through untouched', () => {
    expect(prepare('\\int_0^\\infty e^{-x^2}\\,dx')).toBe('\\int_0^\\infty e^{-x^2}\\,dx')
  })
})
