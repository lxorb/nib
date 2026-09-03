# Typora parity checklist

Every feature Typora ships, tracked to done. Sourced from Typora's own docs
(Markdown Reference, How-Tos index, Shortcut Keys, Export, File Management,
Draw Diagrams, release notes through 1.14).

Legend: `[x]` done · `[~]` partial · `[ ]` todo · `[-]` deliberately skipped

## 1. Block elements

- [x] Paragraphs (blank-line separated)
- [x] Line break with `Shift+Enter`
- [x] Line break via two trailing spaces
- [x] Line break via `<br/>`
- [x] Headings `#` … `######`
- [x] Setext headings (`===`, `---` underlines)
- [x] Blockquotes `>`, arbitrarily nested
- [x] Unordered lists (`*`, `+`, `-`)
- [x] Ordered lists (`1.`), custom start numbers
- [x] Nested lists, indent/outdent with `Tab` / `Shift+Tab`
- [x] Loose vs tight list rendering
- [x] Task lists `- [ ]` / `- [x]`, clickable checkboxes
- [x] Fenced code blocks with language identifier
- [x] Indented code blocks
- [x] Math blocks `$$`
- [x] Tables with alignment (`:---`, `:---:`, `---:`)
- [x] Footnote definitions `[^id]:`
- [x] Horizontal rules (`***`, `---`, `___`)
- [x] YAML front matter
- [x] Table of contents `[toc]`
- [x] GitHub-style alerts / callouts (`> [!NOTE]` …)
- [ ] Page breaks for export
- [ ] Definition lists (Pandoc)
- [ ] Abbreviations (Pandoc)

## 2. Span elements

- [x] Inline links `[text](url "title")`
- [x] Reference links `[text][id]` + `[id]: url`
- [x] Shortcut reference links `[text][]`
- [x] Internal heading links `[text](#heading)`
- [x] Autolinks `<url>` and bare `www.` / `http(s)://`
- [x] Images `![alt](path "title")`
- [x] Emphasis `*` / `_`
- [x] Strong `**` / `__`
- [x] Combined strong + emphasis
- [x] Inline code with backtick runs
- [x] Strikethrough `~~`
- [x] Escaping with `\`
- [~] Emoji shortcodes `:smile:` — parsed, not yet rendered or autocompleted
- [x] Inline math `$…$`
- [x] Subscript `H~2~O`
- [x] Superscript `X^2^`
- [x] Highlight `==text==`
- [x] Underline via `<u>`
- [x] Smart punctuation (curly quotes, en/em dashes, ellipsis)

## 3. HTML support

- [x] Inline HTML spans with styles
- [x] Block-level HTML passthrough
- [x] `<iframe>` embeds
- [x] `<video>` / `<audio>` embeds with relative paths
- [x] HTML escaping in image attributes (XSS-safe)
- [x] HTML preserved through export
- [x] HTML escaped when publishing (blogs share a domain)

## 4. Math and academic

- [x] KaTeX rendering, inline and block
- [x] Auto-numbering for headings (CSS counters, toggleable)
- [x] Footnote rendering + back-links
- [ ] Auto-numbering for equations
- [ ] Cross references to numbered equations
- [ ] Chemical equations (mhchem)

## 5. Diagrams

- [x] ` ```mermaid ` — every Mermaid type, lazily loaded
- [x] Diagram export in HTML/PDF
- [ ] ` ```sequence ` (js-sequence legacy)
- [ ] ` ```flow ` (flowchart.js legacy)
- [ ] Mermaid syntax highlighting inside the fence

## 6. Code fences

- [x] Syntax highlighting for ~150 languages
- [x] Auto-pair brackets and quotes
- [x] Tab/indent behaviour inside fences
- [ ] Language selector on the fence
- [ ] Line numbers (toggle)
- [ ] Copy button
- [ ] Code block themes independent of app theme

## 7. Tables

- [x] Insert via `Ctrl+T`
- [x] Editable cells, written straight back as pipe-aligned markdown
- [x] Reorder rows and columns
- [x] Insert/delete row and column
- [x] Per-column alignment controls
- [x] Keyboard navigation (`Tab`, `Enter`)
- [x] Columns sized to content, CJK-aware
- [ ] Resize columns by dragging
- [ ] Paste TSV/CSV as a table

## 8. Images

- [x] Drag-and-drop insertion
- [x] Paste from clipboard, persisted to an `assets/` folder
- [x] Relative and absolute paths
- [x] Rendered inline in the editor
- [ ] `typora-root-url` front matter
- [ ] Resize handles / width attributes
- [ ] Zoom / preview on click
- [ ] Custom image uploader integration

## 9. File management

- [x] Open folder as a space
- [x] File tree panel
- [x] Articles (flat file list) panel
- [x] Outline panel
- [x] Create, rename, duplicate, delete files and folders
- [x] Reveal in Explorer / Finder
- [x] Copy file path
- [x] Tabs, `Ctrl+Tab` switching
- [x] Reopen last files on start
- [ ] Drag to move
- [ ] Sort by name, modified, created
- [ ] Show hidden files toggle
- [ ] Recent files and folders, pinning
- [ ] Undo move/rename/delete
- [ ] Auto-save
- [ ] Version history and recovery

## 10. Search

- [x] Find `Ctrl+F`, find next/previous
- [x] Replace `Ctrl+H`, replace all
- [x] Regex and case-sensitive toggles
- [x] Quick open / fuzzy finder `Ctrl+P`
- [ ] Global search across the space `Ctrl+Shift+F`
- [ ] `#tag` search

## 11. Editing modes and view

- [x] Source code mode `Ctrl+/`
- [x] Focus mode `F8`
- [x] Typewriter mode `F9`
- [x] Fullscreen `F11`
- [x] Zoom in/out/reset
- [x] Toggle sidebar `Ctrl+Shift+L`
- [x] Outline / Articles / File tree panels
- [x] Word count (words, characters, lines, reading time)
- [x] Custom context menus everywhere
- [ ] Floating editor toolbar
- [ ] Writing area width control
- [ ] Line and paragraph spacing controls
- [ ] RTL support

## 12. Editing behaviour

- [x] Auto-pair brackets, quotes, markdown symbols
- [x] Smart punctuation, toggleable
- [x] Select word `Ctrl+D`, select line `Ctrl+L`
- [x] Clear formatting `Ctrl+\`
- [x] Change list type via shortcut and context menu
- [x] Spellcheck (native, in the editor)
- [x] Every shortcut from Typora's table
- [ ] Copy as Markdown / paste as plain text
- [ ] Strict mode
- [ ] Text snippets
- [ ] Convert and reformat markdown

## 13. Themes and appearance

- [x] CSS theme files loaded from a themes folder
- [x] Theme switching without restart
- [x] Dark mode + light mode
- [x] Follows system appearance on first run
- [x] Four built-in themes
- [x] Typora CSS variable compatibility (`--bg-color`, `--md-char-color`, …)
- [x] `#write` container contract
- [x] Custom fonts (via a theme)
- [ ] Custom CSS injection separate from themes
- [ ] Code block themes

## 14. Export

- [x] PDF (through the print dialog)
- [x] HTML with styles, fully self-contained
- [x] HTML without styles
- [x] Word `.docx` (pandoc)
- [x] OpenOffice `.odt` (pandoc)
- [x] RTF (pandoc)
- [x] EPUB (pandoc)
- [x] LaTeX (pandoc)
- [x] MediaWiki (pandoc)
- [x] reStructuredText (pandoc)
- [x] Textile (pandoc)
- [x] OPML (pandoc)
- [x] RevealJS presentation (pandoc)
- [x] Print styles
- [ ] Image export
- [ ] Export settings (paper size, margins, headers/footers)
- [ ] Per-file export config in YAML front matter

## 15. Import

- [ ] Import via pandoc (docx, odt, rst, textile, epub, …)

## 16. System integration

- [x] Multiple windows
- [ ] Open from shell / CLI with arguments
- [ ] "New Markdown" in Explorer context menu
- [ ] File association for `.md`
- [ ] Windows JumpList
- [ ] Application logs
- [ ] UI translations
- [ ] Auto-update

## 17. Beyond Typora

Features Typora does not have, which are the reason this exists.

- [x] Accounts, passwordless email sign-in
- [x] Spaces, each a folder of markdown
- [x] Cloud sync, offline-first, conflict-preserving
- [x] Publish a space as a blog, on a subdomain or your own domain
- [x] MCP server exposing notes to any LLM client
- [x] Command palette
- [x] Motion system across the whole interface
