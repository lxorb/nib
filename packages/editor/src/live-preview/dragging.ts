import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

const setDragging = StateEffect.define<boolean>()

/** True while a selection is being dragged out with the mouse.
 *
 *  Revealing syntax as the selection moves would reflow the line under the
 *  pointer mid-drag: `**bold**` growing by four characters shifts everything
 *  after it, and the selection ends somewhere nobody pointed at. So the reveal
 *  state holds still until the button comes back up. */
export const dragging = StateField.define<boolean>({
  create: () => false,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDragging)) return effect.value
    }
    return value
  },
})

/** Watches the mouse. The release is listened for on the document, because a
 *  drag very often ends past the edge of the editor. */
const watcher = ViewPlugin.fromClass(
  class {
    private readonly release: () => void

    constructor(private readonly view: EditorView) {
      this.release = () => this.end()
      document.addEventListener('mouseup', this.release)
      // A drag interrupted by the window losing focus never gets a mouseup.
      window.addEventListener('blur', this.release)
    }

    destroy() {
      document.removeEventListener('mouseup', this.release)
      window.removeEventListener('blur', this.release)
    }

    private end() {
      if (this.view.state.field(dragging, false)) {
        this.view.dispatch({ effects: setDragging.of(false) })
      }
    }
  },
  {
    eventHandlers: {
      mousedown(event: MouseEvent, view: EditorView) {
        // Only the button that draws a selection.
        if (event.button !== 0) return false
        view.dispatch({ effects: setDragging.of(true) })
        return false
      },
    },
  },
)

export const dragFreeze = [dragging, watcher]
