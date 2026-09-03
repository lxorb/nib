import { DIAGRAM_LANGUAGES, diagramSvg } from '@nib/editor'
import { documentTitle, renderMarkdown } from '@nib/markdown'
import { katexCss, themeCss } from '@nib/themes/raw'
import { DEFAULT_PAGE_SETUP, type PageSetup, pageCss, pageSetupFor, runningMarkup } from './page-setup'
import { invoke, isDesktop } from './tauri'
import { theme } from './theme.svelte'

/** Formats pandoc can produce, in the order Typora lists them. */
export const PANDOC_FORMATS = [
  { id: 'docx', label: 'Word', extension: 'docx' },
  { id: 'odt', label: 'OpenOffice', extension: 'odt' },
  { id: 'rtf', label: 'RTF', extension: 'rtf' },
  { id: 'epub', label: 'ePub', extension: 'epub' },
  { id: 'latex', label: 'LaTeX', extension: 'tex' },
  { id: 'mediawiki', label: 'MediaWiki', extension: 'wiki' },
  { id: 'rst', label: 'reStructuredText', extension: 'rst' },
  { id: 'textile', label: 'Textile', extension: 'textile' },
  { id: 'opml', label: 'OPML', extension: 'opml' },
  { id: 'revealjs', label: 'Presentation', extension: 'html' },
] as const

export type PandocFormat = (typeof PANDOC_FORMATS)[number]['id']

function escape(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!,
  )
}

export interface HtmlOptions {
  /** Leave the stylesheet out, for pasting into a site that has its own. */
  bare?: boolean
  /** Turns a path written in the note into one the filesystem understands. */
  resolveImage?: (src: string) => string
  /** Which theme to bake in. Defaults to the one on screen. */
  theme?: string
  /** Paper and running text. The note's own front matter wins over this. */
  page?: PageSetup
  /** The date the running text prints. Passed in so a build is reproducible. */
  date?: string
}

/** A standalone page: the note, the active theme, and nothing else. */
export function buildHtml(source: string, name: string, options: HtmlOptions = {}): string {
  const title = documentTitle(source) ?? name.replace(/\.[^.]+$/, '')
  const body = renderMarkdown(source, { footnotes: true })

  if (options.bare) {
    return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${escape(title)}</title>\n</head>\n<body>\n${body}</body>\n</html>\n`
  }

  const scheme = options.theme ?? (theme.active.path ? theme.active.scheme : theme.id)
  const setup = pageSetupFor(source, options.page ?? DEFAULT_PAGE_SETUP)
  const date = options.date ?? new Date().toISOString().slice(0, 10)

  return `<!doctype html>
<html lang="en" data-theme="${scheme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<style>
${katexCss}
${themeCss}
/* Exported pages have no editor around them, so the writing surface is the page. */
body { margin: 0; overflow: auto; }
#write { padding: 3rem 1.5rem 6rem; }
${pageCss(setup, title, date)}
@media print {
  html, body { background: #fff; color: #000; }
  #write { max-width: none; padding: 0; }
  a { color: inherit; }
  /* Chromium repeats a fixed element on every sheet, which is the running text. */
  .nib-running-header, .nib-running-footer {
    position: fixed;
    left: 0;
    right: 0;
    font-size: 9pt;
    color: #666;
    text-align: center;
  }
  .nib-running-header { top: 0; }
  .nib-running-footer { bottom: 0; }
}
.nib-running-header, .nib-running-footer { display: none; }
@media print { .nib-running-header, .nib-running-footer { display: block; } }
</style>
</head>
<body>
${runningMarkup(setup)}
<div id="write">
${body}</div>
</body>
</html>
`
}

const FENCE = /<pre><code class="language-([a-z]+)">([\s\S]*?)<\/code><\/pre>/g

/** Undoes the escaping marked applies inside a code fence. */
export function unescape(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** The diagram fences in a page, in the order they appear. */
export function diagramFences(html: string): { language: string; code: string }[] {
  return [...html.matchAll(FENCE)]
    .filter((match) => DIAGRAM_LANGUAGES.has(match[1]))
    .map((match) => ({ language: match[1], code: unescape(match[2]) }))
}

/** Draws every diagram fence, so an exported page shows pictures rather than
 *  the source that would have made them. A fence that will not draw is left as
 *  code, which is more useful than an empty space. */
export async function renderDiagrams(html: string): Promise<string> {
  const fences = diagramFences(html)
  if (!fences.length) return html

  const drawn = await Promise.all(
    fences.map((fence) =>
      diagramSvg(fence.code, fence.language).catch(() => null),
    ),
  )

  let index = 0

  return html.replace(FENCE, (whole, language: string) => {
    if (!DIAGRAM_LANGUAGES.has(language)) return whole

    const svg = drawn[index++]
    return svg ? `<figure class="nib-diagram" data-language="${language}">${svg}</figure>` : whole
  })
}

/** Every `src` in the page that points at a file rather than at the network. */
export function localSources(html: string): string[] {
  const found = new Set<string>()

  for (const match of html.matchAll(/<img\b[^>]*?\bsrc="([^"]*)"/g)) {
    const src = match[1]
    if (src && !/^(data:|https?:|\/\/)/i.test(src)) found.add(src)
  }

  return [...found]
}

/** Swaps local image paths for `data:` URIs so the exported file stands alone.
 *  An image that cannot be read is left pointing where it did. */
export async function inlineImages(
  html: string,
  resolve: (src: string) => string,
): Promise<string> {
  const sources = localSources(html)
  if (!sources.length) return html

  const inlined = new Map<string, string>()

  await Promise.all(
    sources.map(async (src) => {
      const data = await invoke<string>('read_asset', { path: resolve(src) }).catch(() => null)
      if (data) inlined.set(src, data)
    }),
  )

  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]*)(")/g, (whole, before, src, after) => {
    const data = inlined.get(src)
    return data ? `${before}${data}${after}` : whole
  })
}

async function chooseTarget(name: string, extension: string, label: string) {
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({
    defaultPath: `${name.replace(/\.[^.]+$/, '')}.${extension}`,
    filters: [{ name: label, extensions: [extension] }],
  })
}

export async function exportHtml(source: string, name: string, options: HtmlOptions = {}) {
  if (!isDesktop) return

  const target = await chooseTarget(name, 'html', 'HTML')
  if (!target) return

  let content = await renderDiagrams(buildHtml(source, name, options))
  if (options.resolveImage) content = await inlineImages(content, options.resolveImage)

  await invoke('write_note', { path: target, content })
  return target
}

/** Prints the rendered note. The print dialog is where "Save as PDF" lives. */
export async function exportPdf(source: string, name: string, options: HtmlOptions = {}) {
  // The print frame cannot read the disk, so paths become asset URLs first.
  const built = buildHtml(source, name, options)
  const pointed = options.resolveImage
    ? built.replace(
        /(<img\b[^>]*?\bsrc=")([^"]*)(")/g,
        (whole, before, src: string, after) =>
          /^(data:|https?:|\/\/)/i.test(src) ? whole : `${before}${options.resolveImage!(src)}${after}`,
      )
    : built

  const html = await renderDiagrams(pointed)

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.append(frame)

  const doc = frame.contentDocument
  if (!doc) return

  doc.open()
  doc.write(html)
  doc.close()

  // Give the fonts and any maths a moment before the dialog freezes the page.
  window.setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => frame.remove(), 1000)
  }, 400)
}

export async function pandocAvailable(): Promise<boolean> {
  if (!isDesktop) return false
  return invoke<boolean>('has_pandoc').catch(() => false)
}

/** Reads a Word, ODT, EPUB, RST or similar file in as markdown. */
export async function importDocument(): Promise<{ name: string; markdown: string } | null> {
  if (!isDesktop) return null

  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({
    filters: [
      {
        name: 'Documents',
        extensions: ['docx', 'odt', 'rtf', 'epub', 'rst', 'textile', 'tex', 'html', 'opml', 'org'],
      },
    ],
  })

  if (typeof picked !== 'string') return null

  const markdown = await invoke<string>('import_document', { path: picked })
  const name = picked.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Imported'

  return { name: `${name}.md`, markdown }
}

/** Typora shells out to pandoc for these too; the formats are pandoc's, not ours. */
export async function exportPandoc(source: string, name: string, format: PandocFormat) {
  if (!isDesktop) return

  const spec = PANDOC_FORMATS.find((entry) => entry.id === format)
  if (!spec) return

  const target = await chooseTarget(name, spec.extension, spec.label)
  if (!target) return

  await invoke('run_pandoc', { source, output: target, format })
  return target
}
