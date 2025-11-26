<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import { selectOption } from '$lib/game/engine';
	import type { StepOption, StatName } from '$lib/types/game';

	function handleOption(option: StepOption) {
		selectOption(option);
	}

	function returnToNavigation() {
		gameStore.currentDisplayStep = null;
		gameStore.availableOptions = [];
		gameStore.state.currentStepId = null;
		gameStore.phase = 'navigation';
		gameStore.save();
	}

	function getDifficulty(skill: StatName, dc: number): string {
		const statValue = gameStore.effectiveStats[skill];
		const rollNeeded = dc - statValue;

		if (rollNeeded <= 1) return 'easy';
		if (rollNeeded <= 2) return 'easy';
		if (rollNeeded <= 3) return 'basic';
		if (rollNeeded <= 4) return 'hard';
		if (rollNeeded <= 6) return 'challenging';
		return 'impossible';
	}
</script>

<div class="step-display">
	{#if gameStore.currentDisplayStep}
		<div class="step-text">
			<p>{gameStore.currentDisplayStep.text}</p>
		</div>

		<div class="options">
			{#each gameStore.availableOptions as option (option.label)}
				<button class="option-button" onclick={() => handleOption(option)}>
					{option.label}
					{#if option.skill && option.dc !== undefined}
						<span class="skill-indicator"
							>[{option.skill.toUpperCase()} - {getDifficulty(option.skill, option.dc)}]</span
						>
					{/if}
				</button>
			{/each}

			{#if gameStore.availableOptions.length === 0}
				<button class="option-button" onclick={returnToNavigation}> Continue exploring </button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.step-display {
		padding: 16px;
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.step-text {
		flex: 1;
		padding: 16px;
		background: var(--color-surface);
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.step-text p {
		font-size: 18px;
		line-height: 1.6;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.option-button {
		width: 100%;
		padding: 16px;
		font-size: 16px;
		text-align: left;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}

	.option-button:active {
		opacity: 0.9;
	}

	.skill-indicator {
		display: block;
		margin-top: 4px;
		font-size: 14px;
		opacity: 0.9;
	}
</style>
