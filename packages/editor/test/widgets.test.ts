import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { NibWidget } from '../src/live-preview/widget'

/** A widget that extends `WidgetType` directly inherits an `ignoreMutation`
 *  that answers false, so CodeMirror reads changes to the widget's own DOM as
 *  changes to the document. Positions then drift and selection breaks - the
 *  bug this base class exists to prevent. It only works if every widget uses
 *  it, so that is checked rather than remembered. */

const SOURCE = fileURLToPath(new URL('../src/', import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []

  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path)
  }

  return out
}

describe('every widget', () => {
  test('ignores its own DOM changes', () => {
    class Example extends NibWidget {
      toDOM() {
        return document.createElement('span')
      }
    }

    expect(new Example().ignoreMutation()).toBe(true)
  })

  test('extends NibWidget rather than WidgetType', () => {
    const offenders = sourceFiles(SOURCE)
      // The base class is the one place that may, and must, extend it.
      .filter((path) => !path.endsWith(join('live-preview', 'widget.ts')))
      .filter((path) => /class\s+\w+\s+extends\s+WidgetType\b/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(SOURCE.length).replace(/\\/g, '/'))

    expect(offenders, `these would desync the editor: ${offenders.join(', ')}`).toEqual([])
  })

  test('the scan actually reaches the widget files', () => {
    // Guards the test above: a broken path would make it pass on nothing.
    const files = sourceFiles(SOURCE)
    expect(files.some((path) => path.endsWith('widgets.ts'))).toBe(true)
    expect(files.length).toBeGreaterThan(10)
  })
})
