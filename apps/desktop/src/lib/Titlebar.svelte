<script lang="ts">
  import { t } from './i18n.svelte'
  import Tabs from './Tabs.svelte'
  import { isDesktop, currentWindow } from './tauri'
  import { workspace } from './workspace.svelte'

  let maximized = $state(false)

  async function minimize() {
    if (isDesktop) (await currentWindow()).minimize()
  }

  async function toggleMaximize() {
    if (!isDesktop) return
    const win = await currentWindow()
    await win.toggleMaximize()
    maximized = await win.isMaximized()
  }

  async function close() {
    if (isDesktop) (await currentWindow()).close()
  }
</script>

<!-- One row: the sidebar toggle, the open notes, and the window's own buttons.
     The note's name lives in its tab, so there is no separate title. -->
<header>
  <button
    class="toggle"
    class:on={!!workspace.panel}
    title={workspace.panel ? t('Hide sidebar') : t('Show sidebar')}
    aria-label={workspace.panel ? t('Hide sidebar') : t('Show sidebar')}
    aria-pressed={!!workspace.panel}
    onclick={() => workspace.toggleSidebar()}
  >
    <svg viewBox="0 0 14 14">
      <rect x="1" y="2.5" width="12" height="9" rx="1.5" />
      <path d="M5.5 2.5v9" />
    </svg>
  </button>

  <Tabs />

  <!-- The empty stretch is what the window is dragged by. -->
  <div class="drag" data-tauri-drag-region></div>

  <div class="controls">
    <button onclick={minimize} aria-label={t('Minimize')}>
      <svg viewBox="0 0 10 10"><path d="M0 5h10" /></svg>
    </button>
    <button onclick={toggleMaximize} aria-label={maximized ? t('Restore') : t('Maximize')}>
      {#if maximized}
        <svg viewBox="0 0 10 10"><path d="M2.5 0.5h7v7M0.5 2.5h7v7h-7z" /></svg>
      {:else}
        <svg viewBox="0 0 10 10"><path d="M0.5 0.5h9v9h-9z" /></svg>
      {/if}
    </button>
    <button class="close" onclick={close} aria-label={t('Close')}>
      <svg viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" /></svg>
    </button>
  </div>
</header>

<style>
  header {
    height: var(--titlebar-height);
    display: flex;
    align-items: stretch;
    flex: none;
    user-select: none;
    border-bottom: 1px solid var(--line);
  }

  .drag {
    flex: 1;
    min-width: var(--space-5);
  }

  .toggle {
    width: 38px;
    flex: none;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    color: var(--muted);
    cursor: default;
    transition:
      color var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }

  .toggle:hover {
    background: var(--surface-2);
    color: var(--text-strong);
  }

  .toggle.on {
    color: var(--accent);
  }

  .toggle svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.2;
  }

  .controls {
    flex: none;
    display: flex;
    opacity: 0.45;
    transition: opacity var(--dur-base) var(--ease-out);
  }

  header:hover .controls {
    opacity: 1;
  }

  .controls button {
    width: 44px;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    color: var(--muted-strong);
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .controls button:hover {
    background: var(--surface-2);
    color: var(--text-strong);
  }

  .controls button.close:hover {
    background: var(--danger);
    color: #fff;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .controls svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.1;
    stroke-linecap: square;
  }
</style>
