import { isDesktop } from './tauri'

/** A downloaded update, waiting to be put in place on the way out. */
let staged: { install(): Promise<void> } | null = null

export const ready = () => staged !== null

/** Fetches a new version in the background if there is one.
 *
 *  Only downloads: installing here would restart the app under whoever is
 *  typing. The installer runs on quit instead, so the new version is simply
 *  what starts next time. */
export async function stageUpdate(): Promise<string | null> {
  if (!isDesktop || staged) return null

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) return null

    await update.download()
    staged = update
    return update.version
  } catch {
    // No network, no release yet, or a signature that did not verify. Any of
    // those simply means carrying on with the version already installed.
    return null
  }
}

/** Runs the staged installer. Called as the app closes, so nothing is
 *  interrupted; the update is in place for the next launch. */
export async function installStaged() {
  if (!staged) return

  try {
    await staged.install()
  } catch {
    // A failed install leaves the working version alone, which is the right
    // outcome — it will be offered again next time.
  } finally {
    staged = null
  }
}
