import { describe, expect, test } from 'vitest'
import { compareVersions } from './update'

describe('comparing versions', () => {
  test('orders by each number in turn', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0)
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  test('says so when they are the same', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0)
  })

  test('compares numbers as numbers, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('0.2.0', '0.10.0')).toBeLessThan(0)
  })

  test('ranks a release above its own pre-release', () => {
    expect(compareVersions('1.0.0', '1.0.0-rc1')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-rc1', '1.0.0')).toBeLessThan(0)
  })

  test('takes a shorter version as the earlier one', () => {
    expect(compareVersions('1.1', '1.1.1')).toBeLessThan(0)
    expect(compareVersions('1.1.1', '1.1')).toBeGreaterThan(0)
  })

  test('never reports an upgrade to what is already running', () => {
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
  })
})
