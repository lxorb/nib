import { frontMatter } from '@nib/markdown'

/** Paper the print dialog understands, in `@page size` spelling. */
export const PAPER_SIZES = ['A3', 'A4', 'A5', 'Letter', 'Legal'] as const

export const ORIENTATIONS = ['portrait', 'landscape'] as const

export type Paper = (typeof PAPER_SIZES)[number]
export type Orientation = (typeof ORIENTATIONS)[number]

export interface PageSetup {
  paper: Paper
  orientation: Orientation
  /** A CSS length, or a plain number read as millimetres. */
  margin: string
  header: string
  footer: string
}

export const DEFAULT_PAGE_SETUP: PageSetup = {
  paper: 'A4',
  orientation: 'portrait',
  margin: '20mm',
  header: '',
  footer: '',
}

/** A note can overrule the app's own settings through its front matter:
 *
 *      ---
 *      export:
 *        paper: Letter
 *        margin: 15mm
 *        footer: ${title}
 *      ---
 */
export function pageSetupFor(source: string, base: PageSetup = DEFAULT_PAGE_SETUP): PageSetup {
  const block = frontMatter(source)
  if (!block) return base

  const lines = block.split('\n')
  const start = lines.findIndex((line) => /^export\s*:\s*$/.test(line))
  if (start < 0) return base

  const setup = { ...base }

  for (const line of lines.slice(start + 1)) {
    // The block ends at the first line that is not indented under it.
    if (!/^\s+\S/.test(line)) break

    const pair = /^\s+([A-Za-z_]+)\s*:\s*(.*)$/.exec(line)
    if (!pair) continue

    const value = pair[2].trim().replace(/^["']|["']$/g, '')
    if (!value) continue

    switch (pair[1].toLowerCase()) {
      case 'paper':
      case 'size': {
        const paper = PAPER_SIZES.find((entry) => entry.toLowerCase() === value.toLowerCase())
        if (paper) setup.paper = paper
        break
      }
      case 'orientation':
        if (value === 'portrait' || value === 'landscape') setup.orientation = value
        break
      case 'margin':
        setup.margin = length(value) ?? setup.margin
        break
      case 'header':
        setup.header = value
        break
      case 'footer':
        setup.footer = value
        break
    }
  }

  return setup
}

/** Accepts `15mm`, `0.5in` or a bare number, and refuses anything else so the
 *  value can go straight into a stylesheet. */
export function length(value: string): string | null {
  const match = /^(\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/.exec(value.trim())
  return match ? `${match[1]}${match[2] ?? 'mm'}` : null
}

/** Running text lands inside a CSS string, so a quote must not be able to close
 *  it and a newline must not be able to break out of the rule. */
function cssString(text: string): string {
  return `"${text.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\r\n]+/g, ' ')}"`
}

/** `${title}` and `${date}` are the only placeholders; page numbers come from
 *  the print dialog, which is the only thing that knows how many there are. */
export function fill(template: string, title: string, date: string): string {
  return template
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{date\}/g, date)
    .replace(/\$\{year\}/g, date.slice(0, 4))
}

/** The print half of an exported page: paper, margins, and running text.
 *  Chromium repeats fixed-position elements on every sheet, which is what
 *  makes a header and footer possible at all. */
export function pageCss(setup: PageSetup, title: string, date: string): string {
  const margin = length(setup.margin) ?? DEFAULT_PAGE_SETUP.margin
  const rules = [`@page { size: ${setup.paper} ${setup.orientation}; margin: ${margin}; }`]

  for (const [role, template] of [
    ['header', setup.header],
    ['footer', setup.footer],
  ] as const) {
    if (!template) continue

    const content = cssString(fill(template, title, date))
    rules.push(`@media print { .nib-running-${role}::after { content: ${content}; } }`)
  }

  return rules.join('\n')
}

/** The markup the running text hangs off. Empty when nothing is configured, so
 *  a plain export stays a plain document. */
export function runningMarkup(setup: PageSetup): string {
  const parts: string[] = []
  if (setup.header) parts.push('<div class="nib-running-header" aria-hidden="true"></div>')
  if (setup.footer) parts.push('<div class="nib-running-footer" aria-hidden="true"></div>')
  return parts.join('\n')
}
