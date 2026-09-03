import { api, ApiError } from './api'
import { account } from './account.svelte'
import { invoke } from './tauri'
import { type Entry, workspace } from './workspace.svelte'

const STORAGE_KEY = 'nib:mirrors'
const ENABLED_KEY = 'nib:sync-on'
const POLL_INTERVAL = 20_000

/** What the last sync left on disk, so local edits can be told apart from
 *  remote ones without diffing whole documents. */
interface Tracked {
  id: string
  version: number
  hash: string
}

/** One local space folder and the remote space it mirrors. Keyed by `root`,
 *  because the folder is the thing that persists across launches. */
interface Mirror {
  spaceId: string
  root: string
  cursor: number
  notes: Record<string, Tracked>
}

export type Status = 'off' | 'idle' | 'syncing' | 'error'

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function join(root: string, path: string): string {
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root}${separator}${path.split('/').join(separator)}`
}

function relative(root: string, absolute: string): string {
  return absolute.slice(root.length).replace(/^[\\/]+/, '').replace(/\\/g, '/')
}

/** Where the other side's copy goes when both changed the same note. */
function conflictPath(path: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return path.replace(/(\.[^.\\/]+)$/, ` (from another device ${stamp})$1`)
}

class Sync {
  status = $state<Status>('off')
  lastError = $state<string | null>(null)
  lastSyncedAt = $state<number | null>(null)

  private mirrors: Record<string, Mirror> = {}
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  /** Syncing is all of your spaces or none of them. A per-space choice would
   *  mean some notes are on this machine only and others are everywhere, with
   *  nothing on screen to say which is which. */
  enabled = $state(localStorage.getItem(ENABLED_KEY) === 'true')

  async setEnabled(on: boolean) {
    this.enabled = on
    localStorage.setItem(ENABLED_KEY, String(on))

    if (!on) {
      this.mirrors = {}
      this.save()
      this.stop()
      return
    }

    this.start()
  }

  start() {
    if (!this.enabled) return

    this.mirrors = this.load()
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL)
    void this.tick()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.status = 'off'
  }

  /** Pairs every local space with a remote one, then syncs. Run before each
   *  pass so a space made since the last one is picked up on its own. */
  private async tick() {
    await this.reconcile()
    await this.run()
  }

  private async reconcile() {
    const token = account.token
    if (!token || !this.enabled) return

    try {
      await account.loadSpaces()
    } catch {
      return
    }

    const remoteByName = new Map(account.spaces.map((space) => [space.name, space]))
    const roots = new Set<string>()

    for (const space of workspace.spaces) {
      roots.add(space.root)
      if (this.mirrors[space.root]) continue

      // A remote space of the same name is the same space — that is what makes
      // a second machine adopt what the first one already uploaded.
      const remote =
        remoteByName.get(space.name) ?? (await api.createSpace(token, space.name)).space

      this.mirrors[space.root] = { spaceId: remote.id, root: space.root, cursor: 0, notes: {} }
    }

    // A space deleted here stops being mirrored; the copy in the account stays.
    for (const root of Object.keys(this.mirrors)) {
      if (!roots.has(root)) delete this.mirrors[root]
    }

    this.save()
  }

  /** The remote space a local folder mirrors, if any. Publishing needs it. */
  remoteIdFor(root: string): string | null {
    return this.mirrors[root]?.spaceId ?? null
  }

  /** One full pass: take what the server has, then offer what we have. */
  async run() {
    if (this.running || !account.token) return

    this.running = true
    this.status = 'syncing'
    this.lastError = null

    try {
      for (const mirror of Object.values(this.mirrors)) {
        await this.pull(mirror)
        await this.push(mirror)
      }

      this.save()
      this.lastSyncedAt = Date.now()
      this.status = Object.keys(this.mirrors).length ? 'idle' : 'off'
    } catch (error) {
      this.status = 'error'
      this.lastError = error instanceof Error ? error.message : 'sync failed'
    } finally {
      this.running = false
    }
  }

  private async pull(mirror: Mirror) {
    const token = account.token
    if (!token) return

    for (;;) {
      const page = await api.changes(token, mirror.spaceId, mirror.cursor)

      for (const remote of page.notes) {
        const target = join(mirror.root, remote.path)

        if (remote.deleted) {
          if (mirror.notes[remote.path]) {
            await invoke('delete_note', { path: target }).catch(() => undefined)
            delete mirror.notes[remote.path]
          }
          continue
        }

        const tracked = mirror.notes[remote.path]
        if (tracked?.version === remote.version) continue

        const local = await invoke<string>('read_note', { path: target }).catch(() => null)
        const { content } = await api.readNote(token, remote.id)

        // The local file carries edits that never reached the server, and the
        // server moved too. Overwriting here would throw one of them away.
        const diverged = tracked && local !== null && (await sha256(local)) !== tracked.hash

        if (diverged && local !== content) {
          await invoke('write_note', { path: conflictPath(target), content })
          // An empty hash guarantees the push below sends our copy, now based
          // on the version we just saw, so it lands as the newest one.
          mirror.notes[remote.path] = { id: remote.id, version: remote.version, hash: '' }
          continue
        }

        await invoke('write_note', { path: target, content })
        mirror.notes[remote.path] = { id: remote.id, version: remote.version, hash: remote.hash }
      }

      mirror.cursor = page.cursor
      if (!page.more) break
    }
  }

  private async push(mirror: Mirror) {
    const token = account.token
    if (!token) return

    const tree = await invoke<Entry>('read_tree', { root: mirror.root }).catch(() => null)
    if (!tree) return

    const seen = new Set<string>()

    for (const file of flatten(tree)) {
      const path = relative(mirror.root, file.path)
      seen.add(path)

      const content = await invoke<string>('read_note', { path: file.path })
      const hash = await sha256(content)
      const tracked = mirror.notes[path]

      if (!tracked) {
        const { note } = await api.createNote(token, mirror.spaceId, path, content)
        mirror.notes[path] = { id: note.id, version: note.version, hash: note.hash }
        continue
      }

      if (tracked.hash === hash) continue

      try {
        const { note } = await api.writeNote(token, tracked.id, path, content, tracked.version)
        mirror.notes[path] = { id: note.id, version: note.version, hash: note.hash }
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error
        await this.keepBoth(mirror, path, tracked, error.body)
      }
    }

    // A file that vanished locally is a delete, not a gap.
    for (const [path, tracked] of Object.entries(mirror.notes)) {
      if (seen.has(path)) continue

      await api.deleteNote(token, tracked.id).catch(() => undefined)
      delete mirror.notes[path]
    }
  }

  /** Never silently drop an edit: the other device's copy lands beside ours. */
  private async keepBoth(mirror: Mirror, path: string, tracked: Tracked, conflict: unknown) {
    const token = account.token
    if (!token) return

    const server = conflict as { note?: { version: number; hash: string }; content?: string }
    if (!server?.note) return

    await invoke('write_note', {
      path: conflictPath(join(mirror.root, path)),
      content: server.content ?? '',
    })

    // Our version is now the newer one; write it over the server's.
    const ours = await invoke<string>('read_note', { path: join(mirror.root, path) })
    const { note } = await api.writeNote(token, tracked.id, path, ours, server.note.version)
    mirror.notes[path] = { id: note.id, version: note.version, hash: note.hash }
  }

  private load(): Record<string, Mirror> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Mirror>
    } catch {
      return {}
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mirrors))
  }
}

function flatten(entry: Entry): Entry[] {
  const out: Entry[] = []
  const walk = (node: Entry) => {
    for (const child of node.children) {
      if (child.is_dir) walk(child)
      else out.push(child)
    }
  }
  walk(entry)
  return out
}

export const sync = new Sync()
