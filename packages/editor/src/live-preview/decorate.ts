import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  type WidgetType,
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { lineRevealed, overlaps, revealed } from './reveal'
import { DIAGRAM_LANGUAGES, MathWidget } from './render'
import { emojiFor } from '../emoji'
import {
  BulletWidget,
  CalloutWidget,
  CheckboxWidget,
  EmojiWidget,
  FenceHeaderWidget,
  ImageWidget,
  RuleWidget,
} from './widgets'

const hide = Decoration.replace({})
const meta = Decoration.mark({ class: 'md-meta' })

/** Syntax characters that vanish unless the caret is inside their construct. */
const INLINE_MARKS = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'SubscriptMark',
  'SuperscriptMark',
  'HighlightMark',
  'MathMark',
  'FootnoteMark',
  'FrontMatterMark',
  'LinkMark',
  'URL',
  'LinkTitle',
])

const HEADING = /^(?:ATX|Setext)Heading(\d)$/
const CALLOUT = /^>\s*\[!(note|tip|important|warning|caution)\]/i

const LINE_CLASS: Record<string, string> = {
  CodeBlock: 'nib-code',
  Table: 'nib-table',
  FrontMatter: 'nib-frontmatter',
  FootnoteDef: 'nib-footnote',
}

class Decorator {
  private readonly marks: Range<Decoration>[] = []
  private readonly hidden: Range<Decoration>[] = []
  private readonly lineClasses = new Map<number, Set<string>>()
  /** Spans already replaced wholesale. Nested syntax inside them must not be
   *  decorated again, or the two replacements would overlap and throw. */
  private readonly claimed: { from: number; to: number }[] = []

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
    if (heading) return this.markLines(node, `nib-h${heading[1]}`)

    if (LINE_CLASS[name]) return this.markLines(node, LINE_CLASS[name])

    switch (name) {
      case 'Blockquote':
        return this.blockquote(node)
      case 'FencedCode':
        return this.fence(node)
      case 'ListItem':
        return this.markLines(node, 'nib-li', true)
      case 'HeaderMark':
      case 'QuoteMark':
        // Block marks follow the caret's line, and swallow the space after them
        // so hiding `# ` does not indent the heading by one column.
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
        return this.inlineWidget(node, new RuleWidget(), lineRevealed(this.state, node.from))
      case 'Image':
        return this.image(node)
      case 'HTMLTag':
      case 'HTMLBlock':
        return this.htmlImage(node)
      case 'Emoji':
        return this.emoji(node)
      case 'InlineMath':
        return this.inlineMath(node)
      case 'BlockMath':
        return this.blockMath(node)
      case 'CodeInfo':
        return this.conceal(node.from, node.to, lineRevealed(this.state, node.from))
      case 'TableDelimiter':
        return this.tableDelimiter(node)
      case 'Subscript':
        return void this.marks.push(Decoration.mark({ class: 'nib-sub' }).range(node.from, node.to))
      case 'Superscript':
        return void this.marks.push(Decoration.mark({ class: 'nib-sup' }).range(node.from, node.to))
      default:
        if (INLINE_MARKS.has(name)) this.conceal(node.from, node.to, revealed(this.state, node))
    }
  }

  private isClaimed(from: number, to: number): boolean {
    return this.claimed.some((range) => from >= range.from && to <= range.to)
  }

  /** Hidden when inactive; tagged `.md-meta` when shown so it bleeds back in. */
  private conceal(from: number, to: number, show: boolean) {
    if (from >= to || this.isClaimed(from, to)) return
    if (show) this.marks.push(meta.range(from, to))
    else this.hidden.push(hide.range(from, to))
  }

  private inlineWidget(node: SyntaxNode, widget: WidgetType, show: boolean) {
    if (show || node.from >= node.to || this.isClaimed(node.from, node.to)) return
    this.hidden.push(Decoration.replace({ widget }).range(node.from, node.to))
  }

  private blockquote(node: SyntaxNode) {
    this.markLines(node, 'nib-quote')

    const first = this.state.doc.lineAt(node.from)
    const callout = CALLOUT.exec(first.text)
    if (!callout) return

    // Every line needs the kind, not just the header, so the accent runs the
    // full height of the callout.
    const kind = callout[1].toLowerCase()
    this.markLines(node, `nib-callout nib-callout-${kind}`)

    const from = first.from + first.text.indexOf('[!')
    const to = first.from + first.text.indexOf(']', first.text.indexOf('[!')) + 1

    // `[!NOTE]` also parses as a link label, so claim it before the walk reaches
    // the LinkMarks inside it.
    this.claimed.push({ from, to })

    if (lineRevealed(this.state, first.from)) this.marks.push(meta.range(from, to))
    else this.hidden.push(Decoration.replace({ widget: new CalloutWidget(kind) }).range(from, to))
  }

  private fence(node: SyntaxNode): boolean | void {
    const info = node.getChild('CodeInfo')
    const language = info ? this.state.doc.sliceString(info.from, info.to).trim() : ''

    // Rendered diagrams are block replacements, which only a state field may
    // provide — see blocks.ts. Skip the subtree so nothing double-decorates it.
    if (DIAGRAM_LANGUAGES.has(language) && !overlaps(this.state, node.from, node.to)) return false

    this.markLines(node, 'nib-code')
    const doc = this.state.doc
    const open = doc.lineAt(node.from)
    this.addLineClass(open.from, 'nib-code-open')
    this.addLineClass(doc.lineAt(node.to).from, 'nib-code-close')

    // The opening line reads as empty once its fence is hidden, which leaves
    // room for the language and a copy button.
    const text = node.getChild('CodeText')
    const mark = node.firstChild
    const infoFrom = info ? info.from : (mark?.to ?? open.to)

    this.marks.push(
      Decoration.widget({
        widget: new FenceHeaderWidget(
          language,
          text ? doc.sliceString(text.from, text.to) : '',
          infoFrom,
          info ? info.to : infoFrom,
        ),
        side: 1,
      }).range(open.to),
    )
  }

  private inlineMath(node: SyntaxNode): boolean | void {
    if (revealed(this.state, node)) return

    const tex = this.state.doc.sliceString(node.from + 1, node.to - 1)
    this.inlineWidget(node, new MathWidget(tex, false), false)
    return false
  }

  private blockMath(node: SyntaxNode): boolean | void {
    if (overlaps(this.state, node.from, node.to)) {
      this.markLines(node, 'nib-math-source')
      return
    }
    // Rendered by the block state field; see blocks.ts.
    return false
  }

  private listMark(node: SyntaxNode) {
    // A task item renders a checkbox instead, and hides this mark with it.
    if (node.parent?.getChild('Task')) return

    const ordered = /\d/.test(this.state.doc.sliceString(node.from, node.to))
    if (ordered) {
      this.marks.push(Decoration.mark({ class: 'nib-ordered-mark' }).range(node.from, node.to))
      return
    }

    this.inlineWidget(node, new BulletWidget(this.depth(node)), false)
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

    this.inlineWidget(
      node,
      new ImageWidget({ src, alt, zoom: 100, from: node.from, to: node.to }),
      false,
    )
    // Its marks live inside the replacement now; decorating them would overlap.
    return false
  }

  /** A resized image is stored as an `<img>` tag, so those render as pictures too. */
  private htmlImage(node: SyntaxNode): boolean | void {
    if (revealed(this.state, node)) return

    const tag = this.state.doc.sliceString(node.from, node.to)
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (!src) return

    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)
    const zoom = /zoom\s*:\s*(\d+(?:\.\d+)?)\s*%/i.exec(tag)

    this.inlineWidget(
      node,
      new ImageWidget({
        src: src[1],
        alt: (alt?.[1] ?? '').replace(/&quot;/g, '"'),
        zoom: zoom ? Number(zoom[1]) : 100,
        from: node.from,
        to: node.to,
      }),
      false,
    )
    return false
  }

  private emoji(node: SyntaxNode): boolean | void {
    if (revealed(this.state, node)) return

    const shortcode = this.state.doc.sliceString(node.from + 1, node.to - 1)
    const character = emojiFor(shortcode)
    if (!character) return

    this.inlineWidget(node, new EmojiWidget(character), false)
    return false
  }

  /** Only reached while the caret is in the table's source; blocks.ts renders
   *  the real table otherwise. Dimming the pipes keeps the source readable. */
  private tableDelimiter(node: SyntaxNode) {
    this.marks.push(Decoration.mark({ class: 'nib-table-pipe' }).range(node.from, node.to))
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
