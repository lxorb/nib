/** Nib runs both as a Tauri app and as a plain page during UI work.
 *  Everything platform-specific funnels through here so the UI never branches. */

// Guarded so this module can be imported where there is no window: tests today,
// and server-side rendering once the web app exists.
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktop) {
    if (!import.meta.env.DEV) throw new Error(`${command} needs the desktop app`)
    const { fixtureInvoke } = await import('./dev-fixture')
    return fixtureInvoke<T>(command, args)
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

/** A webview cannot load a bare filesystem path; Tauri hands out a URL for one. */
export function assetUrl(path: string): string {
  if (!isDesktop) return path

  const internals = (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: (p: string) => string } })
    .__TAURI_INTERNALS__

  return internals?.convertFileSrc?.(path) ?? path
}

export function folderOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, '')
}

export function joinPath(dir: string, relative: string): string {
  const separator = dir.includes('\\') ? '\\' : '/'
  return `${dir}${separator}${relative.split('/').join(separator)}`
}
