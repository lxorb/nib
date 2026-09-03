<script lang="ts">
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { t } from './i18n.svelte'
  import { DIVIDER, menu, type MenuEntry } from './menu.svelte'
  import { workspace, type Tab } from './workspace.svelte'

  const stripped = (name: string) => name.replace(/\.(md|markdown|mdown|mkd)$/i, '')

  function tabMenu(tab: Tab): MenuEntry[] {
    return [
      { label: t('Close'), hint: 'Ctrl W', run: () => workspace.close(tab.id) },
      {
        label: t('Close others'),
        disabled: workspace.tabs.length < 2,
        run: () => {
          for (const other of workspace.tabs.filter((entry) => entry.id !== tab.id)) {
            workspace.close(other.id)
          }
        },
      },
      DIVIDER,
      {
        label: t('Copy path'),
        disabled: !tab.path,
        run: () => tab.path && navigator.clipboard.writeText(tab.path),
      },
      {
        label: t('Reveal in Explorer'),
        disabled: !tab.path,
        run: () => tab.path && workspace.reveal(tab.path),
      },
    ]
  }
</script>

<div class="tabs">
  {#each workspace.tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === workspace.activeTabId}
      transition:fly={{ y: -8, duration: 180, easing: cubicOut }}
    >
      <button
        class="pick"
        onclick={() => workspace.activate(tab.id)}
        oncontextmenu={(event) => menu.show(event, tabMenu(tab))}
      >
        {stripped(tab.name)}
        {#if tab.dirty}<span class="dot" aria-label={t('Unsaved')}></span>{/if}
      </button>
      <button class="shut" title={t('Close')} aria-label={t('Close')} onclick={() => workspace.close(tab.id)}>
        <svg viewBox="0 0 8 8"><path d="M1 1l6 6M7 1L1 7" /></svg>
      </button>
    </div>
  {/each}

  <button class="new" title={t('New note')} aria-label={t('New note')} onclick={() => workspace.openBlank()}>
    <svg viewBox="0 0 12 12"><path d="M6 2v8M2 6h8" /></svg>
  </button>
</div>

<style>
  /* Shrinks before the window controls do, and scrolls once it runs out. */
  .tabs {
    display: flex;
    align-items: stretch;
    gap: 2px;
    min-width: 0;
    padding: 0 var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .new {
    flex: none;
    align-self: center;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    margin-left: 2px;
    border-radius: var(--radius-sm);
    color: var(--muted);
  }

  .new:hover {
    background: var(--surface-2);
    color: var(--text-strong);
  }

  .new svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }

  .tab {
    display: flex;
    align-items: center;
    position: relative;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    transition: background var(--dur-fast) var(--ease-out);
  }

  .tab:hover {
    background: var(--surface-2);
  }

  /* The active tab is marked by a line that slides in, not by a label. */
  .tab.active::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 2px;
    background: var(--accent);
    animation: underline var(--dur-base) var(--ease-out);
  }

  @keyframes underline {
    from {
      transform: scaleX(0);
    }
  }

  button {
    border: none;
    background: none;
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    cursor: default;
    transition: color var(--dur-fast) var(--ease-out);
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 15rem;
    padding: 7px 4px 7px 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab.active .pick {
    color: var(--text-strong);
  }

  .dot {
    width: 5px;
    height: 5px;
    flex: none;
    border-radius: 50%;
    background: var(--accent);
  }

  .shut {
    display: grid;
    place-items: center;
    width: 20px;
    height: 100%;
    padding: 0 6px 0 0;
    opacity: 0;
    transition: opacity var(--dur-fast) var(--ease-out);
  }

  .tab:hover .shut,
  .shut:focus-visible {
    opacity: 1;
  }

  .shut:hover {
    color: var(--danger);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  svg {
    width: 7px;
    height: 7px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }
</style>
