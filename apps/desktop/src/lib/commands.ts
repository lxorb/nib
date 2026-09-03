import type { EditorView } from '@nib/editor'
import { account } from './account.svelte'
import { modes } from './modes.svelte'
import { invoke, isDesktop } from './tauri'
import { theme } from './theme.svelte'
import { workspace } from './workspace.svelte'

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
    {
      id: 'sidebar',
      label: workspace.panel ? 'Hide sidebar' : 'Show sidebar',
      hint: 'Ctrl Shift L',
      run: () => workspace.toggleSidebar(),
    },
    { id: 'outline', label: 'Outline', hint: 'Ctrl Shift 1', run: () => workspace.showPanel('outline') },
    { id: 'articles', label: 'Notes', hint: 'Ctrl Shift 2', run: () => workspace.showPanel('articles') },
    { id: 'files', label: 'Files', hint: 'Ctrl Shift 3', run: () => workspace.showPanel('tree') },
  ]
}
