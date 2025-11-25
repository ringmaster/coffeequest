<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import GameMenu from './GameMenu.svelte';

	let menuOpen = $state(false);

	function openMenu() {
		menuOpen = true;
	}
</script>

<header class="game-header">
	<div class="stats">
		<span class="stat">
			<strong>M:</strong>
			{gameStore.effectiveStats.might}
			{#if gameStore.statModifiers.might > 0}
				<span class="modifier">+{gameStore.statModifiers.might}</span>
			{/if}
		</span>
		<span class="stat">
			<strong>G:</strong>
			{gameStore.effectiveStats.guile}
			{#if gameStore.statModifiers.guile > 0}
				<span class="modifier">+{gameStore.statModifiers.guile}</span>
			{/if}
		</span>
		<span class="stat">
			<strong>Ma:</strong>
			{gameStore.effectiveStats.magic}
			{#if gameStore.statModifiers.magic > 0}
				<span class="modifier">+{gameStore.statModifiers.magic}</span>
			{/if}
		</span>
	</div>
	<div class="meta">
		<span class="steps">Steps: {gameStore.state.character.stepsCompleted}</span>
		<button class="menu-button" onclick={openMenu} aria-label="Open Menu">
			&#9776;
		</button>
	</div>
</header>

<GameMenu bind:open={menuOpen} />

<style>
	.game-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.stats {
		display: flex;
		gap: 16px;
		font-size: 14px;
	}

	.stat {
		font-family: monospace;
	}

	.modifier {
		color: var(--color-success);
		font-size: 12px;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.steps {
		font-size: 14px;
		color: var(--color-text-secondary);
	}

	.menu-button {
		width: 44px;
		height: 44px;
		font-size: 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}
</style>
