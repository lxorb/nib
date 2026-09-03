<script lang="ts">
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import type { Entry } from './workspace.svelte'
  import { workspace } from './workspace.svelte'
  import Tree from './Tree.svelte'

  let { entries, depth = 0 }: { entries: Entry[]; depth?: number } = $props()

  let open = $state<Record<string, boolean>>({})
</script>

<ul>
  {#each entries as entry (entry.path)}
    <li>
      {#if entry.is_dir}
        <button
          class="row folder"
          style:padding-left="{depth * 12 + 8}px"
          aria-expanded={!!open[entry.path]}
          onclick={() => (open[entry.path] = !open[entry.path])}
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
          onclick={() => workspace.open(entry.path)}
        >
          <span class="label">{entry.name.replace(/\.(md|markdown|mdown|mkd)$/i, '')}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>

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

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
