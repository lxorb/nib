import type { EditorView } from '@nib/editor'
import { modes } from './modes.svelte'
import { theme } from './theme.svelte'
import { workspace } from './workspace.svelte'

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

    { id: 'zoom-in', label: 'Zoom in', hint: 'Ctrl Shift =', run: () => modes.stepZoom(1) },
    { id: 'zoom-out', label: 'Zoom out', hint: 'Ctrl Shift -', run: () => modes.stepZoom(-1) },
    { id: 'zoom-reset', label: 'Actual size', hint: 'Ctrl Shift 0', run: () => modes.resetZoom() },

    {
      id: 'theme',
      label: theme.current === 'dark' ? 'Light theme' : 'Dark theme',
      run: () => theme.toggle(),
    },
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
