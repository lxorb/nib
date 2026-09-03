/** Builds the `latest.json` the Tauri updater polls.
 *
 *  Every bundle the release workflow produced has a `.sig` beside it; the
 *  manifest pairs each platform with its download URL and that signature.
 *
 *    node scripts/update-manifest.mjs v0.2.0 artifacts > latest.json
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO = 'lxorb/nib'

/** Which Tauri platform key a built file belongs to. */
const PLATFORMS = [
  { key: 'windows-x86_64', match: (path) => /windows-x64/.test(path) && path.endsWith('.exe.sig') },
  { key: 'windows-aarch64', match: (path) => /windows-arm64/.test(path) && path.endsWith('.exe.sig') },
  { key: 'linux-x86_64', match: (path) => path.endsWith('.AppImage.sig') },
]

const [, , tag, root] = process.argv
if (!tag || !root) {
  console.error('usage: update-manifest.mjs <tag> <artifacts-dir>')
  process.exit(1)
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

const files = walk(root).map((path) => path.split('\\').join('/'))
const platforms = {}

for (const { key, match } of PLATFORMS) {
  const signature = files.find(match)
  if (!signature) continue

  // The bundle is the signature's name without `.sig`.
  const bundle = signature.slice(0, -'.sig'.length)

  platforms[key] = {
    signature: readFileSync(signature, 'utf8').trim(),
    url: `https://github.com/${REPO}/releases/download/${tag}/${bundle.split('/').pop()}`,
  }
}

if (!Object.keys(platforms).length) {
  console.error('no signed bundles found - is TAURI_SIGNING_PRIVATE_KEY set?')
  process.exit(1)
}

process.stdout.write(
  `${JSON.stringify(
    {
      version: tag.replace(/^v/, ''),
      pub_date: new Date().toISOString(),
      platforms,
    },
    null,
    2,
  )}\n`,
)
