import { syntaxTree } from '@codemirror/language'
import { type EditorState, type Range, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { lineRevealed, overlaps } from './reveal'
import { DIAGRAM_LANGUAGES, DiagramWidget, MathWidget } from './render'

/** CodeMirror only accepts block-level replacements from a state field, so the
 *  constructs that occupy whole lines live here rather than in the
 *  viewport-scoped plugin. All are rare enough to scan the whole document for. */
export function buildBlockDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const doc = state.doc

  const wholeLines = (from: number, to: number) => ({
    from: doc.lineAt(from).from,
    to: doc.lineAt(to).to,
  })

  syntaxTree(state).iterate({
    enter: (node) => {
      switch (node.name) {
        case 'BlockMath': {
          if (overlaps(state, node.from, node.to)) return false
          const span = wholeLines(node.from, node.to)
          const tex = doc.sliceString(doc.lineAt(node.from).to, doc.lineAt(node.to).from).trim()
          ranges.push(
            Decoration.replace({ widget: new MathWidget(tex, true), block: true }).range(
              span.from,
              span.to,
            ),
          )
          return false
        }

        case 'FencedCode': {
          if (overlaps(state, node.from, node.to)) return false

          const info = node.node.getChild('CodeInfo')
          const language = info ? doc.sliceString(info.from, info.to).trim() : ''
          if (!DIAGRAM_LANGUAGES.has(language)) return false

          const text = node.node.getChild('CodeText')
          const span = wholeLines(node.from, node.to)
          ranges.push(
            Decoration.replace({
              widget: new DiagramWidget(text ? doc.sliceString(text.from, text.to) : '', language),
              block: true,
            }).range(span.from, span.to),
          )
          return false
        }

        case 'TableDelimiter': {
          // The `| --- |` row only tells the parser about alignment. Drop the
          // whole line so the table has no gap under its header.
          if (node.node.parent?.name !== 'Table') return false
          if (lineRevealed(state, node.from)) return false

          const line = doc.lineAt(node.from)
          ranges.push(Decoration.replace({ block: true }).range(line.from, line.to))
          return false
        }

        default:
          return true
      }
    },
  })

  return Decoration.set(ranges, true)
}

export const blockDecorations = StateField.define<DecorationSet>({
  create: buildBlockDecorations,
  update(value, transaction) {
    if (!transaction.docChanged && !transaction.selection) return value
    return buildBlockDecorations(transaction.state)
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
})
