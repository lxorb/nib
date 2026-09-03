# Nib

A markdown editor. Nothing but markdown.

```
pnpm install
pnpm dev
```

| path | what |
| --- | --- |
| `apps/desktop` | Tauri v2 app (Rust core, Svelte 5 shell) |
| `packages/editor` | CodeMirror 6 live-preview engine |
| `packages/ui` | shared components + motion primitives |
| `packages/themes` | CSS theme system |
| `services/sync` | Cloudflare Worker sync backend |
