<script lang="ts">
  import { EditorView } from '@nib/editor'
  import Editor from './lib/Editor.svelte'
  import Rail from './lib/Rail.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import StatusBar from './lib/StatusBar.svelte'
  import Tabs from './lib/Tabs.svelte'
  import Titlebar from './lib/Titlebar.svelte'
  import { theme } from './lib/theme.svelte'
  import { workspace } from './lib/workspace.svelte'

  let view = $state<EditorView>()

  const title = $derived(
    workspace.active
      ? `${workspace.active.name.replace(/\.(md|markdown|mdown|mkd)$/i, '')}${workspace.active.dirty ? ' ·' : ''}`
      : '',
  )

  theme.init()
  void workspace.restore()

  function goto(line: number) {
    if (!view) return

    const target = view.state.doc.line(Math.min(line + 1, view.state.doc.lines))
    view.dispatch({
      selection: { anchor: target.from },
      effects: EditorView.scrollIntoView(target.from, { y: 'start', yMargin: 72 }),
    })
    view.focus()
  }

  function onKeydown(event: KeyboardEvent) {
    if (!event.ctrlKey && !event.metaKey) return

    const key = event.key.toLowerCase()
    const shift = event.shiftKey

    const handlers: Record<string, () => void> = {
      s: () => void workspace.save(),
      n: () => workspace.openBlank(),
      w: () => workspace.activeTabId && workspace.close(workspace.activeTabId),
      o: () => void workspace.addSpace(),
      l: () => shift && workspace.toggleSidebar(),
      '1': () => shift && workspace.showPanel('outline'),
      '2': () => shift && workspace.showPanel('articles'),
      '3': () => shift && workspace.showPanel('tree'),
    }

    const handler = handlers[key]
    if (!handler) return

    // Shift-qualified bindings must not swallow their unshifted counterparts.
    if ((key === 'l' || key === '1' || key === '2' || key === '3') && !shift) return

    event.preventDefault()
    handler()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main>
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
