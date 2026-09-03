import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, type WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { lineRevealed, revealed } from './reveal'
import { BulletWidget, CheckboxWidget, ImageWidget, RuleWidget } from './widgets'

const hide = Decoration.replace({})
const meta = Decoration.mark({ class: 'md-meta' })

/** Syntax characters that vanish unless the caret is inside their construct. */
const INLINE_MARKS = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'SubscriptMark',
  'SuperscriptMark',
  'HighlightMark',
  'LinkMark',
  'URL',
  'LinkTitle',
])

const HEADING = /^(?:ATX|Setext)Heading(\d)$/

const LINE_CLASS: Record<string, string> = {
  Blockquote: 'nib-quote',
  CodeBlock: 'nib-code',
  Table: 'nib-table',
}

class Decorator {
  private readonly marks: Range<Decoration>[] = []
  private readonly hidden: Range<Decoration>[] = []
  private readonly lineClasses = new Map<number, Set<string>>()

  constructor(private readonly state: EditorState) {}

  build(ranges: readonly { from: number; to: number }[]) {
    for (const { from, to } of ranges) {
      syntaxTree(this.state).iterate({ from, to, enter: (node) => this.visit(node.node) !== false })
    }

    const lines: Range<Decoration>[] = []
    for (const [pos, classes] of this.lineClasses) {
      lines.push(Decoration.line({ class: [...classes].join(' ') }).range(pos))
    }

    return {
      decorations: Decoration.set([...lines, ...this.marks, ...this.hidden], true),
      // Only concealed text is atomic, so the caret steps over hidden syntax
      // instead of landing inside it. Visible marks stay freely editable.
      atomic: Decoration.set(this.hidden, true),
    }
  }

  /** Returns false to stop the walk descending into a node that was replaced. */
  private visit(node: SyntaxNode): boolean | void {
    const name = node.name

    const heading = HEADING.exec(name)
    if (heading) {
      this.markLines(node, `nib-h${heading[1]}`)
      return
    }

    if (LINE_CLASS[name]) {
      this.markLines(node, LINE_CLASS[name])
      return
    }

    switch (name) {
      case 'FencedCode':
        return this.fence(node)
      case 'ListItem':
        return this.markLines(node, 'nib-li', true)
      case 'HeaderMark':
      case 'QuoteMark':
        // Block marks follow the caret's line, and swallow the space after them
        // so hiding `# ` does not leave the heading indented by one column.
        return this.conceal(node.from, this.eatSpace(node.to), lineRevealed(this.state, node.from))
      case 'CodeMark':
        // A fence's ``` follows the caret's line; inline backticks follow the span.
        return this.conceal(
          node.from,
          node.to,
          node.parent?.name === 'FencedCode'
            ? lineRevealed(this.state, node.from)
            : revealed(this.state, node),
        )
      case 'ListMark':
        return this.listMark(node)
      case 'TaskMarker':
        return this.taskMarker(node)
      case 'HorizontalRule':
        return this.replaceWith(node.from, node.to, new RuleWidget(), lineRevealed(this.state, node.from))
      case 'Image':
        return this.image(node)
      case 'CodeInfo':
        return this.conceal(node.from, node.to, lineRevealed(this.state, node.from))
      case 'TableDelimiter':
        return this.tableDelimiter(node)
      default:
        if (INLINE_MARKS.has(name)) this.conceal(node.from, node.to, revealed(this.state, node))
    }
  }

  /** Hidden when inactive; tagged `.md-meta` when shown so it bleeds back in. */
  private conceal(from: number, to: number, show: boolean) {
    if (from >= to) return
    if (show) this.marks.push(meta.range(from, to))
    else this.hidden.push(hide.range(from, to))
  }

  private replaceWith(from: number, to: number, widget: WidgetType, show: boolean) {
    if (show || from >= to) return
    this.hidden.push(Decoration.replace({ widget }).range(from, to))
  }

  private fence(node: SyntaxNode) {
    this.markLines(node, 'nib-code')

    const doc = this.state.doc
    this.addLineClass(doc.lineAt(node.from).from, 'nib-code-open')
    this.addLineClass(doc.lineAt(node.to).from, 'nib-code-close')
  }

  private listMark(node: SyntaxNode) {
    // A task item renders a checkbox instead, and hides this mark with it.
    if (node.parent?.getChild('Task')) return

    const ordered = /\d/.test(this.state.doc.sliceString(node.from, node.to))
    if (ordered) {
      this.marks.push(Decoration.mark({ class: 'nib-ordered-mark' }).range(node.from, node.to))
      return
    }

    this.replaceWith(node.from, node.to, new BulletWidget(this.depth(node)), false)
  }

  private taskMarker(node: SyntaxNode) {
    const checked = /x/i.test(this.state.doc.sliceString(node.from, node.to))

    const listMark = node.parent?.parent?.getChild('ListMark')
    if (listMark) this.conceal(listMark.from, this.eatSpace(listMark.to), false)

    this.hidden.push(
      Decoration.replace({ widget: new CheckboxWidget(checked, node.from, node.to) }).range(
        node.from,
        node.to,
      ),
    )

    if (checked) this.addLineClass(this.state.doc.lineAt(node.from).from, 'nib-task-done')
  }

  private image(node: SyntaxNode): boolean | void {
    if (revealed(this.state, node)) return

    const url = node.getChild('URL')
    if (!url) return

    const src = this.state.doc.sliceString(url.from, url.to)
    // The parser leaves alt text as bare text between `![` and `]`.
    const open = node.firstChild
    const close = open?.nextSibling
    const alt = open && close ? this.state.doc.sliceString(open.to, close.from) : ''

    this.replaceWith(node.from, node.to, new ImageWidget(src, alt), false)
    // Its marks are inside the replacement now; decorating them would overlap.
    return false
  }

  /** The alignment row carries no meaning once the table renders, so it goes. */
  private tableDelimiter(node: SyntaxNode) {
    const isAlignmentRow = node.parent?.name === 'Table'
    const show = lineRevealed(this.state, node.from)

    if (isAlignmentRow) this.conceal(node.from, node.to, show)
    else this.marks.push(Decoration.mark({ class: 'nib-table-pipe' }).range(node.from, node.to))
  }

  private eatSpace(pos: number): number {
    const doc = this.state.doc
    const line = doc.lineAt(pos)
    let end = pos
    while (end < line.to && doc.sliceString(end, end + 1) === ' ') end++
    return end
  }

  private depth(node: SyntaxNode): number {
    let depth = 0
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (parent.name === 'BulletList') depth++
    }
    return Math.max(depth - 1, 0)
  }

  private addLineClass(pos: number, className: string) {
    const classes = this.lineClasses.get(pos) ?? new Set<string>()
    classes.add(className)
    this.lineClasses.set(pos, classes)
  }

  /** `firstOnly` keeps a nested list item from restyling its children's lines. */
  private markLines(node: SyntaxNode, className: string, firstOnly = false) {
    const doc = this.state.doc
    const last = firstOnly ? node.from : Math.min(node.to, doc.length)

    for (let pos = node.from; pos <= last; ) {
      const line = doc.lineAt(pos)
      this.addLineClass(line.from, className)
      if (line.to >= doc.length) break
      pos = line.to + 1
    }
  }
}

/** Exposed for tests: builds the same decorations a view would, without a DOM. */
export function buildDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[] = [{ from: 0, to: state.doc.length }],
) {
  return new Decorator(state).build(ranges)
}

export const livePreviewDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    atomic: DecorationSet

    constructor(view: EditorView) {
      const built = buildDecorations(view.state, view.visibleRanges)
      this.decorations = built.decorations
      this.atomic = built.atomic
    }

    update(update: ViewUpdate) {
      // Selection decides what is revealed, so it rebuilds as often as edits do.
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        const built = buildDecorations(update.view.state, update.view.visibleRanges)
        this.decorations = built.decorations
        this.atomic = built.atomic
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
  },
)
