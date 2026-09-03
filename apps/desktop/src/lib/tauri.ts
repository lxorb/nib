/** Nib runs both as a Tauri app and as a plain page during UI work.
 *  Everything platform-specific funnels through here so the UI never branches. */

export const isDesktop = '__TAURI_INTERNALS__' in window

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktop) throw new Error(`${command} is unavailable outside the desktop app`)
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}
