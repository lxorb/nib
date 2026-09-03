import type { StateCommand } from '@codemirror/state'
import { parseTable, serializeTable } from './table/model'

/** Tidies a document without changing what it means: one bullet character, one
 *  emphasis style, pipe-aligned tables, and no runs of blank lines. */
export function reformat(source: string): string {
  const lines = source.split('\n')
  const out: string[] = []

  let index = 0
  let inFence = false
  let blanks = 0

  while (index < lines.length) {
    const line = lines[index]

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      out.push(line)
      index += 1
      blanks = 0
      continue
    }

    // Code and front matter are copied through exactly as written.
    if (inFence) {
      out.push(line)
      index += 1
      continue
    }

    const table = readTable(lines, index)
    if (table) {
      out.push(...table.text.split('\n'))
      index = table.next
      blanks = 0
      continue
    }

    if (!line.trim()) {
      blanks += 1
      if (blanks <= 1) out.push('')
      index += 1
      continue
    }

    blanks = 0
    out.push(tidy(line))
    index += 1
  }

  // Exactly one trailing newline.
  while (out.length && !out[out.length - 1].trim()) out.pop()
  return `${out.join('\n')}\n`
}

/** A table starting at `start`, already re-aligned, or null. */
function readTable(lines: string[], start: number): { text: string; next: number } | null {
  if (!lines[start]?.includes('|')) return null

  let end = start
  while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end += 1

  const block = lines.slice(start, end).join('\n')
  const model = parseTable(block)
  if (!model) return null

  return { text: serializeTable(model), next: end }
}

function tidy(line: string): string {
  return (
    line
      // One bullet character throughout.
      .replace(/^(\s*)[*+](\s+)/, '$1-$2')
      // Underscore emphasis becomes asterisk, which nests more predictably.
      .replace(/(^|[\s(])__(\S(?:[^_]*\S)?)__(?=[\s).,;:!?]|$)/g, '$1**$2**')
      .replace(/(^|[\s(])_(\S(?:[^_]*\S)?)_(?=[\s).,;:!?]|$)/g, '$1*$2*')
      // Setext-style trailing hashes on a heading add nothing.
      .replace(/^(#{1,6}\s+.*?)\s+#+\s*$/, '$1')
      .replace(/[ \t]+$/, '')
  )
}

/** Rewrites the whole document, keeping the caret where it was. */
export const reformatDocument: StateCommand = ({ state, dispatch }) => {
  const source = state.doc.toString()
  const tidied = reformat(source)
  if (tidied === source) return false

  const caret = Math.min(state.selection.main.head, tidied.length)
  dispatch(
    state.update({
      changes: { from: 0, to: state.doc.length, insert: tidied },
      selection: { anchor: caret },
    }),
  )
  return true
}
