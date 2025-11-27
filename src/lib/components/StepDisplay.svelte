<script lang="ts">
	import { gameStore } from '$lib/stores/gameState.svelte';
	import { selectOption, isOptionAvailable, calculateSkillBonus, isStatName } from '$lib/game/engine';
	import type { StepOption, StatName, SkillSource } from '$lib/types/game';

	function handleOption(option: StepOption) {
		if (isOptionAvailable(option)) {
			selectOption(option);
		}
	}

	function returnToNavigation() {
		gameStore.currentDisplayStep = null;
		gameStore.availableOptions = [];
		gameStore.state.currentStepId = null;
		gameStore.phase = 'navigation';
		gameStore.save();
	}

	const statLabels: Record<StatName, string> = {
		might: 'MIGHT',
		guile: 'GUILE',
		magic: 'MAGIC'
	};

	/**
	 * Format skill sources for display in the skill indicator
	 */
	function formatSkillIndicator(skill: SkillSource | SkillSource[]): string {
		const sources = Array.isArray(skill) ? skill : [skill];
		return sources.map(s => isStatName(s) ? statLabels[s] : s.toUpperCase()).join('+');
	}

	/**
	 * Get difficulty label based on roll needed to succeed
	 */
	function getDifficulty(skill: SkillSource | SkillSource[], dc: number): string {
		const bonus = calculateSkillBonus(skill);
		const rollNeeded = dc - bonus;

		if (rollNeeded <= 1) return 'easy';
		if (rollNeeded <= 2) return 'easy';
		if (rollNeeded <= 3) return 'basic';
		if (rollNeeded <= 4) return 'hard';
		if (rollNeeded <= 6) return 'challenging';
		return 'impossible';
	}

	/**
	 * Check if an option should be visible to the player.
	 * Hidden options only appear if the player has qualifying tags.
	 * Non-hidden options always appear (but may be dimmed/disabled).
	 */
	function isOptionVisible(option: StepOption): boolean {
		if (!option.hidden) {
			return true;
		}
		// Hidden options only show if player qualifies
		return isOptionAvailable(option);
	}

	/**
	 * Deduplicate options with the same label, keeping the best one.
	 * Priority: available options first, then by order in array.
	 * Hidden options that don't qualify are excluded entirely.
	 */
	function deduplicateOptions(options: StepOption[]): StepOption[] {
		const byLabel = new Map<string, StepOption[]>();

		// Group options by label
		for (const opt of options) {
			const existing = byLabel.get(opt.label) || [];
			existing.push(opt);
			byLabel.set(opt.label, existing);
		}

		// For each label, pick the best option
		const result: StepOption[] = [];
		for (const [, candidates] of byLabel) {
			// Filter to visible options only
			const visible = candidates.filter(isOptionVisible);
			if (visible.length === 0) continue;

			// Prefer available options, otherwise take first visible
			const available = visible.find((opt) => isOptionAvailable(opt));
			result.push(available ?? visible[0]);
		}

		// Maintain original order based on first occurrence of each label
		const labelOrder = new Map<string, number>();
		options.forEach((opt, i) => {
			if (!labelOrder.has(opt.label)) {
				labelOrder.set(opt.label, i);
			}
		});

		return result.sort((a, b) => (labelOrder.get(a.label) ?? 0) - (labelOrder.get(b.label) ?? 0));
	}

	// Filter and deduplicate options
	const visibleOptions = $derived(deduplicateOptions(gameStore.availableOptions));

	// Check if any visible options are available (for showing "Continue exploring" button)
	const hasAvailableOptions = $derived(
		visibleOptions.some((opt) => isOptionAvailable(opt))
	);
</script>

<div class="step-display">
	{#if gameStore.currentDisplayStep}
		<div class="step-text">
			<p>{gameStore.currentDisplayStep.text}</p>
		</div>

		<div class="options">
			{#each visibleOptions as option, i (i)}
				{@const available = isOptionAvailable(option)}
				<button
					class="option-button"
					class:unavailable={!available}
					onclick={() => handleOption(option)}
					disabled={!available}
				>
					{option.label}
					{#if option.skill && option.dc !== undefined}
						<span class="skill-indicator"
							>[{formatSkillIndicator(option.skill)} - {getDifficulty(option.skill, option.dc)}]</span
						>
					{/if}
				</button>
			{/each}

			{#if !hasAvailableOptions}
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

	.option-button:active:not(:disabled) {
		opacity: 0.9;
	}

	.option-button.unavailable {
		background: var(--color-surface);
		color: var(--color-text-secondary);
		opacity: 0.6;
		cursor: not-allowed;
	}

	.skill-indicator {
		display: block;
		margin-top: 4px;
		font-size: 14px;
		opacity: 0.9;
	}
</style>
