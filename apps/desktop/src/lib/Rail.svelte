<script lang="ts">
  import { account } from './account.svelte'
  import { workspace } from './workspace.svelte'
  import { theme } from './theme.svelte'

  function initial(name: string): string {
    return [...name.trim()][0]?.toUpperCase() ?? '·'
  }
</script>

<nav>
  <div class="spaces">
    {#each workspace.spaces as space (space.id)}
      <button
        class="space"
        class:active={space.id === workspace.activeSpaceId}
        title={space.name}
        aria-label={space.name}
        aria-current={space.id === workspace.activeSpaceId}
        onclick={() => workspace.selectSpace(space.id)}
      >
        {initial(space.name)}
        <span class="name">{space.name}</span>
      </button>
    {/each}

    <button class="add" title="Add a space" aria-label="Add a space" onclick={() => workspace.addSpace()}>
      <svg viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" /></svg>
    </button>
  </div>

  <div class="foot">
    <button
      class="add account"
      class:signed-in={account.signedIn}
      title={account.user?.email ?? 'Sign in'}
      aria-label={account.user?.email ?? 'Sign in'}
      onclick={() => (account.open = true)}
    >
      {#if account.signedIn}
        {initial(account.user!.email)}
      {:else}
        <svg viewBox="0 0 14 14"><circle cx="7" cy="4.6" r="2.8" /><path d="M1.6 13a5.4 5.4 0 0 1 10.8 0" /></svg>
      {/if}
    </button>

    <button
      class="add"
      title={theme.current === 'dark' ? 'Light' : 'Dark'}
      aria-label="Switch theme"
      onclick={() => theme.toggle()}
    >
    {#if theme.current === 'dark'}
      <svg viewBox="0 0 14 14"
        ><circle cx="7" cy="7" r="3" /><path
          d="M7 0v2M7 12v2M0 7h2M12 7h2M2.5 2.5l1.4 1.4M10.1 10.1l1.4 1.4M11.5 2.5l-1.4 1.4M3.9 10.1l-1.4 1.4"
        /></svg
      >
    {:else}
        <svg viewBox="0 0 14 14"><path d="M12 8.6A5.6 5.6 0 1 1 5.4 2a4.4 4.4 0 0 0 6.6 6.6z" /></svg>
      {/if}
    </button>
  </div>
</nav>

<style>
  nav {
    width: var(--rail-width);
    flex: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0 var(--space-3);
    gap: var(--space-2);
    border-right: 1px solid var(--line);
    background: var(--surface);
  }

  .spaces {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
  }

  button {
    border: none;
    background: none;
    color: var(--muted-strong);
    cursor: default;
    display: grid;
    place-items: center;
    position: relative;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .space {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-md);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 620;
    letter-spacing: 0.01em;
    background: var(--surface-2);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      transform var(--dur-base) var(--ease-spring);
  }

  .space:hover {
    background: var(--surface-3);
    color: var(--text-strong);
    transform: scale(1.08);
  }

  /* The active space grows a marker rather than announcing itself in words. */
  .space.active {
    background: var(--accent);
    color: #fff;
  }

  .space.active::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 50%;
    width: 2px;
    height: 16px;
    border-radius: 1px;
    background: var(--accent);
    transform: translateY(-50%) scaleY(0);
    animation: mark var(--dur-base) var(--ease-spring) forwards;
  }

  @keyframes mark {
    to {
      transform: translateY(-50%) scaleY(1);
    }
  }

  /* The label is text on demand: it exists only while pointed at. */
  .name {
    position: absolute;
    left: calc(100% + 10px);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: var(--text-sm);
    font-weight: 450;
    white-space: nowrap;
    box-shadow: var(--shadow-md);
    opacity: 0;
    transform: translateX(-4px);
    pointer-events: none;
    transition:
      opacity var(--dur-fast) var(--ease-out),
      transform var(--dur-base) var(--ease-out);
    z-index: 5;
  }

  .space:hover .name {
    opacity: 1;
    transform: none;
  }

  .add {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-md);
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      transform var(--dur-base) var(--ease-spring);
  }

  .add:hover {
    background: var(--surface-2);
    color: var(--text-strong);
    transform: rotate(90deg);
  }

  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .foot .add:hover {
    transform: none;
  }

  .account {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 620;
  }

  .account.signed-in {
    background: var(--surface-3);
    color: var(--text-strong);
  }

  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }
</style>
