import katex from 'katex/dist/katex.min.css?raw'
import base from './base.css?raw'
import tokens from './tokens.css?raw'
import variants from './variants.css?raw'

/** The stylesheet as text, for baking into an exported document.
 *  Relative `?raw` imports resolve reliably; the same imports made through the
 *  package's exports map from another package come back empty. */
export const themeCss = [tokens, variants, base].join('\n')

/** KaTeX's own stylesheet, so exported maths needs no network. */
export const katexCss = katex
