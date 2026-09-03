<script lang="ts">
  import { EditorView } from '@nib/editor'
  import Editor from './lib/Editor.svelte'
  import Palette from './lib/Palette.svelte'
  import Rail from './lib/Rail.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import SignIn from './lib/SignIn.svelte'
  import { account } from './lib/account.svelte'
  import { sync } from './lib/sync.svelte'
  import StatusBar from './lib/StatusBar.svelte'
  import Tabs from './lib/Tabs.svelte'
  import Titlebar from './lib/Titlebar.svelte'
  import { modes } from './lib/modes.svelte'
  import { currentWindow, isDesktop } from './lib/tauri'
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
  void workspace.restore()
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
  if (import.meta.env.DEV) Object.assign(window, { nibApp: { account, sync, workspace } })

  function goto(line: number) {
    if (!view) return

    const target = view.state.doc.line(Math.min(line + 1, view.state.doc.lines))
    view.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 72 }),
    })
    view.focus()
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
    if (key === '0') return act(event, () => modes.resetZoom())
    if (key === '=' || key === '+') return act(event, () => modes.stepZoom(1))
    if (key === '-' || key === '_') return act(event, () => modes.stepZoom(-1))
  }

  function act(event: KeyboardEvent, run: () => void) {
    event.preventDefault()
    run()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main class:focus={modes.focus}>
  <Rail />

  <div class="pane">
    <Titlebar {title} />

    <div class="middle">
      {#if workspace.panel}
        <Sidebar ongoto={goto} />
      {/if}

      <div class="document">
        {#if workspace.tabs.length > 1}
          <Tabs />
        {/if}

        {#key workspace.activeTabId}
          <Editor
            bind:view
            doc={workspace.active?.doc ?? ''}
            onchange={(value) => workspace.edit(value)}
          />
        {/key}

        <StatusBar doc={workspace.active?.doc ?? ''} />
      </div>
    </div>
  </div>
</main>

<Palette bind:open={palette} {view} />
<SignIn />

<style>
  main {
    display: flex;
    height: 100vh;
    background: var(--bg);
    transition: background var(--dur-slow) var(--ease-out);
  }

  .pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .middle {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .document {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
</style>
