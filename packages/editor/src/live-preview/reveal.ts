import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'

/** Typora reveals a construct's syntax characters when the caret is inside that
 *  construct — not the whole paragraph. So the reveal region for a syntax mark
 *  is its parent element: the `**` of one bold word stays hidden while you edit
 *  a different bold word on the same line. */
export function revealed(state: EditorState, node: SyntaxNode): boolean {
  const parent = node.parent ?? node
  return overlaps(state, parent.from, parent.to)
}

export function overlaps(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.from <= to && range.to >= from)
}

/** Block constructs reveal per line, which is what Typora does for `#` and `>`. */
export function lineRevealed(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos)
  return overlaps(state, line.from, line.to)
}
