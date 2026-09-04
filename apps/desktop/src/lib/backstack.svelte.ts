import { viewport } from './viewport.svelte'

/** On a phone, back should close whatever is covering the document rather than
 *  leave the app. Anything that opens over it registers here while it is open,
 *  and back closes the newest one first.
 *
 *  Each layer takes a history entry when it opens and gives it back when it
 *  closes, so the two stay in step however the layer was dismissed. */
class BackStack {
  private layers: { id: number; close: () => void }[] = []
  private next = 1
  private listening = false

  /** Registers a layer that is now open. Returns the function to call when it
   *  closes, whichever way that happened. */
  open(close: () => void): () => void {
    this.listen()

    const layer = { id: this.next++, close }
    this.layers.push(layer)
    history.pushState({ nibLayer: layer.id }, '')

    return () => {
      const at = this.layers.indexOf(layer)
      // Already gone means back is what closed it, and the entry went with it.
      if (at < 0) return

      this.layers.splice(at, 1)
      if (history.state?.nibLayer === layer.id) history.back()
    }
  }

  private listen() {
    if (this.listening) return
    this.listening = true

    window.addEventListener('popstate', () => {
      // Popped before closing: the layer's own cleanup then finds nothing to
      // do, instead of trying to give back an entry that is already spent.
      const layer = this.layers.pop()
      layer?.close()
    })
  }
}

const backstack = new BackStack()

/** For use as the body of an `$effect`: while `open`, back closes this layer.
 *  Only on phones - on a desktop, back means the previous page. */
export function closeOnBack(open: boolean, close: () => void): (() => void) | undefined {
  if (!open || !viewport.phone) return
  return backstack.open(close)
}
