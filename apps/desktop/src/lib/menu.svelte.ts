export interface MenuItem {
  label: string
  hint?: string
  danger?: boolean
  disabled?: boolean
  run(): void
}

/** A separator between groups. */
export const DIVIDER = null
export type MenuEntry = MenuItem | typeof DIVIDER

class ContextMenu {
  open = $state(false)
  x = $state(0)
  y = $state(0)
  items = $state<MenuEntry[]>([])

  /** Opens at the pointer. The caller has already decided what belongs here,
   *  so an empty list means "no menu" rather than an empty box. */
  show(event: MouseEvent, items: MenuEntry[]) {
    event.preventDefault()
    event.stopPropagation()

    const usable = trim(items)
    if (!usable.length) return

    this.items = usable
    this.x = event.clientX
    this.y = event.clientY
    this.open = true
  }

  hide() {
    this.open = false
  }
}

/** Drops leading, trailing and doubled dividers. */
function trim(items: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = []

  for (const item of items) {
    if (item === DIVIDER && (!out.length || out[out.length - 1] === DIVIDER)) continue
    out.push(item)
  }

  while (out.length && out[out.length - 1] === DIVIDER) out.pop()
  return out
}

export const menu = new ContextMenu()
