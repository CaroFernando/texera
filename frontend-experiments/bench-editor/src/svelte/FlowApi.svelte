<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";

  // Rendered inside <SvelteFlow>, where the flow context exists; hands its helpers up.
  let { onApi }: { onApi: (api: ReturnType<typeof useSvelteFlow>) => void } = $props();
  onApi(useSvelteFlow());
</script>
