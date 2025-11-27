<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import { completeLevelUp } from '$lib/game/engine';
	import type { StatName } from '$lib/types/game';

	function selectStat(stat: StatName) {
		completeLevelUp(stat);
	}
</script>

<div class="level-up">
	<div class="level-up-header">
		<h2>Level Up!</h2>
		<p class="level-display">You are now Level {gameStore.level}</p>
	</div>

	<p class="prompt">Choose a stat to increase:</p>

	<div class="stat-choices">
		<button class="stat-button" onclick={() => selectStat('might')}>
			<span class="stat-name">Might</span>
			<span class="stat-value">{gameStore.state.character.might} &rarr; {gameStore.state.character.might + (gameStore.config?.statIncreaseAmount ?? 1)}</span>
		</button>

		<button class="stat-button" onclick={() => selectStat('guile')}>
			<span class="stat-name">Guile</span>
			<span class="stat-value">{gameStore.state.character.guile} &rarr; {gameStore.state.character.guile + (gameStore.config?.statIncreaseAmount ?? 1)}</span>
		</button>

		<button class="stat-button" onclick={() => selectStat('magic')}>
			<span class="stat-name">Magic</span>
			<span class="stat-value">{gameStore.state.character.magic} &rarr; {gameStore.state.character.magic + (gameStore.config?.statIncreaseAmount ?? 1)}</span>
		</button>
	</div>
</div>

<style>
	.level-up {
		padding: 24px 16px;
		text-align: center;
	}

	.level-up-header {
		margin-bottom: 24px;
	}

	h2 {
		margin: 0 0 8px 0;
		font-size: 28px;
		color: var(--color-success, #4caf50);
	}

	.level-display {
		margin: 0;
		font-size: 18px;
		color: var(--color-text);
	}

	.prompt {
		margin: 0 0 16px 0;
		font-size: 16px;
		color: var(--color-text-secondary);
	}

	.stat-choices {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 300px;
		margin: 0 auto;
	}

	.stat-button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border: 2px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 16px;
		cursor: pointer;
		transition: border-color 0.2s, background-color 0.2s;
	}

	.stat-button:hover {
		border-color: var(--color-primary, #4a90d9);
		background: var(--color-background);
	}

	.stat-button:active {
		transform: scale(0.98);
	}

	.stat-name {
		font-weight: bold;
	}

	.stat-value {
		font-family: monospace;
		color: var(--color-text-secondary);
	}
</style>
