import { EditorView, WidgetType } from '@codemirror/view'
import { label } from '../labels'
import {
  type TableModel,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  parseTable,
  removeColumn,
  removeRow,
  serializeTable,
  setAlign,
  setCell,
} from './model'

/** Events CodeMirror would otherwise claim for the document. */
const CAPTURED_EVENTS = [
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'keydown',
  'keypress',
  'keyup',
  'beforeinput',
  'input',
  'paste',
  'cut',
  'dragstart',
  'compositionstart',
  'compositionend',
] as const

/** The table currently holding an uncommitted cell edit. Rewriting the source
 *  on every keystroke would rebuild the widget and throw the caret out, so
 *  edits land in the document when the cell is left - or when this is flushed. */
let active: { flush(): void } | null = null

/** Where the caret sat before an idle commit rebuilt the widget's DOM. */
let pendingFocus: { row: number; column: number; offset: number } | null = null

/** How long a cell may sit untouched before its edit is written out anyway.
 *  Blur is the primary trigger; this is the safety net for when focus never
 *  leaves the cell - the caret is put back afterwards so typing continues. */
const IDLE_COMMIT = 700

/** Writes any in-progress cell edit into the document. Call before saving. */
export function flushTableEdits() {
  active?.flush()
}

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 10 10')
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  shape.setAttribute('d', path)
  svg.append(shape)
  return svg
}

function button(className: string, label: string, path: string, onPress: () => void) {
  const element = document.createElement('button')
  element.className = className
  element.type = 'button'
  element.title = label
  element.setAttribute('aria-label', label)
  element.append(icon(path))
  element.addEventListener('mousedown', (event) => {
    event.preventDefault()
    onPress()
  })
  return element
}

const ALIGN_PATHS = {
  left: 'M0 2h10M0 5h6M0 8h10',
  center: 'M0 2h10M2 5h6M0 8h10',
  right: 'M0 2h10M4 5h6M0 8h10',
} as const

const ALIGN_LABELS = {
  left: 'alignLeft',
  center: 'alignCenter',
  right: 'alignRight',
} as const

export class TableWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly from: number,
    private readonly to: number,
  ) {
    super()
  }

  eq(other: TableWidget) {
    return other.source === this.source && other.from === this.from
  }

  /** The widget runs its own editing, so CodeMirror should not interpret events. */
  ignoreEvent() {
    return true
  }

  toDOM(view: EditorView) {
    const model = parseTable(this.source)
    const wrap = document.createElement('div')
    wrap.className = 'nib-table-wrap'

    if (!model) {
      wrap.textContent = this.source
      return wrap
    }

    // CodeMirror's handlers sit on .cm-content and would route typing into the
    // document. The widget's own listeners run first, then this stops the event.
    for (const type of CAPTURED_EVENTS) {
      wrap.addEventListener(type, (event) => event.stopPropagation())
    }

    let pending: { row: number; column: number; value: string } | null = null
    let idle: number | undefined

    /** The model including whatever the focused cell currently reads. */
    const current = (): TableModel =>
      pending ? setCell(model, pending.row, pending.column, pending.value) : model

    const commit = (next: TableModel) => {
      window.clearTimeout(idle)
      pending = null
      active = null

      const text = serializeTable(next)
      if (text === this.source) return
      view.dispatch({ changes: { from: this.from, to: this.to, insert: text } })
    }

    const flush = () => {
      if (pending) commit(current())
    }

    const table = document.createElement('table')
    table.className = 'nib-table'
    wrap.append(table)

    const headRow = document.createElement('tr')
    const head = document.createElement('thead')
    head.append(headRow)
    const body = document.createElement('tbody')
    table.append(head, body)

    const cell = (text: string, row: number, column: number, tag: 'th' | 'td') => {
      const element = document.createElement(tag)
      element.contentEditable = 'true'
      element.spellcheck = true
      element.textContent = text
      element.dataset.row = String(row)
      element.dataset.column = String(column)
      if (model.align[column]) element.style.textAlign = model.align[column]!

      // CodeMirror cancels mousedown before it reaches us, taking the browser's
      // default focus and caret placement with it. A timeout, not an animation
      // frame - rAF is paused in background windows.
      element.addEventListener('mousedown', (event) => {
        window.setTimeout(() => {
          if (document.activeElement === element) return
          element.focus()
          placeCaretFromPoint(element, event.clientX, event.clientY)
        }, 0)
      })

      element.addEventListener('input', () => {
        pending = { row, column, value: element.textContent ?? '' }
        active = { flush }

        window.clearTimeout(idle)
        idle = window.setTimeout(() => {
          pendingFocus = { row, column, offset: caretOffset(element) }
          flush()
        }, IDLE_COMMIT)
      })

      element.addEventListener('blur', () => {
        // A rebuild blurs the old cell; its text is already in the document.
        if (!element.isConnected) return
        flush()
      })

      element.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          const next = column + (event.shiftKey ? -1 : 1)
          if (next >= 0 && next < model.header.length) {
            focusCell(table, row, next)
          } else {
            flush()
          }
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          if (row >= 0 && row === model.rows.length - 1) {
            commit(insertRow(current(), row + 1))
          } else {
            focusCell(table, row + 1, column)
          }
        }
      })

      return element
    }

    model.header.forEach((text, column) => {
      const th = cell(text, -1, column, 'th')

      const controls = document.createElement('div')
      controls.className = 'nib-table-controls'
      controls.contentEditable = 'false'

      for (const align of ['left', 'center', 'right'] as const) {
        controls.append(
          button('nib-table-btn', label(ALIGN_LABELS[align]), ALIGN_PATHS[align], () =>
            commit(setAlign(current(), column, align === model.align[column] ? null : align)),
          ),
        )
      }

      controls.append(
        button('nib-table-btn', label('moveColumnLeft'), 'M6 1L2 5l4 4', () =>
          commit(moveColumn(current(), column, column - 1)),
        ),
        button('nib-table-btn', label('moveColumnRight'), 'M4 1l4 4-4 4', () =>
          commit(moveColumn(current(), column, column + 1)),
        ),
        button('nib-table-btn', label('insertColumn'), 'M5 1v8M1 5h8', () =>
          commit(insertColumn(current(), column + 1)),
        ),
        button('nib-table-btn nib-table-btn-danger', label('deleteColumn'), 'M1 1l8 8M9 1l-8 8', () =>
          commit(removeColumn(current(), column)),
        ),
      )

      // Markdown records no column widths, so a resize is a view-level nicety,
      // exactly as it is in Typora.
      const grip = document.createElement('span')
      grip.className = 'nib-table-resize'
      grip.contentEditable = 'false'
      grip.addEventListener('mousedown', (event) => startColumnResize(event, th))

      th.append(controls, grip)
      headRow.append(th)
    })

    model.rows.forEach((row, index) => {
      const tr = document.createElement('tr')
      const cells = row.map((text, column) => cell(text, index, column, 'td'))

      // A positioned <td> still reserves a table column, so the row controls
      // live in a div inside the first cell.
      const grip = document.createElement('div')
      grip.className = 'nib-table-grip'
      grip.contentEditable = 'false'
      grip.append(
        button('nib-table-btn', label('moveRowUp'), 'M1 6l4-4 4 4', () =>
          commit(moveRow(current(), index, index - 1)),
        ),
        button('nib-table-btn', label('moveRowDown'), 'M1 4l4 4 4-4', () =>
          commit(moveRow(current(), index, index + 1)),
        ),
        button('nib-table-btn', label('insertRow'), 'M5 1v8M1 5h8', () =>
          commit(insertRow(current(), index + 1)),
        ),
        button('nib-table-btn nib-table-btn-danger', label('deleteRow'), 'M1 1l8 8M9 1l-8 8', () =>
          commit(removeRow(current(), index)),
        ),
      )

      cells[0]?.append(grip)
      tr.append(...cells)
      body.append(tr)
    })

    if (pendingFocus) {
      // toDOM runs before CodeMirror attaches the node, and focus() on a
      // detached element does nothing - so wait for it to be in the document.
      const target = pendingFocus
      pendingFocus = null
      window.setTimeout(() => restoreFocus(table, target), 0)
    }

    return wrap
  }
}

function caretOffset(element: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0

  const caret = selection.getRangeAt(0)
  const measured = caret.cloneRange()
  measured.selectNodeContents(element)
  measured.setEnd(caret.endContainer, caret.endOffset)
  return measured.toString().length
}

function restoreFocus(
  table: HTMLTableElement,
  { row, column, offset }: { row: number; column: number; offset: number },
) {
  const target = table.querySelector<HTMLElement>(`[data-row="${row}"][data-column="${column}"]`)
  if (!target?.isConnected) return

  target.focus()

  const text = target.firstChild
  const range = document.createRange()
  if (text) range.setStart(text, Math.min(offset, text.textContent?.length ?? 0))
  else range.selectNodeContents(target)
  range.collapse(true)

  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Drags the boundary between two columns. Width lives on the header cell, and
 *  the rest of the column follows because the table is laid out from it. */
function startColumnResize(event: MouseEvent, header: HTMLTableCellElement) {
  event.preventDefault()
  event.stopPropagation()

  const startX = event.clientX
  const startWidth = header.getBoundingClientRect().width

  const move = (moved: MouseEvent) => {
    header.style.width = `${Math.max(48, startWidth + (moved.clientX - startX))}px`
  }

  const finish = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', finish)
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', finish)
}

function focusCell(table: HTMLTableElement, row: number, column: number) {
  const target = table.querySelector<HTMLElement>(`[data-row="${row}"][data-column="${column}"]`)
  if (!target) return

  target.focus()
  const range = document.createRange()
  range.selectNodeContents(target)
  range.collapse(false)

  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function placeCaretFromPoint(element: HTMLElement, x: number, y: number) {
  const selection = window.getSelection()
  if (!selection) return

  // Optional calls: WebKitGTK and WebView2 differ on which of the two exists.
  let range = document.caretRangeFromPoint?.(x, y) ?? null

  if (!range) {
    const position = document.caretPositionFromPoint?.(x, y)
    if (position) {
      range = document.createRange()
      range.setStart(position.offsetNode, position.offset)
    }
  }

  if (!range || !element.contains(range.startContainer)) {
    range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
  }

  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}
