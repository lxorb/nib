<script lang="ts">
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { DIVIDER, menu, type MenuEntry } from './menu.svelte'
  import type { Entry } from './workspace.svelte'
  import { workspace } from './workspace.svelte'
  import Tree from './Tree.svelte'

  let { entries, depth = 0 }: { entries: Entry[]; depth?: number } = $props()

  let open = $state<Record<string, boolean>>({})
  let dropTarget = $state<string | null>(null)

  const stripped = (name: string) => name.replace(/\.(md|markdown|mdown|mkd)$/i, '')

  function folderMenu(entry: Entry): MenuEntry[] {
    return [
      { label: 'New note', run: () => workspace.createNote(entry.path) },
      { label: 'New folder', run: () => workspace.createFolder(entry.path) },
      DIVIDER,
      { label: 'Rename', run: () => (workspace.renaming = entry.path) },
      { label: pinLabel(entry.path), run: () => workspace.togglePin(entry.path) },
      { label: 'Reveal in Explorer', run: () => workspace.reveal(entry.path) },
      DIVIDER,
      { label: 'Delete', danger: true, run: () => workspace.remove(entry.path, true) },
      ...undoEntry(),
    ]
  }

  const pinLabel = (path: string) => (workspace.isPinned(path) ? 'Unpin' : 'Pin to the top')

  /** Only offered once there is something to take back. */
  function undoEntry(): MenuEntry[] {
    const label = workspace.undoLabel
    return label ? [DIVIDER, { label, run: () => workspace.undoFileAction() }] : []
  }

  function noteMenu(entry: Entry): MenuEntry[] {
    return [
      { label: 'Open', run: () => workspace.open(entry.path) },
      DIVIDER,
      { label: 'Rename', run: () => (workspace.renaming = entry.path) },
      { label: pinLabel(entry.path), run: () => workspace.togglePin(entry.path) },
      { label: 'Duplicate', run: () => workspace.duplicate(entry.path) },
      { label: 'Copy path', run: () => navigator.clipboard.writeText(entry.path) },
      { label: 'Reveal in Explorer', run: () => workspace.reveal(entry.path) },
      DIVIDER,
      { label: 'Delete', danger: true, run: () => workspace.remove(entry.path, false) },
      ...undoEntry(),
    ]
  }

  function commit(path: string, value: string) {
    workspace.renaming = null
    void workspace.rename(path, value)
  }

  function startDrag(event: DragEvent, path: string) {
    event.dataTransfer?.setData('text/nib-path', path)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  function overFolder(event: DragEvent, path: string) {
    if (!event.dataTransfer?.types.includes('text/nib-path')) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    dropTarget = path
  }

  function drop(event: DragEvent, folder: string) {
    event.preventDefault()
    dropTarget = null

    const from = event.dataTransfer?.getData('text/nib-path')
    if (from) void workspace.move(from, folder)
  }
</script>

<ul>
  {#each entries as entry (entry.path)}
    <li>
      {#if workspace.renaming === entry.path}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="rename"
          style:padding-left="{depth * 12 + 8}px"
          value={entry.is_dir ? entry.name : stripped(entry.name)}
          autofocus
          spellcheck="false"
          onblur={(event) => commit(entry.path, fullName(entry, event.currentTarget.value))}
          onkeydown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              workspace.renaming = null
            }
          }}
        />
      {:else if entry.is_dir}
        <button
          class="row folder"
          class:dropping={dropTarget === entry.path}
          style:padding-left="{depth * 12 + 8}px"
          aria-expanded={!!open[entry.path]}
          draggable="true"
          onclick={() => (open[entry.path] = !open[entry.path])}
          oncontextmenu={(event) => menu.show(event, folderMenu(entry))}
          ondragstart={(event) => startDrag(event, entry.path)}
          ondragover={(event) => overFolder(event, entry.path)}
          ondragleave={() => (dropTarget = null)}
          ondrop={(event) => drop(event, entry.path)}
        >
          <svg class="chevron" class:open={open[entry.path]} viewBox="0 0 8 8">
            <path d="M2 1l3 3-3 3" />
          </svg>
          <span class="label">{entry.name}</span>
        </button>

        {#if open[entry.path]}
          <div transition:slide={{ duration: 190, easing: cubicOut }}>
            <Tree entries={entry.children} depth={depth + 1} />
          </div>
        {/if}
      {:else}
        <button
          class="row note"
          class:active={workspace.active?.path === entry.path}
          style:padding-left="{depth * 12 + 20}px"
          draggable="true"
          onclick={() => workspace.open(entry.path)}
          oncontextmenu={(event) => menu.show(event, noteMenu(entry))}
          ondragstart={(event) => startDrag(event, entry.path)}
        >
          <span class="label">{stripped(entry.name)}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>

<script module lang="ts">
  /** Folders keep their name; notes keep their extension. */
  function fullName(entry: { is_dir: boolean; name: string }, typed: string): string {
    if (entry.is_dir) return typed
    const extension = entry.name.match(/\.[^.]+$/)?.[0] ?? '.md'
    return typed.endsWith(extension) ? typed : typed + extension
  }
</script>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted-strong);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    text-align: left;
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .row:hover {
    background: var(--item-hover-bg-color);
    color: var(--item-hover-text-color);
  }

  .row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .note.active {
    background: var(--active-file-bg-color);
    color: var(--active-file-text-color);
    font-weight: 550;
  }

  .folder {
    color: var(--muted);
  }

  .row.dropping {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--text-strong);
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rename {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text-strong);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    outline: none;
  }

  .chevron {
    width: 8px;
    height: 8px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    transition: transform var(--dur-base) var(--ease-out);
  }

  .chevron.open {
    transform: rotate(90deg);
  }
</style>
