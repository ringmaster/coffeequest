<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';

	let { open = $bindable(false) } = $props();
	let showConfirmReset = $state(false);

	function viewQuestLog() {
		open = false;
		gameStore.showQuestLog = true;
	}

	function promptReset() {
		showConfirmReset = true;
	}

	function confirmReset() {
		gameStore.clearSave();
		open = false;
		showConfirmReset = false;
	}

	function cancelReset() {
		showConfirmReset = false;
	}

	function closeMenu() {
		open = false;
		showConfirmReset = false;
	}
</script>

{#if open}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="menu-title">
		<div class="menu">
			{#if showConfirmReset}
				<header>
					<h2 id="menu-title">Reset Game?</h2>
				</header>
				<div class="confirm-content">
					<p>This will erase all progress, including your character and quest log.</p>
					<div class="confirm-buttons">
						<button class="cancel-button" onclick={cancelReset}>Cancel</button>
						<button class="danger-button" onclick={confirmReset}>Reset Game</button>
					</div>
				</div>
			{:else}
				<header>
					<h2 id="menu-title">Menu</h2>
					<button class="close-button" onclick={closeMenu} aria-label="Close Menu">
						&times;
					</button>
				</header>
				<nav class="menu-options">
					<button class="menu-item" onclick={viewQuestLog}>View Quest Log</button>
					<button class="menu-item danger" onclick={promptReset}>Reset Game</button>
				</nav>
			{/if}
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

	.menu {
		background: var(--color-background);
		border-radius: 12px;
		width: 100%;
		max-width: 320px;
		overflow: hidden;
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

	.menu-options {
		display: flex;
		flex-direction: column;
	}

	.menu-item {
		width: 100%;
		padding: 16px;
		font-size: 16px;
		text-align: left;
		border: none;
		background: transparent;
		color: var(--color-text);
		cursor: pointer;
		border-bottom: 1px solid var(--color-border);
	}

	.menu-item:last-child {
		border-bottom: none;
	}

	.menu-item:active {
		background: var(--color-surface);
	}

	.menu-item.danger {
		color: var(--color-failure);
	}

	.confirm-content {
		padding: 16px;
	}

	.confirm-content p {
		margin-bottom: 20px;
		line-height: 1.5;
	}

	.confirm-buttons {
		display: flex;
		gap: 12px;
	}

	.cancel-button,
	.danger-button {
		flex: 1;
		padding: 12px 16px;
		font-size: 16px;
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}

	.cancel-button {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.danger-button {
		background: var(--color-failure);
		color: white;
	}
</style>
