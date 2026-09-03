<script lang="ts">
  import { createEditor, type EditorView } from '@nib/editor'

  let { doc = '', onchange }: { doc?: string; onchange?: (value: string) => void } = $props()

  let host: HTMLDivElement
  let view: EditorView | undefined

  $effect(() => {
    view = createEditor({ parent: host, doc, onChange: onchange })
    return () => view?.destroy()
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
