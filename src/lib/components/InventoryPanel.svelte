<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';

	let { open = $bindable(false) } = $props();

	function formatItemName(item: string): string {
		return item
			.replace(/_/g, ' ')
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function close() {
		open = false;
	}
</script>

{#if open}
	<div class="overlay" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="button" tabindex="0">
		<div class="panel" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" aria-label="Inventory" tabindex="-1">
			<header>
				<h2>Inventory</h2>
				<button class="close-button" onclick={close} aria-label="Close inventory">&times;</button>
			</header>
			<div class="content">
				{#if gameStore.inventoryItems.length === 0}
					<p class="empty">Your pack is empty.</p>
				{:else}
					<ul class="item-list">
						{#each gameStore.inventoryItems as { item, count }}
							<li class="item">
								<span class="item-name">{formatItemName(item)}</span>
								{#if count > 1}
									<span class="item-count">&times;{count}</span>
								{/if}
							</li>
						{/each}
					</ul>
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
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.panel {
		background: var(--color-surface);
		border-radius: 12px;
		width: 90%;
		max-width: 400px;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		border-bottom: 1px solid var(--color-border);
	}

	h2 {
		margin: 0;
		font-size: 18px;
		color: var(--color-text);
	}

	.close-button {
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 6px;
		background: var(--color-button);
		color: var(--color-button-text);
		font-size: 20px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.content {
		padding: 16px;
		overflow-y: auto;
	}

	.empty {
		color: var(--color-text-secondary);
		text-align: center;
		font-style: italic;
	}

	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		border-radius: 6px;
		background: var(--color-background);
		margin-bottom: 8px;
	}

	.item:last-child {
		margin-bottom: 0;
	}

	.item-name {
		color: var(--color-text);
		font-weight: 500;
	}

	.item-count {
		color: var(--color-text-secondary);
		font-family: monospace;
		font-size: 14px;
	}
</style>
