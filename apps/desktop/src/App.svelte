<script lang="ts">
  import Editor from './lib/Editor.svelte'
  import Titlebar from './lib/Titlebar.svelte'
  import { theme } from './lib/theme.svelte'
  import { invoke, isDesktop } from './lib/tauri'

  const WELCOME = `# Nib

Markdown, and nothing else.

Put your cursor on this line and the **syntax** bleeds back in.

- [ ] open a file with \`Ctrl+O\`
- [ ] save with \`Ctrl+S\`
`

  let path = $state<string | null>(null)
  let doc = $state(WELCOME)
  let dirty = $state(false)

  const title = $derived(
    path ? `${path.split(/[\\/]/).pop()}${dirty ? ' ·' : ''}` : 'Untitled'
  )

  theme.init()

  async function open() {
    const { open: pick } = await import('@tauri-apps/plugin-dialog')
    const picked = await pick({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
    })
    if (typeof picked !== 'string') return
    doc = await invoke<string>('read_note', { path: picked })
    path = picked
    dirty = false
  }

  async function save() {
    if (!path) {
      const { save: pick } = await import('@tauri-apps/plugin-dialog')
      const picked = await pick({ defaultPath: 'untitled.md' })
      if (!picked) return
      path = picked
    }
    await invoke('write_note', { path, content: doc })
    dirty = false
  }

  function onKeydown(event: KeyboardEvent) {
    if (!event.ctrlKey && !event.metaKey) return
    const key = event.key.toLowerCase()

    if (key === 'o' && isDesktop) {
      event.preventDefault()
      open()
    } else if (key === 's' && isDesktop) {
      event.preventDefault()
      save()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<main>
  <Titlebar {title} />
  <Editor
    {doc}
    onchange={(value) => {
      doc = value
      dirty = true
    }}
  />
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg);
    transition: background var(--dur-slow) var(--ease-out);
  }
</style>
