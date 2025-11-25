<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import { executeSkillCheck, continueAfterSkillCheck } from '$lib/game/engine';
	import type { StatName } from '$lib/types/game';

	function handleRoll() {
		executeSkillCheck();
	}

	function handleContinue() {
		continueAfterSkillCheck();
	}

	const statLabels: Record<StatName, string> = {
		might: 'Might',
		guile: 'Guile',
		magic: 'Magic'
	};
</script>

<div class="skill-check">
	{#if gameStore.phase === 'skill_check_roll'}
		{@const selectedStat = gameStore.pendingSkillCheck?.selectedStat}
		{@const dc = gameStore.pendingSkillCheck?.option.dc}
		<h3>
			Rolling {selectedStat ? statLabels[selectedStat] : ''} Check
		</h3>
		<p class="dc">Target: {dc}</p>
		<button class="roll-button" onclick={handleRoll}> Roll Dice </button>
	{:else if gameStore.phase === 'skill_check_result' && gameStore.skillCheckResult}
		{@const result = gameStore.skillCheckResult}
		{@const selectedStat = gameStore.pendingSkillCheck?.selectedStat}
		<h3>
			{selectedStat ? statLabels[selectedStat] : ''} Check vs DC {result.dc}
		</h3>

		<div class="result-breakdown">
			<div class="result-row">
				<span>Rolled:</span>
				<span class="roll-value">{result.roll}</span>
			</div>
			<div class="result-row">
				<span>{selectedStat ? statLabels[selectedStat] : ''}:</span>
				<span>+{result.statValue}</span>
			</div>
			{#if result.modifier > 0}
				<div class="result-row">
					<span>Bonus:</span>
					<span>+{result.modifier}</span>
				</div>
			{/if}
			<div class="result-row total">
				<span>Total:</span>
				<span>{result.total}</span>
			</div>
		</div>

		<div class="outcome" class:success={result.success} class:failure={!result.success}>
			{result.success ? 'SUCCESS!' : 'FAILURE'}
		</div>

		<button class="continue-button" onclick={handleContinue}> Continue </button>
	{/if}
</div>

<style>
	.skill-check {
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	h3 {
		font-size: 20px;
		margin-bottom: 24px;
	}

	.dc {
		font-size: 24px;
		margin-bottom: 24px;
		color: var(--color-text-secondary);
	}

	.roll-button {
		padding: 20px 48px;
		font-size: 20px;
		font-weight: 600;
		border: none;
		border-radius: 12px;
		background: var(--color-accent);
		color: white;
		cursor: pointer;
	}

	.result-breakdown {
		width: 100%;
		max-width: 200px;
		margin-bottom: 24px;
	}

	.result-row {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		font-size: 18px;
	}

	.result-row.total {
		border-top: 2px solid var(--color-border);
		font-weight: bold;
		margin-top: 8px;
		padding-top: 12px;
	}

	.roll-value {
		font-size: 24px;
		font-weight: bold;
	}

	.outcome {
		font-size: 28px;
		font-weight: bold;
		margin-bottom: 24px;
		padding: 16px 32px;
		border-radius: 8px;
	}

	.outcome.success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.outcome.failure {
		background: var(--color-failure-bg);
		color: var(--color-failure);
	}

	.continue-button {
		width: 100%;
		padding: 16px;
		font-size: 18px;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		background: var(--color-button);
		color: var(--color-button-text);
		cursor: pointer;
	}
</style>
