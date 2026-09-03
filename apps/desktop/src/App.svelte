<script lang="ts">
  import { i18n, t } from './lib/i18n.svelte'
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
  import ContextMenu from './lib/ContextMenu.svelte'
  import Editor from './lib/Editor.svelte'
  import FormatBar from './lib/FormatBar.svelte'
  import History from './lib/History.svelte'
  import { DIVIDER, type MenuEntry, menu } from './lib/menu.svelte'
  import Palette from './lib/Palette.svelte'
  import PromptSheet from './lib/PromptSheet.svelte'
  import Rail from './lib/Rail.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import SettingsPanel from './lib/SettingsPanel.svelte'
  import SignIn from './lib/SignIn.svelte'
  import { account } from './lib/account.svelte'
  import { settings } from './lib/settings.svelte'
  import { sync } from './lib/sync.svelte'
  import StatusBar from './lib/StatusBar.svelte'
  import Titlebar from './lib/Titlebar.svelte'
  import { modes } from './lib/modes.svelte'
  import { imageUrl } from './lib/images'
  import { collectErrors } from './lib/log'
  import { prompt } from './lib/prompt.svelte'
  import { newSpace } from './lib/space-actions'
  import { installStaged, ready, stageUpdate } from './lib/updater'
  import { currentWindow, invoke, isDesktop } from './lib/tauri'
  import { theme } from './lib/theme.svelte'
  import { workspace } from './lib/workspace.svelte'

  let view = $state<EditorView>()
  let palette = $state(false)
  let formatBar = $state<FormatBar>()

  const title = $derived(
    workspace.active
      ? `${workspace.active.name.replace(/\.(md|markdown|mdown|mkd)$/i, '')}${workspace.active.dirty ? ' ·' : ''}`
      : '',
  )

  // The header shows no title, so the note's name goes to the window itself -
  // which is what the taskbar and the window switcher read.
  $effect(() => {
    const next = title ? `${title} - Nib` : 'Nib'
    document.title = next
    if (isDesktop) void currentWindow().then((window) => window.setTitle(next))
  })

  collectErrors()
  i18n.restore()
  theme.init()
  modes.restore()
  settings.restore()
  void workspace.restore().then(openLaunchFiles)
  void guardClose()
  // Fetched quietly at startup; it takes effect the next time Nib opens.
  void stageUpdate()
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

  /** Nothing with words in it is lost on the way out: closing asks first. */
  async function guardClose() {
    if (!isDesktop) return

    const window = await currentWindow()
    await window.onCloseRequested(async (event) => {
      // Nothing to ask about, but there may still be an update to put in place.
      if (!workspace.unsaved.length) {
        if (!ready()) return

        event.preventDefault()
        await installStaged()
        await window.destroy()
        return
      }

      event.preventDefault()

      const answer = await prompt.choose({
        title: t('Save your changes?'),
        detail: t('{count} of your notes have unsaved changes.', {
          count: workspace.unsaved.length,
        }),
        options: [
          { id: 'save', label: 'Save', primary: true },
          { id: 'discard', label: 'Discard', danger: true },
          { id: 'cancel', label: 'Cancel' },
        ],
      })

      if (answer === 'save') await workspace.saveAll()
      else if (answer !== 'discard') return

      // Everything is either written or deliberately given up on.
      await installStaged()
      await window.destroy()
    })
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
      { label: t('Cut'), hint: 'Ctrl X', disabled: !selected, run: () => document.execCommand('cut') },
      { label: t('Copy'), hint: 'Ctrl C', disabled: !selected, run: () => document.execCommand('copy') },
      { label: t('Paste'), hint: 'Ctrl V', run: () => void paste() },
      DIVIDER,
      { label: t('Bold'), hint: 'Ctrl B', run: () => runCommand(toggleWrap('**')) },
      { label: t('Italic'), hint: 'Ctrl I', run: () => runCommand(toggleWrap('*')) },
      { label: t('Code'), run: () => runCommand(toggleWrap('`')) },
      { label: t('Link'), hint: 'Ctrl K', run: () => runCommand(insertLink) },
      { label: t('Clear formatting'), hint: 'Ctrl \\', run: () => runCommand(clearFormatting) },
      DIVIDER,
      { label: t('Quote'), run: () => runCommand(toggleQuote) },
      { label: t('Bulleted list'), run: () => runCommand(toggleBulletList) },
      { label: t('Numbered list'), run: () => runCommand(toggleOrderedList) },
      { label: t('Table'), hint: 'Ctrl T', run: () => runCommand(insertTable()) },
      { label: t('Code block'), run: () => runCommand(insertCodeFence) },
      { label: t('Horizontal rule'), run: () => runCommand(insertHorizontalRule) },
      { label: t('Page break'), run: () => runCommand(insertPageBreak) },
      DIVIDER,
      {
        label: modes.source ? t('Leave source mode') : t('Source mode'),
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
    return imageUrl(src, workspace.active?.path, workspace.active?.doc ?? '')
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
    if (key === 'o' && !shift) return act(event, () => void newSpace())
    if (key === 'w') return act(event, () => workspace.activeTabId && workspace.close(workspace.activeTabId))
    if (key === 'tab') return act(event, () => cycleTab(shift ? -1 : 1))

    if (!shift) return

    if (key === 'l') return act(event, () => workspace.toggleSidebar())
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
<!-- The rail and the sidebar run the full height, so the window's one header
     row sits beside them rather than above everything. -->
<main class:focus={modes.focus}>
  <div class="middle">
    <Rail />

    {#if workspace.panel}
      <Sidebar ongoto={goto} />
    {/if}

    <div class="document">
      <Titlebar />

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="editor" oncontextmenu={(event) => menu.show(event, editorMenu())}>
        {#key workspace.activeTabId}
          <Editor
            bind:view
            doc={workspace.active?.doc ?? ''}
            onchange={(value) => workspace.edit(value)}
            onimage={saveImage}
            resolveimage={resolveImage}
            onselection={(current) => formatBar?.follow(current)}
          />
        {/key}
      </div>

      <StatusBar doc={workspace.active?.doc ?? ''} />
    </div>
  </div>
</main>

<Palette bind:open={palette} {view} />
<SignIn />
<SettingsPanel {view} />
<FormatBar bind:this={formatBar} {view} />
<History bind:open={settings.historyOpen} />
<PromptSheet />
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
