<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';

	let showAll = $state(false);

	const displayedEntries = $derived(
		showAll ? gameStore.state.questLog : gameStore.state.questLog.slice(0, 10)
	);

	const hasMore = $derived(gameStore.state.questLog.length > 10 && !showAll);

	function close() {
		gameStore.toggleQuestLog();
	}

	function showMore() {
		showAll = true;
	}
</script>

{#if gameStore.showQuestLog}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="quest-log-title">
		<div class="quest-log">
			<header>
				<h2 id="quest-log-title">Quest Log</h2>
				<button class="close-button" onclick={close} aria-label="Close Quest Log"> &times; </button>
			</header>

			<div class="entries">
				{#if displayedEntries.length === 0}
					<p class="empty">Your adventure awaits...</p>
				{:else}
					{#each displayedEntries as entry, i (i)}
						<p class="entry">{entry}</p>
					{/each}
				{/if}

				{#if hasMore}
					<button class="show-more" onclick={showMore}> Show More </button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		z-index: 100;
	}

	.quest-log {
		background: var(--color-background);
		border-radius: 12px;
		width: 100%;
		max-width: 400px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid var(--color-border);
	}

	h2 {
		font-size: 20px;
		margin: 0;
	}

	.close-button {
		width: 44px;
		height: 44px;
		font-size: 28px;
		border: none;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.entries {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.empty {
		color: var(--color-text-secondary);
		font-style: italic;
		text-align: center;
	}

	.entry {
		padding: 12px;
		margin-bottom: 8px;
		background: var(--color-surface);
		border-radius: 8px;
		font-size: 14px;
		line-height: 1.5;
	}

	.show-more {
		width: 100%;
		padding: 12px;
		margin-top: 8px;
		font-size: 14px;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}
</style>
