<script lang="ts">
  import { untrack } from 'svelte'
  import { createEditor, type EditorView } from '@nib/editor'

  let { doc = '', onchange }: { doc?: string; onchange?: (value: string) => void } = $props()

  let host: HTMLDivElement
  let view = $state<EditorView | undefined>()

  // Built once. Reading `doc` reactively here would tear the editor down and
  // rebuild it on every keystroke, losing the caret each time.
  $effect(() => {
    const created = createEditor({ parent: host, doc: untrack(() => doc), onChange: onchange })
    view = created
    if (import.meta.env.DEV) Object.assign(window, { nib: created })
    return () => created.destroy()
  })

  // Pushes externally loaded documents in without recreating the view.
  $effect(() => {
    const incoming = doc
    if (!view) return

    const current = view.state.doc.toString()
    if (incoming === current) return

    view.dispatch({ changes: { from: 0, to: current.length, insert: incoming } })
  })
</script>

<div class="surface" bind:this={host}></div>

<style>
  .surface {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    animation: rise var(--dur-slower) var(--ease-out);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
