import type { EditorView } from '@nib/editor'
import { account } from './account.svelte'
import { PANDOC_FORMATS } from './export'
import { modes } from './modes.svelte'
import { settings } from './settings.svelte'
import { invoke, isDesktop } from './tauri'
import { theme } from './theme.svelte'
import { workspace } from './workspace.svelte'

/** Opens `custom.css` in the editor itself — it is a text file like any other. */
async function openCustomCss() {
  if (!isDesktop) return

  const path = await invoke<string>('custom_css_path')
  await workspace.open(path)
}

/** Opens `snippets.json`, and reloads it once the file is saved. */
async function openSnippets() {
  if (!isDesktop) return

  const path = await invoke<string>('snippets_path')
  await workspace.open(path)
}

/** Export entries. The pandoc formats only appear when pandoc is installed,
 *  so the list never offers something that cannot work. */
function exportCommands(): Command[] {
  const note = () => workspace.active
  const source = () => note()?.doc ?? ''
  const name = () => note()?.name ?? 'Untitled.md'

  const commands: Command[] = [
    {
      id: 'export-pdf',
      label: 'Export as PDF',
      run: () => import('./export').then((m) => m.exportPdf(source(), name())),
    },
    {
      id: 'export-html',
      label: 'Export as HTML',
      run: () => void import('./export').then((m) => m.exportHtml(source(), name())),
    },
    {
      id: 'export-html-bare',
      label: 'Export as HTML without styles',
      run: () => void import('./export').then((m) => m.exportHtml(source(), name(), { bare: true })),
    },
  ]

  if (!settings.pandoc) return commands

  commands.push({
    id: 'import',
    label: 'Import a document',
    run: () =>
      void import('./export').then(async (m) => {
        const imported = await m.importDocument()
        if (imported) workspace.openBlank(imported.name, imported.markdown)
      }),
  })

  for (const format of PANDOC_FORMATS) {
    commands.push({
      id: `export-${format.id}`,
      label: `Export as ${format.label}`,
      run: () => void import('./export').then((m) => m.exportPandoc(source(), name(), format.id)),
    })
  }

  return commands
}

/** Reveals the folder a `.css` theme should be dropped into. */
async function openThemesFolder() {
  if (!isDesktop) return

  const dir = await invoke<string>('theme_dir')
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(dir)
  await theme.reload()
}

export interface Command {
  id: string
  label: string
  hint?: string
  disabled?: boolean
  run(): void
}

/** Everything the palette can do. Labels read as the action, not the setting. */
export function appCommands(view?: EditorView): Command[] {
  return [
    { id: 'save', label: 'Save', hint: 'Ctrl S', run: () => void workspace.save() },
    { id: 'new', label: 'New note', hint: 'Ctrl N', run: () => workspace.openBlank() },
    {
      id: 'close',
      label: 'Close note',
      hint: 'Ctrl W',
      run: () => workspace.activeTabId && workspace.close(workspace.activeTabId),
    },
    { id: 'space', label: 'Add a space', run: () => void workspace.addSpace() },
    {
      id: 'autosave',
      label: workspace.autoSave ? 'Turn off auto-save' : 'Turn on auto-save',
      run: () => workspace.setAutoSave(!workspace.autoSave),
    },
    { id: 'settings', label: 'Settings', hint: 'Ctrl ,', run: () => settings.show() },
    {
      id: 'history',
      label: 'Version history',
      disabled: !workspace.active?.path,
      run: () => (settings.historyOpen = true),
    },

    ...workspace.recent
      .filter((path) => !workspace.tabs.some((tab) => tab.path === path))
      .slice(0, 8)
      .map((path) => ({
        id: `recent:${path}`,
        label: `Recent: ${path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path}`,
        run: () => void workspace.open(path),
      })),

    ...exportCommands(),
    { id: 'publish', label: 'Publish this space as a blog', run: () => settings.show('publish') },
    { id: 'llm', label: 'Connect an LLM to this space', run: () => settings.show('llm') },

    account.signedIn
      ? { id: 'signout', label: `Sign out ${account.user?.email ?? ''}`.trim(), run: () => void account.signOut() }
      : { id: 'signin', label: 'Sign in', run: () => (account.open = true) },

    {
      id: 'source',
      label: modes.source ? 'Leave source mode' : 'Source mode',
      hint: 'Ctrl /',
      run: () => modes.toggleSource(view),
    },
    {
      id: 'focus',
      label: modes.focus ? 'Leave focus mode' : 'Focus mode',
      hint: 'F8',
      run: () => modes.toggleFocus(view),
    },
    {
      id: 'typewriter',
      label: modes.typewriter ? 'Leave typewriter mode' : 'Typewriter mode',
      hint: 'F9',
      run: () => modes.toggleTypewriter(view),
    },

    {
      id: 'punctuation',
      label: modes.punctuation ? 'Use straight quotes' : 'Use curly quotes',
      run: () => modes.togglePunctuation(view),
    },
    {
      id: 'numbers',
      label: modes.numbers ? 'Stop numbering headings' : 'Number headings',
      run: () => modes.toggleNumbers(view),
    },

    {
      id: 'line-numbers',
      label: modes.lineNumbers ? 'Hide code line numbers' : 'Show code line numbers',
      run: () => modes.toggleLineNumbers(view),
    },
    {
      id: 'rtl',
      label: modes.rtl ? 'Write left to right' : 'Write right to left',
      run: () => modes.toggleRightToLeft(view),
    },
    {
      id: 'strict',
      label: modes.strict ? 'Allow extended markdown' : 'Strict CommonMark only',
      run: () => modes.toggleStrict(view),
    },
    {
      id: 'equation-numbers',
      label: modes.equationNumbers ? 'Stop numbering equations' : 'Number equations',
      run: () => modes.toggleEquationNumbers(view),
    },
    { id: 'wider', label: 'Wider writing area', run: () => modes.stepWidth(1, view) },
    { id: 'narrower', label: 'Narrower writing area', run: () => modes.stepWidth(-1, view) },
    { id: 'looser', label: 'Looser line spacing', run: () => modes.stepLineHeight(1, view) },
    { id: 'tighter', label: 'Tighter line spacing', run: () => modes.stepLineHeight(-1, view) },

    { id: 'zoom-in', label: 'Zoom in', hint: 'Ctrl Shift =', run: () => modes.stepZoom(1) },
    { id: 'zoom-out', label: 'Zoom out', hint: 'Ctrl Shift -', run: () => modes.stepZoom(-1) },
    { id: 'zoom-reset', label: 'Actual size', hint: 'Ctrl Shift 0', run: () => modes.resetZoom() },

    ...theme.all.map((item) => ({
      id: `theme:${item.id}`,
      label: `Theme: ${item.name}`,
      hint: item.id === theme.id ? 'current' : undefined,
      run: () => theme.select(item.id),
    })),
    { id: 'themes-folder', label: 'Open themes folder', run: () => void openThemesFolder() },
    { id: 'custom-css', label: 'Edit custom CSS', run: () => void openCustomCss() },
    { id: 'snippets', label: 'Edit snippets', run: () => void openSnippets() },
    {
      id: 'sidebar',
      label: workspace.panel ? 'Hide sidebar' : 'Show sidebar',
      hint: 'Ctrl Shift L',
      run: () => workspace.toggleSidebar(),
    },
    { id: 'outline', label: 'Outline', hint: 'Ctrl Shift 1', run: () => workspace.showPanel('outline') },
    { id: 'articles', label: 'Notes', hint: 'Ctrl Shift 2', run: () => workspace.showPanel('articles') },
    { id: 'files', label: 'Files', hint: 'Ctrl Shift 3', run: () => workspace.showPanel('tree') },
    {
      id: 'search-space',
      label: 'Search this space',
      hint: 'Ctrl Shift F',
      run: () => workspace.showPanel('search'),
    },
  ]
}
