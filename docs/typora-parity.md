# Typora parity checklist

Every feature Typora ships, tracked to done. Sourced from Typora's own docs
(Markdown Reference, How-Tos index, Shortcut Keys, Export, File Management,
Draw Diagrams, release notes through 1.14).

Legend: `[ ]` todo · `[~]` partial · `[x]` done · `[-]` deliberately skipped

## 1. Block elements

- [ ] Paragraphs (blank-line separated)
- [ ] Line break with `Shift+Enter`
- [ ] Line break via two trailing spaces
- [ ] Line break via `<br/>`
- [ ] Headings `#` … `######`
- [ ] Setext headings (`===`, `---` underlines)
- [ ] Blockquotes `>`, arbitrarily nested
- [ ] Unordered lists (`*`, `+`, `-`)
- [ ] Ordered lists (`1.`), custom start numbers
- [ ] Nested lists, indent/outdent with `Tab` / `Shift+Tab`
- [ ] Loose vs tight list rendering
- [ ] Task lists `- [ ]` / `- [x]`, clickable checkboxes
- [ ] Fenced code blocks with language identifier
- [ ] Indented code blocks
- [ ] Math blocks `$$`
- [ ] Tables with alignment (`:---`, `:---:`, `---:`)
- [ ] Footnote definitions `[^id]:`
- [ ] Horizontal rules (`***`, `---`, `___`)
- [ ] YAML front matter
- [ ] Table of contents `[toc]`
- [ ] GitHub-style alerts / callouts (`> [!NOTE]` …)
- [ ] Page breaks for export
- [ ] Definition lists (Pandoc)
- [ ] Abbreviations (Pandoc)

## 2. Span elements

- [ ] Inline links `[text](url "title")`
- [ ] Reference links `[text][id]` + `[id]: url`
- [ ] Shortcut reference links `[text][]`
- [ ] Internal heading links `[text](#heading)`
- [ ] Autolinks `<url>` and bare `www.` / `http(s)://`
- [ ] Images `![alt](path "title")`
- [ ] Emphasis `*` / `_`
- [ ] Strong `**` / `__`
- [ ] Combined strong + emphasis
- [ ] Inline code with backtick runs
- [ ] Strikethrough `~~`
- [ ] Escaping with `\`
- [ ] Emoji shortcodes `:smile:` with autocomplete
- [ ] Inline math `$…$` (toggle)
- [ ] Subscript `H~2~O` (toggle)
- [ ] Superscript `X^2^` (toggle)
- [ ] Highlight `==text==` (toggle)
- [ ] Underline via `<u>`
- [ ] Smart punctuation (curly quotes, em/en dashes, ellipsis)

## 3. HTML support

- [ ] Inline HTML spans with styles
- [ ] Block-level HTML passthrough
- [ ] `<iframe>` embeds
- [ ] `<video>` / `<audio>` embeds with relative paths
- [ ] `<track>` elements honouring relative path settings
- [ ] HTML escaping in image attributes (XSS-safe)
- [ ] HTML preserved through PDF/print export

## 4. Math and academic

- [ ] MathJax v4 rendering
- [ ] Line breaks in equations via `\\`
- [ ] TeX packages incl. `begingroup`, `bboldx`
- [ ] Text-mode macros, accents, special symbols
- [ ] Chemical equations (mhchem)
- [ ] Auto-numbering for equations
- [ ] Cross references to numbered equations
- [ ] Auto-numbering for headings (CSS counters)
- [ ] Footnote rendering + back-links

## 5. Diagrams

- [ ] ` ```mermaid ` — flowchart, sequence, gantt, class, state, pie,
      requirement, gitGraph, C4, mindmap, timeline, quadrant, sankey,
      ZenUML, XY chart, Venn, Ishikawa
- [ ] ` ```sequence ` (js-sequence legacy)
- [ ] ` ```flow ` (flowchart.js legacy)
- [ ] Mermaid syntax highlighting inside the fence
- [ ] Diagram export in PDF/HTML/image

## 6. Code fences

- [ ] Syntax highlighting for ~100 languages
- [ ] Language selector on the fence
- [ ] Line numbers (toggle)
- [ ] Code block themes independent of app theme
- [ ] Copy button
- [ ] Auto-pair brackets and quotes inside fences
- [ ] Tab/indent behaviour inside fences

## 7. Tables

- [ ] Insert via `Ctrl+T` with row/column prompt
- [ ] Resize columns by dragging
- [ ] Reorder rows and columns
- [ ] Insert/delete row and column
- [ ] Per-column alignment controls
- [ ] Keyboard navigation (`Tab`, arrows)
- [ ] `Ctrl+E` select cell, `Ctrl+Shift+Backspace` delete row
- [ ] Paste TSV/CSV as a table
- [ ] Columns sized to content

## 8. Images

- [ ] Drag-and-drop insertion
- [ ] Paste from clipboard, persisted to an assets folder
- [ ] Relative and absolute paths
- [ ] `typora-root-url` front matter
- [ ] Copy-image-to-folder rules per document
- [ ] Resize handles / width attributes
- [ ] Zoom / preview on click
- [ ] Custom image uploader integration
- [ ] UNC path handling on Windows

## 9. File management

- [ ] Open file, open folder
- [ ] File tree panel
- [ ] Articles (flat file list) panel
- [ ] Outline panel
- [ ] Create, rename, duplicate, delete files and folders
- [ ] Drag to move
- [ ] Reveal in Explorer / Finder
- [ ] Copy file path
- [ ] Sort by name, modified, created, natural order; asc/desc
- [ ] Group by folder toggle
- [ ] Show hidden files toggle (1.14)
- [ ] Configure which file types display (1.14)
- [ ] Keyboard navigation in the file tree (1.14)
- [ ] Recent files and folders
- [ ] Pin folders
- [ ] Default launch folder
- [ ] Reopen last file on start
- [ ] Undo move/rename/delete
- [ ] Tabs, `Ctrl+Tab` switching, reopen closed tab
- [ ] Auto-save
- [ ] Version history and recovery

## 10. Search

- [ ] Find `Ctrl+F`, find next/previous
- [ ] Replace `Ctrl+H`, replace all
- [ ] Regex and case-sensitive toggles
- [ ] Global search across folder `Ctrl+Shift+F`
- [ ] `#tag` search
- [ ] Open Quickly / fuzzy file finder `Ctrl+P`
- [ ] Add custom search service

## 11. Editing modes and view

- [ ] Source code mode `Ctrl+/`
- [ ] Focus mode `F8`
- [ ] Typewriter mode `F9`
- [ ] Fullscreen `F11`
- [ ] Zoom in/out/reset
- [ ] Toggle sidebar `Ctrl+Shift+L`
- [ ] Outline `Ctrl+Shift+1`, Articles `Ctrl+Shift+2`, File tree `Ctrl+Shift+3`
- [ ] Floating editor toolbar (1.14)
- [ ] Context menu for setting styles
- [ ] Scroll position preserved when switching modes
- [ ] Word count (words, characters, lines, reading time)
- [ ] Writing area width control
- [ ] Line and paragraph spacing controls
- [ ] RTL support

## 12. Editing behaviour

- [ ] Auto-pair brackets, quotes, markdown symbols
- [ ] Smart punctuation
- [ ] Strict mode (stricter CommonMark parsing)
- [ ] Text snippets
- [ ] Copy as Markdown `Ctrl+Shift+C`
- [ ] Paste as plain text `Ctrl+Shift+V`
- [ ] Copy as plain text (context menu)
- [ ] Select word `Ctrl+D`, delete word `Ctrl+Shift+D`
- [ ] Select line/sentence `Ctrl+L`
- [ ] Jump to top/bottom/selection
- [ ] Delete range
- [ ] Convert and reformat markdown
- [ ] Whitespace and line break handling options
- [ ] Spellcheck with dictionaries
- [ ] Clear formatting `Ctrl+\`
- [ ] Change list type via shortcut/context menu

## 13. Themes and appearance

- [ ] CSS theme files loaded from a themes folder
- [ ] Theme switching without restart
- [ ] Dark mode + light mode
- [ ] Follow system appearance
- [ ] Custom CSS injection
- [ ] Custom fonts
- [ ] Custom background
- [ ] Change styles in focus mode
- [ ] Code block themes
- [ ] Typora CSS variable compatibility (`--bg-color`, `--md-char-color`, …)
- [ ] `#write` container contract
- [ ] Theme debugging via devtools
- [ ] Custom list styles

## 14. Export

- [ ] PDF (paper size, margins, headers/footers, page breaks, metadata)
- [ ] HTML with styles
- [ ] HTML without styles
- [ ] Image export (width, font size, quality)
- [ ] Word `.docx` (pandoc)
- [ ] OpenOffice `.odt` (pandoc)
- [ ] RTF (pandoc)
- [ ] EPUB with cover, metadata, chapter level (pandoc)
- [ ] LaTeX (pandoc)
- [ ] MediaWiki (pandoc)
- [ ] reStructuredText (pandoc)
- [ ] Textile (pandoc)
- [ ] OPML (pandoc)
- [ ] RevealJS presentation (pandoc)
- [ ] Other markdown flavours with wrap/width/indent options
- [ ] PDF via LaTeX engines (pdflatex, xelatex, tectonic, …)
- [ ] Custom pandoc export profiles
- [ ] Custom command export with variable substitution
- [ ] Default export folder, post-export behaviour
- [ ] Per-file export config in YAML front matter
- [ ] Print

## 15. Import

- [ ] Import via pandoc (docx, odt, rst, textile, epub, …)

## 16. System integration

- [ ] Open from shell / CLI with arguments
- [ ] Launch options and flags
- [ ] "New Markdown" in Explorer context menu
- [ ] File association for `.md`
- [ ] Windows JumpList
- [ ] Multiple windows `Ctrl+Shift+N`
- [ ] Application logs
- [ ] Advanced settings file
- [ ] UI translations
- [ ] Auto-update

## 17. Beyond Typora

Features Typora does not have, which are the reason this exists.

- [ ] Accounts and cloud sync
- [ ] Spaces, each with a folder/note hierarchy
- [ ] Offline-first with conflict-free merge
- [ ] MCP server exposing notes to any LLM client
- [ ] Command palette
- [ ] Motion system across the whole interface
