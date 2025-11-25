<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Coffee Quest</title>
	<meta name="description" content="A mobile-first adventure game played with your coffee mug" />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		/* Color Palette - Coffee themed */
		--color-background: #f5f1e8;
		--color-surface: #ebe5d8;
		--color-text: #2c1810;
		--color-text-secondary: #5a4a3a;
		--color-button: #6f4e37;
		--color-button-text: #f5f1e8;
		--color-accent: #d4af37;
		--color-border: #d4c8b8;
		--color-success: #2d5016;
		--color-success-bg: #e8f0e0;
		--color-failure: #8b3a3a;
		--color-failure-bg: #f5e8e8;
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(html, body) {
		height: 100%;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Oxygen,
			Ubuntu,
			Cantarell,
			sans-serif;
		font-size: 16px;
		line-height: 1.5;
		background: var(--color-background);
		color: var(--color-text);
	}

	:global(body) {
		min-height: 100dvh;
	}

	:global(button) {
		font-family: inherit;
		touch-action: manipulation;
	}

	:global(button:focus-visible) {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	:global(input:focus-visible) {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
