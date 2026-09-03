import { flushTableEdits } from '@nib/editor'
import { t } from './i18n.svelte'
import { folderOf, invoke, isDesktop, joinPath } from './tauri'

export interface Entry {
  name: string
  path: string
  is_dir: boolean
  modified: number
  created: number
  children: Entry[]
}

export type SortKey = 'name' | 'modified' | 'created'

export interface TreeOptions {
  showHidden: boolean
  sort: SortKey
  descending: boolean
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

export type Panel = 'tree' | 'outline' | 'articles' | 'search'

/** A file operation that can be put back. */
export type FileAction =
  | { kind: 'move' | 'rename'; from: string; to: string }
  | { kind: 'delete'; path: string; content: string }

export interface Hit {
  path: string
  name: string
  line: number
  text: string
}

export interface Tag {
  tag: string
  count: number
}

export interface Heading {
  level: number
  text: string
  line: number
}

const STORAGE_KEY = 'nib:workspace'
const AUTO_SAVE_KEY = 'nib:autosave'
const TREE_KEY = 'nib:tree'
const RECENT_KEY = 'nib:recent'
const RECENT_LIMIT = 15
const UNDO_LIMIT = 20
const PINNED_KEY = 'nib:pinned'
const AUTO_SAVE_DELAY = 1200
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

function readRecent(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(saved) ? (saved as string[]) : []
  } catch {
    return []
  }
}

function readPinned(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]')
    return Array.isArray(saved) ? (saved as string[]) : []
  } catch {
    return []
  }
}

function readTreeOptions(): TreeOptions {
  const fallback: TreeOptions = { showHidden: false, sort: 'name', descending: false }

  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(TREE_KEY) ?? '{}') as TreeOptions) }
  } catch {
    return fallback
  }
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
  autoSave = $state(localStorage.getItem(AUTO_SAVE_KEY) !== 'false')
  treeOptions = $state<TreeOptions>(readTreeOptions())
  recent = $state<string[]>(readRecent())
  /** Not persisted: putting a file back only makes sense while it is fresh. */
  undoable = $state<FileAction[]>([])
  tags = $state<Tag[]>([])
  pinned = $state<string[]>(readPinned())

  private saveTimer: ReturnType<typeof setTimeout> | undefined

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

  openBlank(name = UNTITLED, doc = '') {
    const tab: Tab = { id: identifier(), path: null, name, doc, dirty: !!doc }
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
      this.tree = await invoke<Entry>('read_tree', { root, options: this.treeOptions })
    } catch {
      this.tree = null
    }
  }

  setSort(sort: SortKey) {
    // Choosing the same key again flips the direction, as a file list should.
    const descending = this.treeOptions.sort === sort ? !this.treeOptions.descending : false
    this.treeOptions = { ...this.treeOptions, sort, descending }
    this.persistTreeOptions()
  }

  toggleHidden() {
    this.treeOptions = { ...this.treeOptions, showHidden: !this.treeOptions.showHidden }
    this.persistTreeOptions()
  }

  private persistTreeOptions() {
    localStorage.setItem(TREE_KEY, JSON.stringify(this.treeOptions))
    void this.loadTree()
  }

  /** Moves a note or folder into another folder. */
  async move(from: string, intoFolder: string) {
    const name = basename(from)
    const target = joinPath(intoFolder, name)

    if (target === from || intoFolder.startsWith(from)) return

    await invoke('rename_note', { from, to: target })
    this.recordFileAction({ kind:'move', from, to: target })

    for (const tab of this.tabs.filter((entry) => entry.path === from)) {
      tab.path = target
      tab.name = name
    }

    await this.loadTree()
    this.persist()
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
    this.remember(path)

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
    this.scheduleSave()
  }

  /** Typora saves as you pause; so does this, but only for notes that already
   *  live somewhere. An untitled note waits for you to choose a home. */
  private scheduleSave() {
    if (!this.autoSave || !this.active?.path) return

    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.save(), AUTO_SAVE_DELAY)
  }

  setAutoSave(on: boolean) {
    this.autoSave = on
    localStorage.setItem(AUTO_SAVE_KEY, String(on))
    if (!on) clearTimeout(this.saveTimer)
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

    // Keep the version that is about to be replaced, before replacing it.
    if (tab.path) {
      await invoke('snapshot_note', { path, content: tab.doc }).catch(() => undefined)
    }

    await invoke('write_note', { path, content: tab.doc })

    tab.path = path
    tab.name = basename(path)
    tab.dirty = false

    // Editing the config files in Nib should take effect on save.
    if (/custom\.css$|snippets\.json$/.test(path)) {
      const { settings } = await import('./settings.svelte')
      const { theme } = await import('./theme.svelte')
      await Promise.all([settings.loadSnippets(), theme.reload()])
    }

    await this.loadTree()
    this.persist()
  }

  /** Most-recent-first, newest at the front, no duplicates. */
  private remember(path: string) {
    this.recent = [path, ...this.recent.filter((entry) => entry !== path)].slice(0, RECENT_LIMIT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent))

    // The taskbar keeps its own recent list; this is what puts a note in it.
    if (isDesktop) void invoke('remember_recent', { path }).catch(() => undefined)
  }

  forgetRecent() {
    this.recent = []
    localStorage.removeItem(RECENT_KEY)
  }

  isPinned(path: string): boolean {
    return this.pinned.includes(path)
  }

  /** Pinned notes and folders sit above the tree, whatever their depth. */
  togglePin(path: string) {
    this.pinned = this.isPinned(path)
      ? this.pinned.filter((entry) => entry !== path)
      : [...this.pinned, path]

    localStorage.setItem(PINNED_KEY, JSON.stringify(this.pinned))
  }

  /** Every `#tag` in the space, most used first. */
  async loadTags() {
    const root = this.activeSpace?.root
    if (!isDesktop || !root) return

    this.tags = await invoke<Tag[]>('space_tags', { root }).catch(() => [])
  }

  /** Searches every note in the space and returns the matching lines. */
  async search(query: string): Promise<Hit[]> {
    const root = this.activeSpace?.root
    if (!root || query.trim().length < 2) return []

    return invoke<Hit[]>('search_space', { root, query, limit: 200 }).catch(() => [])
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
    this.recordFileAction({ kind:'rename', from: path, to: target })

    const tab = this.tabs.find((entry) => entry.path === path)
    if (tab) {
      tab.path = target
      tab.name = basename(target)
    }

    await this.loadTree()
    this.persist()
  }

  async remove(path: string, isFolder: boolean) {
    // A deleted note keeps one last snapshot, so the delete is recoverable.
    if (!isFolder) {
      const content = await invoke<string>('read_note', { path }).catch(() => '')
      if (content) await invoke('snapshot_note', { path, content }).catch(() => undefined)
      this.recordFileAction({ kind:'delete', path, content })
    }

    await invoke(isFolder ? 'delete_folder' : 'delete_note', { path })

    for (const tab of this.tabs.filter((entry) => entry.path?.startsWith(path))) {
      this.close(tab.id)
    }

    await this.loadTree()
  }

  /** The last handful of file operations, newest last, so one can be taken back.
   *  Deleting a folder is not among them: its contents are already gone. */
  private recordFileAction(action: FileAction) {
    this.undoable = [...this.undoable, action].slice(-UNDO_LIMIT)
  }

  /** Puts the last move, rename or deletion back. */
  async undoFileAction() {
    const action = this.undoable.at(-1)
    if (!action) return

    this.undoable = this.undoable.slice(0, -1)

    try {
      if (action.kind === 'delete') {
        await invoke('write_note', { path: action.path, content: action.content })
      } else {
        await invoke('rename_note', { from: action.to, to: action.from })

        for (const tab of this.tabs.filter((entry) => entry.path === action.to)) {
          tab.path = action.from
          tab.name = basename(action.from)
        }
      }
    } catch {
      // Something else has since changed the file; leave what is there alone.
      return
    }

    await this.loadTree()
    this.persist()
  }

  /** What undoing would do, phrased for a menu. Null when there is nothing. */
  get undoLabel(): string | null {
    const action = this.undoable.at(-1)
    if (!action) return null

    const name = basename(action.kind === 'delete' ? action.path : action.to)
    return {
      move: t('Undo moving {name}', { name }),
      rename: t('Undo renaming {name}', { name }),
      delete: t('Undo deleting {name}', { name }),
    }[action.kind]
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
