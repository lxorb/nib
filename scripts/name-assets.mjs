/** Renames built bundles to something a person can read before downloading.
 *
 *  Tauri names them after build triples and packaging conventions, so the same
 *  release carries `Nib_0.1.0_x64-setup.exe`, `Nib_0.1.0_amd64.AppImage` and
 *  `Nib-0.1.0-1.x86_64.rpm` - three spellings of the architecture and no word
 *  saying which operating system any of them is for.
 *
 *    node scripts/name-assets.mjs artifacts v0.1.0
 *
 *  Each artifact directory is named `nib-<platform>-<arch>` by the build
 *  matrix, which is exactly the label the file should carry. Signatures are
 *  renamed with the bundle they belong to, so the update manifest still pairs
 *  them up afterwards.
 */

import { readdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Longest first: `.app.tar.gz` has to win over `.gz`. */
const KINDS = [
  { ext: '.app.tar.gz', name: (label) => `${label}.app.tar.gz` },
  { ext: '-setup.exe', name: (label) => `${label}-setup.exe` },
  { ext: '.AppImage', name: (label) => `${label}.AppImage` },
  { ext: '.msi', name: (label) => `${label}.msi` },
  { ext: '.dmg', name: (label) => `${label}.dmg` },
  { ext: '.deb', name: (label) => `${label}.deb` },
  { ext: '.rpm', name: (label) => `${label}.rpm` },
]

const [, , root, tag] = process.argv
if (!root || !tag) {
  console.error('usage: name-assets.mjs <artifacts-dir> <tag>')
  process.exit(1)
}

// The tag carries a `v`; the filenames should not say `Nib-v0.1.0`.
const version = tag.replace(/^v/, '')

/** `nib-windows-x64` is the artifact directory the matrix produced. */
function labelOf(dir) {
  return dir.replace(/^nib-/, '')
}

for (const dir of readdirSync(root)) {
  const full = join(root, dir)
  if (!statSync(full).isDirectory()) continue

  const label = `Nib-${version}-${labelOf(dir)}`

  for (const file of readdirSync(full)) {
    // A signature follows whatever it signs, and is renamed with it.
    const bare = file.endsWith('.sig') ? file.slice(0, -'.sig'.length) : file
    const kind = KINDS.find((one) => bare.endsWith(one.ext))
    if (!kind) continue

    const renamed = kind.name(label) + (file === bare ? '' : '.sig')
    if (renamed === file) continue

    renameSync(join(full, file), join(full, renamed))
    console.error(`${file} -> ${renamed}`)
  }
}
