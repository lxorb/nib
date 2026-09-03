<script lang="ts">
  let { doc = '' }: { doc?: string } = $props()

  // Reading speed of 200 wpm, the figure Typora uses.
  const counts = $derived.by(() => {
    const words = doc.trim() ? doc.trim().split(/\s+/).length : 0
    return {
      words,
      characters: doc.length,
      lines: doc ? doc.split('\n').length : 0,
      minutes: Math.max(1, Math.round(words / 200)),
    }
  })
</script>

<footer>
  <span>{counts.words.toLocaleString()}w</span>
  <span>{counts.characters.toLocaleString()}c</span>
  <span>{counts.lines.toLocaleString()}l</span>
  <span>{counts.minutes}m</span>
</footer>

<style>
  /* Numbers only, and only when looked for. */
  footer {
    flex: none;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: 3px var(--space-4);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--muted);
    opacity: 0;
    transition: opacity var(--dur-slow) var(--ease-out);
    user-select: none;
  }

  footer:hover {
    opacity: 1;
  }
</style>
