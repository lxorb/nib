import { flushTableEdits } from '@nib/editor'
import { folderOf, invoke, isDesktop, joinPath } from './tauri'

export interface Entry {
  name: string
  path: string
  is_dir: boolean
  children: Entry[]
}

/** A space is a folder today and a synced collection once accounts land. */
export interface Space {
  id: string
  name: string
  root: string
}

export interface Tab {
  id: string
  path: string | null
  name: string
  doc: string
  dirty: boolean
}

export type Panel = 'tree' | 'outline' | 'articles'

export interface Heading {
  level: number
  text: string
  line: number
}

const STORAGE_KEY = 'nib:workspace'
const UNTITLED = 'Untitled'

interface Persisted {
  spaces: Space[]
  activeSpace: string | null
  openPaths: string[]
  activePath: string | null
  panel: Panel | null
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function identifier(): string {
  return Math.random().toString(36).slice(2, 10)
}

async function pickFolder(): Promise<string | null> {
  if (isDesktop) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const picked = await open({ directory: true })
    return typeof picked === 'string' ? picked : null
  }

  if (!import.meta.env.DEV) return null
  const { FIXTURE_SPACE } = await import('./dev-fixture')
  return FIXTURE_SPACE.root
}

async function pickSavePath(): Promise<string | null> {
  if (!isDesktop) return null

  const { save } = await import('@tauri-apps/plugin-dialog')
  const picked = await save({
    defaultPath: `${UNTITLED}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  return picked ?? null
}

class Workspace {
  spaces = $state<Space[]>([])
  activeSpaceId = $state<string | null>(null)
  tree = $state<Entry | null>(null)
  tabs = $state<Tab[]>([])
  activeTabId = $state<string | null>(null)
  // Hidden until asked for, the way Typora starts.
  panel = $state<Panel | null>(null)
  /** Path of the tree row currently being renamed in place. */
  renaming = $state<string | null>(null)

  readonly activeSpace = $derived(this.spaces.find((space) => space.id === this.activeSpaceId) ?? null)
  readonly active = $derived(this.tabs.find((tab) => tab.id === this.activeTabId) ?? null)

  readonly headings = $derived.by((): Heading[] => {
    const doc = this.active?.doc
    if (!doc) return []

    const found: Heading[] = []
    let fenced = false

    doc.split('\n').forEach((text, index) => {
      if (/^\s*(```|~~~)/.test(text)) fenced = !fenced
      if (fenced) return

      const match = /^(#{1,6})\s+(.*)$/.exec(text)
      if (match) found.push({ level: match[1].length, text: match[2].trim(), line: index })
    })

    return found
  })

  /** Every note in the space, flattened — the Articles panel and quick open. */
  readonly notes = $derived.by((): Entry[] => {
    const out: Entry[] = []
    const walk = (entry: Entry) => {
      for (const child of entry.children) {
        if (child.is_dir) walk(child)
        else out.push(child)
      }
    }
    if (this.tree) walk(this.tree)
    return out
  })

  async restore() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return this.openBlank()

    let state: Persisted
    try {
      state = JSON.parse(saved) as Persisted
    } catch {
      return this.openBlank()
    }

    this.spaces = state.spaces ?? []
    // Every launch starts on the document, never on the file list.
    this.panel = null
    this.activeSpaceId = state.activeSpace ?? this.spaces[0]?.id ?? null

    if (this.activeSpaceId) await this.loadTree()

    for (const path of state.openPaths ?? []) {
      await this.open(path, { activate: path === state.activePath })
    }

    if (!this.tabs.length) this.openBlank()
  }

  private persist() {
    const state: Persisted = {
      spaces: this.spaces,
      activeSpace: this.activeSpaceId,
      openPaths: this.tabs.map((tab) => tab.path).filter((path): path is string => !!path),
      activePath: this.active?.path ?? null,
      panel: this.panel,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  openBlank() {
    const tab: Tab = { id: identifier(), path: null, name: UNTITLED, doc: '', dirty: false }
    this.tabs = [...this.tabs, tab]
    this.activeTabId = tab.id
  }

  async addSpace() {
    const picked = await pickFolder()
    if (!picked) return

    const space: Space = { id: identifier(), name: basename(picked), root: picked }
    this.spaces = [...this.spaces, space]
    await this.selectSpace(space.id)
  }

  async selectSpace(id: string) {
    this.activeSpaceId = id
    await this.loadTree()
    this.persist()
  }

  removeSpace(id: string) {
    this.spaces = this.spaces.filter((space) => space.id !== id)
    if (this.activeSpaceId !== id) return this.persist()

    this.activeSpaceId = this.spaces[0]?.id ?? null
    this.tree = null
    if (this.activeSpaceId) void this.selectSpace(this.activeSpaceId)
    else this.persist()
  }

  async loadTree() {
    const root = this.activeSpace?.root
    if (!root) return

    try {
      this.tree = await invoke<Entry>('read_tree', { root })
    } catch {
      this.tree = null
    }
  }

  async open(path: string, options: { activate?: boolean } = {}) {
    const existing = this.tabs.find((tab) => tab.path === path)
    if (existing) {
      if (options.activate !== false) this.activeTabId = existing.id
      return
    }

    let doc = ''
    try {
      doc = await invoke<string>('read_note', { path })
    } catch {
      return
    }

    const tab: Tab = { id: identifier(), path, name: basename(path), doc, dirty: false }
    this.tabs = [...this.tabs, tab]
    if (options.activate !== false) this.activeTabId = tab.id

    // A blank untouched tab is scaffolding, not something worth keeping around.
    this.tabs = this.tabs.filter((other) => other === tab || other.path || other.dirty)
    this.persist()
  }

  activate(id: string) {
    this.activeTabId = id
    this.persist()
  }

  close(id: string) {
    const index = this.tabs.findIndex((tab) => tab.id === id)
    if (index < 0) return

    this.tabs = this.tabs.filter((tab) => tab.id !== id)

    if (this.activeTabId === id) {
      this.activeTabId = (this.tabs[index] ?? this.tabs[index - 1])?.id ?? null
    }
    if (!this.tabs.length) this.openBlank()
    this.persist()
  }

  edit(doc: string) {
    const tab = this.active
    if (!tab || tab.doc === doc) return

    tab.doc = doc
    tab.dirty = true
  }

  async save() {
    // A table cell holds its text until it loses focus; make sure it landed.
    flushTableEdits()

    const tab = this.active
    if (!tab) return

    let path = tab.path
    if (!path) {
      const picked = await pickSavePath()
      if (!picked) return
      path = picked
    }

    await invoke('write_note', { path, content: tab.doc })

    tab.path = path
    tab.name = basename(path)
    tab.dirty = false

    await this.loadTree()
    this.persist()
  }

  /** Creates `Untitled.md` in a folder, stepping the name until it is free. */
  async createNote(folder?: string) {
    const dir = folder ?? this.activeSpace?.root
    if (!dir) return

    const taken = new Set(this.notes.map((note) => note.path))
    let name = 'Untitled.md'
    let counter = 2
    while (taken.has(joinPath(dir, name))) name = `Untitled ${counter++}.md`

    const path = joinPath(dir, name)
    await invoke('write_note', { path, content: '' })
    await this.loadTree()
    await this.open(path)
  }

  async createFolder(parent?: string) {
    const dir = parent ?? this.activeSpace?.root
    if (!dir) return

    await invoke('create_folder', { path: joinPath(dir, 'New folder') })
    await this.loadTree()
  }

  async rename(path: string, name: string) {
    const clean = name.trim()
    if (!clean || clean.includes('/') || clean.includes('\\')) return

    const target = joinPath(folderOf(path), clean)
    if (target === path) return

    await invoke('rename_note', { from: path, to: target })

    const tab = this.tabs.find((entry) => entry.path === path)
    if (tab) {
      tab.path = target
      tab.name = basename(target)
    }

    await this.loadTree()
    this.persist()
  }

  async remove(path: string, isFolder: boolean) {
    await invoke(isFolder ? 'delete_folder' : 'delete_note', { path })

    for (const tab of this.tabs.filter((entry) => entry.path?.startsWith(path))) {
      this.close(tab.id)
    }

    await this.loadTree()
  }

  async duplicate(path: string) {
    const content = await invoke<string>('read_note', { path })
    const name = basename(path).replace(/(\.[^.]+)$/, ' copy$1')

    await invoke('write_note', { path: joinPath(folderOf(path), name), content })
    await this.loadTree()
  }

  async reveal(path: string) {
    if (!isDesktop) return
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(path)
  }

  showPanel(next: Panel) {
    this.panel = this.panel === next ? null : next
    this.persist()
  }

  toggleSidebar() {
    this.panel = this.panel ? null : 'tree'
    this.persist()
  }
}

export const workspace = new Workspace()
