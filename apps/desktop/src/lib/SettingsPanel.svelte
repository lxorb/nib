<script lang="ts">
  import { fade, fly, scale, slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { CODE_PALETTES, type EditorView } from '@nib/editor'
  import { account } from './account.svelte'
  import { i18n, LANGUAGES, t } from './i18n.svelte'
  import { modes } from './modes.svelte'
  import { ORIENTATIONS, PAPER_SIZES } from './page-setup'
  import { settings, type Section } from './settings.svelte'
  import { sync } from './sync.svelte'
  import { theme } from './theme.svelte'
  import { workspace } from './workspace.svelte'

  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'account', label: t('Account') },
    { id: 'publish', label: t('Publish') },
    { id: 'llm', label: t('LLM access') },
    { id: 'appearance', label: t('Appearance') },
    { id: 'export', label: t('Export') },
  ]

  let { view }: { view?: EditorView } = $props()

  let subdomain = $state('')
  let domain = $state('')
  let confirmPublic = $state(false)
  let copied = $state(false)
  let checkTimer: ReturnType<typeof setTimeout>

  const blog = $derived(settings.remote?.blog)
  const published = $derived(!!blog?.enabled)

  $effect(() => {
    if (!settings.open) return
    subdomain = blog?.subdomain ?? ''
    domain = blog?.domain ?? ''
    confirmPublic = published
  })

  function onSubdomain(value: string) {
    subdomain = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    clearTimeout(checkTimer)
    checkTimer = setTimeout(() => settings.checkSubdomain(subdomain), 260)
  }

  async function copySnippet() {
    if (!settings.mcp) return
    await navigator.clipboard.writeText(settings.mcp.snippet)
    copied = true
    setTimeout(() => (copied = false), 1600)
  }
</script>

{#if settings.open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="scrim" transition:fade={{ duration: 140 }} onclick={() => (settings.open = false)}></div>

  <div class="sheet" transition:scale={{ duration: 200, start: 0.97, easing: cubicOut }}>
    <nav>
      {#each SECTIONS as item (item.id)}
        <button class:active={settings.section === item.id} onclick={() => (settings.section = item.id)}>
          {item.label}
        </button>
      {/each}
    </nav>

    <div class="body">
      {#if settings.section === 'account'}
        <div class="pane" in:fly={{ y: 8, duration: 180, easing: cubicOut }}>
          {#if account.signedIn}
            <p class="lead">{account.user?.email}</p>

            {#if workspace.activeSpace}
              {#if settings.remote}
                <p class="note">
                  <strong>{workspace.activeSpace.name}</strong>
                  {t('syncs to your account.')}
                  {#if sync.lastSyncedAt}
                    {t('Last synced {time}.', {
                      time: new Date(sync.lastSyncedAt).toLocaleTimeString(),
                    })}
                  {/if}
                </p>
              {:else}
                <button class="primary" disabled={settings.busy} onclick={() => settings.startSyncing()}>
                  {t('Sync {name}', { name: workspace.activeSpace.name })}
                </button>
              {/if}
            {:else}
              <p class="note">{t('Open a folder to sync it.')}</p>
            {/if}

            <button class="quiet" onclick={() => account.signOut()}>{t('Sign out')}</button>
          {:else}
            <p class="lead">{t('Not signed in')}</p>
            <button class="primary" onclick={() => { settings.open = false; account.open = true }}>
              {t('Sign in')}
            </button>
          {/if}
        </div>
      {:else if settings.section === 'publish'}
        <div class="pane" in:fly={{ y: 8, duration: 180, easing: cubicOut }}>
          {#if !settings.remote}
            <p class="note">{t('Sync this space first, from Account.')}</p>
          {:else}
            <!-- The consequence comes before the switch, not after it. -->
            <label class="danger-check">
              <input type="checkbox" bind:checked={confirmPublic} disabled={published} />
              <span>
                <strong>{t('Everything in this space becomes public.')}</strong>
                {t('Every note, including drafts, is readable by anyone with the address.')}
              </span>
            </label>

            <fieldset disabled={!confirmPublic}>
              <label class="field">
                <span class="label">{t('Address')}</span>
                <div class="row">
                  <input
                    value={subdomain}
                    oninput={(event) => onSubdomain(event.currentTarget.value)}
                    placeholder="your-name"
                    spellcheck="false"
                  />
                  <span class="suffix">.icinoxis.net</span>
                </div>
                {#if settings.availability.checking}
                  <span class="hint">{t('checking…')}</span>
                {:else if settings.availability.available === true}
                  <span class="hint ok">{t('available')}</span>
                {:else if settings.availability.available === false}
                  <span class="hint bad">{settings.availability.reason}</span>
                {/if}
              </label>

              <details>
                <summary>{t('Use a domain you own')}</summary>
                <div class="field" transition:slide={{ duration: 180 }}>
                  <input bind:value={domain} placeholder="notes.example.com" spellcheck="false" />
                  {#if settings.dns.length}
                    <table class="dns">
                      <thead>
                        <tr><th>{t('Type')}</th><th>{t('Name')}</th><th>{t('Value')}</th></tr>
                      </thead>
                      <tbody>
                        {#each settings.dns as record (record.name + record.type)}
                          <tr>
                            <td>{record.type}</td>
                            <td>{record.name}</td>
                            <td>{record.value}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    <span class="hint">{t('Add this at your registrar, then reload the page.')}</span>
                  {/if}
                </div>
              </details>

              <button
                class="primary"
                disabled={settings.busy || !subdomain}
                onclick={() => settings.publish({ subdomain, domain: domain || undefined })}
              >
                {published ? t('Update') : t('Publish')}
              </button>
            </fieldset>

            {#if published}
              <p class="note" transition:slide={{ duration: 180 }}>
                {t('Live at')}
                <a href="https://{blog?.subdomain}.icinoxis.net" target="_blank" rel="noreferrer">
                  {blog?.subdomain}.icinoxis.net
                </a>
              </p>
              <button class="quiet danger" onclick={() => settings.unpublish()}>{t('Stop publishing')}</button>
            {/if}
          {/if}
        </div>
      {:else if settings.section === 'llm'}
        <div class="pane" in:fly={{ y: 8, duration: 180, easing: cubicOut }}>
          <label class="switch">
            <input
              type="checkbox"
              checked={settings.llmEnabled}
              onchange={(event) => settings.setLlm(event.currentTarget.checked, settings.llmReadOnly)}
            />
            <span>{t('Let an LLM read this space')}</span>
          </label>

          <label class="switch">
            <input
              type="checkbox"
              checked={!settings.llmReadOnly}
              disabled={!settings.llmEnabled}
              onchange={(event) => settings.setLlm(settings.llmEnabled, !event.currentTarget.checked)}
            />
            <span>{t('…and write to it')}</span>
          </label>

          {#if settings.llmEnabled}
            <div transition:slide={{ duration: 200 }}>
              {#if settings.mcp?.installed === false}
                <p class="hint bad">{t('The connector is not built yet — run the desktop build once.')}</p>
              {/if}

              <p class="note">{t("Paste this into your LLM client's MCP settings.")}</p>
              <pre>{settings.mcp?.snippet ?? '…'}</pre>
              <button class="primary" onclick={copySnippet}>{copied ? t('Copied') : t('Copy')}</button>
            </div>
          {/if}
        </div>
      {:else if settings.section === 'export'}
        <div class="pane" in:fly={{ y: 8, duration: 180, easing: cubicOut }}>
          <div class="row">
            <label class="field">
              <span class="label">{t('Paper')}</span>
              <select
                value={settings.page.paper}
                onchange={(event) => settings.setPage({ paper: event.currentTarget.value as never })}
              >
                {#each PAPER_SIZES as size (size)}
                  <option value={size}>{size}</option>
                {/each}
              </select>
            </label>

            <label class="field">
              <span class="label">{t('Orientation')}</span>
              <select
                value={settings.page.orientation}
                onchange={(event) =>
                  settings.setPage({ orientation: event.currentTarget.value as never })}
              >
                {#each ORIENTATIONS as option (option)}
                  <option value={option}>{t(option)}</option>
                {/each}
              </select>
            </label>

            <label class="field">
              <span class="label">{t('Margin')}</span>
              <input
                value={settings.page.margin}
                oninput={(event) => settings.setPage({ margin: event.currentTarget.value })}
                spellcheck="false"
              />
            </label>
          </div>

          <label class="field">
            <span class="label">{t('Header')}</span>
            <input
              value={settings.page.header}
              oninput={(event) => settings.setPage({ header: event.currentTarget.value })}
              placeholder={'${title}'}
              spellcheck="false"
            />
          </label>

          <label class="field">
            <span class="label">{t('Footer')}</span>
            <input
              value={settings.page.footer}
              oninput={(event) => settings.setPage({ footer: event.currentTarget.value })}
              placeholder={'${date}'}
              spellcheck="false"
            />
          </label>

          <p class="hint">
            <code>{'${title}'}</code>, <code>{'${date}'}</code> and <code>{'${year}'}</code> are filled
            in. Page numbers come from the print dialog. A note can override all of this from its front
            matter under <code>export:</code>.
          </p>
        </div>
      {:else}
        <div class="pane" in:fly={{ y: 8, duration: 180, easing: cubicOut }}>
          <div class="themes">
            {#each theme.all as item (item.id)}
              <button
                class="theme"
                class:active={theme.id === item.id}
                data-scheme={item.scheme}
                onclick={() => theme.select(item.id)}
              >
                {item.name}
              </button>
            {/each}
          </div>
          <label class="field">
            <span class="label">{t('Language')}</span>
            <select value={i18n.choice} onchange={(event) => i18n.select(event.currentTarget.value)}>
              {#each LANGUAGES as language (language.id)}
                <option value={language.id}>{t(language.name)}</option>
              {/each}
            </select>
          </label>

          <label class="field">
            <span class="label">{t('Code')}</span>
            <select
              value={modes.codeTheme}
              onchange={(event) => modes.setCodeTheme(event.currentTarget.value, view)}
            >
              {#each CODE_PALETTES as palette (palette.id)}
                <option value={palette.id}>{palette.name}</option>
              {/each}
            </select>
          </label>

          <button class="quiet" onclick={() => theme.reload()}>{t('Reload themes and custom CSS')}</button>
        </div>
      {/if}

      {#if settings.error}
        <p class="hint bad" transition:slide={{ duration: 160 }}>{settings.error}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--bg) 62%, transparent);
    backdrop-filter: blur(3px);
    z-index: 40;
  }

  .sheet {
    position: fixed;
    top: 12vh;
    left: 50%;
    translate: -50% 0;
    width: min(38rem, calc(100vw - 3rem));
    max-height: 74vh;
    z-index: 41;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  nav {
    display: flex;
    gap: 2px;
    padding: var(--space-2);
    border-bottom: 1px solid var(--line);
  }

  nav button {
    padding: 6px 11px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  nav button:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  nav button.active {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .body {
    padding: var(--space-5);
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .lead {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-strong);
    font-weight: 550;
  }

  .note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--muted-strong);
    line-height: 1.6;
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .hint.ok {
    color: var(--success);
  }

  .hint.bad {
    color: var(--danger);
  }

  button.primary,
  button.quiet {
    padding: 9px 14px;
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 550;
    cursor: default;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-spring);
  }

  button.primary {
    background: var(--accent);
    color: #fff;
  }

  button.primary:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  button.quiet {
    background: none;
    color: var(--muted);
    padding-left: 0;
  }

  button.quiet:hover {
    color: var(--text);
  }

  button.quiet.danger:hover {
    color: var(--danger);
  }

  button:disabled {
    opacity: 0.5;
  }

  /* The warning reads as a warning, and gates the controls behind it. */
  .danger-check {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--line));
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--danger) 7%, transparent);
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--muted-strong);
  }

  .danger-check strong {
    display: block;
    color: var(--text-strong);
  }

  .danger-check input,
  .switch input {
    flex: none;
    margin-top: 3px;
    accent-color: var(--accent);
  }

  .switch {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    font-size: var(--text-sm);
    color: var(--text);
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    transition: opacity var(--dur-base) var(--ease-out);
  }

  fieldset:disabled {
    opacity: 0.4;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
  }

  .label {
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .field select {
    padding: 9px 11px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text-strong);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    outline: none;
  }

  .row input,
  .field input {
    flex: 1;
    padding: 9px 11px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text-strong);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    outline: none;
    transition: border-color var(--dur-fast) var(--ease-out);
  }

  .field input:focus,
  .row input:focus {
    border-color: var(--accent);
  }

  .suffix {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--muted);
  }

  details summary {
    font-size: var(--text-sm);
    color: var(--muted);
    cursor: default;
  }

  details summary:hover {
    color: var(--accent);
  }

  details .field {
    margin-top: var(--space-3);
  }

  .dns {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .dns th,
  .dns td {
    border: 1px solid var(--line);
    padding: 5px 7px;
    text-align: left;
  }

  .dns th {
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 500;
  }

  pre {
    width: 100%;
    margin: var(--space-2) 0;
    padding: var(--space-3);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.6;
    overflow-x: auto;
    color: var(--muted-strong);
  }

  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-2);
    width: 100%;
  }

  .theme {
    padding: var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    text-align: left;
    cursor: default;
    transition:
      border-color var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-spring);
  }

  .theme:hover {
    transform: translateY(-1px);
  }

  .theme.active {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
