import { describe, expect, test } from 'vitest'
import { claimsGesture, settleOpen } from './swipe'

const WIDTH = 300

describe('claiming a swipe', () => {
  test('ignores a movement too small to mean anything', () => {
    expect(claimsGesture(4, 1)).toBe(false)
  })

  test('ignores a scroll, however far it goes', () => {
    expect(claimsGesture(6, 90)).toBe(false)
  })

  test('takes a clearly sideways drag', () => {
    expect(claimsGesture(40, 8)).toBe(true)
  })

  test('takes one going the other way, which is how it closes', () => {
    expect(claimsGesture(-40, 8)).toBe(true)
  })

  test('leaves a diagonal to the scroller', () => {
    expect(claimsGesture(30, 40)).toBe(false)
  })
})

describe('where the drawer lands when the finger lifts', () => {
  test('opens once it is dragged past halfway', () => {
    expect(settleOpen(WIDTH / 2 + 1, WIDTH, 0)).toBe(true)
  })

  test('falls back when it is not', () => {
    expect(settleOpen(WIDTH / 2 - 1, WIDTH, 0)).toBe(false)
  })

  test('a flick opens it from barely anywhere', () => {
    // The whole point: a short fast swipe should not need to cross the middle.
    expect(settleOpen(30, WIDTH, 1.2)).toBe(true)
  })

  test('a flick back closes it from almost fully open', () => {
    expect(settleOpen(WIDTH - 20, WIDTH, -1.2)).toBe(false)
  })

  test('a slow drag past halfway still opens, flick or no flick', () => {
    expect(settleOpen(WIDTH - 10, WIDTH, -0.05)).toBe(true)
  })

  test('nothing dragged and nothing thrown stays shut', () => {
    expect(settleOpen(0, WIDTH, 0)).toBe(false)
  })
})
