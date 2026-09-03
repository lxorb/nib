<script lang="ts">
  import {
    clearFormatting,
    EditorView,
    type StateCommand,
    type Transaction,
    insertCodeFence,
    insertHorizontalRule,
    insertLink,
    insertPageBreak,
    insertTable,
    toggleBulletList,
    toggleOrderedList,
    toggleQuote,
    toggleWrap,
  } from '@nib/editor'
  import { frontMatter } from '@nib/markdown'
  import ContextMenu from './lib/ContextMenu.svelte'
  import Editor from './lib/Editor.svelte'
  import History from './lib/History.svelte'
  import { DIVIDER, type MenuEntry, menu } from './lib/menu.svelte'
  import Palette from './lib/Palette.svelte'
  import Rail from './lib/Rail.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import SettingsPanel from './lib/SettingsPanel.svelte'
  import SignIn from './lib/SignIn.svelte'
  import { account } from './lib/account.svelte'
  import { settings } from './lib/settings.svelte'
  import { sync } from './lib/sync.svelte'
  import StatusBar from './lib/StatusBar.svelte'
  import Tabs from './lib/Tabs.svelte'
  import Titlebar from './lib/Titlebar.svelte'
  import { modes } from './lib/modes.svelte'
  import { assetUrl, currentWindow, folderOf, invoke, isDesktop, joinPath } from './lib/tauri'
  import { theme } from './lib/theme.svelte'
  import { workspace } from './lib/workspace.svelte'

  let view = $state<EditorView>()
  let palette = $state(false)

  const title = $derived(
    workspace.active
      ? `${workspace.active.name.replace(/\.(md|markdown|mdown|mkd)$/i, '')}${workspace.active.dirty ? ' ·' : ''}`
      : '',
  )

  theme.init()
  modes.restore()
  settings.restore()
  void workspace.restore().then(openLaunchFiles)
  void account.restore()

  // A new view starts with no modes applied, so re-apply on every swap.
  $effect(() => {
    if (view) modes.apply(view)
  })

  // Syncing only runs while there is an account behind it.
  $effect(() => {
    if (account.signedIn) sync.start()
    else sync.stop()
  })

  // `window.nib` is the editor view; this is the surrounding app state.
  if (import.meta.env.DEV) {
    Object.assign(window, { nibApp: { account, sync, workspace, settings, modes, theme } })
  }

  function goto(line: number) {
    if (!view) return

    const target = view.state.doc.line(Math.min(line + 1, view.state.doc.lines))
    view.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 72 }),
    })
    view.focus()
  }

  /** Files named on the command line, and any handed over by a second launch. */
  async function openLaunchFiles() {
    if (!isDesktop) return

    for (const path of await invoke<string[]>('take_startup_files').catch(() => [])) {
      await workspace.open(path)
    }

    const { listen } = await import('@tauri-apps/api/event')
    void listen<string[]>('nib://open-files', async (event) => {
      for (const path of event.payload) await workspace.open(path)
    })
  }

  function runCommand(command: StateCommand) {
    if (!view) return
    command({ state: view.state, dispatch: (transaction: Transaction) => view!.dispatch(transaction) })
    view.focus()
  }

  async function paste() {
    if (!view) return
    const text = await navigator.clipboard.readText().catch(() => '')
    if (!text) return

    const range = view.state.selection.main
    view.dispatch({ changes: { from: range.from, to: range.to, insert: text } })
    view.focus()
  }

  /** The editor's own menu, so the browser's never appears. */
  function editorMenu(): MenuEntry[] {
    const selected = !!view && !view.state.selection.main.empty

    return [
      { label: 'Cut', hint: 'Ctrl X', disabled: !selected, run: () => document.execCommand('cut') },
      { label: 'Copy', hint: 'Ctrl C', disabled: !selected, run: () => document.execCommand('copy') },
      { label: 'Paste', hint: 'Ctrl V', run: () => void paste() },
      DIVIDER,
      { label: 'Bold', hint: 'Ctrl B', run: () => runCommand(toggleWrap('**')) },
      { label: 'Italic', hint: 'Ctrl I', run: () => runCommand(toggleWrap('*')) },
      { label: 'Code', run: () => runCommand(toggleWrap('`')) },
      { label: 'Link', hint: 'Ctrl K', run: () => runCommand(insertLink) },
      { label: 'Clear formatting', hint: 'Ctrl \\', run: () => runCommand(clearFormatting) },
      DIVIDER,
      { label: 'Quote', run: () => runCommand(toggleQuote) },
      { label: 'Bulleted list', run: () => runCommand(toggleBulletList) },
      { label: 'Numbered list', run: () => runCommand(toggleOrderedList) },
      { label: 'Table', hint: 'Ctrl T', run: () => runCommand(insertTable()) },
      { label: 'Code block', run: () => runCommand(insertCodeFence) },
      { label: 'Horizontal rule', run: () => runCommand(insertHorizontalRule) },
      { label: 'Page break', run: () => runCommand(insertPageBreak) },
      DIVIDER,
      {
        label: modes.source ? 'Leave source mode' : 'Source mode',
        hint: 'Ctrl /',
        run: () => modes.toggleSource(view),
      },
    ]
  }

  /** Pasted and dropped images are copied next to the note, keeping it portable. */
  async function saveImage(file: File): Promise<string | null> {
    const path = workspace.active?.path
    if (!path) return null

    const bytes = [...new Uint8Array(await file.arrayBuffer())]
    const name = file.name || `pasted-${Date.now()}.${(file.type.split('/')[1] || 'png').replace('+xml', '')}`

    return invoke<string>('save_asset', { notePath: path, name, bytes }).catch(() => null)
  }

  function resolveImage(src: string): string {
    if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith('data:')) return src

    const path = workspace.active?.path
    if (!path) return src

    // `typora-root-url` in the front matter re-bases absolute-looking paths,
    // which is how Typora makes a note portable between a vault and a site.
    const root = /^\s*typora-root-url\s*:\s*(.+)$/m.exec(
      frontMatter(workspace.active?.doc ?? '') ?? '',
    )?.[1]

    if (root && src.startsWith('/')) {
      return assetUrl(joinPath(root.trim().replace(/["']/g, ''), src.slice(1)))
    }

    return assetUrl(joinPath(folderOf(path), src))
  }

  async function toggleFullscreen() {
    if (!isDesktop) return
    const window = await currentWindow()
    await window.setFullscreen(!(await window.isFullscreen()))
  }

  function cycleTab(direction: number) {
    const index = workspace.tabs.findIndex((tab) => tab.id === workspace.activeTabId)
    if (index < 0) return

    const next = (index + direction + workspace.tabs.length) % workspace.tabs.length
    workspace.activate(workspace.tabs[next].id)
  }

  function onKeydown(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey
    const shift = event.shiftKey

    if (event.key === 'F8') return act(event, () => modes.toggleFocus(view))
    if (event.key === 'F9') return act(event, () => modes.toggleTypewriter(view))
    if (event.key === 'F11') return act(event, () => void toggleFullscreen())
    if (!mod) return

    const key = event.key.toLowerCase()

    if (key === 'p' && !shift) return act(event, () => (palette = true))
    if (key === ',') return act(event, () => settings.show())
    if (key === '/') return act(event, () => modes.toggleSource(view))
    if (key === 's' && !shift) return act(event, () => void workspace.save())
    if (key === 'n' && !shift) return act(event, () => workspace.openBlank())
    if (key === 'o' && !shift) return act(event, () => void workspace.addSpace())
    if (key === 'w') return act(event, () => workspace.activeTabId && workspace.close(workspace.activeTabId))
    if (key === 'tab') return act(event, () => cycleTab(shift ? -1 : 1))

    if (!shift) return

    if (key === 'l') return act(event, () => workspace.toggleSidebar())
    if (key === '1') return act(event, () => workspace.showPanel('outline'))
    if (key === '2') return act(event, () => workspace.showPanel('articles'))
    if (key === '3') return act(event, () => workspace.showPanel('tree'))
    if (key === 'f') return act(event, () => workspace.showPanel('search'))
    if (key === '0') return act(event, () => modes.resetZoom())
    if (key === '=' || key === '+') return act(event, () => modes.stepZoom(1))
    if (key === '-' || key === '_') return act(event, () => modes.stepZoom(-1))
  }

  function act(event: KeyboardEvent, run: () => void) {
    event.preventDefault()
    run()
  }
</script>

<!-- Nothing in the app ever shows the browser's own menu. -->
<svelte:window onkeydown={onKeydown} oncontextmenu={(event) => event.preventDefault()} />

<!-- The titlebar spans the whole window, so the rail, the sidebar and the
     document all start on the same line. -->
<main class:focus={modes.focus}>
  <Titlebar {title} />

  <div class="middle">
    <Rail />

    {#if workspace.panel}
      <Sidebar ongoto={goto} />
    {/if}

    <div class="document">
      {#if workspace.tabs.length > 1}
        <Tabs />
      {/if}

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="editor" oncontextmenu={(event) => menu.show(event, editorMenu())}>
        {#key workspace.activeTabId}
          <Editor
            bind:view
            doc={workspace.active?.doc ?? ''}
            onchange={(value) => workspace.edit(value)}
            onimage={saveImage}
            resolveimage={resolveImage}
          />
        {/key}
      </div>

      <StatusBar doc={workspace.active?.doc ?? ''} />
    </div>
  </div>
</main>

<Palette bind:open={palette} {view} />
<SignIn />
<SettingsPanel />
<History bind:open={settings.historyOpen} />
<ContextMenu />

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg);
    transition: background var(--dur-slow) var(--ease-out);
  }

  .middle {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .document {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .editor {
    flex: 1;
    min-height: 0;
    display: flex;
  }
</style>
