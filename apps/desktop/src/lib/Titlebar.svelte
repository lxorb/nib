<script lang="ts">
  import { isDesktop, currentWindow } from './tauri'

  let { title = '' }: { title?: string } = $props()

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

<header data-tauri-drag-region>
  {#if title}
    <span class="title">{title}</span>
  {/if}

  <div class="controls">
    <button onclick={minimize} aria-label="Minimize">
      <svg viewBox="0 0 10 10"><path d="M0 5h10" /></svg>
    </button>
    <button onclick={toggleMaximize} aria-label={maximized ? 'Restore' : 'Maximize'}>
      {#if maximized}
        <svg viewBox="0 0 10 10"><path d="M2.5 0.5h7v7M0.5 2.5h7v7h-7z" /></svg>
      {:else}
        <svg viewBox="0 0 10 10"><path d="M0.5 0.5h9v9h-9z" /></svg>
      {/if}
    </button>
    <button class="close" onclick={close} aria-label="Close">
      <svg viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" /></svg>
    </button>
  </div>
</header>

<style>
  header {
    height: var(--titlebar-height);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex: none;
    user-select: none;
  }

  .title {
    font-size: var(--text-sm);
    color: var(--muted);
    letter-spacing: 0.01em;
    pointer-events: none;
    animation: settle var(--dur-slow) var(--ease-out);
  }

  @keyframes settle {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }

  .controls {
    position: absolute;
    right: 0;
    top: 0;
    height: 100%;
    display: flex;
    opacity: 0.45;
    transition: opacity var(--dur-base) var(--ease-out);
  }

  header:hover .controls {
    opacity: 1;
  }

  button {
    width: 44px;
    height: 100%;
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

  button:hover {
    background: var(--surface-2);
    color: var(--text-strong);
  }

  button.close:hover {
    background: var(--danger);
    color: #fff;
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.1;
    stroke-linecap: square;
  }
</style>
