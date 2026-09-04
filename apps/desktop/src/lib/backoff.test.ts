import { describe, expect, test } from 'vitest'
import { pollDelay } from './backoff'

const SECOND = 1000

describe('how often syncing looks for changes', () => {
  test('is quick right after something moved', () => {
    expect(pollDelay(0, false)).toBe(20 * SECOND)
  })

  test('doubles for each pass that found nothing', () => {
    expect(pollDelay(1, false)).toBe(40 * SECOND)
    expect(pollDelay(2, false)).toBe(80 * SECOND)
  })

  test('stops slowing down while the window is on screen', () => {
    expect(pollDelay(3, false)).toBe(120 * SECOND)
    expect(pollDelay(99, false)).toBe(120 * SECOND)
  })

  test('goes much slower when nobody is looking', () => {
    // Coming back to the window syncs at once, so this staleness is never seen.
    expect(pollDelay(99, true)).toBe(600 * SECOND)
  })

  test('is still quick when hidden if something just moved', () => {
    // A backgrounded window that is mid-sync should not stall on the first pass.
    expect(pollDelay(0, true)).toBe(20 * SECOND)
  })

  test('never returns something a timer cannot use', () => {
    for (const quiet of [0, 1, 5, 8, 40, 1000]) {
      for (const hidden of [false, true]) {
        const delay = pollDelay(quiet, hidden)
        expect(Number.isFinite(delay), `${quiet}/${hidden}`).toBe(true)
        expect(delay).toBeGreaterThan(0)
      }
    }
  })
})
