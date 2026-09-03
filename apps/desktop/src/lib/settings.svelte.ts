import { setSnippets } from '@nib/editor'
import { api, type DnsRecord, type RemoteSpace } from './api'
import { account } from './account.svelte'
import { DEFAULT_PAGE_SETUP, type PageSetup } from './page-setup'
import { invoke, isDesktop } from './tauri'
import {
  currentVersion,
  dueForCheck,
  markChecked,
  openRelease,
  type Release,
  updateAvailable,
} from './update'
import { sync } from './sync.svelte'
import { workspace } from './workspace.svelte'

const STORAGE_KEY = 'nib:llm'
const PAGE_KEY = 'nib:page'

export type Section = 'account' | 'publish' | 'llm' | 'appearance' | 'export'

interface McpConfig {
  binary: string
  installed: boolean
  snippet: string
}

/** Which local space is mirrored to which remote one. */
const LINK_KEY = 'nib:links'

function links(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LINK_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

class Settings {
  open = $state(false)
  section = $state<Section>('account')
  /** The version-history sheet, which is its own overlay. */
  historyOpen = $state(false)

  /** LLM access is off until switched on, and read-only until widened. */
  llmEnabled = $state(false)
  llmReadOnly = $state(true)
  mcp = $state<McpConfig | null>(null)

  /** Whether pandoc is on this machine, which decides the export list. */
  pandoc = $state(false)

  /** Paper and running text for export. A note's front matter overrules it. */
  page = $state<PageSetup>({ ...DEFAULT_PAGE_SETUP })

  /** A published release newer than the one running, once one is found. */
  update = $state<Release | null>(null)

  /** Whether Explorer's "New" menu offers a markdown document. Windows only. */
  newMenu = $state(false)

  busy = $state(false)
  error = $state<string | null>(null)
  dns = $state<DnsRecord[]>([])
  availability = $state<{ checking: boolean; available: boolean | null; reason?: string }>({
    checking: false,
    available: null,
  })

  /** The remote space the open local space mirrors to, if any. */
  readonly remote = $derived.by((): RemoteSpace | null => {
    const local = workspace.activeSpaceId
    if (!local) return null

    const id = links()[local]
    return account.spaces.find((space) => space.id === id) ?? null
  })

  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      this.llmEnabled = !!saved.enabled
      this.llmReadOnly = saved.readOnly ?? true
    } catch {
      // Defaults are the safe ones.
    }

    try {
      const saved = JSON.parse(localStorage.getItem(PAGE_KEY) ?? '{}')
      this.page = { ...DEFAULT_PAGE_SETUP, ...saved }
    } catch {
      // Defaults are the safe ones.
    }

    void import('./export').then(({ pandocAvailable }) =>
      pandocAvailable().then((found) => (this.pandoc = found)),
    )

    void this.loadSnippets()
    void this.checkForUpdate()

    if (isDesktop) {
      void invoke<boolean>('new_menu_registered')
        .then((on) => (this.newMenu = on))
        .catch(() => undefined)
    }
  }

  /** Adds or removes Explorer's "New ▸ Markdown Document" entry. */
  async setNewMenu(enabled: boolean) {
    if (!isDesktop) return

    this.error = null
    try {
      await invoke('set_new_menu', { enabled })
      this.newMenu = enabled
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
    }
  }

  /** Looks for a newer release. Quiet on its own; a check the reader asked for
   *  opens the release page when there is something to see. */
  async checkForUpdate(options: { announce?: boolean } = {}) {
    if (!isDesktop) return

    const now = Date.now()
    if (!options.announce && !dueForCheck(now)) return

    markChecked(now)
    this.update = await updateAvailable(await currentVersion())

    if (options.announce && this.update) await openRelease(this.update)
  }

  setPage(patch: Partial<PageSetup>) {
    this.page = { ...this.page, ...patch }
    localStorage.setItem(PAGE_KEY, JSON.stringify(this.page))
  }

  /** Reads `snippets.json` into the editor's completion source. */
  async loadSnippets() {
    if (!isDesktop) return

    const raw = await invoke<string>('read_snippets').catch(() => '{}')
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const usable = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
      ) as Record<string, string>

      setSnippets(usable)
    } catch {
      // A malformed file simply means no snippets, not a broken editor.
      setSnippets({})
    }
  }

  show(section: Section = 'account') {
    this.section = section
    this.open = true
    this.error = null
    void this.loadMcp()
  }

  setLlm(enabled: boolean, readOnly: boolean) {
    this.llmEnabled = enabled
    this.llmReadOnly = readOnly
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, readOnly }))
    void this.loadMcp()
  }

  async loadMcp() {
    const root = workspace.activeSpace?.root
    if (!isDesktop || !root) return

    this.mcp = await invoke<McpConfig>('mcp_config', {
      space: root,
      readOnly: this.llmReadOnly,
    }).catch(() => null)
  }

  /** Creates a remote space for the open folder and starts mirroring it. */
  async startSyncing() {
    const local = workspace.activeSpace
    if (!local || !account.token) return

    this.busy = true
    this.error = null

    try {
      const { space } = await api.createSpace(account.token, local.name)
      localStorage.setItem(LINK_KEY, JSON.stringify({ ...links(), [local.id]: space.id }))

      await account.loadSpaces()
      await sync.link(space.id, local.root)
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'could not start syncing'
    } finally {
      this.busy = false
    }
  }

  async checkSubdomain(value: string) {
    if (!account.token || value.length < 2) {
      this.availability = { checking: false, available: null }
      return
    }

    this.availability = { checking: true, available: null }
    try {
      const result = await api.subdomainAvailable(account.token, value)
      this.availability = { checking: false, available: result.available, reason: result.reason }
    } catch {
      this.availability = { checking: false, available: null }
    }
  }

  async publish(settings: { subdomain?: string; domain?: string; title?: string }) {
    const space = this.remote
    if (!space || !account.token) return

    this.busy = true
    this.error = null

    try {
      const result = await api.publish(account.token, space.id, settings)
      this.dns = result.dns
      await account.loadSpaces()
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'could not publish'
    } finally {
      this.busy = false
    }
  }

  async unpublish() {
    const space = this.remote
    if (!space || !account.token) return

    this.busy = true
    try {
      await api.unpublish(account.token, space.id)
      this.dns = []
      await account.loadSpaces()
    } finally {
      this.busy = false
    }
  }
}

export const settings = new Settings()
