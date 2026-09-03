import { api, ApiError } from './api'
import { account } from './account.svelte'
import { invoke } from './tauri'
import type { Entry } from './workspace.svelte'

const STORAGE_KEY = 'nib:mirrors'
const POLL_INTERVAL = 20_000

/** What the last sync left on disk, so local edits can be told apart from
 *  remote ones without diffing whole documents. */
interface Tracked {
  id: string
  version: number
  hash: string
}

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

class Sync {
  status = $state<Status>('off')
  lastError = $state<string | null>(null)
  lastSyncedAt = $state<number | null>(null)

  private mirrors: Record<string, Mirror> = {}
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  start() {
    this.mirrors = this.load()
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => void this.run(), POLL_INTERVAL)
    void this.run()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.status = 'off'
  }

  /** Starts mirroring a remote space into a local folder. */
  async link(spaceId: string, root: string) {
    this.mirrors[spaceId] = { spaceId, root, cursor: 0, notes: {} }
    this.save()
    await this.run()
  }

  unlink(spaceId: string) {
    delete this.mirrors[spaceId]
    this.save()
  }

  linked(spaceId: string): boolean {
    return spaceId in this.mirrors
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
        if (remote.deleted) {
          if (mirror.notes[remote.path]) {
            await invoke('delete_note', { path: join(mirror.root, remote.path) }).catch(
              () => undefined,
            )
            delete mirror.notes[remote.path]
          }
          continue
        }

        const tracked = mirror.notes[remote.path]
        if (tracked?.version === remote.version) continue

        const { content } = await api.readNote(token, remote.id)
        await invoke('write_note', { path: join(mirror.root, remote.path), content })

        mirror.notes[remote.path] = {
          id: remote.id,
          version: remote.version,
          hash: remote.hash,
        }
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

    const stamp = new Date().toISOString().slice(0, 10)
    const copy = path.replace(/(\.[^.]+)$/, ` (from another device ${stamp})$1`)

    await invoke('write_note', {
      path: join(mirror.root, copy),
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
