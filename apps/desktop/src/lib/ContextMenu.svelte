<script lang="ts">
  import { scale } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { menu, type MenuItem } from './menu.svelte'

  let element = $state<HTMLDivElement>()
  let position = $state({ x: 0, y: 0 })

  // Flip the menu back inside the window when it would run off an edge.
  $effect(() => {
    if (!menu.open || !element) return

    const { width, height } = element.getBoundingClientRect()
    position = {
      x: Math.min(menu.x, window.innerWidth - width - 8),
      y: Math.min(menu.y, window.innerHeight - height - 8),
    }
  })

  function choose(item: MenuItem) {
    menu.hide()
    item.run()
  }
</script>

<svelte:window
  onclick={() => menu.hide()}
  onblur={() => menu.hide()}
  onresize={() => menu.hide()}
  onkeydown={(event) => event.key === 'Escape' && menu.hide()}
/>

{#if menu.open}
  <div
    bind:this={element}
    class="menu"
    style:left="{position.x}px"
    style:top="{position.y}px"
    transition:scale={{ duration: 120, start: 0.96, easing: cubicOut }}
    role="menu"
    tabindex="-1"
  >
    {#each menu.items as item, index (index)}
      {#if item === null}
        <hr />
      {:else}
        <button
          role="menuitem"
          class:danger={item.danger}
          disabled={item.disabled}
          onclick={() => choose(item)}
        >
          <span>{item.label}</span>
          {#if item.hint}<kbd>{item.hint}</kbd>{/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 60;
    min-width: 11rem;
    padding: var(--space-1);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    transform-origin: top left;
  }

  button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 6px 9px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    text-align: left;
    white-space: nowrap;
    cursor: default;
    transition:
      background var(--dur-instant) var(--ease-out),
      color var(--dur-instant) var(--ease-out);
  }

  button:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--text-strong);
  }

  button.danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 16%, transparent);
    color: var(--danger);
  }

  button:disabled {
    color: var(--muted);
  }

  kbd {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--muted);
  }

  hr {
    margin: var(--space-1) 4px;
    border: none;
    border-top: 1px solid var(--line);
  }
</style>
