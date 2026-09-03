<script lang="ts">
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import type { Panel } from './workspace.svelte'
  import { workspace } from './workspace.svelte'
  import Tree from './Tree.svelte'

  let { ongoto }: { ongoto?: (line: number) => void } = $props()

  const PANELS: { id: Panel; label: string; path: string }[] = [
    { id: 'tree', label: 'Files', path: 'M1 3.5h4l1 1.5h6v6.5H1z' },
    { id: 'articles', label: 'Notes', path: 'M2 2.5h9M2 6.5h9M2 10.5h6' },
    { id: 'outline', label: 'Outline', path: 'M2 2.5h9M4 6.5h7M6 10.5h5' },
  ]

  const stripped = (name: string) => name.replace(/\.(md|markdown|mdown|mkd)$/i, '')
</script>

<aside transition:fly={{ x: -20, duration: 220, easing: cubicOut, opacity: 0 }}>
  <div class="switch">
    {#each PANELS as item (item.id)}
      <button
        class:active={workspace.panel === item.id}
        title={item.label}
        aria-label={item.label}
        aria-current={workspace.panel === item.id}
        onclick={() => workspace.showPanel(item.id)}
      >
        <svg viewBox="0 0 13 13"><path d={item.path} /></svg>
      </button>
    {/each}
  </div>

  <div class="body">
    {#if workspace.panel === 'tree'}
      {#if workspace.tree}
        <Tree entries={workspace.tree.children} />
      {:else}
        <button class="empty" onclick={() => workspace.addSpace()}>Open a folder</button>
      {/if}
    {:else if workspace.panel === 'articles'}
      <ul>
        {#each workspace.notes as note (note.path)}
          <li>
            <button
              class="row"
              class:active={workspace.active?.path === note.path}
              onclick={() => workspace.open(note.path)}
            >
              {stripped(note.name)}
            </button>
          </li>
        {/each}
      </ul>
    {:else if workspace.panel === 'outline'}
      <ul>
        {#each workspace.headings as heading, index (index)}
          <li>
            <button
              class="row heading"
              style:padding-left="{(heading.level - 1) * 11 + 8}px"
              style:opacity={1 - (heading.level - 1) * 0.09}
              onclick={() => ongoto?.(heading.line)}
            >
              {heading.text}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</aside>

<style>
  aside {
    width: var(--sidebar-width);
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--line);
    background: var(--side-bar-bg-color);
  }

  .switch {
    display: flex;
    gap: 2px;
    padding: var(--space-2) var(--space-2) var(--space-1);
  }

  .switch button {
    width: 26px;
    height: 24px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted);
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .switch button:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .switch button.active {
    background: var(--surface-3);
    color: var(--accent);
  }

  .switch button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-1) var(--space-2) var(--space-4);
    scrollbar-width: thin;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    width: 100%;
    padding: 4px 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted-strong);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }

  .row:hover {
    background: var(--item-hover-bg-color);
    color: var(--item-hover-text-color);
  }

  .row.heading:hover {
    transform: translateX(2px);
  }

  .row.active {
    background: var(--active-file-bg-color);
    color: var(--active-file-text-color);
    font-weight: 550;
  }

  .row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .empty {
    width: 100%;
    padding: var(--space-3);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-md);
    background: none;
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    cursor: default;
    transition:
      border-color var(--dur-base) var(--ease-out),
      color var(--dur-base) var(--ease-out);
  }

  .empty:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
