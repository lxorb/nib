import { isDesktop } from './tauri'

/** What is running. Tauri is the one that knows, since it owns the version in
 *  `tauri.conf.json`; before it answers, assume the oldest possible build so a
 *  failed lookup never claims to be newer than a real release. */
export async function currentVersion(): Promise<string> {
  if (!isDesktop) return '0.0.0'

  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion().catch(() => '0.0.0')
}

const RELEASES = 'https://api.github.com/repos/lxorb/nib/releases/latest'
const CHECKED_KEY = 'nib:update-checked'
const DAY = 24 * 60 * 60 * 1000

export interface Release {
  version: string
  url: string
}

/** Compares two `1.2.3` versions. Positive when `a` is the newer one. */
export function compareVersions(a: string, b: string): number {
  const parts = (value: string) =>
    value
      .replace(/^v/, '')
      .split(/[.\-+]/)
      .map((piece) => (/^\d+$/.test(piece) ? Number(piece) : piece))

  const left = parts(a)
  const right = parts(b)

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const one = left[i]
    const other = right[i]

    // A release outranks a pre-release of the same numbers: 1.0.0 beats 1.0.0-rc.
    if (one === undefined) return typeof other === 'string' ? 1 : -1
    if (other === undefined) return typeof one === 'string' ? -1 : 1
    if (one === other) continue

    if (typeof one === 'number' && typeof other === 'number') return one > other ? 1 : -1
    return String(one) > String(other) ? 1 : -1
  }

  return 0
}

/** The newest published release, or null when the check cannot be made. */
export async function latestRelease(): Promise<Release | null> {
  try {
    const response = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return null

    const body = (await response.json()) as { tag_name?: string; html_url?: string }
    if (!body.tag_name || !body.html_url) return null

    return { version: body.tag_name.replace(/^v/, ''), url: body.html_url }
  } catch {
    return null
  }
}

/** A release newer than what is running, or null. */
export async function updateAvailable(current: string): Promise<Release | null> {
  const release = await latestRelease()
  return release && compareVersions(release.version, current) > 0 ? release : null
}

/** True once a day at most, so starting the app is never a network round trip
 *  the reader is waiting on. */
export function dueForCheck(now: number): boolean {
  const last = Number(localStorage.getItem(CHECKED_KEY) ?? 0)
  return !Number.isFinite(last) || now - last > DAY
}

export function markChecked(now: number) {
  localStorage.setItem(CHECKED_KEY, String(now))
}

/** Opens the release page. Installing is the reader's decision, not ours. */
export async function openRelease(release: Release) {
  if (!isDesktop) return
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(release.url)
}
