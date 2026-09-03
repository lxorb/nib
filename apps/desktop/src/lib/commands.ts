import { CODE_PALETTES, type EditorView, reformatDocument, type Transaction } from '@nib/editor'
import { account } from './account.svelte'
import { t } from './i18n.svelte'
import { PANDOC_FORMATS } from './export'
import { imagePath, imageUrl } from './images'
import { newSpace } from './space-actions'
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

  /** PDF wants URLs the print frame can fetch; HTML wants paths it can read. */
  const forPrint = () => ({
    page: settings.page,
    resolveImage: (src: string) => imageUrl(src, note()?.path, source()),
  })

  const forFile = () => ({
    page: settings.page,
    resolveImage: (src: string) => imagePath(src, note()?.path, source()) ?? src,
  })

  const commands: Command[] = [
    {
      id: 'export-pdf',
      label: t('Export as PDF'),
      run: () => import('./export').then((m) => m.exportPdf(source(), name(), forPrint())),
    },
    {
      id: 'export-html',
      label: t('Export as HTML'),
      run: () => void import('./export').then((m) => m.exportHtml(source(), name(), forFile())),
    },
    { id: 'page-setup', label: t('Page setup for export'), run: () => settings.show('export') },
    {
      id: 'export-html-bare',
      label: t('Export as HTML without styles'),
      run: () => void import('./export').then((m) => m.exportHtml(source(), name(), { bare: true })),
    },
  ]

  if (!settings.pandoc) return commands

  commands.push({
    id: 'import',
    label: t('Import a document'),
    run: () =>
      void import('./export').then(async (m) => {
        const imported = await m.importDocument()
        if (imported) workspace.openBlank(imported.name, imported.markdown)
      }),
  })

  for (const format of PANDOC_FORMATS) {
    commands.push({
      id: `export-${format.id}`,
      label: t('Export as {format}', { format: format.label }),
      run: () => void import('./export').then((m) => m.exportPandoc(source(), name(), format.id)),
    })
  }

  return commands
}

/** Shows the log file in the file manager, for when something has gone wrong. */
async function openLog() {
  if (!isDesktop) return

  const path = await invoke<string>('log_dir')
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(path)
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
    { id: 'save', label: t('Save'), hint: 'Ctrl S', run: () => void workspace.save() },
    { id: 'new', label: t('New note'), hint: 'Ctrl N', run: () => workspace.openBlank() },
    {
      id: 'close',
      label: t('Close note'),
      hint: 'Ctrl W',
      run: () => workspace.activeTabId && workspace.close(workspace.activeTabId),
    },
    { id: 'space', label: t('New space'), run: () => void newSpace() },
    {
      id: 'new-window',
      label: t('New window'),
      disabled: !isDesktop,
      run: () => void invoke('new_window').catch(() => undefined),
    },
    {
      id: 'undo-file',
      label: workspace.undoLabel ?? t('Undo the last file change'),
      disabled: !workspace.undoLabel,
      run: () => void workspace.undoFileAction(),
    },
    {
      id: 'autosave',
      label: workspace.autoSave ? t('Turn off auto-save') : t('Turn on auto-save'),
      run: () => workspace.setAutoSave(!workspace.autoSave),
    },
    { id: 'settings', label: t('Settings'), hint: 'Ctrl ,', run: () => settings.show() },
    {
      id: 'history',
      label: t('Version history'),
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
    { id: 'publish', label: t('Publish this space as a blog'), run: () => settings.show('publish') },
    { id: 'llm', label: t('Connect an LLM to this space'), run: () => settings.show('llm') },

    account.signedIn
      ? {
          id: 'signout',
          label: `${t('Sign out')} ${account.user?.email ?? ''}`.trim(),
          run: () => void account.signOut(),
        }
      : { id: 'signin', label: t('Sign in'), run: () => (account.open = true) },

    {
      id: 'reformat',
      label: t('Tidy up this note'),
      disabled: !view,
      run: () =>
        view &&
        reformatDocument({
          state: view.state,
          dispatch: (transaction: Transaction) => view.dispatch(transaction),
        }),
    },

    {
      id: 'source',
      label: modes.source ? t('Leave source mode') : t('Source mode'),
      hint: 'Ctrl /',
      run: () => modes.toggleSource(view),
    },
    {
      id: 'focus',
      label: modes.focus ? t('Leave focus mode') : t('Focus mode'),
      hint: 'F8',
      run: () => modes.toggleFocus(view),
    },
    {
      id: 'typewriter',
      label: modes.typewriter ? t('Leave typewriter mode') : t('Typewriter mode'),
      hint: 'F9',
      run: () => modes.toggleTypewriter(view),
    },

    {
      id: 'punctuation',
      label: modes.punctuation ? t('Use straight quotes') : t('Use curly quotes'),
      run: () => modes.togglePunctuation(view),
    },
    {
      id: 'numbers',
      label: modes.numbers ? t('Stop numbering headings') : t('Number headings'),
      run: () => modes.toggleNumbers(view),
    },

    {
      id: 'line-numbers',
      label: modes.lineNumbers ? t('Hide code line numbers') : t('Show code line numbers'),
      run: () => modes.toggleLineNumbers(view),
    },
    {
      id: 'rtl',
      label: modes.rtl ? t('Write left to right') : t('Write right to left'),
      run: () => modes.toggleRightToLeft(view),
    },
    {
      id: 'strict',
      label: modes.strict ? t('Allow extended markdown') : t('Strict CommonMark only'),
      run: () => modes.toggleStrict(view),
    },
    {
      id: 'equation-numbers',
      label: modes.equationNumbers ? t('Stop numbering equations') : t('Number equations'),
      run: () => modes.toggleEquationNumbers(view),
    },
    { id: 'wider', label: t('Wider writing area'), run: () => modes.stepWidth(1, view) },
    { id: 'narrower', label: t('Narrower writing area'), run: () => modes.stepWidth(-1, view) },
    { id: 'looser', label: t('Looser line spacing'), run: () => modes.stepLineHeight(1, view) },
    { id: 'tighter', label: t('Tighter line spacing'), run: () => modes.stepLineHeight(-1, view) },

    { id: 'zoom-in', label: t('Zoom in'), hint: 'Ctrl Shift =', run: () => modes.stepZoom(1) },
    { id: 'zoom-out', label: t('Zoom out'), hint: 'Ctrl Shift -', run: () => modes.stepZoom(-1) },
    { id: 'zoom-reset', label: t('Actual size'), hint: 'Ctrl Shift 0', run: () => modes.resetZoom() },

    ...theme.all.map((item) => ({
      id: `theme:${item.id}`,
      label: `Theme: ${item.name}`,
      hint: item.id === theme.id ? 'current' : undefined,
      run: () => theme.select(item.id),
    })),
    ...CODE_PALETTES.map((palette) => ({
      id: `code-theme:${palette.id}`,
      label: `Code theme: ${palette.name}`,
      hint: palette.id === modes.codeTheme ? 'current' : undefined,
      run: () => modes.setCodeTheme(palette.id, view),
    })),
    { id: 'themes-folder', label: t('Open themes folder'), run: () => void openThemesFolder() },
    { id: 'custom-css', label: t('Edit custom CSS'), run: () => void openCustomCss() },
    { id: 'snippets', label: t('Edit snippets'), run: () => void openSnippets() },
    { id: 'logs', label: t('Open the log file'), run: () => void openLog() },
    {
      id: 'update',
      label: settings.update
        ? t('Version {version} is out', { version: settings.update.version })
        : t('Check for updates'),
      run: () => void settings.checkForUpdate({ announce: true }),
    },
    {
      id: 'sidebar',
      label: workspace.panel ? t('Hide sidebar') : t('Show sidebar'),
      hint: 'Ctrl Shift L',
      run: () => workspace.toggleSidebar(),
    },
    { id: 'outline', label: t('Outline'), hint: 'Ctrl Shift 1', run: () => workspace.showPanel('outline') },
    { id: 'articles', label: t('Notes'), hint: 'Ctrl Shift 2', run: () => workspace.showPanel('articles') },
    { id: 'files', label: t('Files'), hint: 'Ctrl Shift 3', run: () => workspace.showPanel('tree') },
    {
      id: 'search-space',
      label: t('Search this space'),
      hint: 'Ctrl Shift F',
      run: () => workspace.showPanel('search'),
    },
  ]
}
