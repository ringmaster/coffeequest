<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Quest Editor - Coffee Quest</title>
</svelte:head>

<div class="editor-root">
	{@render children()}
</div>

<style>
	.editor-root {
		min-height: 100vh;
		background: var(--color-background);
		display: flex;
		flex-direction: column;
	}

	/* Override mobile-first constraints for editor */
	:global(body) {
		overflow: auto;
	}
</style>
